import { describe, expect, it } from "vitest";
import { normalizeSelectionText, validateSelectionText } from "../src/shared/selection";

describe("selection helpers", () => {
  it("collapses horizontal whitespace but preserves line breaks", () => {
    expect(normalizeSelectionText("  hello\t world  ")).toBe("hello world");
    expect(normalizeSelectionText("  hello\n\nworld\t ")).toBe("hello\n\nworld");
    expect(normalizeSelectionText("- one\n- two\n\n\n- three")).toBe("- one\n- two\n\n- three");
    expect(normalizeSelectionText("line1\r\nline2\rline3")).toBe("line1\nline2\nline3");
  });

  it("rejects empty and short selections", () => {
    expect(validateSelectionText("   ", 500)).toMatchObject({ ok: false, reason: "empty" });
    expect(validateSelectionText("hey", 500)).toMatchObject({ ok: false, reason: "too-short" });
  });

  it("caps text at the configured character limit", () => {
    expect(validateSelectionText("hello world", 5)).toEqual({ ok: true, text: "hello", reason: "too-long" });
  });
});
