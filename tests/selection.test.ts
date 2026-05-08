import { describe, expect, it } from "vitest";
import { normalizeSelectionText, validateSelectionText } from "../src/shared/selection";

describe("selection helpers", () => {
  it("normalizes whitespace", () => {
    expect(normalizeSelectionText("  hello\n\nworld\t ")).toBe("hello world");
  });

  it("rejects empty and short selections", () => {
    expect(validateSelectionText("   ", 500)).toMatchObject({ ok: false, reason: "empty" });
    expect(validateSelectionText("hey", 500)).toMatchObject({ ok: false, reason: "too-short" });
  });

  it("caps text at the configured character limit", () => {
    expect(validateSelectionText("hello world", 5)).toEqual({ ok: true, text: "hello", reason: "too-long" });
  });
});
