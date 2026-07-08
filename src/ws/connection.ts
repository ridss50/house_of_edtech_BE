import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { ClientMessageSchema } from "../shared";
import type { ServerMessage } from "../shared";
import { getOrCreateRoom, type Connection, type Room } from "./registry";
import { applyAndPersistUpdate } from "./apply-update";
import { verifyToken } from "../auth/verify-token";
import { getRole } from "../auth/get-role";
import { TokenBucket } from "./rate-limit";

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function handleConnection(ws: WebSocket): void {
  const clientId = randomUUID();
  const rateLimiter = new TokenBucket();
  let room: Room | null = null;
  let connection: Connection | null = null;

  ws.on("message", async (raw) => {
    if (!rateLimiter.tryConsume()) {
      send(ws, { type: "error", message: "Rate limit exceeded, slow down" });
      return;
    }

    let parsed;
    try {
      parsed = ClientMessageSchema.parse(JSON.parse(raw.toString()));
    } catch {
      send(ws, { type: "error", message: "Malformed message" });
      return;
    }

    try {
      switch (parsed.type) {
        case "auth": {
          const verified = verifyToken(parsed.token);
          if (!verified) {
            send(ws, { type: "auth-error", message: "Invalid or expired token" });
            ws.close();
            return;
          }

          try {
            room = await getOrCreateRoom(parsed.documentId);
          } catch {
            send(ws, { type: "auth-error", message: "Document not found" });
            ws.close();
            return;
          }

          const role = await getRole(parsed.documentId, verified.userId);
          if (!role) {
            send(ws, { type: "auth-error", message: "Not authorized for this document" });
            ws.close();
            return;
          }

          connection = { ws, clientId, userId: verified.userId, role };
          room.connections.add(connection);
          send(ws, { type: "auth-ok", role });
          break;
        }

        case "sync-step1": {
          if (!room) {
            send(ws, { type: "error", message: "Not authenticated" });
            return;
          }
          const stateVector = Buffer.from(parsed.stateVector, "base64");
          const diff = Y.encodeStateAsUpdate(room.doc, stateVector);
          send(ws, { type: "sync-step2", update: Buffer.from(diff).toString("base64") });
          break;
        }

        case "update": {
          if (!room || !connection) {
            send(ws, { type: "error", message: "Not authenticated" });
            return;
          }
          if (connection.role === "VIEWER") {
            send(ws, { type: "error", message: "Viewers cannot modify the document" });
            console.warn(
              `Rejected write from viewer ${connection.userId} on document ${room.documentId}`,
            );
            return;
          }
          const update = Buffer.from(parsed.update, "base64");
          await applyAndPersistUpdate(room, update, { clientId, exclude: connection });
          break;
        }

        case "awareness":
          // Presence/cursor sharing isn't implemented yet — no UI consumes it.
          break;
      }
    } catch (error) {
      console.error("Error handling sync message:", error);
      send(ws, { type: "error", message: "Internal error processing message" });
    }
  });

  ws.on("close", () => {
    if (room && connection) {
      room.connections.delete(connection);
    }
  });
}
