export interface SelectionValidation {
  ok: boolean;
  text: string;
  reason?: "empty" | "too-short" | "too-long";
}

export function normalizeSelectionText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function validateSelectionText(input: string, limit: number, minLength = 5): SelectionValidation {
  const text = normalizeSelectionText(input);

  if (!text) {
    return { ok: false, text, reason: "empty" };
  }

  if (text.length < minLength) {
    return { ok: false, text, reason: "too-short" };
  }

  if (text.length > limit) {
    return { ok: true, text: text.slice(0, limit), reason: "too-long" };
  }

  return { ok: true, text };
}

export function clampToViewport(left: number, top: number, width: number, height: number): { left: number; top: number } {
  const margin = 10;
  return {
    left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(top, window.innerHeight - height - margin))
  };
}
