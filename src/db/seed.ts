import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB, mongoose } from "./mongoose";
import { User, DocumentModel, DocumentPermission } from "../models";

/**
 * Dev-only seed: a document owner and a viewer, both on a fixed "demo"
 * document, so the Viewer-write-rejection path has a ready-made login to
 * test with (see README for the credentials).
 */
const DEMO_PASSWORD = "password123";

async function main() {
  await connectDB();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const owner = await User.findOneAndUpdate(
    { _id: "demo-user" },
    { email: "demo@example.com", name: "Demo Owner", passwordHash },
    { upsert: true, returnDocument: "after" },
  );

  const viewer = await User.findOneAndUpdate(
    { _id: "viewer-user" },
    { email: "viewer@example.com", name: "Demo Viewer", passwordHash },
    { upsert: true, returnDocument: "after" },
  );

  const document = await DocumentModel.findOneAndUpdate(
    { _id: "demo" },
    { $setOnInsert: { title: "Demo Document", ownerId: owner._id } },
    { upsert: true, returnDocument: "after" },
  );

  // Explicit rows for both, even though getRole() also falls back to
  // ownerId matching an implicit OWNER — every access should be traceable
  // to a real permission row where one can reasonably be created up front.
  await DocumentPermission.findOneAndUpdate(
    { documentId: document._id, userId: owner._id },
    { role: "OWNER" },
    { upsert: true },
  );
  await DocumentPermission.findOneAndUpdate(
    { documentId: document._id, userId: viewer._id },
    { role: "VIEWER" },
    { upsert: true },
  );

  console.log(`Seeded document "${document.title}" (${document._id})`);
  console.log(`  Owner:  ${owner.email} / ${DEMO_PASSWORD}`);
  console.log(`  Viewer: ${viewer.email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
