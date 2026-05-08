export const languageOptions = [
  { code: "vi", label: "Vietnamese" },
  { code: "en", label: "English" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "th", label: "Thai" }
] as const;

export function languageLabel(code: string): string {
  return languageOptions.find((language) => language.code === code)?.label ?? code.toUpperCase();
}

export function normalizeAvailability(value: unknown): "available" | "downloadable" | "downloading" | "unavailable" | "unknown" {
  if (value === "available" || value === "downloadable" || value === "downloading" || value === "unavailable") {
    return value;
  }
  return "unknown";
}
