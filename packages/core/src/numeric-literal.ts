export type TzrNumberLiteralErrorReason = "non-finite" | "unsafe-integer";

export type TzrNumberLiteralResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: TzrNumberLiteralErrorReason };

const INTEGER_LITERAL_PATTERN = /^-?\d+$/;

export function parseTzrNumberLiteral(source: string): TzrNumberLiteralResult {
  const value = Number(source);
  if (!Number.isFinite(value)) {
    return { ok: false, reason: "non-finite" };
  }
  if (INTEGER_LITERAL_PATTERN.test(source) && !Number.isSafeInteger(value)) {
    return { ok: false, reason: "unsafe-integer" };
  }
  return { ok: true, value };
}

export function describeTzrNumberLiteralError(source: string, reason: TzrNumberLiteralErrorReason): string {
  return reason === "non-finite"
    ? `Number literal "${source}" must be finite.`
    : `Number literal "${source}" is outside the safe integer range.`;
}
