import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Rota não encontrada" } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  const maybePrisma = err as { code?: string; status?: number; message?: string };
  if (maybePrisma?.code === "P2002") {
    res.status(409).json({ error: { code: "CONFLICT", message: "Registro duplicado" } });
    return;
  }
  if (typeof maybePrisma?.status === "number" && maybePrisma.status >= 400 && maybePrisma.status < 500) {
    res.status(maybePrisma.status).json({
      error: { code: "BAD_REQUEST", message: maybePrisma.message ?? "Requisição inválida" },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Erro interno do servidor" } });
}
