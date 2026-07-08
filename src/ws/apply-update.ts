import * as Y from "yjs";
import { WebSocket } from "ws";
import { DocumentUpdate } from "../models";
import type { Connection, Room } from "./registry";


export async function applyAndPersistUpdate(
  room: Room,
  update: Uint8Array,
  options: { clientId: string; exclude?: Connection },
): Promise<void> {
  Y.applyUpdate(room.doc, update, options.clientId);

  const seq = room.nextSeq;
  room.nextSeq += 1;
  await DocumentUpdate.create({
    documentId: room.documentId,
    update: Buffer.from(update),
    clientId: options.clientId,
    seq,
  });

  broadcastUpdate(room, update, options.exclude);
}

export function broadcastUpdate(room: Room, update: Uint8Array, exclude?: Connection): void {
  const payload = JSON.stringify({
    type: "update",
    update: Buffer.from(update).toString("base64"),
  });
  for (const connection of room.connections) {
    if (connection === exclude) continue;
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(payload);
    }
  }
}
