import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import axios from "axios";
import FormData from "form-data";
import { GoogleDriveService } from "./google-drive-service";

// Use process.cwd() to get the root directory for temporary files
const PROJECT_ROOT = process.cwd();
const TMP_DIR = path.join(PROJECT_ROOT, "tmp");

export class BackupService {
  private static isRunning = false;

  static async log(configId: number, message: string, level: "info" | "error" | "success" = "info") {
    console.log(`[BackupService] ${message}`);
    try {
      await storage.createBackupLog({
        backupConfigId: configId,
        message,
        level,
      });
    } catch (e) {
      console.error("[BackupService] Failed to write backup log:", e);
    }
  }

  static async performBackup(configId: number) {
    if (this.isRunning) {
      console.log("Backup already in progress, skipping...");
      return;
    }

    const configs = await storage.getBackupConfigs();
    const config = configs.find(c => c.id === configId);
    if (!config || config.status !== "active") return;

    this.isRunning = true;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup-${timestamp}.dump`;
    const filePath = path.join(TMP_DIR, fileName);

    // Ensure tmp directory exists
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }

    try {
      await this.log(configId, "Starting database backup process...");

      // Determine pg_dump path
      let pgDumpPath = "pg_dump"; // Default for Linux/Docker
      if (process.platform === "win32") {
        const winBinPath = path.join(PROJECT_ROOT, "bin", "pg_dump.exe");
        if (fs.existsSync(winBinPath)) {
          pgDumpPath = winBinPath;
        } else {
          const pgPaths = [
            "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe",
            "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
            "C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe",
            "C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe",
          ];
          for (const p of pgPaths) {
            if (fs.existsSync(p)) {
              pgDumpPath = p;
              break;
            }
          }
        }
      }

      await this.log(configId, `Using pg_dump binary: ${pgDumpPath}`);

      // Extract password if present in the connection string
      let dbPassword = "";
      try {
        const parsed = new URL(config.dbUrl);
        dbPassword = decodeURIComponent(parsed.password || "");
      } catch (e) {}

      const args = [
        "--format=c",
        "--file=" + filePath,
        config.dbUrl,
      ];

      const child = spawn(pgDumpPath, args, {
        shell: false,
        env: {
          ...process.env,
          PGPASSWORD: dbPassword,
        },
      });

      let errorOutput = "";

      child.stderr.on("data", (data) => {
        errorOutput += data.toString();
        console.error(`pg_dump stderr: ${data}`);
      });

      await new Promise((resolve, reject) => {
        child.on("error", (err) => {
          reject(err);
        });
        child.on("close", (code) => {
          if (code === 0) resolve(true);
          else reject(new Error(`pg_dump failed with exit code ${code}: ${errorOutput}`));
        });
      });

      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      await this.log(configId, `Database dump created successfully. File size: ${fileSizeInMB.toFixed(2)} MB (${stats.size} bytes)`, "success");

      const destination = config.backupDestination || "both";
      const shouldUploadTelegram = (destination === "both" || destination === "telegram") && Boolean(config.botToken && config.chatId);
      const hasAuth = config.googleDriveAuthType === "oauth2"
        ? Boolean(config.googleDriveOauthRefreshToken)
        : Boolean(config.googleDriveServiceAccount);
      const shouldUploadGDrive = (destination === "both" || destination === "google_drive") && Boolean(config.googleDriveEnabled && hasAuth);

      // 1. Google Drive Upload
      if (shouldUploadGDrive) {
        try {
          const folderLabel = config.googleDriveFolderName || config.googleDriveFolderId || "Root Folder";
          await this.log(configId, `Uploading backup to Google Drive folder: "${folderLabel}"...`);

          const authOptions = {
            authType: (config.googleDriveAuthType as any) || (config.googleDriveOauthRefreshToken ? "oauth2" : "service_account"),
            serviceAccountJson: config.googleDriveServiceAccount,
            oauthClientId: config.googleDriveOauthClientId,
            oauthClientSecret: config.googleDriveOauthClientSecret,
            oauthRefreshToken: config.googleDriveOauthRefreshToken,
          };

          const gdriveResult = await GoogleDriveService.uploadFile(
            authOptions,
            config.googleDriveFolderId || "",
            filePath,
            fileName
          );

          await this.log(
            configId,
            `Backup successfully uploaded to Google Drive! File ID: ${gdriveResult.id}`,
            "success"
          );

          // Apply Auto-Retention Policy
          const retentionDays = config.retentionDays || 49;
          await this.log(configId, `Running retention cleanup for files older than ${retentionDays} days (${Math.round(retentionDays / 7)} weeks)...`);
          
          const cleanup = await GoogleDriveService.cleanOldBackups(
            authOptions,
            config.googleDriveFolderId || "",
            retentionDays
          );

          if (cleanup.deletedCount > 0) {
            await this.log(
              configId,
              `Auto-retention cleanup completed: Removed ${cleanup.deletedCount} expired backup file(s) from Google Drive.`,
              "info"
            );
          } else {
            await this.log(configId, `Auto-retention checked: No expired backups to delete.`);
          }
        } catch (gdriveErr: any) {
          await this.log(configId, `Google Drive upload failed: ${gdriveErr.message}`, "error");
        }
      }

      // 2. Telegram Bot Upload
      if (shouldUploadTelegram && config.botToken && config.chatId) {
        try {
          await this.log(configId, "Uploading backup to Telegram bot...");
          const form = new FormData();
          form.append("chat_id", config.chatId);
          form.append(
            "caption",
            `📊 Database Backup Complete\n🕒 Time: ${new Date().toLocaleString()}\n📦 Size: ${fileSizeInMB.toFixed(2)} MB\n📁 Target: ${destination.toUpperCase()}`
          );
          form.append("document", fs.createReadStream(filePath));

          await axios.post(`https://api.telegram.org/bot${config.botToken}/sendDocument`, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          });

          await this.log(configId, "Backup successfully sent to Telegram bot.", "success");
        } catch (tgErr: any) {
          await this.log(configId, `Telegram upload failed: ${tgErr.message}`, "error");
        }
      }

      // Update last backup timestamp
      await storage.updateBackupConfig(configId, { lastBackupAt: new Date() });

    } catch (error: any) {
      await this.log(configId, `Backup failed: ${error.message}`, "error");
    } finally {
      // Cleanup temporary file
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          await this.log(configId, "Temporary backup file cleaned up from server storage.");
        } catch (e) {
          console.error("Failed to delete temp backup file:", e);
        }
      }
      this.isRunning = false;
    }
  }

  static async startBackupScheduler() {
    console.log("Database Backup Scheduler started...");

    // Initial cleanup of old logs (older than 7 days)
    try {
      await storage.clearOldBackupLogs(7);
    } catch (e) {
      console.error("Failed initial log cleanup:", e);
    }

    // Run check loop every 1 minute
    setInterval(async () => {
      try {
        const configs = await storage.getBackupConfigs();
        for (const config of configs) {
          if (config.status !== "active") continue;

          const lastBackup = config.lastBackupAt ? new Date(config.lastBackupAt).getTime() : 0;
          const now = Date.now();
          const frequencyHours = config.frequency || 3;
          const frequencyMs = frequencyHours * 60 * 60 * 1000;

          if (now - lastBackup >= frequencyMs) {
            console.log(`Triggering scheduled backup for config ${config.id}...`);
            this.performBackup(config.id);
          }
        }
      } catch (err) {
        console.error("Error in backup scheduler loop:", err);
      }
    }, 60 * 1000);
  }
}
