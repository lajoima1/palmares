import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shortTime } from "./time.ts";

describe("shortTime", () => {
  it.each([
    ["45 minutes", "45 min"],
    ["1 minute", "1 min"],
    ["1 heure 5 minutes", "1 h 05"],
    ["1 heure 15 minutes", "1 h 15"],
    ["8 heures 10 minutes", "8 h 10"],
    ["1 heure", "1 h"],
    ["3 heures", "3 h"],
    ["1 hour", "1 h"],
    ["8 hours", "8 h"],
    ["2 h 30", "2 h 30"],
    ["1 h 20", "1 h 20"],
    ["  1 heure  ", "1 h"],
  ])("shortens %j to %j", (text, short) => {
    expect(shortTime(text)).toBe(short);
  });

  it.each(["30 to 35 minutes", "25-30 minutes", "10 à 15 minutes", "N/A", "Une nuit", ""])(
    "keeps %j as written",
    (text) => {
      expect(shortTime(text)).toBe(text.trim());
    },
  );

  it("gives a short form or the text for each time of each recipe", () => {
    const recipes = new URL("../../recipes/", import.meta.url);
    const values: string[] = [];
    for (const slug of readdirSync(recipes)) {
      let text: string;
      try {
        text = readFileSync(new URL(`${slug}/recipe.txt`, recipes), "utf-8");
      } catch {
        continue;
      }
      for (const line of text.split("\n")) {
        const match = line.match(/^(?:prep_time|cook_time|total_time):(.*)$/);
        if (match && match[1].trim()) values.push(match[1]);
      }
    }
    expect(values.length).toBeGreaterThanOrEqual(100);
    for (const value of values) {
      const short = shortTime(value);
      expect(short === value.trim() || /^\d+ (min|h)( \d{2})?$/.test(short)).toBe(true);
      expect(short).not.toBe("");
    }
  });
});
