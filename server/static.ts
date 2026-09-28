import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Do NOT serve index.html for missing assets (/assets/*.js, .css, etc.)
  app.use("/assets", (_req, res) => {
    res.status(404).send("Asset not found");
  });

  // fall through to index.html for all frontend SPA GET routes
  let cachedIndexHtml: string | null = null;
  const indexPath = path.resolve(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    try {
      cachedIndexHtml = fs.readFileSync(indexPath, "utf8");
    } catch {}
  }

  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      
      // Serve cached or live index.html
      if (cachedIndexHtml) {
        return res.status(200).send(cachedIndexHtml);
      }

      return res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(200).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>YouuHost · Cloud & AI Store</title></head><body><div id="root"></div></body></html>`);
        }
      });
    }
    next();
  });
}
