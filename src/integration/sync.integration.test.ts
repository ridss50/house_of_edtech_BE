import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import WebSocket from "ws";
import jwt from "jsonwebtoken";
import * as Y from "yjs";
import { createApp } from "../create-app";
import { connectDB, mongoose } from "../db/mongoose";
import { User, DocumentModel, DocumentPermission, DocumentUpdate } from "../models";
import type { ServerMessage } from "../shared";

const TEST_SECRET = "integration-test-secret";
process.env.NEXTAUTH_SECRET = TEST_SECRET;
process.env.MONGODB_URI = "mongodb://localhost:27017/collab_editor_integration_test";

let server: Server;
let wsUrl: string;

function mintToken(userId: string): string {
  return jwt.sign({ sub: userId }, TEST_SECRET);
}

function connectClient(documentId: string, userId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const onMessage = (raw: Buffer) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      if (msg.type === "auth-ok") {
        ws.off("message", onMessage);
        resolve(ws);
      } else if (msg.type === "auth-error") {
        ws.off("message", onMessage);
        reject(new Error(msg.message));
      }
    };
    ws.on("message", onMessage);
    ws.on("error", reject);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "auth", token: mintToken(userId), documentId }));
    });
  });
}

function waitForMessage(
  ws: WebSocket,
  predicate: (msg: ServerMessage) => boolean,
  timeoutMs = 5000,
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("Timed out waiting for expected message"));
    }, timeoutMs);
    function onMessage(raw: Buffer) {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(msg);
      }
    }
    ws.on("message", onMessage);
  });
}

function send(ws: WebSocket, message: object): void {
  ws.send(JSON.stringify(message));
}

async function createTestDocument(role1: "OWNER" | "EDITOR" | "VIEWER" = "OWNER") {
  const owner = await User.create({ email: `owner-${Date.now()}-${Math.random()}@test.local` });
  const document = await DocumentModel.create({ title: "Integration Test Doc", ownerId: owner._id });
  await DocumentPermission.create({ documentId: document._id, userId: owner._id, role: role1 });
  return { owner, document };
}

beforeAll(async () => {
  await connectDB();
  const { server: httpServer } = createApp("http://localhost:3000");
  server = httpServer;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  wsUrl = `ws://localhost:${port}/sync`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("sync server integration", () => {
  it("two connected clients converge after exchanging updates over the real WS protocol", async () => {
    const { owner, document } = await createTestDocument("OWNER");
    const editor = await User.create({ email: `editor-${Date.now()}@test.local` });
    await DocumentPermission.create({ documentId: document._id, userId: editor._id, role: "EDITOR" });

    const clientA = await connectClient(document._id, owner._id);
    const clientB = await connectClient(document._id, editor._id);

    const docA = new Y.Doc();
    docA.getText("body").insert(0, "hello");
    send(clientA, { type: "update", update: Buffer.from(Y.encodeStateAsUpdate(docA)).toString("base64") });

    const receivedByB = await waitForMessage(clientB, (m) => m.type === "update");
    expect(receivedByB.type).toBe("update");

    const docB = new Y.Doc();
    if (receivedByB.type === "update") {
      Y.applyUpdate(docB, Buffer.from(receivedByB.update, "base64"));
    }
    docB.getText("body").insert(docB.getText("body").length, " world");
    send(clientB, { type: "update", update: Buffer.from(Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA))).toString("base64") });

    const receivedByA = await waitForMessage(clientA, (m) => m.type === "update");
    if (receivedByA.type === "update") {
      Y.applyUpdate(docA, Buffer.from(receivedByA.update, "base64"));
    }

    expect(docA.getText("body").toString()).toBe(docB.getText("body").toString());
    expect(docA.getText("body").toString()).toBe("hello world");

    clientA.close();
    clientB.close();
  });

  it("rejects a viewer's write server-side without applying or broadcasting it", async () => {
    const { owner, document } = await createTestDocument("OWNER");
    const viewer = await User.create({ email: `viewer-${Date.now()}@test.local` });
    await DocumentPermission.create({ documentId: document._id, userId: viewer._id, role: "VIEWER" });

    const ownerClient = await connectClient(document._id, owner._id);
    const viewerClient = await connectClient(document._id, viewer._id);

    const bogusDoc = new Y.Doc();
    bogusDoc.getText("body").insert(0, "should not be applied");
    send(viewerClient, {
      type: "update",
      update: Buffer.from(Y.encodeStateAsUpdate(bogusDoc)).toString("base64"),
    });

    const errorMessage = await waitForMessage(viewerClient, (m) => m.type === "error");
    expect(errorMessage).toMatchObject({ type: "error", message: expect.stringContaining("Viewer") });

    const updateCount = await DocumentUpdate.countDocuments({ documentId: document._id });
    expect(updateCount).toBe(0);

    ownerClient.close();
    viewerClient.close();
  });

  it("converges an offline client's edits with edits made on the server while it was disconnected", async () => {
    const { owner, document } = await createTestDocument("OWNER");

   
    const clientA = await connectClient(document._id, owner._id);
    const localDoc = new Y.Doc();
    localDoc.getText("body").insert(0, "base");
    send(clientA, { type: "update", update: Buffer.from(Y.encodeStateAsUpdate(localDoc)).toString("base64") });
    await new Promise((resolve) => setTimeout(resolve, 200)); // let the server persist it
    clientA.close();
    await new Promise((resolve) => setTimeout(resolve, 200));

 
    localDoc.getText("body").insert(localDoc.getText("body").length, " (offline edit)");

  
    const clientB = await connectClient(document._id, owner._id);
    const emptyStateVector = Buffer.from(Y.encodeStateVector(new Y.Doc())).toString("base64");
    send(clientB, { type: "sync-step1", stateVector: emptyStateVector });
    const step2 = await waitForMessage(clientB, (m) => m.type === "sync-step2");
    const bDoc = new Y.Doc();
    if (step2.type === "sync-step2") Y.applyUpdate(bDoc, Buffer.from(step2.update, "base64"));
    bDoc.getText("body").insert(0, "(B edit) ");
    send(clientB, { type: "update", update: Buffer.from(Y.encodeStateAsUpdate(bDoc)).toString("base64") });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const clientAReconnected = await connectClient(document._id, owner._id);
    send(clientAReconnected, {
      type: "update",
      update: Buffer.from(Y.encodeStateAsUpdate(localDoc)).toString("base64"),
    });
    send(clientAReconnected, {
      type: "sync-step1",
      stateVector: Buffer.from(Y.encodeStateVector(localDoc)).toString("base64"),
    });
    const finalStep2 = await waitForMessage(clientAReconnected, (m) => m.type === "sync-step2");
    if (finalStep2.type === "sync-step2") {
      Y.applyUpdate(localDoc, Buffer.from(finalStep2.update, "base64"));
    }

    const finalText = localDoc.getText("body").toString();
    expect(finalText).toContain("base");
    expect(finalText).toContain("(offline edit)");
    expect(finalText).toContain("(B edit)");

    clientB.close();
    clientAReconnected.close();
  });
});
