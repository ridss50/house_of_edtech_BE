import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { syncDocs } from "./merge";

function textOf(doc: Y.Doc, field = "paragraph"): string {
  return doc.getText(field).toString();
}

function cloneDoc(source: Y.Doc): Y.Doc {
  const clone = new Y.Doc();
  Y.applyUpdate(clone, Y.encodeStateAsUpdate(source));
  return clone;
}

describe("CRDT convergence", () => {
  it("two clients editing the same paragraph differently converge to identical state on both sides", () => {
    const docA = new Y.Doc();
    docA.getText("paragraph").insert(0, "Hello world");

    // docB "loads" the document, then both clients go offline and diverge.
    const docB = cloneDoc(docA);

    docA.getText("paragraph").insert(11, " (edited by A)");
    docB.getText("paragraph").insert(5, " (edited by B)");

    expect(textOf(docA)).not.toBe(textOf(docB));

   
    syncDocs(docA, docB);

    expect(textOf(docA)).toBe(textOf(docB));
    expect(textOf(docA)).toContain("edited by A");
    expect(textOf(docA)).toContain("edited by B");
  });

  it("converges to the same result regardless of the order updates arrive in", () => {
    const docA = new Y.Doc();
    docA.getText("paragraph").insert(0, "Hello world");
    const docB = cloneDoc(docA);

    docA.getText("paragraph").insert(11, " (edited by A)");
    docB.getText("paragraph").insert(5, " (edited by B)");

    const updateFromA = Y.encodeStateAsUpdate(docA);
    const updateFromB = Y.encodeStateAsUpdate(docB);

    const receiverAThenB = cloneDoc(docA); // starts from A's diverged state
    Y.applyUpdate(receiverAThenB, updateFromB);

    const receiverBThenA = cloneDoc(docB); // starts from B's diverged state
    Y.applyUpdate(receiverBThenA, updateFromA);

    expect(textOf(receiverAThenB)).toBe(textOf(receiverBThenA));
  });

  it("applying the same update twice is a no-op (duplicate delivery is safe)", () => {
    const docA = new Y.Doc();
    docA.getText("paragraph").insert(0, "Hello world");
    const docB = cloneDoc(docA);
    docB.getText("paragraph").insert(11, "!");

    const update = Y.encodeStateAsUpdate(docB);
    Y.applyUpdate(docA, update);
    const afterFirstApply = textOf(docA);

    Y.applyUpdate(docA, update);
    Y.applyUpdate(docA, update);

    expect(textOf(docA)).toBe(afterFirstApply);
  });

  it("concurrent inserts at the exact same position both survive the merge", () => {
    const docA = new Y.Doc();
    docA.getText("paragraph").insert(0, "shared start");
    const docB = cloneDoc(docA);

    docA.getText("paragraph").insert(0, "[A] ");
    docB.getText("paragraph").insert(0, "[B] ");

    syncDocs(docA, docB);

    expect(textOf(docA)).toBe(textOf(docB));
    expect(textOf(docA)).toContain("[A]");
    expect(textOf(docA)).toContain("[B]");
    expect(textOf(docA)).toContain("shared start");
  });

  it("simulates a reconnect racing a fresh local edit without losing either change", () => {
    const docA = new Y.Doc();
    docA.getText("paragraph").insert(0, "Hello world");
    const docB = cloneDoc(docA);

    docB.getText("paragraph").insert(11, " from B, while offline");

    // The reconnect handshake begins (server computes its diff for A)...
    const updateForA = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA));

    // ...but a fresh local edit on A lands before that diff is applied.
    docA.getText("paragraph").insert(0, "Race: ");

    Y.applyUpdate(docA, updateForA, "remote");
    const updateForB = Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB));
    Y.applyUpdate(docB, updateForB, "remote");

    expect(textOf(docA)).toBe(textOf(docB));
    expect(textOf(docA)).toContain("Race:");
    expect(textOf(docA)).toContain("from B, while offline");
  });
});
