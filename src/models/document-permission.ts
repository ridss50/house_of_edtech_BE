import { Schema, model, models } from "mongoose";
import { randomUUID } from "node:crypto";
import type { Role } from "../shared";

export interface DocumentPermissionAttrs {
  _id: string;
  documentId: string;
  userId: string;
  role: Role;
  createdAt: Date;
}

const documentPermissionSchema = new Schema<DocumentPermissionAttrs>(
  {
    _id: { type: String, default: () => randomUUID() },
    documentId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["OWNER", "EDITOR", "VIEWER"], required: true },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
);

documentPermissionSchema.index({ documentId: 1, userId: 1 }, { unique: true });

export const DocumentPermission =
  models.DocumentPermission ??
  model<DocumentPermissionAttrs>("DocumentPermission", documentPermissionSchema);
