import * as Y from "yjs";


export function syncDocs(a: Y.Doc, b: Y.Doc): void {
  const stateVectorA = Y.encodeStateVector(a);
  const stateVectorB = Y.encodeStateVector(b);

  const missingFromA = Y.encodeStateAsUpdate(b, stateVectorA);
  const missingFromB = Y.encodeStateAsUpdate(a, stateVectorB);

  Y.applyUpdate(a, missingFromA, "remote");
  Y.applyUpdate(b, missingFromB, "remote");
}
