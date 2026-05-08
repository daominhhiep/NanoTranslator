import { describe, expect, it } from "vitest";
import { languageLabel, normalizeAvailability } from "../src/shared/languages";

describe("language helpers", () => {
  it("maps known language codes to labels", () => {
    expect(languageLabel("vi")).toBe("Vietnamese");
    expect(languageLabel("xx")).toBe("XX");
  });

  it("normalizes built-in AI availability values", () => {
    expect(normalizeAvailability("available")).toBe("available");
    expect(normalizeAvailability("downloadable")).toBe("downloadable");
    expect(normalizeAvailability("downloading")).toBe("downloading");
    expect(normalizeAvailability("unavailable")).toBe("unavailable");
    expect(normalizeAvailability("surprise")).toBe("unknown");
  });
});
