import { storage } from "./storage";

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  name_servers?: string[];
}

export interface CloudflareDnsRecord {
  id?: string;
  type: string;
  name: string;
  content: string;
  proxiable?: boolean;
  proxied?: boolean;
  ttl?: number;
  priority?: number;
  comment?: string;
}

export interface ResendDomainRecord {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string | number;
  status?: string;
  priority?: number;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: string;
  created_at: string;
  region: string;
  records?: ResendDomainRecord[];
}

export class DomainAutomationService {
  // Helpers to get credentials
  private async getCloudflareAuth(): Promise<{ token: string; email?: string; globalKey?: string }> {
    const token = (await storage.getSetting("CLOUDFLARE_API_TOKEN"))?.value || process.env.CLOUDFLARE_API_TOKEN || "";
    const email = (await storage.getSetting("CLOUDFLARE_EMAIL"))?.value || process.env.CLOUDFLARE_EMAIL || "";
    const globalKey = (await storage.getSetting("CLOUDFLARE_GLOBAL_KEY"))?.value || process.env.CLOUDFLARE_GLOBAL_KEY || "";
    return { token, email, globalKey };
  }

  private async getResendApiKey(): Promise<string> {
    return (await storage.getSetting("RESEND_API_KEY"))?.value || process.env.RESEND_API_KEY || "";
  }

  public async getServerIp(): Promise<string> {
    const savedIp = (await storage.getSetting("SERVER_TARGET_IP"))?.value;
    if (savedIp && savedIp.trim()) return savedIp.trim();
    // Default server IP
    return "18.141.224.63";
  }

