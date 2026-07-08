import { Schema, model, models } from "mongoose";
import { randomUUID } from "node:crypto";

export interface DocumentUpdateAttrs {
  _id: string;
  documentId: string;
  update: Buffer;
  clientId: string;
  seq: number;
  userId?: string | null;
  createdAt: Date;
}

const documentUpdateSchema = new Schema<DocumentUpdateAttrs>(
  {
    _id: { type: String, default: () => randomUUID() },
    documentId: { type: String, required: true, index: true },
    update: { type: Buffer, required: true },
    clientId: { type: String, required: true },
    seq: { type: Number, required: true },
    userId: { type: String, default: null },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
);


documentUpdateSchema.index({ documentId: 1, clientId: 1, seq: 1 }, { unique: true });
documentUpdateSchema.index({ documentId: 1, seq: 1 });
documentUpdateSchema.index({ documentId: 1, createdAt: 1 });

export const DocumentUpdate =
  models.DocumentUpdate ?? model<DocumentUpdateAttrs>("DocumentUpdate", documentUpdateSchema);
