import { spawn, execFile } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";
import os from "os";

export interface RcloneStatus {
  installed: boolean;
  configured: boolean;
  status: "connected" | "not_configured" | "error";
  message: string;
  folders?: string[];
  lastChecked?: string;
}

export interface RcloneAuthSession {
  sessionId: string;
  googleAuthUrl: string;
  state: string;
  status: "waiting" | "authorized" | "error";
  token?: any;
  error?: string;
  createdAt: number;
}

export class RcloneService {
  private static activeAuthProcess: any = null;
  private static currentSession: RcloneAuthSession | null = null;

  static getBinaryPath(): string {
    const candidates = [
      "C:\\rclone\\rclone.exe",
      path.join(process.env.ProgramFiles || "C:\\Program Files", "rclone", "rclone.exe"),
      "rclone.exe",
      "rclone"
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return "C:\\rclone\\rclone.exe";
  }

  static getConfigDir(): string {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const rcloneDir = path.join(appData, "rclone");
    if (!fs.existsSync(rcloneDir)) {
      try {
        fs.mkdirSync(rcloneDir, { recursive: true });
      } catch (e) {}
    }
    return rcloneDir;
  }

  static getConfigPath(): string {
    return path.join(this.getConfigDir(), "rclone.conf");
  }

  /**
   * Restores rclone.conf from a saved token string (from database) if missing or requested
   */
  static saveTokenToConfig(token: any): boolean {
    try {
      const configPath = this.getConfigPath();
      const tokenStr = typeof token === "string" ? token.trim() : JSON.stringify(token);

      const content = `[gdrive]
type = drive
scope = drive
token = ${tokenStr}
`;
      fs.writeFileSync(configPath, content, "utf8");
      return true;
    } catch (err: any) {
      console.error("[RCLONE] Failed to save token to rclone.conf:", err.message);
      return false;
    }
  }

  /**
   * Checks live status of rclone Google Drive connection
   */
  static async getLiveStatus(): Promise<RcloneStatus> {
    const bin = this.getBinaryPath();
    if (!fs.existsSync(bin)) {
      return {
        installed: false,
        configured: false,
        status: "not_configured",
        message: "Rclone binary not installed at C:\\rclone\\rclone.exe",
        lastChecked: new Date().toISOString(),
      };
    }

    const configPath = this.getConfigPath();
    if (!fs.existsSync(configPath)) {
      return {
        installed: true,
        configured: false,
        status: "not_configured",
        message: "Google Drive is not configured in rclone.conf. Click 'Generate Login Link' to configure.",
        lastChecked: new Date().toISOString(),
      };
    }

    const configContent = fs.readFileSync(configPath, "utf8");
    if (!configContent.includes("[gdrive]") || !configContent.includes("token =")) {
      return {
        installed: true,
        configured: false,
        status: "not_configured",
        message: "Google Drive remote [gdrive] not configured in rclone. Please authorize.",
        lastChecked: new Date().toISOString(),
      };
    }

    // Perform live query to Google Drive
    try {
      const folders = await this.listFolders();
      return {
        installed: true,
        configured: true,
        status: "connected",
        message: `Successfully connected to Google Drive! Found ${folders.length} folder(s).`,
        folders,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        installed: true,
        configured: false,
        status: "error",
        message: `Google Drive connection error: ${err.message}. Re-authorization may be required.`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Starts a new authorization session and extracts Google's official Login URL
   */
  static async startAuthSession(): Promise<RcloneAuthSession> {
    // Kill existing process if running
    if (this.activeAuthProcess) {
      try {
        this.activeAuthProcess.kill();
      } catch (e) {}
      this.activeAuthProcess = null;
    }

    const bin = this.getBinaryPath();
    if (!fs.existsSync(bin)) {
      throw new Error(`Rclone binary not found at ${bin}`);
    }

    return new Promise((resolve, reject) => {
      const sessionId = `auth_${Date.now()}`;
      let resolved = false;

      const child = spawn(bin, ["authorize", "drive", "--auth-no-open-browser"], {
        windowsHide: true,
      });

      this.activeAuthProcess = child;
      let stdoutBuffer = "";

      const timeout = setTimeout(() => {
        if (!resolved) {
          try { child.kill(); } catch (e) {}
          reject(new Error("Timeout generating rclone authorization URL (15s)"));
        }
      }, 15000);

      child.stderr.on("data", (data) => {
        const text = data.toString();
        const match = text.match(/http:\/\/127\.0\.0\.1:53682\/auth\?state=([a-zA-Z0-9_-]+)/);
        if (match && !resolved) {
          const localAuthUrl = match[0];
          const state = match[1];

          // Fetch the 307 Redirect from the local server to get the exact Google Auth URL
          http.get(localAuthUrl, (res) => {
            const googleAuthUrl = res.headers.location;
            if (!googleAuthUrl) {
              clearTimeout(timeout);
              reject(new Error("Could not extract Google redirect URL from rclone"));
              return;
            }

            resolved = true;
            clearTimeout(timeout);

            const session: RcloneAuthSession = {
              sessionId,
              googleAuthUrl,
              state,
              status: "waiting",
              createdAt: Date.now(),
            };

            this.currentSession = session;
            resolve(session);
          }).on("error", (err) => {
            clearTimeout(timeout);
            reject(new Error(`Failed to query rclone local server: ${err.message}`));
          });
        }
      });

      child.stdout.on("data", (data) => {
        const text = data.toString();
        stdoutBuffer += text;

        // Check if token JSON blob is returned
        if (stdoutBuffer.includes("Paste the following into your remote machine --->")) {
          const startMarker = "Paste the following into your remote machine --->";
          const endMarker = "<---End paste";
          const startIndex = stdoutBuffer.indexOf(startMarker) + startMarker.length;
          const endIndex = stdoutBuffer.indexOf(endMarker);

          if (endIndex > startIndex) {
            const rawJson = stdoutBuffer.substring(startIndex, endIndex).trim();
            try {
              const token = JSON.parse(rawJson);
              this.saveTokenToConfig(token);
              if (this.currentSession) {
                this.currentSession.status = "authorized";
                this.currentSession.token = token;
              }
              console.log("[RCLONE] Successfully authorized Google Drive and saved to rclone.conf!");
            } catch (jsonErr: any) {
              console.error("[RCLONE] Failed to parse rclone token JSON:", jsonErr.message);
            }
          }
        }
      });

      child.on("close", (code) => {
        this.activeAuthProcess = null;
        if (this.currentSession && this.currentSession.status === "waiting") {
          this.currentSession.status = "error";
          this.currentSession.error = `Rclone process exited with code ${code}`;
        }
      });
    });
  }

  /**
   * Helper to manually submit auth code if user authorized on an external device / phone
   */
  static async submitAuthCode(codeOrUrl: string, state?: string): Promise<boolean> {
    let cleanCode = codeOrUrl.trim();
    let cleanState = state || this.currentSession?.state || "";

    // If a full redirect URL was pasted (e.g. http://127.0.0.1:53682/?state=...&code=...)
    if (codeOrUrl.includes("code=")) {
      try {
        const parsed = new URL(codeOrUrl.startsWith("http") ? codeOrUrl : `http://dummy.com/${codeOrUrl}`);
        cleanCode = parsed.searchParams.get("code") || cleanCode;
        cleanState = parsed.searchParams.get("state") || cleanState;
      } catch (e) {}
    }

    if (!cleanCode) {
      throw new Error("Invalid or empty authorization code");
    }

    return new Promise((resolve, reject) => {
      const targetUrl = `http://127.0.0.1:53682/?state=${encodeURIComponent(cleanState)}&code=${encodeURIComponent(cleanCode)}`;
      http.get(targetUrl, (res) => {
        // Wait 1.5 seconds for rclone to process the code and write token
        setTimeout(() => {
          resolve(true);
        }, 1500);
      }).on("error", (err) => {
        reject(new Error(`Failed to forward auth code to rclone: ${err.message}`));
      });
    });
  }

  /**
   * Returns current active auth session status
   */
  static getSessionStatus(): RcloneAuthSession | null {
    return this.currentSession;
  }

  /**
   * Lists all Google Drive folders using rclone lsf --dirs-only
   */
  static async listFolders(): Promise<string[]> {
    const bin = this.getBinaryPath();
    return new Promise((resolve, reject) => {
      execFile(bin, ["lsf", "--dirs-only", "--max-depth", "2", "gdrive:"], { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message));
        }

        const lines = stdout
          .split("\n")
          .map((l) => l.trim().replace(/\/$/, ""))
          .filter((l) => l.length > 0);

        resolve(lines);
      });
    });
  }

  /**
   * Lists backup files in a remote folder using rclone lsf --files-only
   */
  static async listBackupFiles(remoteFolderName: string = "youuhost backups"): Promise<string[]> {
    const bin = this.getBinaryPath();
    const folder = remoteFolderName.trim().replace(/^\/+|\/+$/g, "");
    const target = folder ? `gdrive:${folder}/` : "gdrive:";
    return new Promise((resolve) => {
      execFile(bin, ["lsf", "--files-only", target], { timeout: 15000 }, (error, stdout) => {
        if (error || !stdout) return resolve([]);
        const files = stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        resolve(files);
      });
    });
  }

  /**
   * Uploads database backup to Google Drive folder using rclone copy
   */
  static async uploadBackup(filePath: string, remoteFolderName: string): Promise<string> {
    const bin = this.getBinaryPath();
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found for upload: ${filePath}`);
    }

    const folder = remoteFolderName.trim().replace(/^\/+|\/+$/g, "");
    const target = folder ? `gdrive:${folder}/` : "gdrive:";

    return new Promise((resolve, reject) => {
      console.log(`[RCLONE] Executing: ${bin} copy "${filePath}" "${target}"`);
      execFile(bin, ["copy", filePath, target, "--fast-list", "--stats", "1s"], { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`Rclone upload failed: ${stderr || error.message}`));
        }
        resolve(`Successfully uploaded to ${target}`);
      });
    });
  }

  /**
   * Deletes old backups in Google Drive folder older than retentionDays
   */
  static async cleanOldBackups(remoteFolderName: string, retentionDays: number = 49): Promise<string> {
    if (!retentionDays || retentionDays <= 0) return "Retention cleanup skipped (0 days)";
    const bin = this.getBinaryPath();
    const folder = remoteFolderName.trim().replace(/^\/+|\/+$/g, "");
    const target = folder ? `gdrive:${folder}/` : "gdrive:";

    return new Promise((resolve, reject) => {
      execFile(bin, ["delete", target, "--min-age", `${retentionDays}d`], { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`Rclone retention cleanup failed: ${stderr || error.message}`));
        }
        resolve(`Retention cleanup completed for files older than ${retentionDays} days in ${target}`);
      });
    });
  }
}
