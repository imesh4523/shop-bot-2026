import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Database, 
  Save, 
  Loader2, 
  Play, 
  Terminal as TerminalIcon, 
  History, 
  Clock, 
  ShieldCheck, 
  Cloud, 
  FolderCheck, 
  FolderSync, 
  CheckCircle2, 
  AlertTriangle, 
  UploadCloud, 
  FileText,
  Calendar,
  Send,
  HelpCircle
} from "lucide-react";
import { format } from "date-fns";

type BackupConfig = {
  id: number;
  dbUrl: string;
  botToken: string;
  chatId: string;
  frequency: number;
  lastBackupAt: string | null;
  status: string;
  googleDriveEnabled: boolean;
  googleDriveAuthType?: string | null;
  googleDriveServiceAccount: string | null;
  googleDriveOauthClientId?: string | null;
  googleDriveOauthClientSecret?: string | null;
  googleDriveOauthRefreshToken?: string | null;
  googleDriveUserEmail?: string | null;
  googleDriveFolderId: string | null;
  googleDriveFolderName: string | null;
  retentionDays: number;
  backupDestination: string;
};

type BackupLog = {
  id: number;
  backupConfigId: number;
  level: "info" | "error" | "success";
  message: string;
  createdAt: string;
};

type DriveFolder = {
  id: string;
  name: string;
};

