import { describe, expect, it } from "vitest";
import { mapToRewriterTone, mapToWriterTone, promptToneInstruction, textToneLabel } from "../src/shared/textTone";

describe("text tone helpers", () => {
  it("maps extended tones to Writer API tones", () => {
    expect(mapToWriterTone("academic")).toBe("formal");
    expect(mapToWriterTone("friendly")).toBe("casual");
    expect(mapToWriterTone("neutral")).toBe("neutral");
  });

  it("maps extended tones to Rewriter API tones", () => {
    expect(mapToRewriterTone("formal")).toBe("more-formal");
    expect(mapToRewriterTone("casual")).toBe("more-casual");
    expect(mapToRewriterTone("neutral")).toBe("as-is");
  });

  it("returns display labels and prompt instructions", () => {
    expect(textToneLabel("academic")).toBe("Học thuật");
    expect(promptToneInstruction("friendly")).toContain("friendly");
  });
});
