import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { securityShieldMiddleware } from "./security-shield";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { log } from "./log";
import { createServer } from "http";
import { Server } from "socket.io/dist/index.js";

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ [GLOBAL SAFETY] Unhandled Rejection caught (server will NOT crash):", reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ [GLOBAL SAFETY] Uncaught Exception caught (server will NOT crash):", error?.message || error);
});

const app = express();
app.set("trust proxy", true);

const httpServer = createServer(app);
// Cloudflare Keep-Alive timeout alignment to eliminate Error 520 / 521 / 522 Host Errors
httpServer.keepAliveTimeout = 65000; // > 60s Cloudflare timeout
httpServer.headersTimeout = 66000;

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  log(`Client connected: ${socket.id}`, "socket.io");
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Immediate Cloudflare & Load Balancer Health Check Probes (Bypass rate limit & shields)
app.get(["/health", "/api/health", "/ping"], (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Enterprise Cybersecurity Shield (WAF, Scanner Blocker, Anti-Injection, IP Jail, Rate Limiter)
app.use(securityShieldMiddleware);



app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function startServer() {
  try {
    const port = parseInt(process.env.PORT || "5000", 10);
    console.log(`[SERVER] Attempting to listen on port ${port}...`);

    httpServer.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`⚠️ [SERVER PORT WARNING] Port ${port} is occupied. Retrying connection in 1.5s...`);
        setTimeout(() => {
          httpServer.close();
          httpServer.listen({ port, host: "0.0.0.0" });
        }, 1500);
      } else {
        console.error("❌ Server HTTP error:", err?.message || err);
      }
    });

    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
      },
      () => {
        log(`Server started: Port ${port}`);
        console.log(`✅ Server successfully listening on http://0.0.0.0:${port}`);
      },
    );

    // Cloudflare Keep-Alive timeout alignment to eliminate Error 520 / 521 / 522 Host Errors
    httpServer.keepAliveTimeout = 65000; // > 60s Cloudflare timeout
    httpServer.headersTimeout = 66000;
    httpServer.requestTimeout = 300000;
    httpServer.maxHeadersCount = 0;

    console.log("[SERVER] Registering routes...");
    await registerRoutes(httpServer, app, io);
    
    // Initialize Admin and Database Tables
    console.log("[SERVER] Initializing admin...");
    const { storage } = await import("./storage");
    await storage.initializeAdmin();

    // Start AWS Background Sync
    console.log("[SERVER] Starting AWS sync...");
    const { startAwsBackgroundSync } = await import("./aws-service");
    startAwsBackgroundSync();

    // Init VAPID Push Notifications
    console.log("[SERVER] Initializing push notifications...");
    const { initPushNotifications } = await import("./push-notifications");
    await initPushNotifications();

    // Init Store Mesh Federation Database
    console.log("[SERVER] Initializing store mesh federation...");
    const { initMeshDatabase } = await import("./mesh-service");
    await initMeshDatabase();

    if (process.env.NODE_ENV === "production") {
      console.log("[SERVER] Serving static assets...");
      serveStatic(app);
    } else {
      console.log("[SERVER] Setting up Vite dev server...");
      import("./vite").then(async ({ setupVite }) => {
        await setupVite(httpServer, app);
        console.log("✅ Vite dev server setup complete!");
      }).catch(err => {
        console.error("Vite setup error:", err);
      });
    }

    // Global Final Error Boundary Handler (Never drop connection on Cloudflare)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.status(status).json({ message, status });
      }
    });
  } catch (error) {
    log(`Failed to start server: ${error}`);
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
