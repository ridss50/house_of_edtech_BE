import { Schema, model, models } from "mongoose";
import { randomUUID } from "node:crypto";

export interface UserDocument {
  _id: string;
  name?: string | null;
  email: string;
  emailVerified?: Date | null;
  image?: string | null;
  passwordHash?: string | null;
  createdAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    _id: { type: String, default: () => randomUUID() },
    name: { type: String, default: null },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Date, default: null },
    image: { type: String, default: null },
    passwordHash: { type: String, default: null },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
);

export const User = models.User ?? model<UserDocument>("User", userSchema);
