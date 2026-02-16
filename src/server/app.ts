import express from "express";
import { resolve } from "node:path";
import { createApiRouter, type RoutesDeps } from "./routes.js";

export function createApp(deps: RoutesDeps): express.Express {
  const app = express();

  app.use(express.json());

  // API routes
  app.use("/api", createApiRouter(deps));

  // Serve static UI files
  const uiDir = resolve(__dirname, "../../public");
  app.use(express.static(uiDir));
  
  // Serve node_modules for frontend dependencies
  const nodeModulesDir = resolve(__dirname, "../../node_modules");
  app.use("/node_modules", express.static(nodeModulesDir));

  // SPA fallback
  app.get("*", (_req, res) => {
    res.sendFile(resolve(uiDir, "index.html"));
  });

  return app;
}
