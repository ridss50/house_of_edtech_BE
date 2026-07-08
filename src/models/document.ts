import { Schema, model, models } from "mongoose";
import { randomUUID } from "node:crypto";

export interface DocumentAttrs {
  _id: string;
  title: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<DocumentAttrs>(
  {
    _id: { type: String, default: () => randomUUID() },
    title: { type: String, required: true },
    ownerId: { type: String, required: true, index: true },
  },
  { _id: false, timestamps: true },
);

export const DocumentModel = models.Document ?? model<DocumentAttrs>("Document", documentSchema);
