import * as Y from "yjs";
import { DocumentSnapshot, DocumentUpdate } from "../models";
import type { Room } from "../ws/registry";
import { broadcastUpdate } from "../ws/apply-update";

const COLLABORATION_FIELD = "default"; 


export async function createSnapshot(room: Room, createdById: string, label?: string) {
  const upToSeq = room.nextSeq;
  const state = Buffer.from(Y.encodeStateAsUpdate(room.doc));

  const snapshot = await DocumentSnapshot.create({
    documentId: room.documentId,
    label: label ?? null,
    state,
    upToSeq,
    createdById,
  });

  await DocumentUpdate.deleteMany({ documentId: room.documentId, seq: { $lt: upToSeq } });

  return snapshot;
}

export async function listSnapshots(documentId: string) {
  return DocumentSnapshot.find({ documentId }, { state: 0 }).sort({ upToSeq: -1 });
}


export async function restoreSnapshot(
  room: Room,
  snapshotId: string,
  actorClientId: string,
): Promise<void> {
  const snapshot = await DocumentSnapshot.findOne({ _id: snapshotId, documentId: room.documentId });
  if (!snapshot) {
    throw new Error(`Snapshot "${snapshotId}" does not exist for this document`);
  }

  const tempDoc = new Y.Doc();
  Y.applyUpdate(tempDoc, snapshot.state);
  const oldFragment = tempDoc.getXmlFragment(COLLABORATION_FIELD);
  // XmlHook is a legacy Yjs type not produced by Tiptap/ProseMirror content;
  // filtering it out satisfies insert()'s narrower accepted type.
  const clonedChildren = oldFragment
    .toArray()
    .filter((child) => child instanceof Y.XmlElement || child instanceof Y.XmlText)
    .map((child) => child.clone());

  const stateVectorBefore = Y.encodeStateVector(room.doc);
  room.doc.transact((_transaction) => {
    const liveFragment = room.doc.getXmlFragment(COLLABORATION_FIELD);
    liveFragment.delete(0, liveFragment.length);
    liveFragment.insert(0, clonedChildren);
  }, actorClientId);

  const diff = Y.encodeStateAsUpdate(room.doc, stateVectorBefore);

  const seq = room.nextSeq;
  room.nextSeq += 1;
  await DocumentUpdate.create({
    documentId: room.documentId,
    update: Buffer.from(diff),
    clientId: actorClientId,
    seq,
  });

  broadcastUpdate(room, diff);
}
