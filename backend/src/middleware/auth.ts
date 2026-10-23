import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../lib/http";

export interface AuthUser {
  id: string;
  role: "AUCTIONEER" | "BIDDER";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload extends jwt.JwtPayload {
  sub?: string;
  role?: "AUCTIONEER" | "BIDDER";
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Token de autenticação ausente");
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret) as TokenPayload;
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Token inválido ou expirado");
  }

  if (!payload.sub || !payload.role) {
    throw new AppError(401, "INVALID_TOKEN", "Token inválido");
  }

  req.user = { id: payload.sub, role: payload.role };
  next();
}

export function requireRole(role: "AUCTIONEER" | "BIDDER") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Autenticação necessária");
    }
    if (req.user.role !== role) {
      throw new AppError(403, "FORBIDDEN", "Você não tem permissão para esta ação");
    }
    next();
  };
}
