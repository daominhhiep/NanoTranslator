import type { TextTone } from "./contracts";

export const textToneOptions: Array<{ value: TextTone; label: string; description: string }> = [
  { value: "neutral", label: "Trung tính", description: "Rõ ràng, tự nhiên, không quá trang trọng." },
  { value: "formal", label: "Trang trọng", description: "Phù hợp email công việc, tài liệu, giao tiếp chuyên nghiệp." },
  { value: "casual", label: "Thân mật", description: "Gần gũi, đời thường, dễ đọc." },
  { value: "friendly", label: "Thân thiện", description: "Ấm áp, tích cực, mềm hơn casual." },
  { value: "academic", label: "Học thuật", description: "Chính xác, nghiêm túc, phù hợp nội dung nghiên cứu." }
];

export function textToneLabel(tone: TextTone): string {
  return textToneOptions.find((option) => option.value === tone)?.label ?? tone;
}

export function mapToWriterTone(tone: TextTone): "formal" | "neutral" | "casual" {
  if (tone === "formal" || tone === "academic") {
    return "formal";
  }
  if (tone === "casual" || tone === "friendly") {
    return "casual";
  }
  return "neutral";
}

export function mapToRewriterTone(tone: TextTone): "more-formal" | "as-is" | "more-casual" {
  if (tone === "formal" || tone === "academic") {
    return "more-formal";
  }
  if (tone === "casual" || tone === "friendly") {
    return "more-casual";
  }
  return "as-is";
}

export function promptToneInstruction(tone: TextTone): string {
  switch (tone) {
    case "formal":
      return "Use a formal, professional tone.";
    case "casual":
      return "Use a casual, conversational tone.";
    case "friendly":
      return "Use a friendly, warm, helpful tone.";
    case "academic":
      return "Use an academic, precise, well-structured tone.";
    case "neutral":
    default:
      return "Use a neutral, clear, natural tone.";
  }
}
