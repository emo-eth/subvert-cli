import { describe, expect, test } from "vitest"
import { transformText } from "../src/transform.js"

describe("transformText", () => {
  test("uses longest sources and applies swaps without cascading", () => {
    const replacements = new Map([
      ["cat", "dog"],
      ["cats", "dogs"],
      ["dog", "cat"],
    ])

    expect(transformText("cats cat dog", replacements, "anywhere")).toEqual({
      text: "dogs dog cat",
      count: 3,
    })
  })

  test("matches code-name edges without matching inside plain words", () => {
    const replacements = new Map([
      ["box", "bag"],
      ["Box", "Bag"],
    ])

    expect(
      transformText(
        "box mailbox box_count boxCount myBox outbox",
        replacements,
        "identifier",
      ),
    ).toEqual({
      text: "bag mailbox bag_count bagCount myBag outbox",
      count: 4,
    })
  })

  test("whole-word mode treats underscores as part of a word", () => {
    const replacements = new Map([["box", "bag"]])

    expect(
      transformText("box box_count box-count mailbox", replacements, "word"),
    ).toEqual({
      text: "bag box_count bag-count mailbox",
      count: 2,
    })
  })

  test("uses Unicode letters and numbers for identifier boundaries", () => {
    const replacements = new Map([
      ["café", "bistro"],
      ["Box", "Bag"],
    ])

    expect(
      transformText(
        "café café2 pré-café décafé λBox λBoxδ",
        replacements,
        "identifier",
      ),
    ).toEqual({
      text: "bistro café2 pré-bistro décafé λBag λBoxδ",
      count: 3,
    })
  })
})
