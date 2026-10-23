import cors from "cors";
import express from "express";
import { config } from "./config";
import { errorHandler, notFound } from "./lib/http";
import { authRouter } from "./routes/auth";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  app.use(
    cors({
      origin: config.corsOrigin ? config.corsOrigin.split(",") : true,
    }),
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
