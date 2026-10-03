import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const candidatePaths = [
    path.resolve(__dirname, "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(__dirname, "..", "dist", "public"),
    path.resolve(process.cwd(), "client"),
  ];

  let distPath = candidatePaths.find((p) => fs.existsSync(p) && fs.existsSync(path.resolve(p, "index.html"))) || candidatePaths[0];

  if (!fs.existsSync(distPath)) {
    console.warn(`[STATIC] Warning: Could not find build directory in candidates: ${candidatePaths.join(", ")}`);
    // Fallback safely to cwd/dist/public or cwd/client
    distPath = path.resolve(process.cwd(), "dist", "public");
  }

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  // Mount static uploads directory candidates directly
  const uploadsCandidates = [
    path.resolve(distPath, "uploads"),
    path.resolve(process.cwd(), "public", "uploads"),
    path.resolve(process.cwd(), "uploads"),
  ];
  for (const up of uploadsCandidates) {
    if (fs.existsSync(up)) {
      app.use("/uploads", express.static(up, { maxAge: "1d" }));
    }
  }

  // Do NOT serve index.html for missing /uploads or /assets
  app.use("/uploads", (_req, res) => {
    res.status(404).send("Upload not found");
  });
  app.use("/assets", (_req, res) => {
    res.status(404).send("Asset not found");
  });

  // Fall through to index.html for all frontend SPA GET routes
  let cachedIndexHtml: string | null = null;
  const indexPath = path.resolve(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    try {
      cachedIndexHtml = fs.readFileSync(indexPath, "utf8");
    } catch {}
  }

  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      // Don't intercept API documentation or spec endpoints
      if (req.path === "/docs" || req.path === "/api-docs" || req.path === "/openapi.json") {
        return next();
      }

      const forwarded = req.headers["x-forwarded-host"];
      let rawHost = "";
      if (typeof forwarded === "string") {
        rawHost = forwarded.split(",")[0].trim();
      } else if (Array.isArray(forwarded) && forwarded.length > 0) {
        rawHost = forwarded[0].trim();
      } else {
        rawHost = (req.headers["host"] as string) || req.hostname || "";
      }
      const host = rawHost.split(":")[0].toLowerCase().trim();

      // On API subdomains, let the dedicated API & Scalar docs handler respond
      if (host.startsWith("api.") || host === "api.youuhost.com") {
        return next();
      }

      // Security Domain Isolation: Admin routes can ONLY be accessed from imeshmain2.youuhost.com or localhost
      if (req.path.startsWith("/imeshadmindashbord")) {
        const isAdmin =
          host === "imeshmain2.youuhost.com" ||
          host.startsWith("imeshmain2.") ||
          host.startsWith("admin.") ||
          host.endsWith(".ondigitalocean.app") ||
          host === "localhost" ||
          host === "127.0.0.1" ||
          host.endsWith(".localhost");
        if (!isAdmin) {
          return res.status(404).send(`<!DOCTYPE html><html lang="en"><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>`);
        }
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");

      // Serve cached or live index.html
      if (cachedIndexHtml) {
        return res.status(200).send(cachedIndexHtml);
      }

      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath, (err) => {
          if (err && !res.headersSent) {
            res.status(200).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>YouuHost · Cloud & AI Store</title></head><body><div id="root"></div></body></html>`);
          }
        });
      }

      return res.status(200).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>YouuHost · Cloud & AI Store</title></head><body><div id="root"></div></body></html>`);
    }
    next();
  });
}
