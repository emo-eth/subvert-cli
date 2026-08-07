#!/usr/bin/env node

import { type CliIo, runCli } from "./cli-runner.js"

const io: CliIo = {
  cwd: process.cwd(),
  readStdin: readStandardInput,
  writeStdout: (text) => {
    process.stdout.write(text)
  },
  writeStderr: (text) => {
    process.stderr.write(text)
  },
}

async function readStandardInput(): Promise<string> {
  let input = ""
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) input += chunk
  return input
}

try {
  process.exitCode = await runCli(process.argv.slice(2), io)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`subvert: ${message}\n`)
  process.exitCode = 1
}
