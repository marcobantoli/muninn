import express from "express";
import cors from "cors";
import { profileRoutes } from "./routes/profiles";
import { recognitionRoutes } from "./routes/recognition";
import { conversationRoutes } from "./routes/conversation";

const PORT = 3001;

export async function startBackendServer(): Promise<void> {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Routes
  app.use("/api/profiles", profileRoutes);
  app.use("/api", recognitionRoutes);
  app.use("/api/conversation", conversationRoutes);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "muninn-backend",
      timestamp: new Date().toISOString(),
    });
  });

  function tryListen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = app.listen(port, () => {
        console.log(
          `[MUNINN] Backend server running on http://localhost:${port}`,
        );
        resolve();
      });
      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          console.warn(`[MUNINN] Port ${port} in use, trying ${port + 1}...`);
          server.close();
          tryListen(port + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  return tryListen(PORT);
}
