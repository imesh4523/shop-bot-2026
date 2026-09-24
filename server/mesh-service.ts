import crypto from "crypto";
import { db } from "./db";
import { storeMeshNodes, storeMeshPairCodes, storeMeshLogs, products, type StoreMeshNode, type StoreMeshPairCode, type StoreMeshLog } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import axios from "axios";

// Local server node fingerprint cache
let cachedLocalFingerprint: string | null = null;
const nonceCache = new Map<string, number>();

// Clean expired nonces every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [nonce, ts] of nonceCache.entries()) {
    if (now - ts > 10 * 60 * 1000) {
      nonceCache.delete(nonce);
    }
  }
}, 5 * 60 * 1000);

export async function initMeshDatabase(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS store_mesh_nodes (
        id SERIAL PRIMARY KEY,
        node_name TEXT NOT NULL,
        node_url TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        shared_secret TEXT NOT NULL,
        auth_token TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'online',
        description TEXT,
        sync_catalog BOOLEAN NOT NULL DEFAULT TRUE,
        sync_orders BOOLEAN NOT NULL DEFAULT FALSE,
        price_markup_pct INTEGER NOT NULL DEFAULT 0,
        last_ping_at TIMESTAMP,
        last_sync_at TIMESTAMP,
        latency_ms INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS store_mesh_pair_codes (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        host_url TEXT NOT NULL,
        secret_key TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS store_mesh_logs (
        id SERIAL PRIMARY KEY,
        node_id INTEGER,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        ip TEXT,
        details_json TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("[MESH] store_mesh_nodes, pair_codes, logs verified/created");
  } catch (err) {
    console.error("[MESH] Failed to init mesh tables:", err);
  }
}

export function getLocalFingerprint(): string {
  if (cachedLocalFingerprint) return cachedLocalFingerprint;
  const machineSeed = process.env.SESSION_SECRET || "SHOPEEFY_ENTERPRISE_MESH_SEED_2026";
  cachedLocalFingerprint = "MESH-" + crypto.createHash("sha256").update(machineSeed).digest("hex").slice(0, 16).toUpperCase();
  return cachedLocalFingerprint;
}

export async function logMeshEvent(eventType: string, message: string, nodeId?: number | null, ip?: string, details?: any): Promise<void> {
  try {
    await db.insert(storeMeshLogs).values({
      nodeId: nodeId || null,
      eventType,
      message,
      ip: ip || "internal",
      detailsJson: details ? JSON.stringify(details) : null,
    });
  } catch (err) {
    console.error("[MESH LOG ERROR]", err);
  }
}

/**
 * Generate a 1-time cryptographic pairing code for this store (Host Mode)
 */
export async function generatePairCode(hostUrl: string): Promise<{ code: string; hostUrl: string; expiresAt: Date; connectString: string }> {
  // Clean old expired codes
  try {
    await db.execute(sql`DELETE FROM store_mesh_pair_codes WHERE expires_at < NOW() OR used = TRUE`);
  } catch (e) {
    // ignore
  }

  const rawRandom = crypto.randomBytes(4).toString("hex").toUpperCase();
  const code = `MESH-${rawRandom.slice(0, 4)}-${rawRandom.slice(4, 8)}`;
  const secretKey = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

  const cleanHostUrl = hostUrl.replace(/\/+$/, "");

  await db.insert(storeMeshPairCodes).values({
    code,
    hostUrl: cleanHostUrl,
    secretKey,
    expiresAt,
    used: false,
  });

  const connectString = `${cleanHostUrl}|${code}`;

  await logMeshEvent("pair_code_generated", `Generated pair code ${code} valid for 15 mins`, null, "admin", { hostUrl: cleanHostUrl, code });

  return {
    code,
    hostUrl: cleanHostUrl,
    expiresAt,
    connectString,
  };
}

/**
 * Remote Store receives handshake request and issues mutual credentials
 */
export async function handleIncomingHandshake(data: {
  code: string;
  clientUrl: string;
  clientName: string;
  clientFingerprint: string;
  clientChallenge: string;
  ip?: string;
}): Promise<{
  success: boolean;
  nodeName: string;
  serverUrl: string;
  fingerprint: string;
  sharedSecret: string;
  authToken: string;
  message?: string;
}> {
  const { code, clientUrl, clientName, clientFingerprint, clientChallenge, ip } = data;

  if (!code || !clientUrl || !clientFingerprint) {
    await logMeshEvent("security_reject", "Handshake rejected: missing required handshake parameters", null, ip);
    throw new Error("Missing required handshake parameters");
  }

  const [pairRecord] = await db
    .select()
    .from(storeMeshPairCodes)
    .where(and(eq(storeMeshPairCodes.code, code.toUpperCase().trim()), eq(storeMeshPairCodes.used, false)));

  if (!pairRecord) {
    await logMeshEvent("security_reject", `Handshake rejected: Invalid or already used pair code ${code}`, null, ip);
    throw new Error("Invalid or expired pair code");
  }

  if (new Date() > new Date(pairRecord.expiresAt)) {
    await logMeshEvent("security_reject", `Handshake rejected: Expired pair code ${code}`, null, ip);
    throw new Error("Pair code has expired. Please generate a fresh code.");
  }

  // Mark pair code as used
  await db.update(storeMeshPairCodes).set({ used: true }).where(eq(storeMeshPairCodes.id, pairRecord.id));

  // Generate 256-bit cryptographically secure shared secret + token
  const sharedSecret = crypto.randomBytes(32).toString("hex");
  const authToken = "MTK_" + crypto.randomBytes(24).toString("hex");

  // Check if node with this fingerprint or url already exists
  const [existingNode] = await db
    .select()
    .from(storeMeshNodes)
    .where(eq(storeMeshNodes.fingerprint, clientFingerprint));

  let savedNodeId: number;

  if (existingNode) {
    await db
      .update(storeMeshNodes)
      .set({
        nodeName: clientName || existingNode.nodeName,
        nodeUrl: clientUrl.replace(/\/+$/, ""),
        sharedSecret,
        authToken,
        status: "online",
        lastPingAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storeMeshNodes.id, existingNode.id));
    savedNodeId = existingNode.id;
  } else {
    const [inserted] = await db
      .insert(storeMeshNodes)
      .values({
        nodeName: clientName || `Store Peer (${clientFingerprint.slice(0, 8)})`,
        nodeUrl: clientUrl.replace(/\/+$/, ""),
        fingerprint: clientFingerprint,
        sharedSecret,
        authToken,
        status: "online",
        description: `Paired via Host Code ${code}`,
        syncCatalog: true,
        syncOrders: false,
        priceMarkupPct: 0,
        lastPingAt: new Date(),
      })
      .returning();
    savedNodeId = inserted.id;
  }

  await logMeshEvent("handshake_success", `Successfully paired with incoming peer store [${clientName || clientFingerprint}]`, savedNodeId, ip, {
    clientUrl,
    clientFingerprint,
  });

  return {
    success: true,
    nodeName: "Host Shopeefy Store",
    serverUrl: pairRecord.hostUrl,
    fingerprint: getLocalFingerprint(),
    sharedSecret,
    authToken,
  };
}

/**
 * Connect to a Remote Store using Remote URL + Pair Code (Client Mode)
 */
export async function connectToRemoteStore(params: {
  remoteUrl: string;
  pairCode: string;
  nodeName?: string;
  description?: string;
  syncCatalog?: boolean;
  syncOrders?: boolean;
  priceMarkupPct?: number;
  myServerUrl: string;
}): Promise<StoreMeshNode> {
  const cleanRemoteUrl = params.remoteUrl.trim().replace(/\/+$/, "");
  const cleanCode = params.pairCode.trim().toUpperCase();
  const cleanMyUrl = params.myServerUrl.trim().replace(/\/+$/, "");

  const clientFingerprint = getLocalFingerprint();
  const clientChallenge = crypto.randomBytes(16).toString("hex");

  // Dispatch Handshake to Remote Peer Store
  const handshakeEndpoint = `${cleanRemoteUrl}/api/mesh/handshake/initiate`;
  
  let response;
  try {
    response = await axios.post(
      handshakeEndpoint,
      {
        code: cleanCode,
        clientUrl: cleanMyUrl,
        clientName: params.nodeName || "Shopeefy Client Store",
        clientFingerprint,
        clientChallenge,
      },
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ShopeefyMeshEngine/2.0",
        },
      }
    );
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.message || "Failed to reach remote store";
    await logMeshEvent("handshake_failed", `Failed to connect to remote store ${cleanRemoteUrl}: ${errorMsg}`, null, "internal");
    throw new Error(`Connection to peer failed: ${errorMsg}`);
  }

  const { success, nodeName: remoteName, fingerprint: remoteFingerprint, sharedSecret, authToken } = response.data;

  if (!success || !sharedSecret || !remoteFingerprint) {
    throw new Error("Remote peer returned an invalid handshake response");
  }

  // Check if existing
  const [existing] = await db
    .select()
    .from(storeMeshNodes)
    .where(eq(storeMeshNodes.fingerprint, remoteFingerprint));

  let savedNode: StoreMeshNode;

  if (existing) {
    const [updated] = await db
      .update(storeMeshNodes)
      .set({
        nodeName: params.nodeName || remoteName || existing.nodeName,
        nodeUrl: cleanRemoteUrl,
        sharedSecret,
        authToken,
        status: "online",
        description: params.description || existing.description,
        syncCatalog: params.syncCatalog ?? existing.syncCatalog,
        syncOrders: params.syncOrders ?? existing.syncOrders,
        priceMarkupPct: params.priceMarkupPct ?? existing.priceMarkupPct,
        lastPingAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storeMeshNodes.id, existing.id))
      .returning();
    savedNode = updated;
  } else {
    const [inserted] = await db
      .insert(storeMeshNodes)
      .values({
        nodeName: params.nodeName || remoteName || `Remote Peer (${cleanRemoteUrl})`,
        nodeUrl: cleanRemoteUrl,
        fingerprint: remoteFingerprint,
        sharedSecret,
        authToken,
        status: "online",
        description: params.description || `Connected via Pair Code ${cleanCode}`,
        syncCatalog: params.syncCatalog ?? true,
        syncOrders: params.syncOrders ?? false,
        priceMarkupPct: params.priceMarkupPct ?? 0,
        lastPingAt: new Date(),
      })
      .returning();
    savedNode = inserted;
  }

  await logMeshEvent("node_connected", `Peer connection established with [${savedNode.nodeName}] at ${cleanRemoteUrl}`, savedNode.id, "admin");

  return savedNode;
}

