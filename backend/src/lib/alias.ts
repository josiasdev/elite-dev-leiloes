import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newAlias(prefix: "Leiloeiro" | "Licitante"): string {
  const suffix = Array.from(randomBytes(4))
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join("");
  return `${prefix}-${suffix}`;
}
