import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Globe,
  Mail,
  Zap,
  Server,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
  Send,
  Sliders,
  Settings,
  Terminal,
  Code2,
  Lock,
  ArrowRight,
  Sparkles,
  Cloud,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function DomainAutomationPage() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("auto-config");

  // --- SETTINGS STATE ---
  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } = useQuery<{
    cloudflareToken: string;
    cloudflareEmail: string;
    cloudflareGlobalKey: string;
    resendApiKey: string;
    resendFromEmail: string;
    targetServerIp: string;
    lastDomain: string;
    apiBaseUrl: string;
  }>({
    queryKey: ["/api/admin/domain-automation/settings"],
  });

  const [cfToken, setCfToken] = useState("");
  const [cfEmail, setCfEmail] = useState("");
  const [cfGlobalKey, setCfGlobalKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [resendFrom, setResendFrom] = useState("");
  const [serverIp, setServerIp] = useState("");
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  // Sync loaded settings into local inputs
  if (settingsData && !settingsInitialized) {
    setCfToken(settingsData.cloudflareToken || "");
    setCfEmail(settingsData.cloudflareEmail || "");
    setCfGlobalKey(settingsData.cloudflareGlobalKey || "");
    setResendKey(settingsData.resendApiKey || "");
    setResendFrom(settingsData.resendFromEmail || "Shopeefy <onboarding@resend.dev>");
    setServerIp(settingsData.targetServerIp || "18.141.224.63");
    setSettingsInitialized(true);
  }

  // --- AUTO-CONFIG STATE ---
  const [targetDomain, setTargetDomain] = useState(settingsData?.lastDomain || "youuhost.com");
  const [subdomainsInput, setSubdomainsInput] = useState("api");
  const [enableResendSync, setEnableResendSync] = useState(true);
  const [enableCfProxy, setEnableCfProxy] = useState(true);
  const [autoConfigLogs, setAutoConfigLogs] = useState<any[] | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);

  // --- CLOUDFLARE ZONES & RECORDS ---
  const { data: zones = [], isLoading: zonesLoading, refetch: refetchZones } = useQuery<any[]>({
    queryKey: ["/api/admin/domain-automation/cloudflare/zones"],
    enabled: !!(settingsData?.cloudflareToken || settingsData?.cloudflareGlobalKey),
    retry: false,
  });

  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const activeZone = zones.find((z) => z.id === selectedZoneId) || zones[0];

  const { data: dnsRecords = [], isLoading: dnsLoading, refetch: refetchDns } = useQuery<any[]>({
    queryKey: ["/api/admin/domain-automation/cloudflare/records", activeZone?.id],
    queryFn: async () => {
      if (!activeZone?.id) return [];
      const res = await fetch(`/api/admin/domain-automation/cloudflare/records?zoneId=${activeZone.id}`);
      if (!res.ok) throw new Error("Failed to fetch DNS records");
      return res.json();
    },
    enabled: !!activeZone?.id,
  });

  // --- RESEND DOMAINS ---
  const { data: resendDomains = [], isLoading: resendLoading, refetch: refetchResend } = useQuery<any[]>({
    queryKey: ["/api/admin/domain-automation/resend/domains"],
    enabled: !!settingsData?.resendApiKey,
    retry: false,
  });

  const [selectedResendDomainId, setSelectedResendDomainId] = useState<string | null>(null);
  const { data: resendDomainDetail, isLoading: resendDetailLoading } = useQuery<any>({
    queryKey: ["/api/admin/domain-automation/resend/domain", selectedResendDomainId],
    queryFn: async () => {
      if (!selectedResendDomainId) return null;
      const res = await fetch(`/api/admin/domain-automation/resend/domain/${selectedResendDomainId}`);
      return res.json();
    },
    enabled: !!selectedResendDomainId,
  });

  // --- TEST EMAIL STATE ---
  const [testEmailModal, setTestEmailModal] = useState(false);
  const [testToEmail, setTestToEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  // --- ADD CUSTOM DNS RECORD MODAL ---
  const [addDnsModal, setAddDnsModal] = useState(false);
  const [newDnsType, setNewDnsType] = useState("A");
  const [newDnsName, setNewDnsName] = useState("");
  const [newDnsContent, setNewDnsContent] = useState("");
  const [newDnsProxied, setNewDnsProxied] = useState(true);
  const [newDnsPriority, setNewDnsPriority] = useState("10");

  // --- ADMIN SUBDOMAIN (e.g. imeshmain2.domain.com) STATE ---
  const { data: adminSubdomainData, refetch: refetchAdminSubdomain } = useQuery<{
    domainName: string;
    subdomain: string;
    enabled: boolean;
    subdomainUrl: string;
    standardUrl: string;
  }>({
    queryKey: ["/api/admin/domain-automation/admin-subdomain"],
  });

  const [adminSubInput, setAdminSubInput] = useState("imeshmain2");
  const [adminSubEnabled, setAdminSubEnabled] = useState(false);
  const [adminSubProxied, setAdminSubProxied] = useState(true);
  const [adminSubInitialized, setAdminSubInitialized] = useState(false);
  const [isAdminSubSaving, setIsAdminSubSaving] = useState(false);

  // --- CYBERSECURITY SHIELD STATE ---
  const { data: securityStatus, refetch: refetchSecurity } = useQuery<{
    status: string;
    activeJailedIpsCount: number;
    jailedIps: { ip: string; expiresInMinutes: number; violations: number; reason: string }[];
    recentThreatsCount: number;
    recentThreats: {
      id: string;
      ip: string;
      country: string;
      method: string;
      url: string;
      host: string;
      userAgent: string;
      threatType: string;
      action: string;
      timestamp: string;
    }[];
  }>({
    queryKey: ["/api/admin/security-shield/status"],
    refetchInterval: selectedTab === "security" ? 4000 : false,
  });

  const handleUnbanIp = async (ip: string) => {
    try {
      const res = await fetch("/api/admin/security-shield/unban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to unban IP");
      toast({ title: "IP Unbanned! 🔓", description: `IP ${ip} has been removed from jail.` });
      refetchSecurity();
    } catch (err: any) {
      toast({ title: "Unban Failed", description: err.message, variant: "destructive" });
    }
  };

  if (adminSubdomainData && !adminSubInitialized) {
    setAdminSubInput(adminSubdomainData.subdomain || "imeshmain2");
    setAdminSubEnabled(adminSubdomainData.enabled || false);
    setAdminSubInitialized(true);
  }

  const handleToggleAdminSubdomain = async (enableVal: boolean) => {
    setAdminSubEnabled(enableVal);
    setIsAdminSubSaving(true);
    try {
      const res = await fetch("/api/admin/domain-automation/admin-subdomain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainName: targetDomain.trim(),
          subdomain: adminSubInput.trim(),
          enabled: enableVal,
          proxied: adminSubProxied,
          zoneId: activeZone?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update admin subdomain");

      toast({
        title: enableVal ? "Admin Subdomain Activated! ⚡" : "Default Mode Activated 🌐",
        description: enableVal
          ? `Subdomain URL configured: ${data.subdomainUrl}`
          : `Using standard path: ${data.standardUrl}`,
      });
      refetchAdminSubdomain();
      refetchDns();
    } catch (err: any) {
      toast({
        title: "Configuration Error",
        description: err.message,
        variant: "destructive",
      });
      setAdminSubEnabled(!enableVal);
    } finally {
      setIsAdminSubSaving(false);
    }
  };

  // --- SAVE SETTINGS MUTATION ---
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/domain-automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudflareToken: cfToken,
          cloudflareEmail: cfEmail,
          cloudflareGlobalKey: cfGlobalKey,
          resendApiKey: resendKey,
          resendFromEmail: resendFrom,
          targetServerIp: serverIp,
          lastDomain: targetDomain,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved! 💾",
        description: "Cloudflare and Resend credentials updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/domain-automation/settings"] });
      refetchSettings();
      refetchZones();
      refetchResend();
    },
    onError: (err: any) => {
      toast({
        title: "Error Saving Settings",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // --- RUN 1-CLICK AUTO-CONFIGURATION ---
  const handleRunAutoConfig = async () => {
    if (!targetDomain.trim()) {
      toast({ title: "Domain Required", description: "Please enter a domain name (e.g. youuhost.com)", variant: "destructive" });
      return;
    }
    setIsConfiguring(true);
    setAutoConfigLogs(null);

    try {
      const subdomainsList = subdomainsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/domain-automation/auto-configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainName: targetDomain.trim(),
          zoneId: activeZone?.id,
          subdomains: subdomainsList.length > 0 ? subdomainsList : ["api"],
          setupResend: enableResendSync,
          proxyApiSubdomain: enableCfProxy,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Auto-configuration failed");
      }

      setAutoConfigLogs(data.recordsCreated || []);
      toast({
        title: "Domain Auto-Configured! 🚀",
        description: `Successfully configured ${data.domain} and created ${data.recordsCreated?.length || 0} DNS records.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/domain-automation/cloudflare/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/domain-automation/resend/domains"] });
      refetchDns();
      refetchResend();
      refetchSettings();
    } catch (err: any) {
      toast({
        title: "Configuration Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  // --- ADD DNS RECORD MUTATION ---
  const handleAddDnsRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZone?.id) {
      toast({ title: "Select a Zone", description: "Please select a Cloudflare zone first", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch("/api/admin/domain-automation/cloudflare/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: activeZone.id,
          record: {
            type: newDnsType,
            name: newDnsName.trim(),
            content: newDnsContent.trim(),
            proxied: newDnsType === "A" || newDnsType === "CNAME" ? newDnsProxied : false,
            priority: newDnsType === "MX" ? parseInt(newDnsPriority) || 10 : undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create DNS record");

      toast({ title: "DNS Record Created! ✅", description: `${newDnsType} record for ${newDnsName} saved.` });
      setAddDnsModal(false);
      setNewDnsName("");
      setNewDnsContent("");
      refetchDns();
    } catch (err: any) {
      toast({ title: "Error Creating DNS Record", description: err.message, variant: "destructive" });
    }
  };

  // --- DELETE DNS RECORD ---
  const handleDeleteDns = async (recordId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the DNS record "${name}"?`)) return;
    try {
      const res = await fetch("/api/admin/domain-automation/cloudflare/record", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId: activeZone.id, recordId }),
      });
      if (!res.ok) throw new Error("Failed to delete record");
      toast({ title: "Record Deleted", description: `Deleted DNS record ${name}` });
      refetchDns();
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  // --- VERIFY RESEND DOMAIN ---
  const handleVerifyResend = async (domainId: string) => {
    try {
      const res = await fetch("/api/admin/domain-automation/resend/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification request failed");
      toast({
        title: "Verification Triggered 🔄",
        description: "Resend is checking your DNS records. Please allow 1-2 minutes.",
      });
      refetchResend();
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
    }
  };

  // --- SEND TEST EMAIL ---
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testToEmail.trim() || !testToEmail.includes("@")) {
      toast({ title: "Valid Email Required", description: "Please enter a valid recipient email.", variant: "destructive" });
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await fetch("/api/admin/domain-automation/resend/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: testToEmail.trim(), fromEmail: resendFrom }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send test email");

      toast({
        title: "Test Email Sent! 📬",
        description: `Successfully sent test email to ${testToEmail}`,
      });
      setTestEmailModal(false);
      setTestToEmail("");
    } catch (err: any) {
      toast({ title: "Email Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to Clipboard! 📋", description: `${label}: ${text}` });
  };

  const activeApiBaseUrl = settingsData?.apiBaseUrl || `https://api.${targetDomain || "youuhost.com"}`;
  const isCfConnected = !!(settingsData?.cloudflareToken || settingsData?.cloudflareGlobalKey);
  const isResendConnected = !!settingsData?.resendApiKey;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Domain & Infrastructure Automation
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Globe className="w-8 h-8 text-purple-400" /> Cloudflare & Resend Hub
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Automate DNS records, subdomains (<code className="text-purple-300 font-mono">api.domain.com</code>), and Resend.com email verification in 1-Click.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSettings();
              refetchZones();
              refetchDns();
              refetchResend();
              toast({ title: "Refreshed Data 🔄" });
            }}
            className="border-white/10 hover:bg-white/5 text-xs text-white"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setTestEmailModal(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20"
          >
            <Mail className="w-3.5 h-3.5 mr-2" /> Send Test Email
          </Button>
        </div>
      </div>

      {/* TOP STATUS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Cloudflare Status */}
        <Card className="glass-panel border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 blur-2xl rounded-full" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Cloudflare DNS</span>
              <Cloud className="w-4 h-4 text-orange-400" />
            </div>
            <CardTitle className="text-xl font-black text-white flex items-center gap-2 mt-1">
              {isCfConnected ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-amber-400" />
                  <span>Not Configured</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-white/60">
            {zones.length > 0 ? `${zones.length} active zones loaded` : "Configure API Token in Settings"}
          </CardContent>
        </Card>

        {/* Card 2: Resend Email Status */}
        <Card className="glass-panel border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Resend.com</span>
              <Mail className="w-4 h-4 text-purple-400" />
            </div>
            <CardTitle className="text-xl font-black text-white flex items-center gap-2 mt-1">
              {isResendConnected ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Ready</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-amber-400" />
                  <span>Missing Key</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-white/60">
            {resendDomains.length > 0 ? `${resendDomains.length} domains linked` : "Configure Resend API Key"}
          </CardContent>
        </Card>

        {/* Card 3: Target Server IPv4 */}
        <Card className="glass-panel border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Server Target IP</span>
              <Server className="w-4 h-4 text-blue-400" />
            </div>
            <CardTitle className="text-lg font-mono font-bold text-white flex items-center justify-between mt-1">
              <span>{serverIp || "18.141.224.63"}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/40 hover:text-white"
                onClick={() => copyToClipboard(serverIp || "18.141.224.63", "Server IP")}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-white/60">
            AWS EC2 / Server Gateway
          </CardContent>
        </Card>

        {/* Card 4: Customer API Base URL */}
        <Card className="glass-panel border-purple-500/30 bg-purple-950/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/20 blur-2xl rounded-full" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Customer API Base URL</span>
              <Zap className="w-4 h-4 text-purple-400 animate-pulse" />
            </div>
            <CardTitle className="text-sm font-mono font-bold text-purple-200 truncate flex items-center justify-between mt-1">
              <span className="truncate">{activeApiBaseUrl}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-purple-400 hover:text-white shrink-0 ml-1"
                onClick={() => copyToClipboard(activeApiBaseUrl, "API Base URL")}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-purple-300/70">
            Official Endpoint for Partners
          </CardContent>
        </Card>
      </div>

      {/* MAIN TABS */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="bg-black/40 border border-white/10 p-1 rounded-2xl grid grid-cols-2 md:grid-cols-5 max-w-3xl">
          <TabsTrigger value="auto-config" className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Zap className="w-3.5 h-3.5 mr-1.5" /> 1-Click Auto Config
          </TabsTrigger>
          <TabsTrigger value="cloudflare" className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Cloud className="w-3.5 h-3.5 mr-1.5" /> Cloudflare DNS
          </TabsTrigger>
          <TabsTrigger value="resend" className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Mail className="w-3.5 h-3.5 mr-1.5" /> Resend.com
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Security Shield
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Settings className="w-3.5 h-3.5 mr-1.5" /> API Credentials
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: 1-CLICK MAGIC AUTO-CONFIG */}
        <TabsContent value="auto-config" className="space-y-6">
          {/* ADMIN SUBDOMAIN & SAFE URL SWITCHER CARD */}
          <Card className="glass-panel border-indigo-500/30 bg-indigo-950/15 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg text-white">Admin Subdomain & Safe URL Switcher</CardTitle>
                      <Badge className={adminSubEnabled ? "bg-emerald-500/20 text-emerald-300 border-0 text-xs" : "bg-white/10 text-white/60 border-0 text-xs"}>
                        {adminSubEnabled ? "⚡ Subdomain Active" : "🌐 Standard Path Mode"}
                      </Badge>
                    </div>
                    <CardDescription className="text-white/60 text-xs">
                      Switch between standard path (<code className="text-purple-300">/imeshadmindashbord</code>) and a dedicated custom subdomain (<code className="text-indigo-300">https://{adminSubInput}.{targetDomain}</code>) with zero downtime and automatic Cloudflare DNS routing.
                    </CardDescription>
                  </div>
                </div>

                {/* Main Switch / Toggle */}
                <div className="flex items-center gap-3 bg-black/40 px-4 py-2.5 rounded-2xl border border-white/10 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-bold text-white block">Dedicated Subdomain</span>
                    <span className="text-[10px] text-white/50">{adminSubEnabled ? "Active (Direct Route)" : "Disabled (Path Only)"}</span>
                  </div>
                  <Switch
                    checked={adminSubEnabled}
                    onCheckedChange={handleToggleAdminSubdomain}
                    disabled={isAdminSubSaving}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Subdomain Input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-white/80">Subdomain Name</Label>
                  <div className="flex items-center">
                    <Input
                      placeholder="imeshmain2"
                      value={adminSubInput}
                      onChange={(e) => setAdminSubInput(e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-xs font-mono rounded-r-none focus:border-indigo-500"
                    />
                    <span className="px-3 py-2 bg-white/10 border border-l-0 border-white/10 text-white/60 text-xs font-mono rounded-r-xl">
                      .{targetDomain}
                    </span>
                  </div>
                </div>

                {/* Cloudflare Proxy Toggle */}
                <div className="space-y-1.5 flex flex-col justify-end">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="space-y-0.5">
                      <Label className="text-xs text-white">Cloudflare Proxy (CDN)</Label>
                      <p className="text-[10px] text-white/40">Free SSL & DDoS Shield</p>
                    </div>
                    <Switch checked={adminSubProxied} onCheckedChange={setAdminSubProxied} />
                  </div>
                </div>

                {/* Update / Push DNS Button */}
                <div className="space-y-1.5 flex flex-col justify-end">
                  <Button
                    onClick={() => handleToggleAdminSubdomain(true)}
                    disabled={isAdminSubSaving || !adminSubInput.trim()}
                    className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    {isAdminSubSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>⚡ Auto-Configure DNS & Switch</span>
                  </Button>
                </div>
              </div>

              {/* DUAL ACCESS URLS STATUS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {/* URL 1: Standard URL (Always Safe) */}
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-400" /> Standard Fallback URL (Always Safe)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      Permanent Access
                    </Badge>
                  </div>
                  <div className="font-mono text-xs text-white truncate font-bold">
                    https://{targetDomain}/imeshadmindashbord
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`https://${targetDomain}/imeshadmindashbord`, "Standard URL")}
                      className="border-white/10 text-[11px] h-7 text-white/80"
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                    <a
                      href={`https://${targetDomain}/imeshadmindashbord`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[11px] font-semibold transition-colors"
                    >
                      Open <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  </div>
                </div>

                {/* URL 2: Dedicated Subdomain URL */}
                <div className={`p-4 rounded-2xl border space-y-2 ${adminSubEnabled ? "bg-indigo-950/30 border-indigo-500/40 shadow-lg shadow-indigo-500/10" : "bg-black/40 border-white/5 opacity-70"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Dedicated Admin Subdomain URL
                    </span>
                    <Badge className={adminSubEnabled ? "bg-indigo-500/20 text-indigo-300 border-0 text-[10px]" : "bg-white/10 text-white/40 border-0 text-[10px]"}>
                      {adminSubEnabled ? "⚡ Active Direct" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="font-mono text-xs text-indigo-200 truncate font-bold">
                    https://{adminSubInput || "imeshmain2"}.{targetDomain}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`https://${adminSubInput || "imeshmain2"}.${targetDomain}`, "Subdomain URL")}
                      className="border-white/10 text-[11px] h-7 text-white/80"
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                    <a
                      href={`https://${adminSubInput || "imeshmain2"}.${targetDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors"
                    >
                      Open <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-white/40 flex items-center gap-2 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero-Lockout Guarantee: Both the standard URL and subdomain URL remain simultaneously operational.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel border-white/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">1-Click Domain & Subdomain Auto-Configuration</CardTitle>
                  <CardDescription className="text-white/60 text-xs">
                    Seamlessly connect your Cloudflare domain, create <code className="text-purple-300">api.{targetDomain}</code> pointing to your server, and push all Resend SPF/DKIM/MX records directly to Cloudflare DNS.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Domain Input */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/80">Target Root Domain</Label>
                  <Input
                    placeholder="e.g. youuhost.com"
                    value={targetDomain}
                    onChange={(e) => setTargetDomain(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-sm font-mono focus:border-purple-500"
                  />
                  <p className="text-[11px] text-white/40">
                    The root domain registered in Cloudflare (e.g. <code>youuhost.com</code>).
                  </p>
                </div>

                {/* Subdomains Input */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/80">Subdomains to Create & Point to Server</Label>
                  <Input
                    placeholder="api, shop, bot"
                    value={subdomainsInput}
                    onChange={(e) => setSubdomainsInput(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-sm font-mono focus:border-purple-500"
                  />
                  <p className="text-[11px] text-white/40">
                    Comma separated. Creating <code>api</code> will configure <code className="text-purple-300">api.{targetDomain}</code>.
                  </p>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-white">Auto-Push Resend DNS to Cloudflare</Label>
                    <p className="text-[11px] text-white/50">
                      Creates SPF, DKIM (domainkey), MX, and DMARC TXT records automatically in Cloudflare.
                    </p>
                  </div>
                  <Switch checked={enableResendSync} onCheckedChange={setEnableResendSync} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-white">Cloudflare Proxy (CDN/SSL 🛡️) on API Subdomain</Label>
                    <p className="text-[11px] text-white/50">
                      Enables Cloudflare DDoS protection and free Universal SSL.
                    </p>
                  </div>
                  <Switch checked={enableCfProxy} onCheckedChange={setEnableCfProxy} />
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={handleRunAutoConfig}
                disabled={isConfiguring || !targetDomain.trim()}
                className="w-full py-6 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-purple-600/25 transition-all flex items-center justify-center gap-3"
              >
                {isConfiguring ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Configuring Cloudflare & Resend DNS...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>⚡ Auto-Configure Everything (Cloudflare + Resend + Subdomain)</span>
                  </>
                )}
              </Button>

              {/* Live Execution Logs */}
              {autoConfigLogs && (
                <div className="mt-6 p-5 rounded-2xl bg-black/50 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h4 className="text-xs font-bold text-purple-300 flex items-center gap-2">
                      <Terminal className="w-4 h-4" /> Configuration Results & DNS Records Configured:
                    </h4>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      {autoConfigLogs.length} Records Processed
                    </Badge>
                  </div>

                  <div className="space-y-2 font-mono text-xs max-h-64 overflow-y-auto">
                    {autoConfigLogs.map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">
                            {log.type}
                          </span>
                          <span className="text-white font-semibold">{log.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-white/60 text-[11px] truncate max-w-xs">{log.content}</span>
                          <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-0">
                            {log.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-white/60">Official Partner API Base URL:</span>
                    <a
                      href={activeApiBaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 font-mono"
                    >
                      {activeApiBaseUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PARTNER API QUICK REFERENCE CARD */}
          <Card className="glass-panel border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-purple-400" /> Customer & Partner API Base URL
                  </CardTitle>
                  <CardDescription className="text-xs text-white/60">
                    Customers and partners will use this base URL to interact with your automated cloud store API.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-xs">
                  REST API v1
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-white/40 block">Primary Base URL</span>
                  <span className="text-purple-300 text-sm font-bold">{activeApiBaseUrl}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(activeApiBaseUrl, "API Base URL")}
                    className="border-white/10 text-xs text-white"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy Base URL
                  </Button>
                </div>
              </div>

              {/* Endpoints Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-emerald-400 font-bold text-xs font-mono mr-2">GET</span>
                    <span className="text-white text-xs font-mono">/api/v1/products</span>
                    <p className="text-[10px] text-white/40 mt-0.5">List all available stock & prices</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/30 hover:text-white"
                    onClick={() => copyToClipboard(`${activeApiBaseUrl}/api/v1/products`, "Endpoint")}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-blue-400 font-bold text-xs font-mono mr-2">POST</span>
                    <span className="text-white text-xs font-mono">/api/v1/orders</span>
                    <p className="text-[10px] text-white/40 mt-0.5">Instant purchase & auto-delivery</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/30 hover:text-white"
                    onClick={() => copyToClipboard(`${activeApiBaseUrl}/api/v1/orders`, "Endpoint")}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-emerald-400 font-bold text-xs font-mono mr-2">GET</span>
                    <span className="text-white text-xs font-mono">/api/v1/balance</span>
                    <p className="text-[10px] text-white/40 mt-0.5">Partner wallet balance check</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/30 hover:text-white"
                    onClick={() => copyToClipboard(`${activeApiBaseUrl}/api/v1/balance`, "Endpoint")}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-emerald-400 font-bold text-xs font-mono mr-2">GET</span>
                    <span className="text-white text-xs font-mono">/api/v1/health</span>
                    <p className="text-[10px] text-white/40 mt-0.5">Server connectivity & ping</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/30 hover:text-white"
                    onClick={() => copyToClipboard(`${activeApiBaseUrl}/api/v1/health`, "Endpoint")}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CLOUDFLARE DNS MANAGER */}
        <TabsContent value="cloudflare" className="space-y-6">
          <Card className="glass-panel border-white/10">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-orange-400" /> Cloudflare DNS Records
                </CardTitle>
                <CardDescription className="text-xs text-white/60">
                  Manage active DNS records directly inside Cloudflare.
                </CardDescription>
              </div>

              <div className="flex items-center gap-3">
                {zones.length > 0 && (
                  <select
                    value={activeZone?.id || ""}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-xs font-bold"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id} className="bg-slate-900 text-white">
                        {z.name} ({z.status})
                      </option>
                    ))}
                  </select>
                )}

                <Button
                  size="sm"
                  onClick={() => setAddDnsModal(true)}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add DNS Record
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {dnsLoading ? (
                <div className="py-12 text-center text-white/40 text-xs">Loading Cloudflare DNS records...</div>
              ) : dnsRecords.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs">
                  No DNS records found. Make sure your Cloudflare API credentials are configured in Settings.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-white">
                    <thead className="border-b border-white/10 text-[11px] font-bold text-white/40 uppercase">
                      <tr>
                        <th className="py-3 px-3">Type</th>
                        <th className="py-3 px-3">Name</th>
                        <th className="py-3 px-3">Content / Value</th>
                        <th className="py-3 px-3">Proxy</th>
                        <th className="py-3 px-3">TTL</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {dnsRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-3 font-bold">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300">
                              {rec.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-white">{rec.name}</td>
                          <td className="py-3 px-3 text-white/70 max-w-xs truncate">{rec.content}</td>
                          <td className="py-3 px-3">
                            {rec.proxied ? (
                              <Badge className="bg-orange-500/20 text-orange-300 border-0 text-[10px]">
                                Proxied 🛡️
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-white/40 border-white/10 text-[10px]">
                                DNS Only 🌐
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-3 text-white/40">{rec.ttl === 1 ? "Auto" : rec.ttl}</td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteDns(rec.id, rec.name)}
                              className="h-7 w-7 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: RESEND DOMAINS & VERIFICATION */}
        <TabsContent value="resend" className="space-y-6">
          <Card className="glass-panel border-white/10">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-400" /> Resend.com Linked Domains
                </CardTitle>
                <CardDescription className="text-xs text-white/60">
                  Domains registered for sending transactional & OTP emails via Resend.
                </CardDescription>
              </div>

              <Button
                size="sm"
                onClick={() => setTestEmailModal(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5 mr-1" /> Send Test Email
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              {resendLoading ? (
                <div className="py-12 text-center text-white/40 text-xs">Loading Resend domains...</div>
              ) : resendDomains.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs">
                  No Resend domains found. Use the 1-Click Auto Config tab to automatically register your domain in Resend.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resendDomains.map((dom) => (
                    <div
                      key={dom.id}
                      className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-purple-500/30 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-white">{dom.name}</span>
                        <Badge
                          className={
                            dom.status === "verified"
                              ? "bg-emerald-500/20 text-emerald-300 border-0 text-xs"
                              : "bg-amber-500/20 text-amber-300 border-0 text-xs"
                          }
                        >
                          {dom.status === "verified" ? "✅ Verified" : "⏳ " + dom.status}
                        </Badge>
                      </div>

                      <div className="text-xs text-white/50 space-y-1">
                        <div>Region: <span className="text-white">{dom.region}</span></div>
                        <div>Created: <span className="text-white">{new Date(dom.created_at).toLocaleDateString()}</span></div>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedResendDomainId(dom.id)}
                          className="border-white/10 text-xs text-white"
                        >
                          View DNS Records
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleVerifyResend(dom.id)}
                          className="bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-bold"
                        >
                          Verify in Resend
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resend Domain Record Inspector */}
              {resendDomainDetail && (
                <div className="mt-6 p-5 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h4 className="text-xs font-bold text-purple-300">
                      Required DNS Records for {resendDomainDetail.name}:
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedResendDomainId(null)}
                      className="text-xs text-white/40 hover:text-white"
                    >
                      Close
                    </Button>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    {(resendDomainDetail.records || []).map((rec: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-purple-300 font-bold">{rec.record || rec.type} ({rec.type})</span>
                          <Badge variant="outline" className="text-[10px] border-white/10 text-white/60">
                            {rec.status || "required"}
                          </Badge>
                        </div>
                        <div className="text-white/80 font-bold text-[11px] truncate">Host / Name: {rec.name}</div>
                        <div className="text-white/60 text-[10px] break-all">Value: {rec.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: API CREDENTIALS & SETTINGS */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="glass-panel border-white/10">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-400" /> API Keys & Configuration
              </CardTitle>
              <CardDescription className="text-xs text-white/60">
                Securely store your Cloudflare and Resend.com credentials.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Cloudflare Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-orange-400 flex items-center gap-2">
                  <Cloud className="w-4 h-4" /> Cloudflare Credentials
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Cloudflare API Token (Recommended)</Label>
                    <Input
                      type="password"
                      placeholder="e.g. vL8..."
                      value={cfToken}
                      onChange={(e) => setCfToken(e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-xs font-mono focus:border-purple-500"
                    />
                    <p className="text-[10px] text-white/40">
                      Token with Zone.DNS (Edit) and Zone (Read) permissions.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Target Server IPv4 Address</Label>
                    <Input
                      placeholder="e.g. 18.141.224.63"
                      value={serverIp}
                      onChange={(e) => setServerIp(e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-xs font-mono focus:border-purple-500"
                    />
                    <p className="text-[10px] text-white/40">
                      The destination IP address for <code>api.yourdomain.com</code>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Cloudflare Account Email (Optional)</Label>
                    <Input
                      type="email"
                      placeholder="you@gmail.com"
                      value={cfEmail}
                      onChange={(e) => setCfEmail(e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-xs font-mono focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Cloudflare Global API Key (Optional)</Label>
                    <Input
                      type="password"
                      placeholder="Global API Key"
                      value={cfGlobalKey}
                      onChange={(e) => setCfGlobalKey(e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-xs font-mono focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Resend Section */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Resend.com Credentials
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Resend API Key</Label>
                    <Input
                      type="password"
                      placeholder="re_123456789..."
                      value={resendKey}
                      onChange={(e) => setResendKey(e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-xs font-mono focus:border-purple-500"
                    />
                    <p className="text-[10px] text-white/40">
                      Get from <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-purple-400 underline">resend.com/api-keys</a>.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Default Sender Email (From)</Label>
                    <Input
                      placeholder="Shopeefy <support@youuhost.com>"
                      value={resendFrom}
                      onChange={(e) => setResendFrom(e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-xs font-mono focus:border-purple-500"
                    />
                    <p className="text-[10px] text-white/40">
                      Must use your verified domain or <code>onboarding@resend.dev</code> for testing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 flex justify-end">
                <Button
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={saveSettingsMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-8"
                >
                  {saveSettingsMutation.isPending ? "Saving..." : "Save API Credentials"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: CYBERSECURITY SHIELD & WAF MONITOR */}
        <TabsContent value="security" className="space-y-6">
          <Card className="glass-panel border-emerald-500/30 bg-emerald-950/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      Enterprise Cybersecurity Shield & WAF
                    </CardTitle>
                    <CardDescription className="text-white/60 text-xs">
                      Active real-time protection against SQL Injection, XSS, automated scanner bots, path traversal, and brute-force DDoS.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1">
                    🛡️ WAF ARMED & PROTECTING
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      refetchSecurity();
                      toast({ title: "Security Threat Database Refreshed 🔄" });
                    }}
                    className="border-white/10 text-xs text-white"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh Logs
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Top Security Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Subdomain Request Validation</span>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> 100% Strict Inspection
                  </div>
                  <p className="text-[10px] text-white/40">Headers, Query params & JSON body filtered</p>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Active Jailed Hacker IPs</span>
                  <div className="text-base font-bold text-amber-400 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> {securityStatus?.activeJailedIpsCount || 0} IPs Blocked
                  </div>
                  <p className="text-[10px] text-white/40">Auto-banned for scanner probes or rate abuse</p>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Blocked Threats Recorded</span>
                  <div className="text-base font-bold text-purple-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> {securityStatus?.recentThreatsCount || 0} Events
                  </div>
                  <p className="text-[10px] text-white/40">SQLi, Bot Scanners, Traversal attacks dropped</p>
                </div>
              </div>

              {/* JAILED IPS TABLE */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" /> Active Jailed IPs (Blacklist):
                </h4>
                {(!securityStatus?.jailedIps || securityStatus.jailedIps.length === 0) ? (
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-xs text-white/40 text-center font-mono">
                    No active jailed IPs. All incoming traffic is within normal security thresholds.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/5">
                    <table className="w-full text-left text-xs text-white">
                      <thead className="bg-white/5 text-[11px] font-bold text-white/40 uppercase">
                        <tr>
                          <th className="p-3">IP Address</th>
                          <th className="p-3">Reason</th>
                          <th className="p-3">Violations</th>
                          <th className="p-3">Ban Expires In</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {securityStatus.jailedIps.map((item, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-bold text-amber-300">{item.ip}</td>
                            <td className="p-3 text-white/70">{item.reason}</td>
                            <td className="p-3 text-white/50">{item.violations}</td>
                            <td className="p-3 text-white/80">{item.expiresInMinutes} mins</td>
                            <td className="p-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnbanIp(item.ip)}
                                className="border-white/10 text-[10px] h-7 text-emerald-400 hover:text-emerald-300"
                              >
                                Unban IP
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* RECENT THREAT LOGS TABLE */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" /> Live Threat Defense Log:
                </h4>
                {(!securityStatus?.recentThreats || securityStatus.recentThreats.length === 0) ? (
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-xs text-white/40 text-center font-mono">
                    Security shield armed. Threat log is empty (no recent attack attempts).
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/5 max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs text-white">
                      <thead className="bg-white/5 text-[11px] font-bold text-white/40 uppercase sticky top-0">
                        <tr>
                          <th className="p-3">Time</th>
                          <th className="p-3">Client IP & Country</th>
                          <th className="p-3">Threat Type</th>
                          <th className="p-3">Method & Path</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                        {securityStatus.recentThreats.map((threat) => (
                          <tr key={threat.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 text-white/40 whitespace-nowrap">
                              {new Date(threat.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="p-3">
                              <span className="text-white font-bold">{threat.ip}</span>
                              <span className="text-white/40 ml-1.5 text-[10px]">({threat.country})</span>
                            </td>
                            <td className="p-3">
                              <Badge className="bg-purple-500/20 text-purple-300 border-0 text-[10px]">
                                {threat.threatType}
                              </Badge>
                            </td>
                            <td className="p-3 text-white/70 max-w-xs truncate font-mono">
                              <span className="text-emerald-400 font-bold mr-1.5">{threat.method}</span>
                              <span>{threat.url}</span>
                            </td>
                            <td className="p-3">
                              <Badge className="bg-red-500/20 text-red-300 border-0 text-[10px]">
                                🚫 {threat.action}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: ADD CUSTOM DNS RECORD */}
      <Dialog open={addDnsModal} onOpenChange={setAddDnsModal}>
        <DialogContent className="max-w-md bg-[#0f0a1a] border border-white/10 text-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black">Add Custom DNS Record</DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Create a new DNS record in zone <code className="text-purple-300">{activeZone?.name}</code>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddDnsRecord} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-white/70">Record Type</Label>
                <select
                  value={newDnsType}
                  onChange={(e) => setNewDnsType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="A" className="bg-slate-900">A (IPv4)</option>
                  <option value="CNAME" className="bg-slate-900">CNAME (Alias)</option>
                  <option value="TXT" className="bg-slate-900">TXT (Text / Verification)</option>
                  <option value="MX" className="bg-slate-900">MX (Mail Server)</option>
                  <option value="AAAA" className="bg-slate-900">AAAA (IPv6)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-white/70">Host / Name</Label>
                <Input
                  placeholder="e.g. api, @, mail"
                  value={newDnsName}
                  onChange={(e) => setNewDnsName(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-white/70">Target Content / IP / Value</Label>
              <Input
                placeholder={newDnsType === "A" ? "18.141.224.63" : "e.g. target.domain.com"}
                value={newDnsContent}
                onChange={(e) => setNewDnsContent(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white text-xs font-mono"
              />
            </div>

            {newDnsType === "MX" && (
              <div className="space-y-1">
                <Label className="text-xs text-white/70">Priority</Label>
                <Input
                  type="number"
                  value={newDnsPriority}
                  onChange={(e) => setNewDnsPriority(e.target.value)}
                  className="bg-white/5 border-white/10 text-white text-xs font-mono"
                />
              </div>
            )}

            {(newDnsType === "A" || newDnsType === "CNAME") && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="space-y-0.5">
                  <Label className="text-xs text-white">Cloudflare Proxy (CDN)</Label>
                  <p className="text-[10px] text-white/40">Proxy traffic through Cloudflare network</p>
                </div>
                <Switch checked={newDnsProxied} onCheckedChange={setNewDnsProxied} />
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddDnsModal(false)}
                className="text-xs text-white/60"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold">
                Create Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: SEND TEST EMAIL */}
      <Dialog open={testEmailModal} onOpenChange={setTestEmailModal}>
        <DialogContent className="max-w-md bg-[#0f0a1a] border border-white/10 text-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-400" /> Send Test Email via Resend
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Verify that Resend can deliver transactional emails to your inbox.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendTestEmail} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Recipient Email Address</Label>
              <Input
                type="email"
                placeholder="yourname@gmail.com"
                value={testToEmail}
                onChange={(e) => setTestToEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white text-xs font-mono"
              />
            </div>

            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
              <strong>Sender:</strong> {resendFrom || "onboarding@resend.dev"}
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTestEmailModal(false)}
                className="text-xs text-white/60"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSendingTest}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2"
              >
                {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Test Email
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
