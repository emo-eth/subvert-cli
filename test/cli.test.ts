import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, test } from "vitest"
import { type CliIo, runCli } from "../src/cli-runner.js"

interface CliResult {
  exitCode: number
  stdout: string
  stderr: string
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function run(
  args: string[],
  stdin = "",
  cwd = process.cwd(),
): Promise<CliResult> {
  let stdout = ""
  let stderr = ""
  const io: CliIo = {
    cwd,
    readStdin: async () => stdin,
    writeStdout: (text) => {
      stdout += text
    },
    writeStderr: (text) => {
      stderr += text
    },
  }
  const exitCode = await runCli(args, io)
  return { exitCode, stdout, stderr }
}

describe("runCli", () => {
  test("transforms standard input when no paths are supplied", async () => {
    const result = await run(
      ["facilit{y,ies}", "building{,s}"],
      "Facility facilities mailbox\n",
    )

    expect(result).toEqual({
      exitCode: 0,
      stdout: "Building buildings mailbox\n",
      stderr: "",
    })
  })

  test("prints command help without requiring patterns", async () => {
    const result = await run(["--help"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(
      "Usage: subvert [OPTIONS] FROM TO [PATH...]",
    )
    expect(result.stdout).toContain("--boundary identifier|anywhere|word")
    expect(result.stderr).toBe("")
  })

  test("applies explicit case, style, and boundary options in filter mode", async () => {
    const result = await run(
      [
        "--case",
        "exact",
        "--styles",
        "camel",
        "--boundary",
        "anywhere",
        "user_profile",
        "account_record",
      ],
      "UserProfile userProfile Xuser_profileX\n",
    )

    expect(result).toEqual({
      exitCode: 0,
      stdout: "UserProfile accountRecord Xaccount_recordX\n",
      stderr: "",
    })
  })

  test("previews file changes without writing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "subvert-cli-"))
    temporaryDirectories.push(root)
    const file = path.join(root, "example.txt")
    await writeFile(file, "box\nmailbox\n")

    const result = await run(["box", "bag", "."], "", root)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("--- a/example.txt")
    expect(result.stdout).toContain("-box")
    expect(result.stdout).toContain("+bag")
    expect(result.stderr).toBe(
      "subvert: 1 replacement in 1 file; preview only, use --write to apply\n",
    )
    expect(await readFile(file, "utf8")).toBe("box\nmailbox\n")
  })

  test("writes file changes when requested", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "subvert-cli-"))
    temporaryDirectories.push(root)
    const file = path.join(root, "example.txt")
    await writeFile(file, "box\nmailbox\n")

    const result = await run(["--write", "box", "bag", "example.txt"], "", root)

    expect(result).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "subvert: 1 replacement in 1 file; files updated\n",
    })
    expect(await readFile(file, "utf8")).toBe("bag\nmailbox\n")
  })

  test("rejects write mode without file paths", async () => {
    const result = await run(["--write", "box", "bag"], "box\n")

    expect(result).toEqual({
      exitCode: 2,
      stdout: "",
      stderr: "subvert: --write requires at least one PATH\n",
    })
  })

  test("uses invalid-input and file-failure exit codes", async () => {
    const missingPattern = await run(["box"])
    expect(missingPattern.exitCode).toBe(2)
    expect(missingPattern.stderr).toBe("subvert: FROM and TO are required\n")

    const invalidOption = await run(["--case", "strange", "box", "bag"])
    expect(invalidOption.exitCode).toBe(2)
    expect(invalidOption.stderr).toBe("subvert: invalid case mode: strange\n")

    const missingFile = await run(["box", "bag", "does-not-exist.txt"])
    expect(missingFile.exitCode).toBe(1)
    expect(missingFile.stderr).toContain("does-not-exist.txt")
  })
})
