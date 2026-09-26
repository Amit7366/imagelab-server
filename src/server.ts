import { createApp } from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { ensureStorage } from "./modules/asset/storage";

async function start() {
  await connectDatabase();
  await ensureStorage();
  const app = createApp();
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`API listening on http://0.0.0.0:${env.PORT}`);
  });
  server.on("error", (error) => {
    console.error("Failed to listen", error);
    process.exit(1);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
