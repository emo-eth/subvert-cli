import { describe, expect, test } from "vitest"
import { createReplacementMap } from "../src/core.js"

describe("createReplacementMap", () => {
  test("pairs brace alternatives and adds Abolish capitalization forms", () => {
    const replacements = createReplacementMap(
      "facilit{y,ies}",
      "building{,s}",
      { caseMode: "abolish", styles: [] },
    )

    expect(Object.fromEntries(replacements)).toEqual({
      FACILITIES: "BUILDINGS",
      FACILITY: "BUILDING",
      Facilities: "Buildings",
      Facility: "Building",
      facilities: "buildings",
      facility: "building",
    })
  })

  test("does not change identifier style when adding Abolish case forms", () => {
    const replacements = createReplacementMap(
      "user_profile",
      "account_record",
      { caseMode: "abolish", styles: [] },
    )

    expect(Object.fromEntries(replacements)).toEqual({
      USER_PROFILE: "ACCOUNT_RECORD",
      User_profile: "Account_record",
      user_profile: "account_record",
    })
  })

  test("expands multiple groups and copies choices through empty target groups", () => {
    const replacements = createReplacementMap("pre{a,b}{1,2}", "post{x,y}{}", {
      caseMode: "exact",
      styles: [],
    })

    expect(Object.fromEntries(replacements)).toEqual({
      prea1: "postx1",
      prea2: "postx2",
      preb1: "posty1",
      preb2: "posty2",
    })
  })

  test("repeats a shorter target alternative list", () => {
    const replacements = createReplacementMap("{a,b,c,d}", "{x,y}", {
      caseMode: "exact",
      styles: [],
    })

    expect(Object.fromEntries(replacements)).toEqual({
      a: "x",
      b: "y",
      c: "x",
      d: "y",
    })
  })

  test("generates every common identifier style when requested", () => {
    const replacements = createReplacementMap(
      "user_profile",
      "account_record",
      { caseMode: "exact", styles: ["identifier"] },
    )

    expect(Object.fromEntries(replacements)).toEqual({
      USER_PROFILE: "ACCOUNT_RECORD",
      UserProfile: "AccountRecord",
      "user-profile": "account-record",
      "user.profile": "account.record",
      userProfile: "accountRecord",
      user_profile: "account_record",
    })
  })

  test("rejects an empty source and malformed brace patterns", () => {
    expect(() =>
      createReplacementMap("", "replacement", {
        caseMode: "exact",
        styles: [],
      }),
    ).toThrow("FROM must not expand to an empty string")

    expect(() =>
      createReplacementMap("broken{a,b", "replacement", {
        caseMode: "exact",
        styles: [],
      }),
    ).toThrow("unmatched opening brace")

    expect(() =>
      createReplacementMap("source", "target{a,b}", {
        caseMode: "exact",
        styles: [],
      }),
    ).toThrow("TO cannot contain more brace groups than FROM")
  })

  test("rejects patterns that expand beyond the mapping limit", () => {
    const tooManyGroups = "{a,b}".repeat(14)

    expect(() =>
      createReplacementMap(tooManyGroups, "replacement", {
        caseMode: "exact",
        styles: [],
      }),
    ).toThrow("FROM expands to more than 10000 mappings")
  })

  test("rejects generated source forms with conflicting targets", () => {
    expect(() =>
      createReplacementMap("{foo,FOO}", "{one,two}", {
        caseMode: "abolish",
        styles: [],
      }),
    ).toThrow('conflicting replacements for "FOO"')
  })
})
