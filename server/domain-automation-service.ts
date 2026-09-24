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
    // Find matching record by name and type
    const recordNameLower = record.name.toLowerCase().trim();
    const existing = existingRecords.find(
      (r) => r.type.toUpperCase() === record.type.toUpperCase() && r.name.toLowerCase().trim() === recordNameLower
    );

    const body: any = {
      type: record.type.toUpperCase(),
      name: record.name,
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
    return await this.resendFetch("/domains", {
      method: "POST",
      body: JSON.stringify({ name: name.trim().toLowerCase(), region }),
    });
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
}

export const domainAutomationService = new DomainAutomationService();
