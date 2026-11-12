import { createServer } from "node:http";
import { createApp } from "./app";
import { setupVite, serveStatic, log } from "./vite";

(async () => {
  const app = createApp();
  const server = createServer(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT ?? 5000);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
