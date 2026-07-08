import { Router } from "express";
import { mongoose } from "../db/mongoose";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await mongoose.connection.db?.admin().ping();
    dbOk = mongoose.connection.readyState === 1;
  } catch {
    dbOk = false;
  }

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "connected" : "unreachable",
    timestamp: new Date().toISOString(),
  });
});