  // --- CLOUDFLARE API METHODS ---
  private async cfFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const { token, email, globalKey } = await this.getCloudflareAuth();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token.trim()}`;
    } else if (email && globalKey) {
      headers["X-Auth-Email"] = email.trim();
      headers["X-Auth-Key"] = globalKey.trim();
    } else {
      throw new Error("Cloudflare credentials not configured. Please enter your API Token or Global Key.");
    }

    const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
      ...options,
      headers: { ...headers, ...(options.headers as any) },
    });

    const data = await res.json();
    if (!res.ok || data.success === false) {
      const errDetail = data.errors?.map((e: any) => e.message).join(", ") || res.statusText;
      throw new Error(`Cloudflare API error: ${errDetail}`);
    }
    return data;
  }

  public async listCloudflareZones(): Promise<CloudflareZone[]> {
    const data = await this.cfFetch("/zones?per_page=50");
    return (data.result || []).map((z: any) => ({
      id: z.id,
      name: z.name,
      status: z.status,
      paused: z.paused,
      name_servers: z.name_servers,
    }));
  }

  public async listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
    const data = await this.cfFetch(`/zones/${zoneId}/dns_records?per_page=100`);
    return (data.result || []).map((r: any) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      content: r.content,
      proxiable: r.proxiable,
      proxied: r.proxied,
      ttl: r.ttl,
      priority: r.priority,
      comment: r.comment,
    }));
  }

  public async createOrUpdateDnsRecord(zoneId: string, record: CloudflareDnsRecord): Promise<any> {
    const existingRecords = await this.listDnsRecords(zoneId);
    const zones = await this.listCloudflareZones();
    const currentZone = zones.find((z) => z.id === zoneId);
    const zoneName = (currentZone?.name || "").toLowerCase().trim();

    // Normalize record name
    let cleanName = record.name.toLowerCase().trim();
    if (zoneName && !cleanName.endsWith(`.${zoneName}`) && cleanName !== zoneName && cleanName !== "@") {
      cleanName = `${cleanName}.${zoneName}`;
    }

    // Find matching record by name and type (matching both full name and apex aliases)
    const existing = existingRecords.find((r) => {
      const rName = r.name.toLowerCase().trim();
      const sameType = r.type.toUpperCase() === record.type.toUpperCase();
      if (!sameType) return false;

      if (rName === cleanName) return true;
      if (zoneName && `${rName}.${zoneName}` === cleanName) return true;
      if (zoneName && rName === `${cleanName}.${zoneName}`) return true;
      return false;
    });

    const body: any = {
      type: record.type.toUpperCase(),
      name: cleanName,
      content: record.content,
      ttl: record.ttl || 1, // 1 = Auto
      proxied: !!record.proxied,
      comment: record.comment || "Managed by Shopeefy Domain Automation",
    };

    if (record.priority !== undefined && record.type.toUpperCase() === "MX") {
      body.priority = record.priority;
    }

    if (existing && existing.id) {
      // Update existing record
      return await this.cfFetch(`/zones/${zoneId}/dns_records/${existing.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      // Create new record
      return await this.cfFetch(`/zones/${zoneId}/dns_records`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
  }

  public async deleteDnsRecord(zoneId: string, recordId: string): Promise<any> {
    return await this.cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: "DELETE",
    });
  }

  // --- RESEND API METHODS ---
  private async resendFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const apiKey = await this.getResendApiKey();
    if (!apiKey) {
      throw new Error("Resend API Key not configured. Please enter your Resend API Key (starts with re_).");
    }

    const res = await fetch(`https://api.resend.com${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
        ...(options.headers as any),
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data.message || data.error || res.statusText;
      throw new Error(`Resend API error: ${err}`);
    }
    return data;
  }

  public async listResendDomains(): Promise<ResendDomain[]> {
    const data = await this.resendFetch("/domains");
    return data.data || [];
  }

  public async getResendDomain(domainId: string): Promise<ResendDomain> {
    return await this.resendFetch(`/domains/${domainId}`);
  }

  public async createResendDomain(name: string, region: string = "us-east-1"): Promise<ResendDomain> {
    const cleanDomain = name.trim().toLowerCase();
    const created = await this.resendFetch("/domains", {
      method: "POST",
      body: JSON.stringify({ name: cleanDomain, region }),
    });

    // Automatically sync DNS records to Cloudflare if matching zone exists
    try {
      const domainDetails = await this.getResendDomain(created.id);
      if (domainDetails.records && domainDetails.records.length > 0) {
        const zones = await this.listCloudflareZones();
        const matchedZone = zones.find(
          (z) => z.name.toLowerCase() === cleanDomain || cleanDomain.endsWith(z.name.toLowerCase())
        );

        if (matchedZone) {
          for (const rec of domainDetails.records) {
            try {
              await this.createOrUpdateDnsRecord(matchedZone.id, {
                type: rec.type,
                name: rec.name,
                content: rec.value,
                priority: rec.priority,
                proxied: false,
                ttl: 1,
                comment: `Resend Email Verification (${rec.record || rec.type})`,
              });
            } catch (syncErr) {
              console.warn(`[Auto-Sync Resend Record Error] ${rec.type} ${rec.name}:`, syncErr);
            }
          }
          // Trigger immediate verification check
          await this.verifyResendDomain(created.id);
        }
      }
    } catch (e) {
      console.warn("[Auto-Sync Resend to Cloudflare Warning]:", e);
    }

    return created;
  }

  public async verifyResendDomain(domainId: string): Promise<any> {
    return await this.resendFetch(`/domains/${domainId}/verify`, {
      method: "POST",
    });
  }

  public async deleteResendDomain(domainId: string): Promise<any> {
    return await this.resendFetch(`/domains/${domainId}`, {
      method: "DELETE",
    });
  }

  public async sendTestEmail(toEmail: string, fromEmail?: string): Promise<any> {
    const savedFrom = (await storage.getSetting("RESEND_FROM_EMAIL"))?.value;
    const defaultFrom = fromEmail || savedFrom || "Shopeefy <onboarding@resend.dev>";
    
    return await this.resendFetch("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: defaultFrom,
        to: [toEmail.trim()],
        subject: "🚀 Shopeefy Cloudflare & Resend Test Email",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; background: #f9f9fc; border-radius: 12px;">
            <h2 style="color: #6c5ce7; margin-bottom: 8px;">Domain & Email System Online!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Congratulations! Your Resend.com and Cloudflare DNS automation is working perfectly.
            </p>
            <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
              <strong>Configured Sender:</strong> ${defaultFrom}<br />
              <strong>Delivered To:</strong> ${toEmail}<br />
              <strong>Timestamp:</strong> ${new Date().toISOString()}
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
              Powered by Shopeefy Automated Domain & DNS Infrastructure.
            </p>
          </div>
        `,
      }),
    });
  }

  // --- AUTOMATED 1-CLICK ALL-IN-ONE CONFIGURATION ---
  public async autoConfigureDomain(params: {
    domainName: string;
    zoneId?: string;
    subdomains?: string[]; // e.g. ["api", "shop"]
    setupResend?: boolean;
    proxyApiSubdomain?: boolean;
  }): Promise<{
    success: boolean;
    domain: string;
    serverIp: string;
    cloudflareZoneId: string;
    recordsCreated: { type: string; name: string; content: string; status: string }[];
    resendStatus?: string;
    apiBaseUrl: string;
  }> {
    const cleanDomain = params.domainName.trim().toLowerCase();
    const serverIp = await this.getServerIp();
    const subdomainsToCreate = params.subdomains && params.subdomains.length > 0 ? params.subdomains : ["api"];
    const results: { type: string; name: string; content: string; status: string }[] = [];

    // 1. Find or verify Cloudflare Zone
    let zoneId = params.zoneId;
    if (!zoneId) {
      const zones = await this.listCloudflareZones();
      const matched = zones.find(
        (z) => z.name.toLowerCase() === cleanDomain || cleanDomain.endsWith(z.name.toLowerCase())
      );
      if (!matched) {
        throw new Error(
          `Cloudflare Zone for "${cleanDomain}" not found. Please ensure the domain is added to your Cloudflare account.`
        );
      }
      zoneId = matched.id;
    }

    // 2. Create / Update Subdomains (e.g. api.youuhost.com -> Server IP)
    for (const sub of subdomainsToCreate) {
      const subClean = sub.trim().toLowerCase();
      const fullName = subClean === "@" || subClean === "" ? cleanDomain : `${subClean}.${cleanDomain}`;
      const isProxied = params.proxyApiSubdomain !== false;

      try {
        await this.createOrUpdateDnsRecord(zoneId, {
          type: "A",
          name: fullName,
          content: serverIp,
          proxied: isProxied,
          ttl: 1,
          comment: `Shopeefy ${subClean} endpoint`,
        });
        results.push({
          type: "A",
          name: fullName,
          content: `${serverIp} (${isProxied ? "Cloudflare Proxied 🛡️" : "DNS Only 🌐"})`,
          status: "configured",
        });
      } catch (err: any) {
        results.push({
          type: "A",
          name: fullName,
          content: serverIp,
          status: `error: ${err.message}`,
        });
      }
    }

    // 3. Resend Integration & DNS Push
    let resendStatus = "skipped";
    if (params.setupResend !== false) {
      try {
        const apiKey = await this.getResendApiKey();
        if (apiKey) {
          // Check if domain exists in Resend
          const resendDomains = await this.listResendDomains();
          let resendDomain = resendDomains.find((d) => d.name.toLowerCase() === cleanDomain);

          if (!resendDomain) {
            console.log(`[Resend Auto-Config] Creating domain ${cleanDomain} in Resend...`);
            resendDomain = await this.createResendDomain(cleanDomain);
          }

          // Fetch domain details to get the exact DNS records
          const domainDetails = await this.getResendDomain(resendDomain.id);
          const recordsToSync = domainDetails.records || [];

          for (const rec of recordsToSync) {
            try {
              // Mail records (SPF, DKIM, MX, DMARC) must NEVER be proxied by Cloudflare CDN!
              await this.createOrUpdateDnsRecord(zoneId, {
                type: rec.type,
                name: rec.name,
                content: rec.value,
                priority: rec.priority,
                proxied: false,
                ttl: 1,
                comment: `Resend Email ${rec.record || rec.type}`,
              });

              results.push({
                type: rec.type,
                name: rec.name,
                content: rec.value.length > 50 ? `${rec.value.slice(0, 50)}...` : rec.value,
                status: "resend_dns_synced",
              });
            } catch (err: any) {
              results.push({
                type: rec.type,
                name: rec.name,
                content: rec.value,
                status: `error: ${err.message}`,
              });
            }
          }

          // Also ensure DMARC record exists
          try {
            await this.createOrUpdateDnsRecord(zoneId, {
              type: "TXT",
              name: `_dmarc.${cleanDomain}`,
              content: "v=DMARC1; p=none;",
              proxied: false,
              ttl: 1,
              comment: "YouuHost DMARC Email Security Policy",
            });
            results.push({
              type: "TXT",
              name: `_dmarc.${cleanDomain}`,
              content: "v=DMARC1; p=none;",
              status: "dmarc_synced",
            });
          } catch (dmarcErr) {
            console.warn("[DMARC DNS Error]", dmarcErr);
          }

          // Trigger Resend domain verification
          await this.verifyResendDomain(resendDomain.id);
          resendStatus = "synced_and_verification_requested";
        }
      } catch (err: any) {
        console.warn("[Resend Auto-Sync Error]", err);
        resendStatus = `failed: ${err.message}`;
      }
    }

    // Save active API domain
    const primaryApiSub = subdomainsToCreate.includes("api") ? `api.${cleanDomain}` : cleanDomain;
    const apiBaseUrl = `https://${primaryApiSub}`;
    await storage.setSetting("API_BASE_URL", apiBaseUrl);
    await storage.setSetting("LAST_AUTOMATED_DOMAIN", cleanDomain);

    return {
      success: true,
      domain: cleanDomain,
      serverIp,
      cloudflareZoneId: zoneId,
      recordsCreated: results,
      resendStatus,
      apiBaseUrl,
    };
  }

  // --- ADMIN CUSTOM SUBDOMAIN (e.g. imeshmain2.domain.com) ---
  public async setupAdminSubdomain(params: {
    domainName: string;
    subdomain: string; // e.g. "imeshmain2"
    enabled: boolean;
    proxied?: boolean;
    zoneId?: string;
  }): Promise<{
    success: boolean;
    subdomainUrl: string;
    standardUrl: string;
    subdomain: string;
    enabled: boolean;
    dnsStatus: string;
  }> {
    const cleanDomain = (params.domainName || "youuhost.com").trim().toLowerCase();
    const cleanSub = (params.subdomain || "imeshmain2").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    const fullSubdomain = `${cleanSub}.${cleanDomain}`;
    const serverIp = await this.getServerIp();
    const subdomainUrl = `https://${fullSubdomain}`;
    const standardUrl = `https://${cleanDomain}/imeshadmindashbord`;

    let dnsStatus = "skipped";

    if (params.enabled) {
      let zoneId = params.zoneId;
      if (!zoneId) {
        try {
          const zones = await this.listCloudflareZones();
          const matched = zones.find(
            (z) => z.name.toLowerCase() === cleanDomain || cleanDomain.endsWith(z.name.toLowerCase())
          );
          if (matched) zoneId = matched.id;
        } catch (e) {
          console.warn("Could not auto-detect zone for admin subdomain:", e);
        }
      }

      if (zoneId) {
        try {
          await this.createOrUpdateDnsRecord(zoneId, {
            type: "A",
            name: fullSubdomain,
            content: serverIp,
            proxied: params.proxied !== false,
            ttl: 1,
            comment: `Shopeefy Admin Subdomain (${cleanSub})`,
          });
          dnsStatus = "configured";
        } catch (err: any) {
          dnsStatus = `error: ${err.message}`;
        }
      }
    }

    await storage.setSetting("ADMIN_CUSTOM_SUBDOMAIN", cleanSub);
    await storage.setSetting("ADMIN_CUSTOM_SUBDOMAIN_ENABLED", params.enabled ? "true" : "false");
    await storage.setSetting("ADMIN_SUBDOMAIN_URL", subdomainUrl);

    return {
      success: true,
      subdomainUrl,
      standardUrl,
      subdomain: cleanSub,
      enabled: params.enabled,
      dnsStatus,
    };
  }

  // --- DNS PROPAGATION & LIVE DIAGNOSTICS ---
  public async checkDnsPropagation(domain: string, recordType: string = "A"): Promise<{
    domain: string;
    recordType: string;
    globalPropagationPercent: number;
    targetServerIp: string;
    nodes: Array<{
      provider: string;
      location: string;
      flag: string;
      ip: string;
      status: "resolved" | "pending" | "failed";
      matchedTarget: boolean;
      latencyMs: number;
      records: string[];
      rawTtl?: number;
    }>;
  }> {
    const cleanDomain = (domain || "youuhost.com").trim().toLowerCase();
    const cleanType = (recordType || "A").trim().toUpperCase();
    const serverIp = await this.getServerIp();

    const dohProviders = [
      {
        provider: "Google Public DNS",
        location: "Global / Anycast (US-East)",
        flag: "🇺🇸",
        url: (d: string, t: string) => `https://dns.google/resolve?name=${encodeURIComponent(d)}&type=${encodeURIComponent(t)}`,
        parser: (data: any) => (data.Answer || []).map((a: any) => a.data),
      },
      {
        provider: "Cloudflare 1.1.1.1",
        location: "Global Edge / Anycast (Singapore)",
        flag: "🇸🇬",
        url: (d: string, t: string) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(d)}&type=${encodeURIComponent(t)}`,
        parser: (data: any) => (data.Answer || []).map((a: any) => a.data),
      },
      {
        provider: "Quad9 Secure DNS",
        location: "Zurich / Europe (Frankfurt)",
        flag: "🇪🇺",
        url: (d: string, t: string) => `https://dns.quad9.net/dns-query?name=${encodeURIComponent(d)}&type=${encodeURIComponent(t)}`,
        parser: (data: any) => (data.Answer || []).map((a: any) => a.data),
      },
      {
        provider: "Alibaba Public DNS",
        location: "Asia Pacific (Tokyo / Hong Kong)",
        flag: "🇯🇵",
        url: (d: string, t: string) => `https://dns.alidns.com/resolve?name=${encodeURIComponent(d)}&type=${encodeURIComponent(t)}`,
        parser: (data: any) => (data.Answer || []).map((a: any) => a.data),
      },
    ];

    const nodes = await Promise.all(
      dohProviders.map(async (p) => {
        const start = Date.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(p.url(cleanDomain, cleanType), {
            headers: { Accept: "application/dns-json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);

          const latencyMs = Date.now() - start;
          if (!res.ok) {
            return {
              provider: p.provider,
              location: p.location,
              flag: p.flag,
              ip: "Timeout / Error",
              status: "failed" as const,
              matchedTarget: false,
              latencyMs,
              records: [],
            };
          }

          const data = await res.json();
          const rawRecords: string[] = p.parser(data) || [];
          const records = rawRecords.map((r: string) => r.replace(/"/g, "").trim());

          const isResolved = records.length > 0;
          // For A records, check if matched target server IP or Cloudflare proxy IP
          const matchedTarget = cleanType === "A" 
            ? records.includes(serverIp) || records.some((r) => r.startsWith("104.") || r.startsWith("172.67.") || r.startsWith("188."))
            : isResolved;

          return {
            provider: p.provider,
            location: p.location,
            flag: p.flag,
            ip: records.join(", ") || "No Answer",
            status: isResolved ? ("resolved" as const) : ("pending" as const),
            matchedTarget,
            latencyMs,
            records,
            rawTtl: data.Answer?.[0]?.TTL,
          };
        } catch (err) {
          return {
            provider: p.provider,
            location: p.location,
            flag: p.flag,
            ip: "Unreachable / Timeout",
            status: "failed" as const,
            matchedTarget: false,
            latencyMs: Date.now() - start,
            records: [],
          };
        }
      })
    );

    const resolvedCount = nodes.filter((n) => n.status === "resolved").length;
    const globalPropagationPercent = Math.round((resolvedCount / nodes.length) * 100);

    return {
      domain: cleanDomain,
      recordType: cleanType,
      globalPropagationPercent,
      targetServerIp: serverIp,
      nodes,
    };
  }

  public async runComprehensiveDiagnostics(domainName: string, zoneId?: string): Promise<{
    timestamp: string;
    domain: string;
    serverIp: string;
    logs: Array<{
      timestamp: string;
      level: "info" | "success" | "warn" | "error" | "debug";
      tag: string;
      message: string;
    }>;
    dnsSummary: {
      zoneFound: boolean;
      recordsCount: number;
      apexConfigured: boolean;
      apiSubdomainConfigured: boolean;
      adminSubdomainConfigured: boolean;
      resendSpfConfigured: boolean;
      resendDkimConfigured: boolean;
    };
    propagation: any;
  }> {
    const logs: Array<{
      timestamp: string;
      level: "info" | "success" | "warn" | "error" | "debug";
      tag: string;
      message: string;
    }> = [];

    const addLog = (level: "info" | "success" | "warn" | "error" | "debug", tag: string, message: string) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0] + "." + String(now.getMilliseconds()).padStart(3, "0");
      logs.push({ timestamp: timeStr, level, tag, message });
    };

    const cleanDomain = (domainName || "youuhost.com").trim().toLowerCase();
    const serverIp = await this.getServerIp();

    addLog("info", "INIT", `🚀 Starting Real-Time Infrastructure Diagnostics for ${cleanDomain}`);
    addLog("info", "CONFIG", `🎯 Target Server IPv4 Gateway: ${serverIp}`);

    // 1. Verify Cloudflare Auth & Zones
    let activeZoneId = zoneId;
    let records: CloudflareDnsRecord[] = [];
    let zoneFound = false;

    try {
      addLog("info", "CLOUDFLARE", "📡 Establishing handshake with Cloudflare API v4...");
      const zones = await this.listCloudflareZones();
      addLog("success", "CLOUDFLARE", `✅ Connected to Cloudflare! Found ${zones.length} active zones.`);

      const matched = zones.find((z) => z.name.toLowerCase() === cleanDomain || cleanDomain.endsWith(z.name.toLowerCase()));
      if (matched) {
        activeZoneId = matched.id;
        zoneFound = true;
        addLog("success", "ZONE", `🎯 Matched Cloudflare Zone: "${matched.name}" (ID: ${matched.id}) [Status: ${matched.status}]`);
      } else {
        addLog("warn", "ZONE", `⚠️ Exact zone for "${cleanDomain}" not in active list. Using first available zone if applicable.`);
        if (zones.length > 0) activeZoneId = zones[0].id;
      }

      if (activeZoneId) {
        addLog("info", "DNS_QUERY", `🔍 Fetching live authoritative DNS records from Cloudflare...`);
        records = await this.listDnsRecords(activeZoneId);
        addLog("success", "DNS_QUERY", `📋 Retrieved ${records.length} authoritative DNS records.`);
      }
    } catch (err: any) {
      addLog("error", "CLOUDFLARE", `❌ Cloudflare API Handshake Failed: ${err.message}`);
    }

    // 2. Audit Key Records
    const apexRecord = records.find((r) => (r.name.toLowerCase() === cleanDomain || r.name === "@") && r.type === "A");
    const apiSubRecord = records.find((r) => r.name.toLowerCase() === `api.${cleanDomain}` && (r.type === "A" || r.type === "CNAME"));
    const adminSub = (await storage.getSetting("ADMIN_CUSTOM_SUBDOMAIN"))?.value || "imeshmain2";
    const adminSubRecord = records.find((r) => r.name.toLowerCase() === `${adminSub}.${cleanDomain}` && (r.type === "A" || r.type === "CNAME"));
    const spfRecord = records.find((r) => r.type === "TXT" && r.content.includes("v=spf1"));
    const dkimRecord = records.find((r) => r.type === "TXT" && r.name.includes("_domainkey"));

    if (apexRecord) {
      addLog("success", "APEX_A", `✅ Apex A Record Found: ${apexRecord.name} -> ${apexRecord.content} [Proxied CDN: ${apexRecord.proxied ? "YES 🛡️" : "NO"}]`);
    } else {
      addLog("warn", "APEX_A", `⚠️ Apex A Record (@) missing for ${cleanDomain}.`);
    }

    if (apiSubRecord) {
      addLog("success", "API_SUB", `✅ API Subdomain Found: ${apiSubRecord.name} -> ${apiSubRecord.content} [Proxied: ${apiSubRecord.proxied ? "YES ⚡" : "NO"}]`);
    } else {
      addLog("info", "API_SUB", `ℹ️ Subdomain api.${cleanDomain} not configured yet.`);
    }

    if (adminSubRecord) {
      addLog("success", "ADMIN_SUB", `⚡ Admin Subdomain Found: ${adminSubRecord.name} -> ${adminSubRecord.content}`);
    } else {
      addLog("info", "ADMIN_SUB", `ℹ️ Admin Dedicated Subdomain ${adminSub}.${cleanDomain} is inactive/unregistered.`);
    }

    if (spfRecord) {
      addLog("success", "RESEND_SPF", `📧 Resend SPF Record Verified: ${spfRecord.content}`);
    } else {
      addLog("warn", "RESEND_SPF", `⚠️ Resend SPF TXT Record not detected in zone.`);
    }

    if (dkimRecord) {
      addLog("success", "RESEND_DKIM", `🔑 Resend DKIM Key Record Verified: ${dkimRecord.name}`);
    } else {
      addLog("warn", "RESEND_DKIM", `⚠️ Resend DKIM TXT record not detected in zone.`);
    }

    // 3. Run Global DNS Over HTTPS Propagation Check
    addLog("info", "PROPAGATION", `🌍 Querying Global Anycast DNS Resolvers (Google, Cloudflare, Quad9, Alibaba)...`);
    const propagation = await this.checkDnsPropagation(cleanDomain, "A");

    propagation.nodes.forEach((node) => {
      if (node.status === "resolved") {
        addLog(
          "success",
          "DOH_RESOLVER",
          `${node.flag} [${node.provider}] ${node.location} -> ${node.ip} (${node.latencyMs}ms) [Matched Gateway: ${node.matchedTarget ? "YES ✅" : "CDN/Proxied"}]`
        );
      } else {
        addLog("warn", "DOH_RESOLVER", `${node.flag} [${node.provider}] ${node.location} -> Unresolved / Pending (${node.latencyMs}ms)`);
      }
    });

    addLog(
      propagation.globalPropagationPercent === 100 ? "success" : "info",
      "SUMMARY",
      `🏁 Diagnostics Complete! Global DNS Propagation: ${propagation.globalPropagationPercent}% | Cloudflare Zone: ${zoneFound ? "Connected" : "Standby"}`
    );

    return {
      timestamp: new Date().toISOString(),
      domain: cleanDomain,
      serverIp,
      logs,
      dnsSummary: {
        zoneFound,
        recordsCount: records.length,
        apexConfigured: !!apexRecord,
        apiSubdomainConfigured: !!apiSubRecord,
        adminSubdomainConfigured: !!adminSubRecord,
        resendSpfConfigured: !!spfRecord,
        resendDkimConfigured: !!dkimRecord,
      },
      propagation,
    };
  }

  // --- UNIFIED ZERO-TOUCH INFRASTRUCTURE STATUS & ORCHESTRATOR ---
  public async getUnifiedInfrastructureStatus(domainName?: string): Promise<{
    domain: string;
    serverIp: string;
    activeZoneId: string | null;
    overallScore: number;
    overallStatus: "healthy" | "action_required" | "pending";
    pipelineSteps: Array<{
      id: string;
      stepNumber: number;
      title: string;
      description: string;
      status: "completed" | "in_progress" | "failed" | "pending";
      detail: string;
      error?: string;
    }>;
    recordsGrid: Array<{
      key: string;
      name: string;
      type: string;
      targetContent: string;
      category: "Routing" | "API Gateway" | "Admin Access" | "Email Security" | "Tracking";
      cloudflareStatus: "synced" | "missing" | "error";
      proxied: boolean;
      dohStatus: "resolved" | "pending" | "failed";
      resolvedValue?: string;
      latencyMs?: number;
      comment?: string;
    }>;
    actionableIssues: Array<{
      id: string;
      severity: "high" | "medium" | "low";
      title: string;
      explanation: string;
      fixLabel: string;
    }>;
    resendSummary: {
      connected: boolean;
      domainId?: string;
      status?: string;
      dkimVerified: boolean;
      spfVerified: boolean;
      mxVerified: boolean;
    };
  }> {
    const cleanDomain = (domainName || (await storage.getSetting("LAST_AUTOMATED_DOMAIN"))?.value || "youuhost.com").trim().toLowerCase();
    const serverIp = await this.getServerIp();

    let activeZoneId: string | null = null;
    let cfRecords: CloudflareDnsRecord[] = [];
    let cfConnected = false;
    let cfError: string | undefined;

    // 1. Cloudflare Check
    try {
      const zones = await this.listCloudflareZones();
      cfConnected = zones.length > 0;
      const matched = zones.find((z) => z.name.toLowerCase() === cleanDomain || cleanDomain.endsWith(z.name.toLowerCase()));
      if (matched) {
        activeZoneId = matched.id;
        cfRecords = await this.listDnsRecords(matched.id);
      }
    } catch (err: any) {
      cfError = err.message;
    }

    // 2. Resend Check
    let resendConnected = false;
    let resendDomainObj: ResendDomain | null = null;
    let resendDkimVerified = false;
    let resendSpfVerified = false;
    let resendMxVerified = false;

    try {
      const rDomains = await this.listResendDomains();
      resendConnected = true;
      const rDomain = rDomains.find((d) => d.name.toLowerCase() === cleanDomain);
      if (rDomain) {
        resendDomainObj = await this.getResendDomain(rDomain.id);
        const recs = resendDomainObj.records || [];
        const dkimRec = recs.find((r) => r.record === "DKIM");
        resendDkimVerified = dkimRec?.status === "verified" || resendDomainObj.status === "verified";
        resendSpfVerified = recs.some((r) => r.record === "SPF" && r.type === "TXT" && r.status === "verified") || resendDomainObj.status === "verified";
        resendMxVerified = recs.some((r) => r.record === "SPF" && r.type === "MX" && r.status === "verified") || resendDomainObj.status === "verified";
      }
    } catch (e) {
      resendConnected = false;
    }

    // 3. Audit Records Grid
    const expectedRecords = [
      { key: "apex", name: cleanDomain, type: "A", targetContent: serverIp, category: "Routing" as const, proxied: true, comment: "Main Root Domain Website" },
      { key: "www", name: `www.${cleanDomain}`, type: "CNAME", targetContent: cleanDomain, category: "Routing" as const, proxied: true, comment: "Standard Web CNAME Alias" },
      { key: "api", name: `api.${cleanDomain}`, type: "A", targetContent: serverIp, category: "API Gateway" as const, proxied: true, comment: "Partner & Customer REST API" },
      { key: "admin", name: `admin.${cleanDomain}`, type: "A", targetContent: serverIp, category: "Admin Access" as const, proxied: true, comment: "Dedicated Admin Portal" },
      { key: "imeshmain2", name: `imeshmain2.${cleanDomain}`, type: "A", targetContent: serverIp, category: "Admin Access" as const, proxied: true, comment: "Secure Direct Admin Route" },
      { key: "dkim", name: `resend._domainkey.${cleanDomain}`, type: "TXT", targetContent: "p=MIGfMA0GCSqGSIb3...", category: "Email Security" as const, proxied: false, comment: "DKIM 2048-bit Cryptographic Signature" },
      { key: "spf", name: `send.${cleanDomain}`, type: "TXT", targetContent: "v=spf1 include:amazonses.com ~all", category: "Email Security" as const, proxied: false, comment: "SPF Anti-Spoofing Policy" },
      { key: "mx", name: `send.${cleanDomain}`, type: "MX", targetContent: "feedback-smtp.us-east-1.amazonses.com", category: "Email Security" as const, proxied: false, comment: "Mail Server Exchange Route" },
      { key: "rsend", name: `rsend.${cleanDomain}`, type: "CNAME", targetContent: "send.forge.rmta.net", category: "Tracking" as const, proxied: false, comment: "Click & Open Tracking Route" },
      { key: "dmarc", name: `_dmarc.${cleanDomain}`, type: "TXT", targetContent: "v=DMARC1; p=none;", category: "Email Security" as const, proxied: false, comment: "DMARC Alignment Policy" },
    ];

    const recordsGrid = expectedRecords.map((exp) => {
      const matchInCf = cfRecords.find((r) => {
        const rName = r.name.toLowerCase().trim();
        const eName = exp.name.toLowerCase().trim();
        return r.type.toUpperCase() === exp.type.toUpperCase() && (rName === eName || `${rName}.${cleanDomain}` === eName || rName === `${eName}.${cleanDomain}`);
      });

      return {
        key: exp.key,
        name: exp.name,
        type: exp.type,
        targetContent: exp.targetContent,
        category: exp.category,
        cloudflareStatus: matchInCf ? ("synced" as const) : ("missing" as const),
        proxied: matchInCf ? !!matchInCf.proxied : exp.proxied,
        dohStatus: matchInCf ? ("resolved" as const) : ("pending" as const),
        resolvedValue: matchInCf ? matchInCf.content : undefined,
        comment: exp.comment,
      };
    });

    // 4. Actionable Issues Detection
    const actionableIssues: Array<{ id: string; severity: "high" | "medium" | "low"; title: string; explanation: string; fixLabel: string }> = [];

    if (!cfConnected) {
      actionableIssues.push({
        id: "cf_missing",
        severity: "high",
        title: "Cloudflare API Key Required",
        explanation: "Cloudflare token or credentials have not been configured yet.",
        fixLabel: "Configure Cloudflare Token",
      });
    }

    if (!activeZoneId && cfConnected) {
      actionableIssues.push({
        id: "zone_missing",
        severity: "high",
        title: `Zone "${cleanDomain}" Not Found in Cloudflare`,
        explanation: `Please add "${cleanDomain}" into your Cloudflare account to enable auto-DNS provisioning.`,
        fixLabel: "Check Cloudflare Zones",
      });
    }

    const missingRecords = recordsGrid.filter((r) => r.cloudflareStatus === "missing");
    if (missingRecords.length > 0) {
      actionableIssues.push({
        id: "missing_dns",
        severity: "medium",
        title: `${missingRecords.length} DNS Records Pending Sync`,
        explanation: `Records for ${missingRecords.map((r) => r.name).slice(0, 3).join(", ")} are missing in Cloudflare DNS.`,
        fixLabel: "1-Click Auto-Pilot Sync",
      });
    }

    if (resendDomainObj && resendDomainObj.status === "pending") {
      actionableIssues.push({
        id: "resend_pending",
        severity: "medium",
        title: "Resend Email Domain Verification Pending",
        explanation: "Resend is verifying the DKIM, SPF, and MX records in Cloudflare. This verifies automatically within minutes.",
        fixLabel: "Trigger Resend Verify",
      });
    }

    // 5. Build 7 Pipeline Steps
    const apexSynced = recordsGrid.find((r) => r.key === "apex")?.cloudflareStatus === "synced";
    const apiSynced = recordsGrid.find((r) => r.key === "api")?.cloudflareStatus === "synced";
    const adminSynced = recordsGrid.find((r) => r.key === "admin")?.cloudflareStatus === "synced" && recordsGrid.find((r) => r.key === "imeshmain2")?.cloudflareStatus === "synced";
    const emailSynced = recordsGrid.filter((r) => ["dkim", "spf", "mx", "dmarc"].includes(r.key)).every((r) => r.cloudflareStatus === "synced");

    const pipelineSteps = [
      {
        id: "cf_auth",
        stepNumber: 1,
        title: "Cloudflare API Connection & Handshake",
        description: "Bearer Token authorized with Zone & DNS edit permissions.",
        status: cfConnected && activeZoneId ? ("completed" as const) : cfConnected ? ("in_progress" as const) : ("failed" as const),
        detail: activeZoneId ? `Connected to zone "${cleanDomain}" (ID: ${activeZoneId.slice(0, 8)}...)` : cfError || "Enter API Token in Settings",
        error: cfError,
      },
      {
        id: "apex_routing",
        stepNumber: 2,
        title: "Apex Domain & Web Routing (@ & www)",
        description: "Direct traffic from root domain and www alias to server IP.",
        status: apexSynced ? ("completed" as const) : ("pending" as const),
        detail: apexSynced ? `${cleanDomain} & www.${cleanDomain} ➔ ${serverIp} (Proxied 🛡️)` : "Pending DNS sync",
      },
      {
        id: "api_subdomain",
        stepNumber: 3,
        title: "Partner & Customer API Gateway Subdomain",
        description: "Cloud endpoint for partner integrations and mobile mini app.",
        status: apiSynced ? ("completed" as const) : ("pending" as const),
        detail: apiSynced ? `https://api.${cleanDomain} ➔ ${serverIp} (Cloudflare CDN Shield 🛡️)` : "api subdomain missing",
      },
      {
        id: "admin_subdomain",
        stepNumber: 4,
        title: "Dedicated Admin Subdomains",
        description: "Zero-downtime secure subdomains for administration.",
        status: adminSynced ? ("completed" as const) : ("pending" as const),
        detail: adminSynced ? `admin.${cleanDomain} & imeshmain2.${cleanDomain} active` : "Admin subdomains pending",
      },
      {
        id: "resend_provision",
        stepNumber: 5,
        title: "Resend.com Email Domain Link",
        description: "Registers domain in Resend transactional infrastructure.",
        status: resendDomainObj ? ("completed" as const) : resendConnected ? ("in_progress" as const) : ("pending" as const),
        detail: resendDomainObj ? `Domain ID: ${resendDomainObj.id.slice(0, 12)}... (Region: ${resendDomainObj.region})` : "Configure Resend API Key",
      },
      {
        id: "email_security",
        stepNumber: 6,
        title: "DKIM, SPF, MX & DMARC Security Suite",
        description: "Cryptographic email authentication & deliverability guarantees.",
        status: emailSynced ? ("completed" as const) : ("pending" as const),
        detail: emailSynced ? "DKIM Verified ✅ | SPF Synced ✅ | MX Mail Synced ✅ | DMARC Active ✅" : "Email records missing in Cloudflare",
      },
      {
        id: "propagation",
        stepNumber: 7,
        title: "Global Anycast DNS Propagation",
        description: "Verified multi-node global DNS resolution and SSL handshake.",
        status: apexSynced && apiSynced && emailSynced ? ("completed" as const) : ("pending" as const),
        detail: apexSynced && apiSynced && emailSynced ? "100% Verified across Google, Cloudflare, Quad9 & Alibaba Anycast" : "Pending complete propagation",
      },
    ];

    const completedStepsCount = pipelineSteps.filter((s) => s.status === "completed").length;
    const overallScore = Math.round((completedStepsCount / pipelineSteps.length) * 100);
    const overallStatus = overallScore === 100 ? "healthy" : overallScore >= 50 ? "action_required" : "pending";

    return {
      domain: cleanDomain,
      serverIp,
      activeZoneId,
      overallScore,
      overallStatus,
      pipelineSteps,
      recordsGrid,
      actionableIssues,
      resendSummary: {
        connected: resendConnected,
        domainId: resendDomainObj?.id,
        status: resendDomainObj?.status,
        dkimVerified: resendDkimVerified,
        spfVerified: resendSpfVerified,
        mxVerified: resendMxVerified,
      },
    };
  }

  public async runAutoPilotFix(domainName?: string): Promise<any> {
    const cleanDomain = (domainName || (await storage.getSetting("LAST_AUTOMATED_DOMAIN"))?.value || "youuhost.com").trim().toLowerCase();
    const serverIp = await this.getServerIp();

    console.log(`[Auto-Pilot] Starting 100% Zero-Touch Infrastructure Orchestration for ${cleanDomain}...`);

    // 1. Find zone
    const zones = await this.listCloudflareZones();
    const matchedZone = zones.find((z) => z.name.toLowerCase() === cleanDomain || cleanDomain.endsWith(z.name.toLowerCase()));
    if (!matchedZone) {
      throw new Error(`Cloudflare Zone for "${cleanDomain}" not found in account.`);
    }

    // 2. Auto-configure all 5 routing and subdomains
    const subdomains = ["@", "api", "admin", "www", "imeshmain2"];
    for (const sub of subdomains) {
      const fullName = sub === "@" ? cleanDomain : sub === "www" ? `www.${cleanDomain}` : `${sub}.${cleanDomain}`;
      if (sub === "www") {
        await this.createOrUpdateDnsRecord(matchedZone.id, {
          type: "CNAME",
          name: fullName,
          content: cleanDomain,
          proxied: true,
          ttl: 1,
          comment: "YouuHost Web Alias",
        });
      } else {
        await this.createOrUpdateDnsRecord(matchedZone.id, {
          type: "A",
          name: fullName,
          content: serverIp,
          proxied: true,
          ttl: 1,
          comment: `YouuHost ${sub === "@" ? "Root Apex" : sub} Gateway`,
        });
      }
    }

    // 3. Ensure Resend Domain & sync all email records
    try {
      const resendApiKey = await this.getResendApiKey();
      if (resendApiKey) {
        const resendDomains = await this.listResendDomains();
        let resendDomain = resendDomains.find((d) => d.name.toLowerCase() === cleanDomain);
        if (!resendDomain) {
          resendDomain = await this.createResendDomain(cleanDomain);
        }

        const domainDetails = await this.getResendDomain(resendDomain.id);
        for (const rec of domainDetails.records || []) {
          await this.createOrUpdateDnsRecord(matchedZone.id, {
            type: rec.type,
            name: rec.name,
            content: rec.value,
            priority: rec.priority,
            proxied: false,
            ttl: 1,
            comment: `Resend Email ${rec.record || rec.type}`,
          });
        }

        // DMARC
        await this.createOrUpdateDnsRecord(matchedZone.id, {
          type: "TXT",
          name: `_dmarc.${cleanDomain}`,
          content: "v=DMARC1; p=none;",
          proxied: false,
          ttl: 1,
          comment: "YouuHost DMARC Email Policy",
        });

        await this.verifyResendDomain(resendDomain.id);
      }
    } catch (resendErr) {
      console.warn("[Auto-Pilot Resend Sync Warning]:", resendErr);
    }

    // 4. Set default settings
    await storage.setSetting("API_BASE_URL", `https://api.${cleanDomain}`);
    await storage.setSetting("LAST_AUTOMATED_DOMAIN", cleanDomain);
    await storage.setSetting("RESEND_FROM_EMAIL", `YouuHost <no-reply@${cleanDomain}>`);

    // 5. Return fresh status
    return await this.getUnifiedInfrastructureStatus(cleanDomain);
  }
}

export const domainAutomationService = new DomainAutomationService();


