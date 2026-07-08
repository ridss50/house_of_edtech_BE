
import { z } from "zod";
import { RoleSchema } from "./roles";


export const MAX_PAYLOAD_BASE64_LENGTH = 2 * 1024 * 1024; // ~1.5MB decoded

export const base64Payload = z.string().max(MAX_PAYLOAD_BASE64_LENGTH);

// ---- Client -> Server ----

export const AuthMessageSchema = z.object({
  type: z.literal("auth"),
  token: z.string().min(1),
  documentId: z.string().min(1),
});

export const SyncStep1MessageSchema = z.object({
  type: z.literal("sync-step1"),
  stateVector: base64Payload,
});

export const UpdateMessageSchema = z.object({
  type: z.literal("update"),
  update: base64Payload,
});

export const AwarenessMessageSchema = z.object({
  type: z.literal("awareness"),
  update: base64Payload,
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
  AuthMessageSchema,
  SyncStep1MessageSchema,
  UpdateMessageSchema,
  AwarenessMessageSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---- Server -> Client ----

export const AuthOkMessageSchema = z.object({
  type: z.literal("auth-ok"),
  role: RoleSchema,
});

export const AuthErrorMessageSchema = z.object({
  type: z.literal("auth-error"),
  message: z.string(),
});

export const SyncStep2MessageSchema = z.object({
  type: z.literal("sync-step2"),
  update: base64Payload,
});

export const ServerUpdateMessageSchema = z.object({
  type: z.literal("update"),
  update: base64Payload,
});

export const ServerAwarenessMessageSchema = z.object({
  type: z.literal("awareness"),
  update: base64Payload,
});

export const ServerErrorMessageSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
});

export const ServerMessageSchema = z.discriminatedUnion("type", [
  AuthOkMessageSchema,
  AuthErrorMessageSchema,
  SyncStep2MessageSchema,
  ServerUpdateMessageSchema,
  ServerAwarenessMessageSchema,
  ServerErrorMessageSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
