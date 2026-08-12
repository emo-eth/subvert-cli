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
  stdinIsTTY = false,
): Promise<CliResult> {
  let stdout = ""
  let stderr = ""
  const io: CliIo = {
    cwd,
    stdinIsTTY,
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
    expect(result.stdout).toContain("-V, --version")
    expect(result.stdout).toContain("HOW IT WORKS")
    expect(result.stdout).toContain("SAFETY")
    expect(result.stdout).toContain("EXIT CODES")
    expect(result.stdout).toContain("EXAMPLES")
    expect(result.stdout).toContain(
      "printf 'Facility facilities\\n' | subvert 'facilit{y,ies}' 'building{,s}'",
    )
    expect(result.stderr).toBe("")
  })

  test("prints the package version without requiring patterns", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string }
    const result = await run(["--version"])
    const shortResult = await run(["-V"])

    expect(result).toEqual({
      exitCode: 0,
      stdout: `${packageJson.version}\n`,
      stderr: "",
    })
    expect(shortResult).toEqual(result)
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
      "subvert: 1 replacement in 1 of 1 file; preview only, use --write to apply\n",
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
      stderr: "subvert: 1 replacement in 1 of 1 file; files updated\n",
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

  test("reports no matches with the scanned file count", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "subvert-cli-"))
    temporaryDirectories.push(root)
    await writeFile(path.join(root, "example.txt"), "box\n")

    const preview = await run(["zebra", "yak", "."], "", root)
    expect(preview).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "subvert: no matches found in 1 file\n",
    })

    const write = await run(["--write", "zebra", "yak", "."], "", root)
    expect(write).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "subvert: no matches found in 1 file; no files changed\n",
    })
  })

  test("refuses to read from an interactive terminal without paths", async () => {
    const result = await run(["box", "bag"], "", process.cwd(), true)

    expect(result).toEqual({
      exitCode: 2,
      stdout: "",
      stderr:
        "subvert: pass one or more PATH arguments, or pipe text on standard input\n",
    })
  })

  test("uses invalid-input and file-failure exit codes", async () => {
    const missingPattern = await run(["box"])
    expect(missingPattern.exitCode).toBe(2)
    expect(missingPattern.stderr).toBe(
      "subvert: FROM and TO are required\nTry 'subvert --help' for usage.\n",
    )

    const invalidOption = await run(["--case", "strange", "box", "bag"])
    expect(invalidOption.exitCode).toBe(2)
    expect(invalidOption.stderr).toBe("subvert: invalid case mode: strange\n")

    const missingFile = await run(["box", "bag", "does-not-exist.txt"])
    expect(missingFile.exitCode).toBe(1)
    expect(missingFile.stderr).toBe(
      "subvert: path not found: does-not-exist.txt\n",
    )
  })
})
