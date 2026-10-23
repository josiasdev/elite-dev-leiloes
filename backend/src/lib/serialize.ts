import { toNumber } from "./money";

export type Role = "AUCTIONEER" | "BIDDER";

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  alias: string;
  balance: number;
  createdAt: string;
}

export function toUserDTO(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  alias: string;
  balance: unknown;
  createdAt: Date;
}): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    alias: user.alias,
    balance: toNumber(user.balance),
    createdAt: user.createdAt.toISOString(),
  };
}