/**
 * Make a cryptographically signed HMAC-SHA256 request to a paired peer store
 */
export async function sendSignedMeshRequest(node: StoreMeshNode, endpoint: string, method: "GET" | "POST" = "GET", bodyData: any = null): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(12).toString("hex");
  const localFingerprint = getLocalFingerprint();

  const bodyString = bodyData ? JSON.stringify(bodyData) : "";
  const payloadToSign = `${method.toUpperCase()}:${endpoint}:${timestamp}:${nonce}:${bodyString}`;
  const signature = crypto.createHmac("sha256", node.sharedSecret).update(payloadToSign).digest("hex");

  const url = `${node.nodeUrl.replace(/\/+$/, "")}${endpoint}`;

  const headers: Record<string, string> = {
    "X-Mesh-Node-Id": localFingerprint,
    "X-Mesh-Timestamp": timestamp,
    "X-Mesh-Nonce": nonce,
    "X-Mesh-Signature": signature,
    "Authorization": `Bearer ${node.authToken}`,
    "Content-Type": "application/json",
    "User-Agent": "ShopeefyMeshEngine/2.0",
  };

  const response = await axios({
    url,
    method,
    headers,
    data: bodyData || undefined,
    timeout: 10000,
  });

  return response.data;
}

/**
 * Verify incoming signed mesh request from a paired peer store
 */
