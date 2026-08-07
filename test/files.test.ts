import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, test } from "vitest"
import {
  applyFileChanges,
  discoverFiles,
  planFileChanges,
  renderUnifiedDiff,
} from "../src/files.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function makeFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "subvert-files-"))
  temporaryDirectories.push(root)
  await mkdir(path.join(root, "nested"), { recursive: true })
  await mkdir(path.join(root, ".git"), { recursive: true })
  await writeFile(path.join(root, ".gitignore"), "ignored.txt\n")
  await writeFile(path.join(root, "visible.txt"), "visible\n")
  await writeFile(
    path.join(root, "nested", ".gitignore"),
    "ignored-nested.txt\n",
  )
  await writeFile(path.join(root, "nested", "keep.txt"), "keep\n")
  await writeFile(path.join(root, "nested", "ignored-nested.txt"), "ignored\n")
  await writeFile(path.join(root, "ignored.txt"), "ignored\n")
  await writeFile(path.join(root, ".hidden.txt"), "hidden\n")
  await writeFile(path.join(root, ".git", "config"), "metadata\n")
  return root
}

describe("discoverFiles", () => {
  test("honors ignore files and skips hidden and repository metadata", async () => {
    const root = await makeFixture()

    const result = await discoverFiles(["."], {
      cwd: root,
      hidden: false,
      noIgnore: false,
    })

    expect(result.files).toEqual([
      path.join(root, "nested", "keep.txt"),
      path.join(root, "visible.txt"),
    ])
    expect(result.skipped).toEqual([])
  })

  test("can include hidden and ignored files without exposing repository metadata", async () => {
    const root = await makeFixture()

    const result = await discoverFiles(["."], {
      cwd: root,
      hidden: true,
      noIgnore: true,
    })

    expect(result.files).toEqual([
      path.join(root, ".gitignore"),
      path.join(root, ".hidden.txt"),
      path.join(root, "ignored.txt"),
      path.join(root, "nested", ".gitignore"),
      path.join(root, "nested", "ignored-nested.txt"),
      path.join(root, "nested", "keep.txt"),
      path.join(root, "visible.txt"),
    ])
    expect(result.skipped).toEqual([])
  })

  test.runIf(process.platform !== "win32")(
    "processes explicit hidden and ignored files but reports protected inputs",
    async () => {
      const root = await makeFixture()
      await symlink(
        path.join(root, "visible.txt"),
        path.join(root, "visible-link.txt"),
      )

      const result = await discoverFiles(
        ["ignored.txt", ".hidden.txt", "visible-link.txt", ".git/config"],
        { cwd: root, hidden: false, noIgnore: false },
      )

      expect(result.files).toEqual([
        path.join(root, ".hidden.txt"),
        path.join(root, "ignored.txt"),
      ])
      expect(result.skipped).toEqual([
        {
          path: path.join(root, ".git", "config"),
          reason: "repository-metadata",
        },
        {
          path: path.join(root, "visible-link.txt"),
          reason: "symbolic-link",
        },
      ])
    },
  )

  test.runIf(process.platform !== "win32")(
    "reports symbolic links encountered during folder traversal",
    async () => {
      const root = await makeFixture()
      const link = path.join(root, "visible-link.txt")
      await symlink(path.join(root, "visible.txt"), link)

      const result = await discoverFiles(["."], {
        cwd: root,
        hidden: false,
        noIgnore: false,
      })

      expect(result.files).not.toContain(link)
      expect(result.skipped).toContainEqual({
        path: link,
        reason: "symbolic-link",
      })
    },
  )

  test("plans UTF-8 text changes while preserving line endings and reporting binary data", async () => {
    const root = await makeFixture()
    const textFile = path.join(root, "text.txt")
    const binaryFile = path.join(root, "binary.dat")
    const controlFile = path.join(root, "control.dat")
    const invalidFile = path.join(root, "invalid.txt")
    await writeFile(textFile, "box\r\nmailbox\r\n")
    await writeFile(binaryFile, Buffer.from([0x62, 0x6f, 0x78, 0x00]))
    await writeFile(
      controlFile,
      Buffer.from([0x01, 0x02, 0x03, 0x62, 0x6f, 0x78]),
    )
    await writeFile(invalidFile, Buffer.from([0xc3, 0x28]))

    const plan = await planFileChanges(
      [textFile, binaryFile, controlFile, invalidFile],
      new Map([["box", "bag"]]),
      "identifier",
    )

    expect(plan.changes).toEqual([
      {
        path: textFile,
        before: "box\r\nmailbox\r\n",
        after: "bag\r\nmailbox\r\n",
        count: 1,
      },
    ])
    expect(plan.skipped).toEqual([
      { path: binaryFile, reason: "binary" },
      { path: controlFile, reason: "binary" },
      { path: invalidFile, reason: "invalid-utf8" },
    ])
  })

  test("renders deterministic unified diffs with repository-relative labels", () => {
    const root = path.join(path.sep, "repo")
    const diff = renderUnifiedDiff(
      [
        {
          path: path.join(root, "src", "example.ts"),
          before: "const box = 1\n",
          after: "const bag = 1\n",
          count: 1,
        },
      ],
      root,
    )

    expect(diff).toContain("--- a/src/example.ts")
    expect(diff).toContain("+++ b/src/example.ts")
    expect(diff).toContain("-const box = 1")
    expect(diff).toContain("+const bag = 1")
  })

  test("writes planned changes without changing file permissions", async () => {
    const root = await makeFixture()
    const file = path.join(root, "mode.txt")
    await writeFile(file, "box\n")
    await chmod(file, 0o640)

    await applyFileChanges([
      { path: file, before: "box\n", after: "bag\n", count: 1 },
    ])

    expect(await readFile(file, "utf8")).toBe("bag\n")
    if (process.platform !== "win32") {
      expect((await stat(file)).mode & 0o777).toBe(0o640)
    }
  })

  test("preserves a UTF-8 byte order mark", async () => {
    const root = await makeFixture()
    const file = path.join(root, "bom.txt")
    await writeFile(
      file,
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("box\r\n")]),
    )

    const plan = await planFileChanges(
      [file],
      new Map([["box", "bag"]]),
      "identifier",
    )

    expect(plan.changes[0]).toMatchObject({
      before: "\ufeffbox\r\n",
      after: "\ufeffbag\r\n",
    })
  })
})
