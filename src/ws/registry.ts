import * as Y from "yjs";
import type { WebSocket } from "ws";
import { DocumentModel, DocumentSnapshot, DocumentUpdate } from "../models";
import type { Role } from "../shared";

export interface Connection {
  ws: WebSocket;
  clientId: string;
  userId: string;
  role: Role;
}

export interface Room {
  documentId: string;
  doc: Y.Doc;
  connections: Set<Connection>;
  nextSeq: number;
}

const rooms = new Map<string, Room>();
// Guards concurrent first-time loads of the same document from racing each
// other into two separate Y.Doc instances.
const loading = new Map<string, Promise<Room>>();

async function loadRoom(documentId: string): Promise<Room> {
  const document = await DocumentModel.findById(documentId);
  if (!document) {
    throw new Error(`Document "${documentId}" does not exist`);
  }

  const doc = new Y.Doc();

  const latestSnapshot = await DocumentSnapshot.findOne({ documentId }).sort({ upToSeq: -1 });
  if (latestSnapshot) {
    Y.applyUpdate(doc, latestSnapshot.state, "server-load");
  }

  const updatesSinceSnapshot = await DocumentUpdate.find({
    documentId,
    ...(latestSnapshot ? { seq: { $gte: latestSnapshot.upToSeq } } : {}),
  }).sort({ seq: 1 });
  for (const row of updatesSinceSnapshot) {
    Y.applyUpdate(doc, row.update, "server-load");
  }

  const lastUpdate = await DocumentUpdate.findOne({ documentId }).sort({ seq: -1 });

  return {
    documentId,
    doc,
    connections: new Set(),
    nextSeq: lastUpdate ? lastUpdate.seq + 1 : 0,
  };
}

export async function getOrCreateRoom(documentId: string): Promise<Room> {
  const existing = rooms.get(documentId);
  if (existing) return existing;

  let pending = loading.get(documentId);
  if (!pending) {
    pending = loadRoom(documentId).then((room) => {
      rooms.set(documentId, room);
      loading.delete(documentId);
      return room;
    });
    pending.catch(() => loading.delete(documentId));
    loading.set(documentId, pending);
  }
  return pending;
}
