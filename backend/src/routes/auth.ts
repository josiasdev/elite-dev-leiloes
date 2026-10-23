import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { newAlias } from "../lib/alias";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";
import { toUserDTO, type Role } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

const ROLES: readonly Role[] = ["AUCTIONEER", "BIDDER"];

function signToken(userId: string, role: Role): string {
  return jwt.sign({ role }, config.jwtSecret, { subject: userId, expiresIn: "7d" });
}

authRouter.post("/register", async (req, res) => {
  const body = req.body as { name?: unknown; email?: unknown; password?: unknown; role?: unknown };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (body.role !== undefined && body.role !== null && !ROLES.includes(body.role as Role)) {
    throw new AppError(400, "INVALID_ROLE", "Papel inválido (use AUCTIONEER ou BIDDER)");
  }
  const role: Role = body.role === "AUCTIONEER" ? "AUCTIONEER" : "BIDDER";

  if (name.length < 2) throw new AppError(400, "INVALID_NAME", "O nome precisa de ao menos 2 caracteres");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, "INVALID_EMAIL", "E-mail inválido");
  if (password.length < 6) throw new AppError(400, "INVALID_PASSWORD", "A senha precisa de ao menos 6 caracteres");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "EMAIL_IN_USE", "Este e-mail já está cadastrado");

  const passwordHash = await bcrypt.hash(password, 10);
  const aliasPrefix = role === "AUCTIONEER" ? "Leiloeiro" : "Licitante";

  let user = null;
  for (let attempt = 0; attempt < 5 && !user; attempt++) {
    try {
      user = await prisma.user.create({
        data: { name, email, passwordHash, role, alias: newAlias(aliasPrefix) },
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") continue;
      throw error;
    }
  }
  if (!user) throw new AppError(500, "INTERNAL", "Não foi possível gerar um alias único");

  res.status(201).json({ token: signToken(user.id, user.role), user: toUserDTO(user) });
});

authRouter.post("/login", async (req, res) => {
  const body = req.body as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) throw new AppError(400, "INVALID_BODY", "Informe e-mail e senha");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos");
  }

  res.json({ token: signToken(user.id, user.role), user: toUserDTO(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "Usuário não encontrado");
  res.json({ user: toUserDTO(user) });
});
