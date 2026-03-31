import { access, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  BUILD_INPUT_PATHS,
  BUILD_CACHE_REASONS,
  createBuildStamp,
  determineBuildAction,
  getCommitHashFromBuildStamp
} from "./one-click-build-cache.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? "8080");
const baseUrl = `http://127.0.0.1:${port}`;
const healthUrl = `${baseUrl}/health`;

async function main() {
  process.chdir(projectRoot);

  await assertCommand("node", ["--version"], "Node.js fehlt. Bitte Node.js 20+ installieren.");
  await assertCommand("az", ["--version"], "Azure CLI fehlt. Bitte Azure CLI installieren.");

  await ensureAzureDevOpsExtension();
  await ensureAzureLogin();
  await ensureDependenciesInstalled();
  await ensureBuildArtifacts();

  if (await isServerHealthy()) {
    log(`Server läuft bereits auf ${baseUrl}. Öffne Browser...`);
    await openBrowser(baseUrl);
    return;
  }

  log("Starte lokalen Server...");
  const server = spawn(process.execPath, ["dist/src/app/bootstrap/local-server.js"], {
    stdio: "inherit",
    env: process.env,
    cwd: projectRoot
  });

  const shutdown = () => {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const healthy = await waitForServer(25000);
  if (healthy) {
    log(`Server bereit auf ${baseUrl}. Öffne Browser...`);
    await openBrowser(baseUrl);
  } else {
    warn("Server-Healthcheck hat nicht rechtzeitig geantwortet. Browser wird trotzdem geöffnet.");
    await openBrowser(baseUrl);
  }

  await new Promise((resolve, reject) => {
    server.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
        return;
      }
      reject(new Error(`Server wurde mit Exit-Code ${code} beendet.`));
    });
    server.on("error", reject);
  });
}

// --------------------------------------------------
// Hilfsfunktionen
// --------------------------------------------------

async function assertCommand(command, args, errorMessage) {
  await run(command, args, { stdio: "ignore" }).catch(() => {
    throw new Error(errorMessage);
  });
}

async function ensureAzureDevOpsExtension() {
  const hasExtension = await run("az", ["extension", "show", "--name", "azure-devops"], {
    stdio: "ignore"
  })
    .then(() => true)
    .catch(() => false);

  if (hasExtension) {
    return;
  }

  log("Azure DevOps CLI Extension fehlt, installiere sie jetzt...");
  await run("az", ["extension", "add", "--name", "azure-devops"]);
}

async function ensureAzureLogin() {
  const isLoggedIn = await run("az", ["account", "show", "-o", "none"], {
    stdio: "ignore"
  })
    .then(() => true)
    .catch(() => false);

  if (isLoggedIn) {
    return;
  }

  log("Keine aktive Azure-Session gefunden. Starte 'az login'...");
  await run("az", ["login"]);
  log("Azure-Login erfolgreich.");
}

async function ensureDependenciesInstalled() {
  const nodeModulesPath = path.join(projectRoot, "node_modules");
  const hasNodeModules = await canAccess(nodeModulesPath);

  if (hasNodeModules) {
    return;
  }

  log("Installiere npm-Abhängigkeiten (einmalig)...");
  await run("npm", ["install"]);
}

// --------------------------------------------------
// NEUE VERSION: Robuster Build mit Git-basiertem Caching
// --------------------------------------------------
async function ensureBuildArtifacts() {
  const serverArtifact = path.join(projectRoot, "dist/src/app/bootstrap/local-server.js");
  const uiArtifact = path.join(projectRoot, "dist/src/app/bootstrap/local-ui-entry.browser.js");
  const buildTagPath = path.join(projectRoot, ".last_build_commit");

  const hasServerArtifact = await canAccess(serverArtifact);
  const hasUiArtifact = await canAccess(uiArtifact);

  let lastCommit = "";
  try {
    lastCommit = (await readFile(buildTagPath, "utf8")).trim();
  } catch {}

  const currentBuildStamp = await getCurrentBuildStamp();
  const buildAction = determineBuildAction({
    hasServerArtifact,
    hasUiArtifact,
    currentBuildStamp,
    lastBuildStamp: lastCommit
  });

  if (!buildAction.shouldBuild) {
    if (buildAction.reason === BUILD_CACHE_REASONS.GIT_UNAVAILABLE) {
      log("Git-Status konnte nicht gelesen werden, aber Artefakte existieren. Überspringe Build.");
      return;
    }

    const currentCommitHash = getCommitHashFromBuildStamp(currentBuildStamp);
    if (currentCommitHash) {
      log(`Build ist aktuell (Commit ${currentCommitHash.slice(0, 8)}). Überspringe Build.`);
      return;
    }

    log("Build ist aktuell. Überspringe Build.");
    return;
  }

  if (buildAction.reason === BUILD_CACHE_REASONS.MISSING_ARTIFACTS) {
    log("Build-Artefakte fehlen, führe Build aus...");
  } else if (buildAction.reason === BUILD_CACHE_REASONS.MISSING_MARKER) {
    log("Build-Marker fehlt, führe Build aus...");
  } else {
    log("Build-Eingaben haben sich geändert. Führe Build aus...");
  }

  await runBuild(currentBuildStamp);
}

async function runBuild(buildStamp) {
  await run("npm", ["run", "build"]);

  if (buildStamp) {
    const buildTagPath = path.join(projectRoot, ".last_build_commit");
    await writeFile(buildTagPath, buildStamp, "utf8");
    const commitHash = getCommitHashFromBuildStamp(buildStamp);
    if (commitHash) {
      log(`Build abgeschlossen. Merke Stand ${commitHash.slice(0, 8)}.`);
      return;
    }
  } else {
    log("Build abgeschlossen. Build-Marker konnte nicht aktualisiert werden.");
    return;
  }

  log("Build abgeschlossen.");
}

// --------------------------------------------------

async function isServerHealthy() {
  try {
    const response = await fetch(healthUrl, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isServerHealthy()) {
      return true;
    }
    await sleep(500);
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? "inherit",
      cwd: options.cwd ?? projectRoot,
      env: process.env,
      shell: process.platform === "win32"
    });

    let output = "";
    if (options.stdio === "pipe") {
      child.stdout.on("data", (data) => (output += data.toString()));
    }

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(options.stdio === "pipe" ? output : undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

async function openBrowser(url) {
  if (process.platform === "darwin") {
    await run("open", [url]);
    return;
  }

  if (process.platform === "win32") {
    await run("cmd", ["/c", "start", "", url], { stdio: "ignore" });
    return;
  }

  await run("xdg-open", [url]);
}

async function canAccess(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function getCurrentBuildStamp() {
  try {
    const commitHash = String(await run("git", ["rev-parse", "HEAD"], { stdio: "pipe" })).trim();
    const statusOutput = String(
      await run(
        "git",
        ["status", "--porcelain", "--untracked-files=normal", "--", ...BUILD_INPUT_PATHS],
        { stdio: "pipe" }
      )
    );
    return createBuildStamp(commitHash, statusOutput);
  } catch {
    return "";
  }
}

function log(message) {
  console.log(`[launcher] ${message}`);
}

function warn(message) {
  console.warn(`[launcher] ${message}`);
}

// --------------------------------------------------

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[launcher] Fehler: ${message}`);
  process.exit(1);
});
