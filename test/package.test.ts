import { readFile } from "node:fs/promises"
import { describe, expect, test } from "vitest"

const projectRoot = new URL("../", import.meta.url)

describe("package", () => {
  test("defines a CLI-only package and an executable source entry point", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("package.json", projectRoot), "utf8"),
    ) as Record<string, unknown>
    const cliSource = await readFile(new URL("src/cli.ts", projectRoot), "utf8")

    expect(packageJson.bin).toEqual({ subvert: "./dist/cli.js" })
    expect(packageJson).not.toHaveProperty("types")
    expect(packageJson).not.toHaveProperty("exports")
    expect(cliSource.startsWith("#!/usr/bin/env node\n")).toBe(true)
  })
})
