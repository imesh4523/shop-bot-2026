import { google } from "googleapis";
import fs from "fs";

export interface GoogleDriveFolder {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface GoogleDriveUploadResult {
  id?: string | null;
  name?: string | null;
  size?: string | null;
  webViewLink?: string | null;
  webContentLink?: string | null;
}

export interface GoogleDriveAuthOptions {
  authType?: "service_account" | "oauth2";
  serviceAccountJson?: string | object | null;
  oauthClientId?: string | null;
  oauthClientSecret?: string | null;
  oauthRefreshToken?: string | null;
}

export class GoogleDriveService {
  /**
   * Helper to initialize Google Drive client from either Service Account JSON or OAuth2 credentials
   */
  static getDriveClient(options: string | object | GoogleDriveAuthOptions) {
    // If passed a raw string or traditional service account object
    if (typeof options === "string" || ("type" in (options as any) && (options as any).type === "service_account")) {
      return this.getServiceAccountDriveClient(options as string | object);
    }

    const opts = options as GoogleDriveAuthOptions;

    // Check if OAuth2 credentials provided
    if (opts.authType === "oauth2" || opts.oauthRefreshToken) {
      if (!opts.oauthClientId || !opts.oauthClientSecret || !opts.oauthRefreshToken) {
        throw new Error("OAuth2 requires Client ID, Client Secret, and Refresh Token");
      }

      const oauth2Client = new google.auth.OAuth2(
        opts.oauthClientId.trim(),
        opts.oauthClientSecret.trim()
      );

      oauth2Client.setCredentials({
        refresh_token: opts.oauthRefreshToken.trim(),
      });

      const drive = google.drive({ version: "v3", auth: oauth2Client });
      return { drive, clientEmail: "OAuth2 User Account", authType: "oauth2" };
    }

    // Default to Service Account
    if (opts.serviceAccountJson) {
      return this.getServiceAccountDriveClient(opts.serviceAccountJson);
    }

    throw new Error("No valid Google Drive credentials provided (Service Account or OAuth2)");
  }

  private static getServiceAccountDriveClient(serviceAccountJson: string | object) {
    let credentials: any;
    if (typeof serviceAccountJson === "string") {
      try {
        credentials = JSON.parse(serviceAccountJson.trim());
      } catch (err: any) {
        throw new Error(`Invalid Service Account JSON format: ${err.message}`);
      }
    } else {
      credentials = serviceAccountJson;
    }

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error("Service Account JSON must contain client_email and private_key");
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
      ],
    });

    const drive = google.drive({ version: "v3", auth });
    return { drive, clientEmail: credentials.client_email, projectId: credentials.project_id, authType: "service_account" };
  }

  /**
   * Test credentials and fetch all folders accessible
   */
  static async listFolders(options: string | object | GoogleDriveAuthOptions): Promise<{ clientEmail: string; folders: GoogleDriveFolder[] }> {
    const { drive, clientEmail } = this.getDriveClient(options);

    const res = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id, name, createdTime, modifiedTime)",
      spaces: "drive",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: "name",
    });

    const folders: GoogleDriveFolder[] = (res.data.files || []).map(f => ({
      id: f.id || "",
      name: f.name || "Untitled Folder",
      createdTime: f.createdTime || undefined,
      modifiedTime: f.modifiedTime || undefined,
    }));

    return {
      clientEmail,
      folders,
    };
  }

  /**
   * Uploads a file (e.g. database .dump) to a specific folder in Google Drive
   */
  static async uploadFile(
    options: string | object | GoogleDriveAuthOptions,
    folderId: string,
    filePath: string,
    fileName: string
  ): Promise<GoogleDriveUploadResult> {
    const { drive } = this.getDriveClient(options);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found for upload: ${filePath}`);
    }

    const fileMetadata: any = {
      name: fileName,
    };

    if (folderId && folderId.trim().length > 0) {
      fileMetadata.parents = [folderId.trim()];
    }

    const media = {
      mimeType: "application/octet-stream",
      body: fs.createReadStream(filePath),
    };

    try {
      const res = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, size, webViewLink, webContentLink",
        supportsAllDrives: true,
      });

      return res.data;
    } catch (err: any) {
      if (err.message && err.message.includes("Service Accounts do not have storage quota")) {
        throw new Error(
          "Google Quota Limitation: Service Accounts cannot upload directly to personal Gmail folders ('My Drive') because Service Accounts have 0 MB personal quota. " +
          "To fix this: (1) Use a Google Workspace 'Shared Drive' (where quota belongs to the drive, not the service account), OR (2) Use OAuth2 User Credentials in the backup settings."
        );
      }
      throw err;
    }
  }

  /**
   * Automatically deletes old backup dumps older than retentionDays
   */
  static async cleanOldBackups(
    options: string | object | GoogleDriveAuthOptions,
    folderId: string,
    retentionDays: number = 49
  ): Promise<{ deletedCount: number; deletedFiles: { id: string; name: string }[] }> {
    if (!retentionDays || retentionDays <= 0) {
      return { deletedCount: 0, deletedFiles: [] };
    }

    const { drive } = this.getDriveClient(options);
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoffDate.toISOString();

    let q = `trashed = false and createdTime < '${cutoffIso}' and (name contains '.dump' or name contains 'backup-')`;
    if (folderId && folderId.trim().length > 0) {
      q = `'${folderId.trim()}' in parents and ${q}`;
    }

    const res = await drive.files.list({
      q,
      fields: "files(id, name, createdTime)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100,
    });

    const deletedFiles: { id: string; name: string }[] = [];
    const filesToDelete = res.data.files || [];

    for (const file of filesToDelete) {
      if (file.id) {
        try {
          await drive.files.delete({
            fileId: file.id,
            supportsAllDrives: true,
          });
          deletedFiles.push({ id: file.id, name: file.name || "unnamed" });
        } catch (delErr: any) {
          console.error(`Failed to delete expired Google Drive backup ${file.id}:`, delErr.message);
        }
      }
    }

    return {
      deletedCount: deletedFiles.length,
      deletedFiles,
    };
  }
}