export async function verifyIncomingMeshRequest(req: any): Promise<{ valid: boolean; node?: StoreMeshNode; error?: string }> {
  const senderFingerprint = req.headers["x-mesh-node-id"] as string;
  const timestampStr = req.headers["x-mesh-timestamp"] as string;
  const nonce = req.headers["x-mesh-nonce"] as string;
  const signature = req.headers["x-mesh-signature"] as string;

  if (!senderFingerprint || !timestampStr || !nonce || !signature) {
    return { valid: false, error: "Missing cryptographic mesh headers" };
  }

  const timestamp = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);

  // 120s validity window
  if (Math.abs(now - timestamp) > 120) {
    return { valid: false, error: "Mesh request timestamp expired or clock desynchronized" };
  }

  // Anti-Replay check
  if (nonceCache.has(nonce)) {
    return { valid: false, error: "Replay attack detected: Nonce has already been processed" };
  }
  nonceCache.set(nonce, Date.now());

  // Find paired node in db
  const [node] = await db
    .select()
    .from(storeMeshNodes)
    .where(and(eq(storeMeshNodes.fingerprint, senderFingerprint), eq(storeMeshNodes.status, "online")));

  if (!node) {
    return { valid: false, error: "Unrecognized or revoked peer store node" };
  }

  const rawBody = req.rawBody || (req.body ? JSON.stringify(req.body) : "");
  const payloadToSign = `${req.method.toUpperCase()}:${req.path}:${timestampStr}:${nonce}:${rawBody}`;
  const expectedSignature = crypto.createHmac("sha256", node.sharedSecret).update(payloadToSign).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return { valid: false, error: "Cryptographic signature verification failed" };
  }

  return { valid: true, node };
}

