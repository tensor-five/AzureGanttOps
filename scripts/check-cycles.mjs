import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");

async function main() {
  const files = await collectSourceFiles(srcRoot);
  const fileSet = new Set(files);
  const graph = new Map();

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind(filePath));
    const deps = extractRelativeDeps(sourceFile, filePath, fileSet);
    graph.set(filePath, deps);
  }

  const cycles = detectCycles(graph);

  if (cycles.length > 0) {
    console.error("Cycle check failed. Cycles found:");
    for (const cycle of cycles) {
      const rendered = cycle.map((entry) => path.relative(projectRoot, entry)).join(" -> ");
      console.error(`- ${rendered}`);
    }
    process.exit(1);
  }

  console.log(`Cycle check passed. Scanned ${files.length} files, no cycles found.`);
}

function scriptKind(filePath) {
  return filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

async function collectSourceFiles(root) {
  const results = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!isCodeFile(fullPath) || isTestFile(fullPath)) {
        continue;
      }

      results.push(path.resolve(fullPath));
    }
  }

  await walk(root);
  return results;
}

function isCodeFile(filePath) {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

function isTestFile(filePath) {
  return filePath.endsWith(".spec.ts") || filePath.endsWith(".spec.tsx");
}

function extractRelativeDeps(sourceFile, importerPath, fileSet) {
  const deps = new Set();

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (specifier && ts.isStringLiteral(specifier)) {
        addDependency(specifier.text, importerPath, fileSet, deps);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...deps];
}

function addDependency(specifier, importerPath, fileSet, deps) {
  if (!specifier.startsWith(".")) {
    return;
  }

  for (const candidate of resolveCandidates(specifier, importerPath)) {
    if (fileSet.has(candidate)) {
      deps.add(candidate);
      return;
    }
  }
}

function resolveCandidates(specifier, importerPath) {
  const baseDir = path.dirname(importerPath);
  const raw = path.resolve(baseDir, specifier);
  const candidates = new Set([raw]);

  const ext = path.extname(raw);

  if (!ext) {
    candidates.add(`${raw}.ts`);
    candidates.add(`${raw}.tsx`);
    candidates.add(path.join(raw, "index.ts"));
    candidates.add(path.join(raw, "index.tsx"));
  } else if (ext === ".js") {
    const stem = raw.slice(0, -3);
    candidates.add(`${stem}.ts`);
    candidates.add(`${stem}.tsx`);
    candidates.add(path.join(stem, "index.ts"));
    candidates.add(path.join(stem, "index.tsx"));
  }

  return [...candidates].map((entry) => path.resolve(entry));
}

function detectCycles(graph) {
  const unvisited = 0;
  const visiting = 1;
  const done = 2;
  const state = new Map();
  const stack = [];
  const seen = new Set();
  const cycles = [];

  for (const node of graph.keys()) {
    if ((state.get(node) ?? unvisited) === unvisited) {
      dfs(node);
    }
  }

  return cycles;

  function dfs(node) {
    state.set(node, visiting);
    stack.push(node);

    for (const dep of graph.get(node) ?? []) {
      const depState = state.get(dep) ?? unvisited;
      if (depState === unvisited) {
        dfs(dep);
        continue;
      }

      if (depState === visiting) {
        const startIndex = stack.indexOf(dep);
        if (startIndex >= 0) {
          const cycle = [...stack.slice(startIndex), dep];
          const key = canonicalCycleKey(cycle);
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push(cycle);
          }
        }
      }
    }

    stack.pop();
    state.set(node, done);
  }
}

function canonicalCycleKey(cycle) {
  const ring = cycle.slice(0, -1);
  const rotations = [];

  for (let i = 0; i < ring.length; i += 1) {
    rotations.push([...ring.slice(i), ...ring.slice(0, i)].join("|"));
  }

  rotations.sort();
  return rotations[0] ?? "";
}

void main();
