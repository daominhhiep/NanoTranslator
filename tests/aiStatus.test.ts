import { describe, expect, it } from "vitest";
import { hasUsableAiApi } from "../src/shared/aiStatus";
import type { ApiStatusSnapshot } from "../src/shared/contracts";

const unavailable: ApiStatusSnapshot = {
  translator: "unsupported",
  summarizer: "unavailable",
  writer: "unsupported",
  rewriter: "unsupported",
  proofreader: "unknown",
  prompt: "unsupported"
};

describe("AI status helpers", () => {
  it("treats null status as not yet known", () => {
    expect(hasUsableAiApi(null)).toBe(true);
  });

  it("detects no usable built-in AI APIs", () => {
    expect(hasUsableAiApi(unavailable)).toBe(false);
  });

  it("treats downloadable models as usable with setup", () => {
    expect(hasUsableAiApi({ ...unavailable, translator: "downloadable" })).toBe(true);
  });
});
