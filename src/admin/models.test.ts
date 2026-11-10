import { describe, expect, it, vi } from "vitest";
import { ApiError, type ModelChoice } from "./api.ts";
import { backupOf, readWithBackup, switchedText, switchText } from "./models.ts";

const MISTRAL = { id: "@cf/mistral", name: "Mistral Small", company: "Cloudflare" };
const GEMMA = { id: "@cf/gemma", name: "Gemma 4", company: "Cloudflare" };
const FLASH = { id: "gemini-flash-lite", name: "Gemini Flash-Lite", company: "Google" };
const ALL = [MISTRAL, GEMMA, FLASH];

const modelError = (kind: string) => new ApiError(429, "The service is busy. Try again in a minute.", kind);

describe("backupOf", () => {
  it("takes the first model of another company", () => {
    expect(backupOf(ALL, MISTRAL.id)).toBe(FLASH);
    expect(backupOf(ALL, GEMMA.id)).toBe(FLASH);
    expect(backupOf(ALL, FLASH.id)).toBe(MISTRAL);
  });

  it("gives null with one company only, or an unknown model", () => {
    expect(backupOf([MISTRAL, GEMMA], MISTRAL.id)).toBeNull();
    expect(backupOf(ALL, "other")).toBeNull();
  });
});

describe("the reason texts", () => {
  it("says why the page switches, and why it switched", () => {
    expect(switchText(MISTRAL, "busy", FLASH)).toBe("Mistral Small is busy, so Gemini Flash-Lite reads it.");
    expect(switchText(MISTRAL, "daily", FLASH)).toBe(
      "Mistral Small reached its free limit of the day, so Gemini Flash-Lite reads it.",
    );
    expect(switchText(MISTRAL, "unreadable", FLASH)).toBe("Mistral Small failed, so Gemini Flash-Lite reads it.");
    expect(switchedText(MISTRAL, "busy")).toBe("Mistral Small was busy.");
    expect(switchedText(MISTRAL, "failed")).toBe("Mistral Small failed.");
  });
});

describe("readWithBackup", () => {
  it("reads once with the first model if it works", async () => {
    const read = vi.fn(async (m: ModelChoice) => m.id);
    const onSwitch = vi.fn();
    expect(await readWithBackup(ALL, MISTRAL, read, onSwitch)).toEqual({ result: MISTRAL.id, model: MISTRAL, switched: null });
    expect(read).toHaveBeenCalledOnce();
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("switches once to the other company for each kind of model error", async () => {
    for (const kind of ["daily", "busy", "failed", "unreadable"]) {
      const read = vi.fn(async (m: ModelChoice) => m.id).mockRejectedValueOnce(modelError(kind));
      const onSwitch = vi.fn();
      const outcome = await readWithBackup(ALL, MISTRAL, read, onSwitch);
      expect(outcome.model).toBe(FLASH);
      expect(outcome.switched).toBe(switchedText(MISTRAL, kind));
      expect(onSwitch).toHaveBeenCalledWith(switchText(MISTRAL, kind, FLASH), FLASH);
      expect(read.mock.calls.map(([m]) => m)).toEqual([MISTRAL, FLASH]);
    }
  });

  it("lists both models if the backup fails too, and does not read a third time", async () => {
    const read = vi.fn(async () => "x").mockRejectedValueOnce(modelError("busy")).mockRejectedValueOnce(modelError("daily"));
    await expect(readWithBackup(ALL, MISTRAL, read, () => {})).rejects.toThrow(
      "Mistral Small was busy. Gemini Flash-Lite reached its free limit of the day. Try again later, or type the recipe.",
    );
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not switch with no model of another company", async () => {
    const read = vi.fn(async () => "x").mockRejectedValueOnce(modelError("busy"));
    await expect(readWithBackup([MISTRAL, GEMMA], MISTRAL, read, () => {})).rejects.toThrow(
      "Mistral Small was busy. Try again later, or type the recipe.",
    );
    expect(read).toHaveBeenCalledOnce();
  });

  it("does not switch for an error that another model cannot fix", async () => {
    const errors = [
      new ApiError(422, "No recipe was found."),
      new ApiError(400, "This link is not valid."),
      new ApiError(413, "The photo is too large."),
      new ApiError(401, "Sign in first."),
      new ApiError(0, "No connection. Check the network and try again."),
      new DOMException("The read was cancelled.", "AbortError"),
    ];
    for (const error of errors) {
      const read = vi.fn(async () => "x").mockRejectedValueOnce(error);
      await expect(readWithBackup(ALL, MISTRAL, read, () => {})).rejects.toBe(error);
      expect(read).toHaveBeenCalledOnce();
    }
  });

  it("gives the error of the backup as it is if another model cannot fix it", async () => {
    const cancel = new DOMException("The read was cancelled.", "AbortError");
    const read = vi.fn(async () => "x").mockRejectedValueOnce(modelError("busy")).mockRejectedValueOnce(cancel);
    await expect(readWithBackup(ALL, MISTRAL, read, () => {})).rejects.toBe(cancel);
  });
});
