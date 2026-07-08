import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import * as Y from "yjs";
import { base64Payload } from "../shared";
import { getOrCreateRoom } from "../ws/registry";
import { applyAndPersistUpdate } from "../ws/apply-update";
import { requireAuth, requireDocumentRole, type AuthedRequest } from "../middleware/auth";
import { createSnapshot, listSnapshots, restoreSnapshot } from "../sync/snapshot";
import { DocumentModel, DocumentPermission } from "../models";

export const documentsRouter = Router();

const CreateDocumentBodySchema = z.object({ title: z.string().min(1).max(200) });

/** No single document to check a role against yet — any authenticated user
 * may create one (becoming its OWNER) or list the ones they can see. */
documentsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const body = CreateDocumentBodySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Title is required" });
  }

  const document = await DocumentModel.create({ title: body.data.title, ownerId: req.userId! });
  await DocumentPermission.create({
    documentId: document._id,
    userId: req.userId!,
    role: "OWNER",
  });

  res.status(201).json({ id: document._id, title: document.title });
});

documentsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const permissions = await DocumentPermission.find({ userId: req.userId! });
  const documents = await DocumentModel.find({
    _id: { $in: permissions.map((p) => p.documentId) },
  });
  const roleByDocId = new Map(permissions.map((p) => [p.documentId, p.role]));

  res.json(
    documents.map((doc) => ({
      id: doc._id,
      title: doc.title,
      role: roleByDocId.get(doc._id),
      updatedAt: doc.updatedAt,
    })),
  );
});

documentsRouter.get("/:id", requireDocumentRole, async (req: AuthedRequest, res) => {
  const document = await DocumentModel.findById(req.params.id);
  if (!document) {
    return res.status(404).json({ error: "Document not found" });
  }
  res.json({ id: document._id, title: document.title, role: req.role });
});

const UpdateBodySchema = z.object({ update: base64Payload });
const StateVectorQuerySchema = z.object({ since: base64Payload });

/**
 * REST fallback for when a client can't establish (or hold open) a
 * WebSocket connection. Applies/persists exactly like the WS 'update'
 * handler, and broadcasts to any live WS peers on the same document so
 * they don't miss a change pushed over this path.
 */
documentsRouter.post("/:id/updates", requireDocumentRole, async (req: AuthedRequest, res) => {
  if (req.role === "VIEWER") {
    return res.status(403).json({ error: "Viewers cannot modify the document" });
  }

  const body = UpdateBodySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid update payload" });
  }

  const room = await getOrCreateRoom(req.params.id);
  const update = Buffer.from(body.data.update, "base64");
  await applyAndPersistUpdate(room, update, { clientId: `rest-${randomUUID()}` });
  res.status(204).end();
});

documentsRouter.get("/:id/updates", requireDocumentRole, async (req: AuthedRequest, res) => {
  const query = StateVectorQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: "Missing or invalid 'since' state vector" });
  }

  const room = await getOrCreateRoom(req.params.id);
  const stateVector = Buffer.from(query.data.since, "base64");
  const diff = Y.encodeStateAsUpdate(room.doc, stateVector);
  res.json({ update: Buffer.from(diff).toString("base64") });
});

const CreateSnapshotBodySchema = z.object({ label: z.string().max(200).optional() });

documentsRouter.post("/:id/snapshots", requireDocumentRole, async (req: AuthedRequest, res) => {
  if (req.role === "VIEWER") {
    return res.status(403).json({ error: "Viewers cannot save a version" });
  }

  const body = CreateSnapshotBodySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid snapshot payload" });
  }

  const room = await getOrCreateRoom(req.params.id);
  const snapshot = await createSnapshot(room, req.userId!, body.data.label);
  res.status(201).json({
    id: snapshot._id,
    label: snapshot.label,
    createdAt: snapshot.createdAt,
  });
});

documentsRouter.get("/:id/snapshots", requireDocumentRole, async (req: AuthedRequest, res) => {
  const snapshots = await listSnapshots(req.params.id);
  res.json(
    snapshots.map((snapshot) => ({
      id: snapshot._id,
      label: snapshot.label,
      createdAt: snapshot.createdAt,
      createdById: snapshot.createdById,
    })),
  );
});

documentsRouter.post(
  "/:id/restore/:snapshotId",
  requireDocumentRole,
  async (req: AuthedRequest, res) => {
    if (req.role === "VIEWER") {
      return res.status(403).json({ error: "Viewers cannot restore a version" });
    }

    const room = await getOrCreateRoom(req.params.id);
    try {
      await restoreSnapshot(room, req.params.snapshotId, `restore-${randomUUID()}`);
    } catch {
      return res.status(404).json({ error: "Snapshot not found" });
    }
    res.status(204).end();
  },
);
