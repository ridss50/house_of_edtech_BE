import "dotenv/config";
import { connectDB } from "./db/mongoose";
import { createApp } from "./create-app";

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

const { server } = createApp(CORS_ORIGIN);

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Backend listening on http://localhost:${PORT} (ws: /sync)`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  });
