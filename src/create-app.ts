import http from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { healthRouter } from "./routes/health";
import { documentsRouter } from "./routes/documents";
import { authRouter } from "./routes/auth";
import { handleConnection } from "./ws/connection";
import { MAX_PAYLOAD_BASE64_LENGTH } from "./shared";
import { authRateLimiter, apiRateLimiter } from "./middleware/rate-limit";


export function createApp(corsOrigin: string) {
  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.use(healthRouter);
  app.use("/auth", authRateLimiter, authRouter);
  app.use("/documents", apiRateLimiter, documentsRouter);

  const server = http.createServer(app);


  const wss = new WebSocketServer({
    server,
    path: "/sync",
    maxPayload: MAX_PAYLOAD_BASE64_LENGTH + 1024,
  });
  wss.on("connection", handleConnection);

  return { app, server, wss };
}