/**
 * Ping Peer Node and measure latency
 */
export async function pingPeerNode(id: number): Promise<{ success: boolean; latencyMs: number; status: string; nodeName: string }> {
  const [node] = await db.select().from(storeMeshNodes).where(eq(storeMeshNodes.id, id));
  if (!node) throw new Error("Store node not found");

  const start = Date.now();
  try {
    const result = await sendSignedMeshRequest(node, "/api/mesh/peer/ping", "GET");
    const latencyMs = Date.now() - start;

    await db
      .update(storeMeshNodes)
      .set({
        status: "online",
        lastPingAt: new Date(),
        latencyMs,
        updatedAt: new Date(),
      })
      .where(eq(storeMeshNodes.id, id));

    await logMeshEvent("ping_success", `Peer ping successful (${latencyMs}ms)`, id, "admin", { latencyMs, result });

    return { success: true, latencyMs, status: "online", nodeName: node.nodeName };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    await db
      .update(storeMeshNodes)
      .set({
        status: "offline",
        lastPingAt: new Date(),
        latencyMs,
        updatedAt: new Date(),
      })
      .where(eq(storeMeshNodes.id, id));

    await logMeshEvent("ping_failed", `Peer ping failed: ${err.message}`, id, "admin", { error: err.message });
    return { success: false, latencyMs, status: "offline", nodeName: node.nodeName };
  }
}

/**
 * Fetch and sync products from a paired store node
 */
export async function syncPeerCatalog(id: number): Promise<{ success: boolean; productCount: number; syncedAt: Date }> {
  const [node] = await db.select().from(storeMeshNodes).where(eq(storeMeshNodes.id, id));
  if (!node) throw new Error("Store node not found");
  if (!node.syncCatalog) throw new Error("Catalog sync is disabled for this store node");

  try {
    const data = await sendSignedMeshRequest(node, "/api/mesh/peer/products", "GET");
    const remoteProducts = data.products || [];

    await db
      .update(storeMeshNodes)
      .set({
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storeMeshNodes.id, id));

    await logMeshEvent("catalog_synced", `Synced ${remoteProducts.length} items from peer [${node.nodeName}] with ${node.priceMarkupPct}% markup`, id, "admin", {
      count: remoteProducts.length,
      markup: node.priceMarkupPct,
    });

    return {
      success: true,
      productCount: remoteProducts.length,
      syncedAt: new Date(),
    };
  } catch (err: any) {
    await logMeshEvent("sync_failed", `Failed to sync products from peer [${node.nodeName}]: ${err.message}`, id, "admin");
    throw new Error(`Catalog sync failed: ${err.message}`);
  }
}

/**
 * List all paired nodes
 */
export async function getAllMeshNodes(): Promise<StoreMeshNode[]> {
  return await db.select().from(storeMeshNodes).orderBy(desc(storeMeshNodes.createdAt));
}

/**
 * Update node details (Name, Description, Sync Rules, Markup)
 */
export async function updateMeshNode(id: number, data: Partial<StoreMeshNode>): Promise<StoreMeshNode> {
  const [updated] = await db
    .update(storeMeshNodes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(storeMeshNodes.id, id))
    .returning();

  if (!updated) throw new Error("Store node not found");

  await logMeshEvent("node_updated", `Updated configuration for peer node [${updated.nodeName}]`, id, "admin", data);

  return updated;
}

/**
 * Remove / unpair a store node
 */
export async function deleteMeshNode(id: number): Promise<void> {
  const [node] = await db.select().from(storeMeshNodes).where(eq(storeMeshNodes.id, id));
  if (!node) return;

  await db.delete(storeMeshNodes).where(eq(storeMeshNodes.id, id));
  await logMeshEvent("node_unpaired", `Unpaired and revoked link with [${node.nodeName}] (${node.nodeUrl})`, id, "admin");
}

/**
 * Get recent mesh activity logs
 */
export async function getMeshLogs(limit: number = 30): Promise<StoreMeshLog[]> {
  return await db.select().from(storeMeshLogs).orderBy(desc(storeMeshLogs.createdAt)).limit(limit);
}
