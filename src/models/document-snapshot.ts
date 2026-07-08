import { Schema, model, models } from "mongoose";
import { randomUUID } from "node:crypto";

export interface DocumentSnapshotAttrs {
  _id: string;
  documentId: string;
  label?: string | null;
  state: Buffer;

  upToSeq: number;
  createdById: string;
  createdAt: Date;
}

const documentSnapshotSchema = new Schema<DocumentSnapshotAttrs>(
  {
    _id: { type: String, default: () => randomUUID() },
    documentId: { type: String, required: true, index: true },
    label: { type: String, default: null },
    state: { type: Buffer, required: true },
    upToSeq: { type: Number, required: true },
    createdById: { type: String, required: true },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
);

documentSnapshotSchema.index({ documentId: 1, upToSeq: -1 });

export const DocumentSnapshot =
  models.DocumentSnapshot ?? model<DocumentSnapshotAttrs>("DocumentSnapshot", documentSnapshotSchema);
