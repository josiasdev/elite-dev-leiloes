import { createHash } from "node:crypto";
import { moneyKey, toNumber } from "./money";

export const GENESIS_HASH = "GENESIS";

export interface BidHashInput {
  lotId: string;
  seq: number;
  amount: unknown;
  bidderId: string;
  createdAt: Date;
  prevHash: string | null;
}

export function computeBidHash(input: BidHashInput): string {
  const payload = [
    input.prevHash ?? GENESIS_HASH,
    input.seq,
    moneyKey(input.amount),
    input.bidderId,
    input.createdAt.toISOString(),
    input.lotId,
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function verifyChain(
  lotId: string,
  bids: { seq: number; amount: unknown; bidderId: string; createdAt: Date; prevHash: string | null; hash: string }[],
): { valid: boolean; brokenAt?: number } {
  let prevHash: string | null = null;
  let expectedSeq = 1;
  for (const bid of bids) {
    if (bid.seq !== expectedSeq) return { valid: false, brokenAt: bid.seq };
    if ((bid.prevHash ?? null) !== prevHash) return { valid: false, brokenAt: bid.seq };
    const expected = computeBidHash({
      lotId,
      seq: bid.seq,
      amount: bid.amount,
      bidderId: bid.bidderId,
      createdAt: bid.createdAt,
      prevHash,
    });
    if (bid.hash !== expected) return { valid: false, brokenAt: bid.seq };
    prevHash = bid.hash;
    expectedSeq += 1;
  }
  return { valid: true };
}
