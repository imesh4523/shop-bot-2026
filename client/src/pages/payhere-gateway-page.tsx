import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Save, Loader2, Sparkles, CheckCircle2, XCircle, Activity, Link2, ExternalLink, ShieldCheck, Zap, RefreshCw } from "lucide-react";

export default function PayHereGatewayPage() {
  const { toast } = useToast();

  const [payhereEnabled, setPayhereEnabled] = useState(false);
  const [payhereGatewayUrl, setPayhereGatewayUrl] = useState("");
  const [payhereMerchantId, setPayhereMerchantId] = useState("");
  const [payhereMerchantSecret, setPayhereMerchantSecret] = useState("");
  const [payhereSandboxMode, setPayhereSandboxMode] = useState(true);
  const [payherePairingUrl, setPayherePairingUrl] = useState("");
  const [payhereStatus, setPayhereStatus] = useState("disconnected");
  const [payherePairedAt, setPayherePairedAt] = useState("");
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs?: number; message?: string } | null>(null);

  // Live Status Query (Refetches every 4 seconds)
  const { data: liveStatus, refetch: refetchStatus } = useQuery<{
    status: string;
    gatewayUrl: string;
    pairedAt: string;
    enabled: boolean;
    sandboxMode: boolean;
    merchantId: string;
    hasSecret: boolean;
    isConnected: boolean;
  }>({
    queryKey: ["/api/payhere/status"],
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (liveStatus) {
      setPayhereStatus(liveStatus.status || "disconnected");
      setPayhereGatewayUrl(liveStatus.gatewayUrl || "");
      setPayherePairedAt(liveStatus.pairedAt || "");
      setPayhereEnabled(liveStatus.enabled);
      setPayhereSandboxMode(liveStatus.sandboxMode);
      if (liveStatus.merchantId) setPayhereMerchantId(liveStatus.merchantId);
    }
  }, [liveStatus]);

  const togglePaymentMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("POST", "/api/settings", { key, value });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payhere/status"] });
      toast({
        title: "Setting Saved",
        description: `${variables.key} updated successfully.`,
      });
    },
  });

  const payhereMerchantIdMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest("POST", "/api/settings", {
        key: "PAYHERE_MERCHANT_ID",
        value,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payhere/status"] });
      toast({
        title: "PayHere Merchant ID Saved",
        description: "Merchant ID updated successfully.",
      });
    },
  });

  const payhereMerchantSecretMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest("POST", "/api/settings", {
        key: "PAYHERE_MERCHANT_SECRET",
        value,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payhere/status"] });
      toast({
        title: "PayHere Merchant Secret Saved",
        description: "Merchant Secret updated securely.",
      });
    },
  });

  const payherePairMutation = useMutation({
    mutationFn: async (data: { pairingUrl: string; merchantId?: string; merchantSecret?: string }) => {
      const res = await apiRequest("POST", "/api/payhere/pair", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payhere/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/PAYHERE_GATEWAY_URL"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/PAYHERE_STATUS"] });
      if (data.gatewayUrl) setPayhereGatewayUrl(data.gatewayUrl);
      setPayhereStatus("connected");
      setPayherePairingUrl("");
      toast({
        title: "⚡ PayHere Gateway Connected Successfully!",
        description: `Connected to ${data.gatewayUrl || "host proxy"}. Gateway is now Live & Active.`,
      });
      handleTestPing();
    },
    onError: (err: any) => {
      toast({
        title: "Pairing Failed",
        description: err.message || "Failed to pair with the host URL.",
        variant: "destructive",
      });
    },
  });

  const payhereDisconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payhere/disconnect", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payhere/status"] });
      setPayhereGatewayUrl("");
      setPayhereStatus("disconnected");
      setPingResult(null);
      toast({
        title: "Host Disconnected",
        description: "PayHere gateway proxy has been unlinked.",
      });
    },
  });

  const handleTestPing = async () => {
    try {
      setPingLoading(true);
      setPingResult(null);
      const res = await apiRequest("POST", "/api/payhere/test-ping", {});
      const data = await res.json();
      setPingResult(data);
      if (data.success) {
        toast({
          title: "Ping Successful 📡",
          description: `Host responded in ${data.latencyMs}ms. Status: Online & Healthy`,
        });
      } else {
        toast({
          title: "Ping Failed",
          description: data.message || "Host did not respond",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setPingResult({ success: false, message: err.message });
      toast({
        title: "Ping Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setPingLoading(false);
    }
  };

  const isConnected = payhereStatus === "connected" && !!payhereGatewayUrl;

  return (
    <div className="space-y-10 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-2xl flex items-center gap-3">
            <CreditCard className="w-10 h-10 text-emerald-400" />
            PayHere Host Gateway
          </h1>
          <p className="text-white/60 mt-1 font-medium">
            Approved domain proxy configuration for zero-detection LKR checkout and instant deposits
          </p>
        </div>

        {/* Dynamic Status Pill */}
        <div className={`px-6 py-2.5 rounded-full flex items-center gap-3 text-sm font-bold shadow-lg border transition-all ${
          isConnected 
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
            : 'bg-red-950/80 border-red-500/40 text-red-300'
        }`}>
          <span className={`inline-block w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse shadow-[0_0_15px_rgba(52,211,153,1)]' : 'bg-red-500'}`} />
          {isConnected ? "🟢 GATEWAY CONNECTED" : "🔴 DISCONNECTED"}
        </div>
      </div>

      <div className="max-w-4xl space-y-8">
        {/* Main Status & Pairing Card */}
        <Card className={`glass-card border transition-all duration-500 ${
          isConnected
            ? 'bg-gradient-to-br from-emerald-950/40 via-background/95 to-teal-950/30 border-emerald-500/30 shadow-2xl'
            : 'bg-gradient-to-br from-purple-950/30 via-background/95 to-background border-white/10 shadow-xl'
        }`}>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black flex items-center gap-2 text-white">
                  <Zap className={`w-6 h-6 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-purple-400'}`} />
                  Gateway Connection & Status
                </CardTitle>
                <CardDescription className="text-white/60">
                  {isConnected 
                    ? `Live checkout proxy paired with ${payhereGatewayUrl}`
                    : "Pair with your standalone approved host (e.g. https://imhosteepay.online or http://localhost:3000)"
                  }
                </CardDescription>
              </div>

              {/* Status Controls */}
              <div className="flex items-center gap-3">
                <Button
                  variant={payhereSandboxMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const newValue = !payhereSandboxMode;
                    setPayhereSandboxMode(newValue);
                    togglePaymentMutation.mutate({ key: "PAYHERE_SANDBOX_MODE", value: newValue.toString() });
                  }}
                  className={payhereSandboxMode ? "bg-amber-500 hover:bg-amber-600 text-xs text-black font-bold" : "border-white/20 text-xs text-white/60"}
                >
                  {payhereSandboxMode ? "Sandbox Mode" : "Live Mode"}
                </Button>

                <Button
                  variant={payhereEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const newValue = !payhereEnabled;
                    setPayhereEnabled(newValue);
                    togglePaymentMutation.mutate({ key: "PAYHERE_ENABLED", value: newValue.toString() });
                  }}
                  className={payhereEnabled ? "bg-emerald-500 hover:bg-emerald-600 text-black font-bold" : "border-white/20"}
                >
                  {payhereEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Live Connection Banner */}
            {isConnected ? (
              <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-4 shadow-lg shadow-emerald-950/40">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Connected Proxy Gateway</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">ONLINE</span>
                      </div>
                      <code className="text-base font-black text-white font-mono">{payhereGatewayUrl}</code>
                      {payherePairedAt && (
                        <p className="text-[11px] text-white/40 mt-0.5">Paired at: {new Date(payherePairedAt).toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestPing}
                      disabled={pingLoading}
                      className="h-10 px-4 text-xs font-bold border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 bg-emerald-950/40"
                    >
                      {pingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Activity className="w-4 h-4 mr-1.5" />}
                      Test Ping
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => payhereDisconnectMutation.mutate()}
                      disabled={payhereDisconnectMutation.isPending}
                      className="h-10 px-3 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>

                {pingResult && (
                  <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between font-bold ${
                    pingResult.success ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200" : "bg-red-500/20 border border-red-500/40 text-red-200"
                  }`}>
                    <span>{pingResult.success ? `✅ Ping Response Received! Latency: ${pingResult.latencyMs}ms (Online)` : `❌ Ping failed: ${pingResult.message}`}</span>
                    {pingResult.latencyMs && <span className="font-mono bg-black/40 px-2 py-1 rounded text-emerald-300">{pingResult.latencyMs} ms</span>}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm font-bold text-red-300">Gateway is Disconnected</p>
                    <p className="text-xs text-white/50">Paste a pairing link below to link your host instance.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Instant Pairing Input Box */}
            <div className="space-y-3 p-5 rounded-2xl bg-black/60 border border-white/10 shadow-inner">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-black text-emerald-300 uppercase tracking-widest flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  {isConnected ? "Re-Pair or Update Gateway Link" : "Paste Pairing Link from Host Instance"}
                </Label>
                <span className="text-xs text-emerald-400/80 font-mono">imhost /pair</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Paste URL e.g. https://imhosteepay.online/pair/pair_12345... or domain URL"
                  className="glass-panel border-white/20 bg-white/5 text-white h-12 text-sm font-mono flex-1 focus:border-emerald-400"
                  value={payherePairingUrl}
                  onChange={(e) => setPayherePairingUrl(e.target.value)}
                />
                <Button
                  onClick={() => {
                    if (!payherePairingUrl.trim()) {
                      toast({ title: "Pairing URL Required", description: "Please enter the pairing URL from imhost /pair.", variant: "destructive" });
                      return;
                    }
                    payherePairMutation.mutate({
                      pairingUrl: payherePairingUrl.trim(),
                      merchantId: payhereMerchantId.trim(),
                      merchantSecret: payhereMerchantSecret.trim()
                    });
                  }}
                  disabled={payherePairMutation.isPending}
                  className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black font-black text-sm shadow-lg shadow-emerald-500/20"
                >
                  {payherePairMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
                  {isConnected ? "Update Link" : "Connect Gateway"}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between pt-1 text-xs text-white/50">
                <p>
                  1. Open <code>/pair</code> on your PayHere host instance (Auto-refreshes every 10 mins).<br />
                  2. Copy the active link and click <b>Connect Gateway</b>.
                </p>
                {payhereGatewayUrl ? (
                  <a
                    href={`${payhereGatewayUrl}/pair`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:underline mt-2 sm:mt-0"
                  >
                    Open {payhereGatewayUrl}/pair <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-white/40">Open /pair on your host instance</span>
                )}
              </div>
            </div>

            {/* Merchant ID & Secret Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <Label className="text-xs font-bold text-white/70 uppercase tracking-wider">PayHere Merchant ID</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 1210000"
                    className="glass-panel border-white/10 bg-white/5 text-white h-11 text-xs"
                    value={payhereMerchantId}
                    onChange={(e) => setPayhereMerchantId(e.target.value)}
                  />
                  <Button
                    onClick={() => payhereMerchantIdMutation.mutate(payhereMerchantId)}
                    disabled={payhereMerchantIdMutation.isPending}
                    className="h-11 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                  >
                    {payhereMerchantIdMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-white/40">From your PayHere Merchant Portal ➔ Settings ➔ Domains & Credentials</p>
              </div>

              <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <Label className="text-xs font-bold text-white/70 uppercase tracking-wider">PayHere Merchant Secret</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Paste Merchant Secret"
                    className="glass-panel border-white/10 bg-white/5 text-white h-11 text-xs"
                    value={payhereMerchantSecret}
                    onChange={(e) => setPayhereMerchantSecret(e.target.value)}
                  />
                  <Button
                    onClick={() => payhereMerchantSecretMutation.mutate(payhereMerchantSecret)}
                    disabled={payhereMerchantSecretMutation.isPending}
                    className="h-11 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                  >
                    {payhereMerchantSecretMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-white/40">Used for MD5 security hash generation on the proxy.</p>
              </div>
            </div>

            {/* Zero Detection & Security Info */}
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-2">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                Zero-Detection Architecture Active
              </div>
              <ul className="text-xs text-white/60 space-y-1 list-disc list-inside">
                <li>Referrer Policy: <code>strict-origin-when-cross-origin</code> (no leaks to PayHere).</li>
                <li>Items Description: Generic <code>"API Checking Service"</code> (never mentions hosting or bot).</li>
                <li>Instant Balance Crediting: Instant IPN Webhook updates <code>telegram_users</code> balance automatically.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