export default function BackupPage() {
  const { toast } = useToast();
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    dbUrl: "",
    botToken: "",
    chatId: "",
    frequency: 3,
    googleDriveEnabled: false,
    googleDriveAuthType: "service_account" as "service_account" | "oauth2",
    googleDriveServiceAccount: "",
    googleDriveOauthClientId: "",
    googleDriveOauthClientSecret: "",
    googleDriveOauthRefreshToken: "",
    googleDriveUserEmail: "",
    googleDriveFolderId: "",
    googleDriveFolderName: "",
    retentionDays: 49, // 7 weeks default
    backupDestination: "both",
  });

  const [fetchedFolders, setFetchedFolders] = useState<DriveFolder[]>([]);
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string>("");
  const [isFetchingFolders, setIsFetchingFolders] = useState<boolean>(false);
  const [retentionPreset, setRetentionPreset] = useState<string>("7_weeks");
  const [customDays, setCustomDays] = useState<number>(49);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const { data: config, isLoading: isConfigLoading } = useQuery<BackupConfig | null>({
    queryKey: ["/api/backups/config"],
  });

  const { data: logs, isLoading: isLogsLoading } = useQuery<BackupLog[]>({
    queryKey: ["/api/backups/logs"],
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (config) {
      const days = config.retentionDays || 49;
      setFormData({
        dbUrl: config.dbUrl || "",
        botToken: config.botToken || "",
        chatId: config.chatId || "",
        frequency: config.frequency || 3,
        googleDriveEnabled: Boolean(config.googleDriveEnabled),
        googleDriveAuthType: (config.googleDriveAuthType as any) || "service_account",
        googleDriveServiceAccount: config.googleDriveServiceAccount || "",
        googleDriveOauthClientId: config.googleDriveOauthClientId || "",
        googleDriveOauthClientSecret: config.googleDriveOauthClientSecret || "",
        googleDriveOauthRefreshToken: config.googleDriveOauthRefreshToken || "",
        googleDriveUserEmail: config.googleDriveUserEmail || "",
        googleDriveFolderId: config.googleDriveFolderId || "",
        googleDriveFolderName: config.googleDriveFolderName || "",
        retentionDays: days,
        backupDestination: config.backupDestination || "both",
      });

      setCustomDays(days);
      if (days === 49) {
        setRetentionPreset("7_weeks");
      } else if (days === 14) {
        setRetentionPreset("2_weeks");
      } else if (days === 30) {
        setRetentionPreset("1_month");
      } else {
        setRetentionPreset("custom");
      }

      // If service account is present, display service account email
      if (config.googleDriveServiceAccount) {
        try {
          const parsed = JSON.parse(config.googleDriveServiceAccount);
          if (parsed.client_email) setServiceAccountEmail(parsed.client_email);
        } catch (e) {}
      }

      // If folder is already selected, pre-populate folders list
      if (config.googleDriveFolderId && config.googleDriveFolderName) {
        setFetchedFolders([{ id: config.googleDriveFolderId, name: config.googleDriveFolderName }]);
      }
    }
  }, [config]);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Handle JSON file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.client_email || !parsed.private_key) {
          throw new Error("Uploaded file is not a valid Google Service Account JSON key (missing client_email or private_key).");
        }
        setFormData(prev => ({ ...prev, googleDriveServiceAccount: text }));
        setServiceAccountEmail(parsed.client_email);
        toast({
          title: "Service Account Loaded",
          description: `Loaded credentials for: ${parsed.client_email}`,
        });
        // Auto-fetch folders
        fetchDriveFolders(text);
      } catch (err: any) {
        toast({
          title: "Invalid JSON File",
          description: err.message,
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  // Fetch Google Drive folders using API
  const fetchDriveFolders = async (saJson?: string) => {
    const isOAuth = formData.googleDriveAuthType === "oauth2";
    if (isOAuth) {
      if (!formData.googleDriveOauthClientId || !formData.googleDriveOauthClientSecret || !formData.googleDriveOauthRefreshToken) {
        toast({
          title: "Missing OAuth Credentials",
          description: "Please enter your OAuth Client ID, Client Secret, and Refresh Token.",
          variant: "destructive",
        });
        return;
      }
    } else {
      const jsonToUse = saJson || formData.googleDriveServiceAccount;
      if (!jsonToUse || jsonToUse.trim().length === 0) {
        toast({
          title: "Missing Credentials",
          description: "Please upload or paste your Google Service Account JSON key first.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsFetchingFolders(true);
    try {
      const res = await apiRequest("POST", "/api/backups/google-drive/folders", {
        authType: formData.googleDriveAuthType,
        serviceAccountJson: formData.googleDriveServiceAccount,
        oauthClientId: formData.googleDriveOauthClientId,
        oauthClientSecret: formData.googleDriveOauthClientSecret,
        oauthRefreshToken: formData.googleDriveOauthRefreshToken,
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to fetch folders");
      }

      setServiceAccountEmail(data.clientEmail);
      setFetchedFolders(data.folders || []);

      if (data.folders.length === 0) {
        toast({
          title: "No Folders Found",
          description: isOAuth 
            ? "Connected via OAuth, but no folders were found in your Google Drive." 
            : `Connected to ${data.clientEmail}, but no shared folders were found. Remember to share your Google Drive folder with this email as 'Editor'!`,
        });
      } else {
        toast({
          title: "Folders Fetched Successfully",
          description: `Found ${data.folders.length} folder(s) in Google Drive.`,
        });
        // If current folderId isn't set, select first one
        if (!formData.googleDriveFolderId && data.folders.length > 0) {
          setFormData(prev => ({
            ...prev,
            googleDriveFolderId: data.folders[0].id,
            googleDriveFolderName: data.folders[0].name,
          }));
        }
      }
    } catch (err: any) {
      toast({
        title: "Google Drive Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsFetchingFolders(false);
    }
  };

  const handleRetentionPresetChange = (preset: string) => {
    setRetentionPreset(preset);
    if (preset === "7_weeks") {
      setFormData(prev => ({ ...prev, retentionDays: 49 }));
      setCustomDays(49);
    } else if (preset === "2_weeks") {
      setFormData(prev => ({ ...prev, retentionDays: 14 }));
      setCustomDays(14);
    } else if (preset === "1_month") {
      setFormData(prev => ({ ...prev, retentionDays: 30 }));
      setCustomDays(30);
    }
  };

  const handleCustomDaysChange = (days: number) => {
    const val = Math.max(1, days);
    setCustomDays(val);
    setFormData(prev => ({ ...prev, retentionDays: val }));
  };

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/backups/config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backups/logs"] });
      toast({
        title: "Backup Settings Saved",
        description: "Your database backup & Google Drive configuration have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/backups/trigger");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups/logs"] });
      toast({
        title: "Backup Triggered",
        description: data.message || "Backup process started. Live console below shows status.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Execution Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-10 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-2xl">
            Database Backup & Sync
          </h1>
          <p className="text-white/60 mt-2 font-medium">
            PostgreSQL 17 Automated Backups with Telegram & Google Drive Cloud Storage
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(!showGuide)}
            className="border-white/10 text-white/70 hover:text-white hover:bg-white/5 rounded-xl gap-2 text-xs"
          >
            <HelpCircle className="w-4 h-4 text-purple-400" />
            {showGuide ? "Hide Setup Guide" : "Google Drive Setup Guide"}
          </Button>
          <div className="glass-panel px-5 py-2.5 rounded-full flex items-center gap-3 text-xs font-bold text-white shadow-lg border-white/20">
            <Database className="w-4 h-4 text-purple-400" />
            Status: <span className="text-green-400">Active</span>
          </div>
        </div>
      </div>

      {/* Google Drive Setup Step-by-Step Guide Modal / Banner */}
      {showGuide && (
        <Card className="glass-card border border-purple-500/30 bg-purple-950/20 p-6 rounded-2xl animate-in slide-in-from-top-2">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
              <Cloud className="w-6 h-6" />
            </div>
            <div className="space-y-3 flex-1 text-sm text-white/80">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                How to Connect Google Drive (4 Simple Steps)
              </h3>
              <ol className="list-decimal pl-5 space-y-2 text-xs sm:text-sm text-white/70">
                <li>
                  <strong className="text-white">Enable Google Drive API:</strong> Go to the Google Cloud Console (console.cloud.google.com), create or open a project, navigate to <em>APIs & Services &gt; Library</em>, and search for <strong>Google Drive API</strong> & click <em>Enable</em>.
                </li>
                <li>
                  <strong className="text-white">Create a Service Account:</strong> Under <em>APIs & Services &gt; Credentials</em>, click <em>Create Credentials &gt; Service Account</em>. Name it (e.g. <code>db-backup-bot</code>) and finish.
                </li>
                <li>
                  <strong className="text-white">Generate JSON Key:</strong> Click on your newly created Service Account &gt; <em>Keys</em> tab &gt; <em>Add Key &gt; Create new key &gt; JSON</em>. A <code>.json</code> file will automatically download to your computer.
                </li>
                <li>
                  <strong className="text-white">Share Your Google Drive Folder:</strong> Open your Google Drive, create a folder (e.g. <code>YouuHost Database Backups</code>), right-click &gt; <em>Share</em>, and paste the <em>client_email</em> of your service account (e.g. <code>backup@...iam.gserviceaccount.com</code>) with <strong>Editor</strong> permission.
                </li>
              </ol>
              <p className="text-xs text-purple-300 font-medium">
                Once done, click "Upload Service Account JSON" below, click "Fetch Folders", select your folder, and click Save Configuration!
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Configuration Forms */}
        <div className="space-y-8">
          {/* PostgreSQL & Telegram Card */}
          <Card className="glass-card border-0 overflow-hidden shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                PostgreSQL & Telegram Backup
              </CardTitle>
              <CardDescription className="text-white/60 text-xs">
                Configure database source connection and Telegram notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                  PostgreSQL Connection URL
                </Label>
                <Input
                  placeholder="postgresql://doadmin:pass@host:25060/defaultdb?sslmode=require"
                  className="glass-panel border-white/10 bg-white/5 text-white h-11 rounded-xl text-sm"
                  value={formData.dbUrl}
                  onChange={(e) => setFormData({ ...formData, dbUrl: e.target.value })}
                />
                <p className="text-[11px] text-white/40">
                  DigitalOcean or cloud PostgreSQL connection string with credentials.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                    Telegram Bot Token
                  </Label>
                  <Input
                    type="password"
                    placeholder="Bot Token (e.g. 8597932397:...)"
                    className="glass-panel border-white/10 bg-white/5 text-white h-11 rounded-xl text-sm"
                    value={formData.botToken}
                    onChange={(e) => setFormData({ ...formData, botToken: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                    Telegram Chat ID
                  </Label>
                  <Input
                    placeholder="Chat ID (e.g. 7507799896)"
                    className="glass-panel border-white/10 bg-white/5 text-white h-11 rounded-xl text-sm"
                    value={formData.chatId}
                    onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                    Backup Frequency (Hours)
                  </Label>
                  <div className="flex gap-3 items-center">
                    <Input
                      type="number"
                      min="1"
                      max="72"
                      className="glass-panel border-white/10 bg-white/5 text-white h-11 rounded-xl w-24 text-center font-bold"
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: Math.max(1, parseInt(e.target.value) || 1) })}
                    />
                    <span className="text-xs text-white/60">Every {formData.frequency} hrs</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                    Backup Destination
                  </Label>
                  <select
                    className="glass-panel border-white/10 bg-white/5 text-white h-11 rounded-xl w-full px-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                    value={formData.backupDestination}
                    onChange={(e) => setFormData({ ...formData, backupDestination: e.target.value })}
                  >
                    <option value="both" className="bg-[#121225] text-white">Google Drive & Telegram (Both)</option>
                    <option value="google_drive" className="bg-[#121225] text-white">Google Drive Only</option>
                    <option value="telegram" className="bg-[#121225] text-white">Telegram Only</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Google Drive Integration Card */}
          <Card className="glass-card border-0 overflow-hidden shadow-2xl border-t border-purple-500/20">
            <CardHeader className="bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
                    <Cloud className="w-5 h-5 text-blue-400" />
                    Google Drive Cloud Storage Integration
                  </CardTitle>
                  <CardDescription className="text-white/60 text-xs">
                    Upload automated <code>.dump</code> files to your Google Drive folder & manage retention.
                  </CardDescription>
                </div>
                <Badge className={`text-xs px-3 py-1 font-bold ${formData.googleDriveEnabled ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/10 text-white/40 border-white/10"}`}>
                  {formData.googleDriveEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Enable Toggle Switch */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-purple-400" />
                    Enable Google Drive Storage
                  </span>
                  <p className="text-xs text-white/50">
                    Automatically push backup dumps to Google Drive on each scheduled run
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="gdrive-toggle"
                  className="w-5 h-5 accent-purple-500 cursor-pointer rounded"
                  checked={formData.googleDriveEnabled}
                  onChange={(e) => setFormData({ ...formData, googleDriveEnabled: e.target.checked })}
                />
              </div>

              {formData.googleDriveEnabled && (
                <div className="space-y-6 animate-in slide-in-from-top-2">
                  {/* Google Quota Policy Warning */}
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-2">
                    <div className="font-bold flex items-center gap-2 text-amber-200 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      Google Drive Quota Policy Notice
                    </div>
                    <p className="text-amber-200/90 leading-relaxed">
                      Google assigns <strong>0 MB storage quota to robot Service Accounts</strong> on personal Gmail accounts (<code>@gmail.com</code>). 
                      Therefore, uploads to personal "My Drive" folders fail unless one of the two methods below is used:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                          Option A: Workspace Shared Drive
                        </div>
                        <p className="text-[11px] text-white/60">
                          Create a <strong>Shared Drive</strong> in Google Workspace, add your Service Account email as <em>Content Manager</em>, and select that folder.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                          Option B: OAuth 2.0 (Personal Gmail)
                        </div>
                        <p className="text-[11px] text-white/60">
                          Connect via OAuth 2.0 Client Credentials to upload directly into your personal 15 GB Google Drive quota without restrictions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Auth Type Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                      Authentication Mode
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, googleDriveAuthType: "service_account" })}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                          formData.googleDriveAuthType === "service_account"
                            ? "bg-purple-500/20 border-purple-500/40 text-purple-200"
                            : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                        Service Account (Shared Drive)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, googleDriveAuthType: "oauth2" })}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                          formData.googleDriveAuthType === "oauth2"
                            ? "bg-blue-500/20 border-blue-500/40 text-blue-200"
                            : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        <Cloud className="w-4 h-4 text-blue-400" />
                        OAuth 2.0 (Personal Gmail)
                      </button>
                    </div>
                  </div>

                  {/* Service Account UI */}
                  {formData.googleDriveAuthType === "service_account" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                          Google Service Account Credentials (JSON)
                        </Label>
                        {serviceAccountEmail && (
                          <span className="text-[11px] text-green-400 font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {serviceAccountEmail}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-xl h-11 px-4 gap-2 text-xs font-bold shrink-0"
                        >
                          <FileText className="w-4 h-4" />
                          Upload .json File
                        </Button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept=".json,application/json"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isFetchingFolders || !formData.googleDriveServiceAccount}
                          onClick={() => fetchDriveFolders()}
                          className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl h-11 px-4 gap-2 text-xs font-bold shrink-0"
                        >
                          {isFetchingFolders ? (
                            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                          ) : (
                            <FolderSync className="w-4 h-4 text-blue-400" />
                          )}
                          Fetch Folders
                        </Button>
                      </div>

                      <Textarea
                        placeholder='Paste Service Account JSON key content here ({ "type": "service_account", ... })'
                        className="glass-panel border-white/10 bg-white/5 text-white rounded-xl text-xs font-mono h-24 resize-y mt-2"
                        value={formData.googleDriveServiceAccount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, googleDriveServiceAccount: val });
                          try {
                            const parsed = JSON.parse(val);
                            if (parsed.client_email) setServiceAccountEmail(parsed.client_email);
                          } catch (e) {}
                        }}
                      />
                      <p className="text-[11px] text-white/40">
                        For Workspace Shared Drives: Add this service account email as a Content Manager inside the Shared Drive.
                      </p>
                    </div>
                  ) : (
                    /* OAuth 2.0 Credentials UI */
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                          Google OAuth 2.0 Client ID
                        </Label>
                        <Input
                          placeholder="e.g. 123456789-xxx.apps.googleusercontent.com"
                          className="glass-panel border-white/10 bg-white/5 text-white h-11 rounded-xl text-xs font-mono"
                          value={formData.googleDriveOauthClientId}
                          onChange={(e) => setFormData({ ...formData, googleDriveOauthClientId: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                          Google OAuth 2.0 Client Secret
                        </Label>
                        <Input
                          type="password"
                          placeholder="GOCSPX-xxxxxxxxxxxxxxxx"
                          className="glass-panel border-white/10 bg-white/5 text-white h-11 rounded-xl text-xs font-mono"
                          value={formData.googleDriveOauthClientSecret}
                          onChange={(e) => setFormData({ ...formData, googleDriveOauthClientSecret: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                            OAuth Refresh Token
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isFetchingFolders || !formData.googleDriveOauthRefreshToken}
                            onClick={() => fetchDriveFolders()}
                            className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl h-8 px-3 gap-1.5 text-[11px] font-bold shrink-0"
                          >
                            {isFetchingFolders ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                            ) : (
                              <FolderSync className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            Fetch Folders
                          </Button>
                        </div>
                        <Input
                          type="password"
                          placeholder="1//04xxxxxxxxxxxxxxxxxx"
                          className="glass-panel border-white/10 bg-white/5 text-white h-11 rounded-xl text-xs font-mono"
                          value={formData.googleDriveOauthRefreshToken}
                          onChange={(e) => setFormData({ ...formData, googleDriveOauthRefreshToken: e.target.value })}
                        />
                        <p className="text-[11px] text-white/40">
                          Uploads directly into your personal 15 GB Google Drive quota.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Folder Selection Dropdown */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                        <FolderCheck className="w-4 h-4 text-green-400" />
                        Google Drive Destination Folder
                      </Label>
                      {formData.googleDriveFolderName && (
                        <span className="text-[11px] text-purple-300 font-medium">
                          Selected: <strong>{formData.googleDriveFolderName}</strong>
                        </span>
                      )}
                    </div>

                    {fetchedFolders.length > 0 ? (
                      <select
                        className="glass-panel border-white/10 bg-white/5 text-white h-12 rounded-xl w-full px-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={formData.googleDriveFolderId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const found = fetchedFolders.find(f => f.id === selectedId);
                          setFormData({
                            ...formData,
                            googleDriveFolderId: selectedId,
                            googleDriveFolderName: found ? found.name : "Custom Folder",
                          });
                        }}
                      >
                        <option value="" className="bg-[#121225] text-white/60">-- Select Destination Folder --</option>
                        {fetchedFolders.map((f) => (
                          <option key={f.id} value={f.id} className="bg-[#121225] text-white">
                            📁 {f.name} ({f.id.slice(0, 10)}...)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          placeholder="Folder ID (or click 'Fetch Folders' to select from list)"
                          className="glass-panel border-white/10 bg-white/5 text-white h-11 rounded-xl text-sm"
                          value={formData.googleDriveFolderId}
                          onChange={(e) => setFormData({ ...formData, googleDriveFolderId: e.target.value, googleDriveFolderName: "Manual Folder ID" })}
                        />
                        <p className="text-[11px] text-white/40">
                          Click "Fetch Folders" above after uploading your JSON to pick directly from your Google Drive.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Retention Policy Setting (User requested 7 weeks or custom date) */}
                  <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-white/70 uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-yellow-400" />
                        Auto-Deletion / Retention Policy
                      </Label>
                      <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400">
                        {formData.retentionDays} Days ({Math.round(formData.retentionDays / 7)} Weeks)
                      </Badge>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Automatically purge old <code>.dump</code> files in your Google Drive folder older than this threshold to save space:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={retentionPreset === "7_weeks" ? "default" : "outline"}
                        onClick={() => handleRetentionPresetChange("7_weeks")}
                        className={`rounded-xl text-xs font-bold ${
                          retentionPreset === "7_weeks"
                            ? "bg-purple-600 text-white"
                            : "border-white/10 text-white/70 hover:bg-white/5"
                        }`}
                      >
                        7 Weeks (49d) ⭐
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={retentionPreset === "1_month" ? "default" : "outline"}
                        onClick={() => handleRetentionPresetChange("1_month")}
                        className={`rounded-xl text-xs font-bold ${
                          retentionPreset === "1_month"
                            ? "bg-purple-600 text-white"
                            : "border-white/10 text-white/70 hover:bg-white/5"
                        }`}
                      >
                        1 Month (30d)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={retentionPreset === "2_weeks" ? "default" : "outline"}
                        onClick={() => handleRetentionPresetChange("2_weeks")}
                        className={`rounded-xl text-xs font-bold ${
                          retentionPreset === "2_weeks"
                            ? "bg-purple-600 text-white"
                            : "border-white/10 text-white/70 hover:bg-white/5"
                        }`}
                      >
                        2 Weeks (14d)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={retentionPreset === "custom" ? "default" : "outline"}
                        onClick={() => setRetentionPreset("custom")}
                        className={`rounded-xl text-xs font-bold ${
                          retentionPreset === "custom"
                            ? "bg-purple-600 text-white"
                            : "border-white/10 text-white/70 hover:bg-white/5"
                        }`}
                      >
                        Custom Days
                      </Button>
                    </div>

                    {retentionPreset === "custom" && (
                      <div className="flex items-center gap-3 pt-2">
                        <Label className="text-xs text-white/60">Delete dumps older than:</Label>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          className="glass-panel border-white/10 bg-white/5 text-white h-10 rounded-xl w-24 text-center font-bold"
                          value={customDays}
                          onChange={(e) => handleCustomDaysChange(parseInt(e.target.value) || 1)}
                        />
                        <span className="text-xs text-white/60">days</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={() => updateMutation.mutate(formData)}
                  disabled={updateMutation.isPending}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 font-bold shadow-lg shadow-purple-500/20 text-white"
                >
                  {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Save Configuration
                </Button>
                <Button 
                  onClick={() => triggerMutation.mutate()}
                  disabled={triggerMutation.isPending}
                  variant="outline"
                  className="h-12 px-6 rounded-xl border-white/20 hover:bg-white/5 font-bold text-white"
                >
                  {triggerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2 text-green-400" />}
                  Run Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Console Terminal */}
        <div className="space-y-6">
          <Card className="relative glass-panel border-0 overflow-hidden flex flex-col h-[750px] group/console shadow-2xl">
            {/* Glass Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none z-10 opacity-30" />
            
            <CardHeader className="bg-white/5 backdrop-blur-3xl border-b border-white/10 shrink-0 py-4 relative z-20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[0_0_10px_rgba(255,95,86,0.3)]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[0_0_10px_rgba(255,189,46,0.2)]" />
                    <div className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[0_0_10px_rgba(39,201,63,0.3)]" />
                  </div>
                  <div className="h-4 w-px bg-white/10 mx-1" />
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-white/90 uppercase tracking-[0.2em]">
                    <TerminalIcon className="w-4 h-4 text-purple-400" />
                    Backup Live Console
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded bg-green-500/20 text-[10px] font-bold text-green-400 border border-green-500/30">
                    LIVE
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 bg-[#050510]/95 font-mono text-[13px] overflow-hidden flex flex-col relative z-20">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
              
              <div className="flex-1 overflow-y-auto p-6 space-y-2.5 custom-scrollbar relative">
                {!logs || logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <div className="italic font-medium animate-pulse">Establishing terminal connection...</div>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-4 group animate-in slide-in-from-left-2 duration-300">
                      <span className="text-white/30 shrink-0 select-none font-medium text-xs">
                        {format(new Date(log.createdAt), "HH:mm:ss")}
                      </span>
                      <div className="flex flex-col gap-1">
                        <div className={`
                          flex items-center gap-2 font-medium leading-relaxed
                          ${log.level === 'success' ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]' : ''}
                          ${log.level === 'error' ? 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]' : ''}
                          ${log.level === 'info' ? 'text-white/80' : ''}
                        `}>
                          <span className="shrink-0 opacity-60">
                            {log.level === 'success' ? '✔' : log.level === 'error' ? '✖' : '›'}
                          </span>
                          <span>{log.message}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={consoleEndRef} />
              </div>
              
              <div className="p-4 bg-white/5 border-t border-white/10 shrink-0 flex justify-between items-center text-[10px] text-white/40 font-bold uppercase tracking-[0.15em] px-6">
                <div className="flex items-center gap-6">
                  <span className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-400" /> 
                    SCHED: <span className="text-white/70">{formData.frequency}H</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-purple-400" /> 
                    LAST: <span className="text-white/70">{config?.lastBackupAt ? format(new Date(config.lastBackupAt), "MMM d, HH:mm") : 'NEVER'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  ONLINE
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
