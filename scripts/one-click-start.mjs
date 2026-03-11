import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? "8080");
const baseUrl = `http://127.0.0.1:${port}`;
const healthUrl = `${baseUrl}/health`;

async function main() {
  process.chdir(projectRoot);

  await assertCommand("node", ["--version"], "Node.js fehlt. Bitte Node.js 20+ installieren.");
  await assertCommand("az", ["--version"], "Azure CLI fehlt. Bitte Azure CLI installieren.");

  await ensureAzureDevOpsExtension();
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

  const healthy = await waitForServer(25_000);
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

async function ensureDependenciesInstalled() {
  const nodeModulesPath = path.join(projectRoot, "node_modules");
  const hasNodeModules = await canAccess(nodeModulesPath);

  if (hasNodeModules) {
    return;
  }

  log("Installiere npm-Abhängigkeiten (einmalig)...");
  await run("npm", ["install"]);
}

async function ensureBuildArtifacts() {
  const serverArtifact = path.join(projectRoot, "dist/src/app/bootstrap/local-server.js");
  const uiArtifact = path.join(projectRoot, "dist/src/app/bootstrap/local-ui-entry.browser.js");

  const hasServerArtifact = await canAccess(serverArtifact);
  const hasUiArtifact = await canAccess(uiArtifact);

  if (hasServerArtifact && hasUiArtifact) {
    return;
  }

  log("Build-Artefakte fehlen, führe Build aus...");
  await run("npm", ["run", "build"]);
}

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

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
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

function log(message) {
  console.log(`[launcher] ${message}`);
}

function warn(message) {
  console.warn(`[launcher] ${message}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[launcher] Fehler: ${message}`);
  process.exit(1);
});
