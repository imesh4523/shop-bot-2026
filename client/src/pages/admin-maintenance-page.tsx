import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShieldAlert, 
  Power, 
  Mail, 
  Send, 
  Plus, 
  Trash2, 
  Clock, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Lock, 
  Key, 
  RefreshCw 
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LottieMaintenance } from "@/components/lottie-loader";

export function AdminMaintenancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newEmail, setNewEmail] = useState("");
  const [newTelegram, setNewTelegram] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Fetch current maintenance settings
  const { data: statusData, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/maintenance/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/maintenance/settings");
      return res.json();
    },
  });

  // Local form state
  const [enabled, setEnabled] = useState<boolean>(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [estimatedEnd, setEstimatedEnd] = useState("");
  const [whitelistEmails, setWhitelistEmails] = useState<string[]>([]);
  const [whitelistTelegram, setWhitelistTelegram] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Sync state once data loads
  React.useEffect(() => {
    if (statusData && !hasInitialized) {
      setEnabled(!!statusData.enabled);
      setTitle(statusData.title || "Scheduled Maintenance in Progress");
      setMessage(statusData.message || "We are currently upgrading our cloud infrastructure and payment gateways. We'll be back shortly!");
      setEstimatedEnd(statusData.estimatedEnd || "About 30 minutes");
      setWhitelistEmails(Array.isArray(statusData.whitelistEmails) ? statusData.whitelistEmails : ["rochanaimeah@gmail.com", "imeshcheak@gmail.com"]);
      setWhitelistTelegram(Array.isArray(statusData.whitelistTelegram) ? statusData.whitelistTelegram : ["7507799896", "rochana_imesh"]);
      setHasInitialized(true);
    }
  }, [statusData, hasInitialized]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/maintenance/settings", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Settings Saved! 💾",
        description: data.enabled ? "Maintenance Mode is now ACTIVE across all services." : "System is LIVE and accessible to all users.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/maintenance/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system/maintenance-status"] });
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = (newEnabledState?: boolean) => {
    const finalEnabled = typeof newEnabledState === "boolean" ? newEnabledState : enabled;
    saveMutation.mutate({
      enabled: finalEnabled,
      title: title.trim(),
      message: message.trim(),
      estimatedEnd: estimatedEnd.trim(),
      whitelistEmails,
      whitelistTelegram,
    });
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    handleSave(checked);
  };

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmail.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (whitelistEmails.includes(clean)) {
      toast({ title: "Already Added", description: "This email is already in the whitelist." });
      return;
    }
    const updated = [...whitelistEmails, clean];
    setWhitelistEmails(updated);
    setNewEmail("");
    saveMutation.mutate({
      enabled,
      title,
      message,
      estimatedEnd,
      whitelistEmails: updated,
      whitelistTelegram,
    });
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    const updated = whitelistEmails.filter((e) => e !== emailToRemove);
    setWhitelistEmails(updated);
    saveMutation.mutate({
      enabled,
      title,
      message,
      estimatedEnd,
      whitelistEmails: updated,
      whitelistTelegram,
    });
  };

  const handleAddTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTelegram.trim().replace(/^@/, "").toLowerCase();
    if (!clean) return;
    if (whitelistTelegram.includes(clean)) {
      toast({ title: "Already Added", description: "This Telegram username/ID is already in the whitelist." });
      return;
    }
    const updated = [...whitelistTelegram, clean];
    setWhitelistTelegram(updated);
    setNewTelegram("");
    saveMutation.mutate({
      enabled,
      title,
      message,
      estimatedEnd,
      whitelistEmails,
      whitelistTelegram: updated,
    });
  };

  const handleRemoveTelegram = (tgToRemove: string) => {
    const updated = whitelistTelegram.filter((t) => t !== tgToRemove);
    setWhitelistTelegram(updated);
    saveMutation.mutate({
      enabled,
      title,
      message,
      estimatedEnd,
      whitelistEmails,
      whitelistTelegram: updated,
    });
  };

  if (isLoading && !hasInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                System Maintenance Mode
                {enabled ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold px-2.5 py-0.5">
                    ● ACTIVE (LOCKED)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold px-2.5 py-0.5">
                    ● LIVE (PUBLIC)
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lockdown the entire store, API gateways, and Telegram bots with granular whitelist access controls.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="border-border/60 hover:bg-muted font-semibold text-xs"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            {isPreviewMode ? "Hide Preview" : "Live User Preview"}
          </Button>

          <Button
            onClick={() => handleSave()}
            disabled={saveMutation.isPending}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-cyan-500/20"
          >
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Live Preview Box when toggled */}
      {isPreviewMode && (
        <Card className="border border-border/40 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <CardHeader className="bg-slate-100/80 border-b border-slate-200 py-2.5 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-600" /> Live Preview: What visitors see when maintenance is active
            </span>
            <button
              onClick={() => setIsPreviewMode(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              Close
            </button>
          </CardHeader>
          <CardContent className="p-10 flex flex-col items-center justify-center text-center bg-white min-h-[360px]">
            <LottieMaintenance size={280} className="max-w-full" />
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Control & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Master Switch & Lock State */}
        <div className="space-y-6 lg:col-span-1">
          {/* Master Switch Card */}
          <Card className={`border transition-all duration-300 ${enabled ? "border-amber-500/40 bg-amber-500/[0.03] shadow-lg shadow-amber-500/5" : "border-border/40 bg-card/60"}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Power className={`w-4 h-4 ${enabled ? "text-amber-400" : "text-slate-400"}`} />
                  Master Kill Switch
                </span>
                <Switch
                  checked={enabled}
                  onCheckedChange={handleToggle}
                  className="data-[state=checked]:bg-amber-500"
                />
              </CardTitle>
              <CardDescription className="text-xs">
                {enabled
                  ? "Maintenance Mode is ACTIVE. All regular visitors and API keys are blocked."
                  : "Maintenance Mode is OFF. Store and APIs are functioning normally for everyone."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="p-3 rounded-xl bg-background/80 border border-border/40 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" /> Web Store & Mini App:
                  </span>
                  <Badge variant={enabled ? "destructive" : "secondary"} className="text-[10px] uppercase font-bold">
                    {enabled ? "Locked" : "Open"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-400" /> Developer API Keys:
                  </span>
                  <Badge variant={enabled ? "destructive" : "secondary"} className="text-[10px] uppercase font-bold">
                    {enabled ? "503 Blocked" : "Active"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-cyan-400" /> Telegram Bot Commands:
                  </span>
                  <Badge variant={enabled ? "destructive" : "secondary"} className="text-[10px] uppercase font-bold">
                    {enabled ? "Maintenance Msg" : "Responsive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Info / Security Advice */}
          <Card className="border border-border/40 bg-card/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Staff Access Note
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                • As the logged-in administrator, your browser session has <strong>permanent access</strong> and will never be locked out.
              </p>
              <p>
                • Anyone whose email or Telegram account is added to the Whitelist can sign in on the maintenance screen to preview or test the live store.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Center & Right Column: Content Config & Whitelist Management */}
        <div className="space-y-6 lg:col-span-2">
          {/* Public Messaging Settings Card */}
          <Card className="border border-border/40 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Public Display Content
              </CardTitle>
              <CardDescription className="text-xs">
                Customize the headline, explanation, and estimated time displayed to users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Maintenance Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scheduled Maintenance in Progress"
                  className="bg-background/80 border-border/60 text-sm h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Maintenance Message</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Explain why the maintenance is happening and what is being upgraded..."
                  className="bg-background/80 border-border/60 text-sm rounded-xl leading-relaxed resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Estimated Time / Duration
                </label>
                <Input
                  value={estimatedEnd}
                  onChange={(e) => setEstimatedEnd(e.target.value)}
                  placeholder="e.g. About 30 minutes / Back at 12:00 PM UTC"
                  className="bg-background/80 border-border/60 text-sm h-10 rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          {/* Granular Whitelist / Allowlist Access Card (Advanced Feature) */}
          <Card className="border border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-cyan-400">
                <Lock className="w-4 h-4" />
                VIP & Staff Whitelist (Exclusive Access)
              </CardTitle>
              <CardDescription className="text-xs">
                Users matching any of these emails or Telegram accounts can bypass maintenance mode and use the store and APIs normally.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 1. Whitelisted Emails */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-cyan-400" /> Allowed Emails
                  </label>
                  <span className="text-[11px] text-muted-foreground">{whitelistEmails.length} active</span>
                </div>

                <form onSubmit={handleAddEmail} className="flex gap-2">
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter email e.g. dev@youuhost.com"
                    className="bg-background/80 border-border/60 text-xs h-9 rounded-xl flex-1"
                  />
                  <Button type="submit" size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold h-9 px-3 rounded-xl">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Email
                  </Button>
                </form>

                <div className="flex flex-wrap gap-2 pt-1">
                  {whitelistEmails.map((email) => (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5"
                    >
                      <Mail className="w-3 h-3 text-cyan-400" />
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(email)}
                        className="text-muted-foreground hover:text-red-400 ml-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {whitelistEmails.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No specific emails whitelisted yet.</p>
                  )}
                </div>
              </div>

              {/* 2. Whitelisted Telegram Accounts */}
              <div className="space-y-3 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-400" /> Allowed Telegram Accounts / Usernames / IDs
                  </label>
                  <span className="text-[11px] text-muted-foreground">{whitelistTelegram.length} active</span>
                </div>

                <form onSubmit={handleAddTelegram} className="flex gap-2">
                  <Input
                    type="text"
                    value={newTelegram}
                    onChange={(e) => setNewTelegram(e.target.value)}
                    placeholder="Enter username e.g. rochana_imesh or ID e.g. 7507799896"
                    className="bg-background/80 border-border/60 text-xs h-9 rounded-xl flex-1"
                  />
                  <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-9 px-3 rounded-xl">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Telegram
                  </Button>
                </form>

                <div className="flex flex-wrap gap-2 pt-1">
                  {whitelistTelegram.map((tg) => (
                    <Badge
                      key={tg}
                      variant="secondary"
                      className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3 text-blue-400" />
                      @{tg}
                      <button
                        type="button"
                        onClick={() => handleRemoveTelegram(tg)}
                        className="text-muted-foreground hover:text-red-400 ml-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {whitelistTelegram.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No Telegram accounts whitelisted yet.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AdminMaintenancePage;
