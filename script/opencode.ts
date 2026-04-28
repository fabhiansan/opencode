#!/usr/bin/env bun

import path from "path"

const root = path.resolve(import.meta.dir, "..")
const dist = path.join(root, "packages/opencode/dist")
const action = process.argv[2] ?? "start"
const args = process.argv.slice(3)
const os = process.platform === "win32" ? "windows" : process.platform
const candidates = [
  `opencode-${os}-${process.arch}/bin/opencode*`,
  `opencode-${os}-${process.arch}-*/bin/opencode*`,
  "opencode-*/bin/opencode*",
]
const binary = candidates
  .map((pattern) => [...new Bun.Glob(pattern).scanSync({ cwd: dist })].sort().at(0))
  .find(Boolean)

const run = (cmd: string[], cwd = root) => {
  const proc = Bun.spawnSync(cmd, {
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
    env: process.env,
  })
  process.exit(proc.exitCode ?? 1)
}

if (action === "build") {
  run([process.execPath, "run", "--cwd", "packages/opencode", "build", "--single", "--skip-install", ...args])
}

if (action === "dev") {
  run([process.execPath, "run", "--cwd", "packages/opencode", "--conditions=browser", "src/index.ts", ...args])
}

if (!binary) {
  console.error("No built opencode binary found. Run `bun run opencode:build` first.")
  process.exit(1)
}

run([path.join(dist, binary), ...args])
