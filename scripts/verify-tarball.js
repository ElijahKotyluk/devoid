const { execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function run(cmd, cwd = process.cwd()) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { cwd, stdio: "pipe" }).toString().trim();
}

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  console.log(`\n✔ ${msg}`);
}

let distFileCount = 0;

function printTree(rootDir, prefix = "") {
  const items = fs.readdirSync(rootDir, { withFileTypes: true });
  const last = items.length - 1;

  items.forEach((item, index) => {
    const isLast = index === last;
    const connector = isLast ? "└── " : "├── ";

    console.log(prefix + connector + item.name);

    if (item.isDirectory()) {
      const nextPrefix = prefix + (isLast ? "    " : "│   ");
      printTree(path.join(rootDir, item.name), nextPrefix);
    } else {
      distFileCount += 1;
    }
  });
}

const tarball = fs.readdirSync(path.join(process.cwd(), "packed")).find((f) => f.endsWith(".tgz"));

if (!tarball) {
  fail("No tarball found. Did you run `pnpm pack` first?");
}

ok(`Found tarball: ${tarball}`);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-pack-test-"));
ok(`Created temp directory: ${tempDir}`);

const tarballPath = path.join(process.cwd(), "packed", tarball);

try {
  run(`pnpm add ${tarballPath}`, tempDir);
  ok("Tarball installed successfully");
} catch (err) {
  fail(`Failed to install tarball:\n${err}`);
}

const pnpmStoreDir = path.join(tempDir, "node_modules/.pnpm");

const installedPkgDir = fs
  .readdirSync(pnpmStoreDir, { withFileTypes: true })
  .find((d) => d.isDirectory() && d.name.startsWith("devoid@"));

if (!installedPkgDir) {
  fail("Could not locate installed devoid package inside node_modules/.pnpm");
}

const pkgRoot = path.join(pnpmStoreDir, installedPkgDir.name, "node_modules/devoid");

ok(`Resolved installed package: ${pkgRoot}`);

const required = ["dist", "package.json", "bin/devoid.js"];

for (const file of required) {
  const fullPath = path.join(pkgRoot, file);

  if (!fs.existsSync(fullPath)) {
    fail(`Missing required file: ${file}`);
  }
}

ok("Required files present");

const dist = path.join(pkgRoot, "dist");
const distFiles = fs.readdirSync(dist);

if (distFiles.length === 0) {
  fail("dist/ is empty in the installed package");
}

console.log("\ndist/ file structure:\n");
console.log("dist/");
printTree(dist, "  ");
console.log("");

ok(`dist/ contains ${distFileCount} files`);

try {
  const output = run(`node ${path.join(pkgRoot, "bin/devoid.js")} --help`);

  if (!output.toLowerCase().includes("usage")) {
    fail("CLI did not output expected help text");
  }

  ok("CLI executed successfully");
} catch (err) {
  fail(`CLI failed to execute:\n${err}`);
}

try {
  fs.rmSync(tempDir, { recursive: true, force: true });
  ok(`Cleaned up temporary directory: ${tempDir}`);
  fs.rmSync(path.join(process.cwd(), "packed"), { recursive: true, force: true });
  ok(`Removed temporary packed/ directory containing tarball ${tarball}`);
} catch (err) {
  console.warn(`⚠ Warning: Could not remove temp dir: ${tempDir}`);
}

console.log(`\n
🌌 Devoid package successfully validated!

Everything looks good:
  • Tarball packed without issues
  • dist/ directory is present and contains build output
  • Package structure matches expected layout
  • CLI binary runs and responds correctly

You're all set — the release artifact is ready to publish. ✨
`);
