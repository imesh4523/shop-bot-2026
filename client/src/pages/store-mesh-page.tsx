import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Network,
  Shield,
  Key,
  Link2,
  RefreshCw,
  Copy,
  Check,
  Server,
  Zap,
  Radio,
  Clock,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  Lock,
  ExternalLink,
  Plus,
  Layers,
  Activity,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { StoreMeshNode, StoreMeshLog } from "@shared/schema";

export default function StoreMeshPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Active tab state
  const [activeTab, setActiveTab] = useState("nodes");

  // Host Mode (Generate Pair Code) states
  const [customHostUrl, setCustomHostUrl] = useState("");
  const [generatedPair, setGeneratedPair] = useState<{
    code: string;
    hostUrl: string;
    expiresAt: string;
    connectString: string;
  } | null>(null);

  // Client Mode (Connect Remote Store) states
  const [remoteUrl, setRemoteUrl] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [nodeAlias, setNodeAlias] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [syncCatalog, setSyncCatalog] = useState(true);
  const [syncOrders, setSyncOrders] = useState(false);
  const [priceMarkup, setPriceMarkup] = useState("10");

  // Edit Node Modal state
  const [editingNode, setEditingNode] = useState<StoreMeshNode | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSyncCatalog, setEditSyncCatalog] = useState(true);
  const [editSyncOrders, setEditSyncOrders] = useState(false);
  const [editMarkup, setEditMarkup] = useState("0");

  // Copy helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    toast({ title: "Copied!", description: "Copied to clipboard." });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Queries
  const { data: nodeInfo, isLoading: isInfoLoading } = useQuery({
    queryKey: ["/api/mesh/node-info"],
    queryFn: async () => {
      const res = await fetch("/api/mesh/node-info");
      if (!res.ok) throw new Error("Failed to fetch node info");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: nodes = [], isLoading: isNodesLoading } = useQuery<StoreMeshNode[]>({
    queryKey: ["/api/mesh/nodes"],
    queryFn: async () => {
      const res = await fetch("/api/mesh/nodes");
      if (!res.ok) throw new Error("Failed to fetch mesh nodes");
      return res.json();
    },
    refetchInterval: 8000,
  });

  const { data: logs = [], isLoading: isLogsLoading } = useQuery<StoreMeshLog[]>({
    queryKey: ["/api/mesh/logs"],
    queryFn: async () => {
      const res = await fetch("/api/mesh/logs");
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    refetchInterval: 6000,
  });

  // Generate Pair Code Mutation
  const generateMutation = useMutation({
    mutationFn: async (hostUrl: string) => {
      const res = await fetch("/api/mesh/pair/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostUrl: hostUrl || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate pairing code");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedPair(data);
      toast({
        title: "Pairing Code Generated",
        description: `Code ${data.code} is active for 15 minutes.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/logs"] });
    },
    onError: (err: any) => {
      toast({
        title: "Generation Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Connect to Remote Store Mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/mesh/pair/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remoteUrl,
          pairCode,
          nodeName: nodeAlias || undefined,
          description: nodeDescription || undefined,
          syncCatalog,
          syncOrders,
          priceMarkupPct: parseInt(priceMarkup, 10) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to connect to remote store");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Peer Connection Established! 🚀",
        description: `Paired securely with [${data.node?.nodeName}].`,
      });
      setRemoteUrl("");
      setPairCode("");
      setNodeAlias("");
      setNodeDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/logs"] });
      setActiveTab("nodes");
    },
    onError: (err: any) => {
      toast({
        title: "Connection Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Ping Peer Node Mutation
  const pingMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/mesh/nodes/${id}/ping`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ping failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "🟢 Peer Node Online" : "🔴 Peer Node Unreachable",
        description: data.success
          ? `${data.nodeName} responded with ${data.latencyMs}ms latency.`
          : `Could not reach ${data.nodeName}.`,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Ping Error", description: err.message, variant: "destructive" });
    },
  });

  // Sync Peer Catalog Mutation
  const syncMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/mesh/nodes/${id}/sync`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Sync failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Catalog Synced Successfully! 📦",
        description: `Fetched ${data.productCount} available products from peer store.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Sync Error", description: err.message, variant: "destructive" });
    },
  });

  // Update Node Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingNode) return;
      const res = await fetch(`/api/mesh/nodes/${editingNode.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeName: editName,
          description: editDesc,
          syncCatalog: editSyncCatalog,
          syncOrders: editSyncOrders,
          priceMarkupPct: parseInt(editMarkup, 10) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update node");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Store Node Updated", description: "Settings saved successfully." });
      setEditingNode(null);
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  // Delete / Unpair Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/mesh/nodes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to unpair node");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Node Unpaired", description: "The peer connection has been revoked." });
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mesh/logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Unpair Failed", description: err.message, variant: "destructive" });
    },
  });

  const openEditModal = (node: StoreMeshNode) => {
    setEditingNode(node);
    setEditName(node.nodeName);
    setEditDesc(node.description || "");
    setEditSyncCatalog(node.syncCatalog);
    setEditSyncOrders(node.syncOrders);
    setEditMarkup((node.priceMarkupPct || 0).toString());
  };

  // Helper for quick connect string paste
  const handleQuickPasteConnectString = (val: string) => {
    if (val.includes("|")) {
      const parts = val.split("|");
      setRemoteUrl(parts[0].trim());
      setPairCode(parts[1].trim());
    } else {
      setPairCode(val);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500 pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 border border-white/20">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                Store Mesh Connect
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-2 py-0.5 font-mono">
                  HMAC-SHA256 Encrypted
                </Badge>
              </h1>
              <p className="text-white/50 text-sm">
                Peer-to-Peer Inter-Store Cryptographic Federation & Multi-Store Synchronizer
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/mesh/nodes"] });
              queryClient.invalidateQueries({ queryKey: ["/api/mesh/logs"] });
              queryClient.invalidateQueries({ queryKey: ["/api/mesh/node-info"] });
              toast({ title: "Refreshed", description: "Mesh network status updated." });
            }}
            variant="outline"
            className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl gap-2 font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Mesh
          </Button>
          <Button
            onClick={() => setActiveTab("connect")}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl gap-2 font-bold shadow-lg shadow-purple-600/30"
          >
            <Plus className="w-4 h-4" />
            Connect New Store
          </Button>
        </div>
      </div>

      {/* Top Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Node Fingerprint */}
        <Card className="bg-[#130d24]/80 border-white/10 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-white/40 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              Local Node Identity
              <Shield className="w-4 h-4 text-purple-400" />
            </CardDescription>
            <CardTitle className="text-lg font-mono font-black text-purple-300 truncate">
              {nodeInfo?.fingerprint || "MESH-LOCAL-001"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <button
              onClick={() => handleCopy(nodeInfo?.fingerprint || "", "fp")}
              className="text-xs text-white/50 hover:text-white flex items-center gap-1.5 transition-colors font-mono"
            >
              {copiedKey === "fp" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Click to Copy Fingerprint
            </button>
          </CardContent>
        </Card>

        {/* Paired Stores Count */}
        <Card className="bg-[#130d24]/80 border-white/10 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-white/40 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              Active Paired Nodes
              <Server className="w-4 h-4 text-indigo-400" />
            </CardDescription>
            <CardTitle className="text-3xl font-black text-white">
              {nodes.filter((n) => n.status === "online").length}
              <span className="text-sm font-normal text-white/40 ml-2">/ {nodes.length} connected</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Mutual Handshake Ready
            </p>
          </CardContent>
        </Card>

        {/* Security Model */}
        <Card className="bg-[#130d24]/80 border-white/10 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-white/40 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              Anti-Spoof Defense
              <Lock className="w-4 h-4 text-emerald-400" />
            </CardDescription>
            <CardTitle className="text-base font-bold text-white">
              Zero-Trust Replay Shield
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-white/50">
              Expiring Nonce + HMAC Verification on every sync request.
            </p>
          </CardContent>
        </Card>

        {/* Sync Mode */}
        <Card className="bg-[#130d24]/80 border-white/10 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-white/40 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              Cross-Sync Engine
              <ArrowRightLeft className="w-4 h-4 text-pink-400" />
            </CardDescription>
            <CardTitle className="text-base font-bold text-white">
              Catalog & Margin Markup
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-white/50">
              Automated multi-store product inventory federation.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#130d24] border border-white/10 p-1.5 rounded-2xl grid grid-cols-2 md:grid-cols-4 w-full h-auto gap-2">
          <TabsTrigger
            value="nodes"
            className="rounded-xl py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white text-white/60 font-bold text-sm gap-2"
          >
            <Boxes className="w-4 h-4" />
            Paired Stores ({nodes.length})
          </TabsTrigger>
          <TabsTrigger
            value="host"
            className="rounded-xl py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white text-white/60 font-bold text-sm gap-2"
          >
            <Key className="w-4 h-4" />
            Host Mode (Pair Key)
          </TabsTrigger>
          <TabsTrigger
            value="connect"
            className="rounded-xl py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white text-white/60 font-bold text-sm gap-2"
          >
            <Link2 className="w-4 h-4" />
            Connect Remote Store
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="rounded-xl py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white text-white/60 font-bold text-sm gap-2"
          >
            <Activity className="w-4 h-4" />
            Mesh Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PAIRED STORE NODES */}
        <TabsContent value="nodes" className="space-y-6">
          {isNodesLoading ? (
            <div className="py-16 text-center text-white/40 flex items-center justify-center gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
              Loading connected store nodes...
            </div>
          ) : nodes.length === 0 ? (
            <Card className="bg-[#130d24]/60 border-white/10 text-center py-16 px-6">
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-purple-400 shadow-2xl">
                <Network className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">No Connected Stores Yet</h3>
              <p className="text-white/50 text-sm max-w-md mx-auto mb-6">
                Connect your store with another Shopeefy instance or partner shop to sync products, share stock, and enable cross-store order routing.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  onClick={() => setActiveTab("host")}
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl gap-2 font-bold"
                >
                  <Key className="w-4 h-4 text-purple-400" />
                  Generate My Pair Key
                </Button>
                <Button
                  onClick={() => setActiveTab("connect")}
                  className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl gap-2 font-bold"
                >
                  <Link2 className="w-4 h-4" />
                  Connect to a Store
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {nodes.map((node) => (
                <Card
                  key={node.id}
                  className="bg-[#130d24]/90 border border-white/10 hover:border-purple-500/40 transition-all duration-300 rounded-3xl overflow-hidden shadow-2xl group relative"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

                  <CardHeader className="pb-3 border-b border-white/5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center text-purple-300 font-black text-lg shadow-inner">
                          <Server className="w-6 h-6" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-black text-white group-hover:text-purple-300 transition-colors flex items-center gap-2">
                            {node.nodeName}
                          </CardTitle>
                          <a
                            href={node.nodeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-white/40 hover:text-purple-400 flex items-center gap-1 font-mono transition-colors"
                          >
                            {node.nodeUrl}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <Badge
                        className={`font-mono text-xs px-2.5 py-1 ${
                          node.status === "online"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-red-500/20 text-red-400 border-red-500/40"
                        }`}
                      >
                        {node.status === "online" ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            {node.latencyMs ? `${node.latencyMs}ms` : "Online"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400" />
                            Offline
                          </span>
                        )}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {node.description && (
                      <div className="text-xs text-white/70 bg-white/5 p-3 rounded-xl border border-white/5">
                        {node.description}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                        <span className="text-white/40 block mb-1">Catalog Sync:</span>
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {node.syncCatalog ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <span className="text-white/40 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Disabled
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                        <span className="text-white/40 block mb-1">Price Markup:</span>
                        <span className="font-bold text-purple-300 font-mono">
                          +{node.priceMarkupPct || 0}% Profit Margin
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-white/40 flex items-center justify-between font-mono pt-1">
                      <span>Node FP: {node.fingerprint.slice(0, 16)}...</span>
                      <span>
                        Last Ping: {node.lastPingAt ? new Date(node.lastPingAt).toLocaleTimeString() : "Never"}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pingMutation.mutate(node.id)}
                        disabled={pingMutation.isPending}
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs h-9 rounded-xl font-bold gap-1.5"
                      >
                        <Radio className={`w-3.5 h-3.5 text-indigo-400 ${pingMutation.isPending ? "animate-spin" : ""}`} />
                        Test Ping
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncMutation.mutate(node.id)}
                        disabled={syncMutation.isPending || !node.syncCatalog}
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs h-9 rounded-xl font-bold gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                        Sync Products
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditModal(node)}
                        className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Are you sure you want to unpair from ${node.nodeName}?`)) {
                            deleteMutation.mutate(node.id);
                          }
                        }}
                        className="h-9 w-9 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: HOST MODE - GENERATE PAIR CODE */}
        <TabsContent value="host" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-[#130d24]/90 border-white/10 backdrop-blur-xl rounded-3xl p-6">
              <CardHeader className="px-0 pt-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-white">Generate Host Pairing Key</CardTitle>
                    <CardDescription className="text-white/50 text-xs">
                      Create an ephemeral, high-entropy cryptographic token for another store admin to link with your store.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-0 space-y-6">
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">
                    Your Server Domain / Public Base URL (Auto-Detected)
                  </Label>
                  <Input
                    placeholder={nodeInfo?.detectedUrl || "https://your-store.com"}
                    value={customHostUrl}
                    onChange={(e) => setCustomHostUrl(e.target.value)}
                    className="bg-white/5 border-white/10 text-white rounded-xl font-mono text-sm"
                  />
                  <p className="text-[11px] text-white/40">
                    The connecting store will send handshake payloads to this endpoint. (e.g. <code>https://youuhost.com</code>)
                  </p>
                </div>

                <Button
                  onClick={() => generateMutation.mutate(customHostUrl || nodeInfo?.detectedUrl || "")}
                  disabled={generateMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-6 rounded-2xl gap-2 shadow-xl shadow-purple-600/20 text-base"
                >
                  <Zap className={`w-5 h-5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                  {generateMutation.isPending ? "Generating Cryptographic Token..." : "Generate Secure 1-Time Pair Key"}
                </Button>

                {generatedPair && (
                  <div className="bg-gradient-to-br from-purple-950/60 to-indigo-950/60 border border-purple-500/40 rounded-3xl p-6 space-y-4 relative overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                        <Clock className="w-4 h-4 animate-spin text-purple-400" />
                        Valid for 15 Minutes
                      </span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        Ready for Handshake
                      </Badge>
                    </div>

                    <div className="text-center py-4 bg-black/40 rounded-2xl border border-white/10">
                      <span className="text-xs text-white/40 block mb-1">PAIR CODE</span>
                      <span className="text-3xl sm:text-4xl font-mono font-black text-white tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-200">
                        {generatedPair.code}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-white/60">
                        1-Click Full Connection String (Share with partner store):
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={generatedPair.connectString}
                          className="bg-black/50 border-white/10 text-purple-300 font-mono text-xs rounded-xl"
                        />
                        <Button
                          onClick={() => handleCopy(generatedPair.connectString, "connStr")}
                          className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl gap-1.5 shrink-0 font-bold"
                        >
                          {copiedKey === "connStr" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          Copy String
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How Host Mode Works */}
            <Card className="bg-[#130d24]/60 border-white/10 rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  How Pairing Works
                </h3>
                <ol className="space-y-4 text-xs text-white/70">
                  <li className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>
                      Click <b>Generate Secure 1-Time Pair Key</b>. A single-use 256-bit token is created on your server.
                    </span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>
                      Copy and send the <b>Connection String</b> to the other store owner.
                    </span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span>
                      They paste it into their <b>Connect Remote Store</b> tab. Both servers perform an automated mutual HMAC cryptographic exchange.
                    </span>
                  </li>
                </ol>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-300">
                🔒 <b>Zero Hacker Exposure:</b> The Pair Code self-destructs immediately upon successful handshake or 15-minute timeout.
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: CLIENT MODE - CONNECT REMOTE STORE */}
        <TabsContent value="connect" className="space-y-6">
          <Card className="max-w-3xl mx-auto bg-[#130d24]/90 border-white/10 backdrop-blur-xl rounded-3xl p-6 sm:p-8">
            <CardHeader className="px-0 pt-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Link2 className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black text-white">Connect to Remote Store Node</CardTitle>
                  <CardDescription className="text-white/50 text-sm">
                    Enter the remote store's server URL and pairing code to establish a secure peer federation.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-0 space-y-6">
              {/* Quick Connection String Paste */}
              <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <Label className="text-xs font-bold text-purple-300 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  Quick Paste Connection String:
                </Label>
                <Input
                  placeholder="Paste URL|CODE here (e.g. https://partner-store.com|MESH-8291-3810)"
                  onChange={(e) => handleQuickPasteConnectString(e.target.value)}
                  className="bg-white/5 border-white/10 text-white rounded-xl font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/70 uppercase">Remote Server URL *</Label>
                  <Input
                    placeholder="https://partner-store.com"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    className="bg-white/5 border-white/10 text-white rounded-xl font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/70 uppercase">Pairing Code *</Label>
                  <Input
                    placeholder="MESH-XXXX-XXXX"
                    value={pairCode}
                    onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                    className="bg-white/5 border-white/10 text-white rounded-xl font-mono text-sm uppercase tracking-wider"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/70 uppercase">Friendly Store Alias (Optional)</Label>
                  <Input
                    placeholder="e.g. VIP Branch Store #2"
                    value={nodeAlias}
                    onChange={(e) => setNodeAlias(e.target.value)}
                    className="bg-white/5 border-white/10 text-white rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-white/70 uppercase">Profit Margin Markup %</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="10"
                      value={priceMarkup}
                      onChange={(e) => setPriceMarkup(e.target.value)}
                      className="bg-white/5 border-white/10 text-white rounded-xl text-sm pl-4 pr-12 font-mono"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40 font-bold">
                      % Markup
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-white/70 uppercase">Store Notes / Description</Label>
                <Textarea
                  placeholder="Notes about products, supplier terms, or contact information for this peer store..."
                  value={nodeDescription}
                  onChange={(e) => setNodeDescription(e.target.value)}
                  className="bg-white/5 border-white/10 text-white rounded-xl text-xs h-20"
                />
              </div>

              {/* Sync Switches */}
              <div className="space-y-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-bold text-white block">Auto Sync Products & Catalog</Label>
                    <span className="text-xs text-white/40">
                      Import active inventory items from this partner store with your custom profit markup.
                    </span>
                  </div>
                  <Switch checked={syncCatalog} onCheckedChange={setSyncCatalog} />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div>
                    <Label className="text-sm font-bold text-white block">Cross-Store Order Routing</Label>
                    <span className="text-xs text-white/40">
                      Forward customer fulfillment requests directly to this peer store.
                    </span>
                  </div>
                  <Switch checked={syncOrders} onCheckedChange={setSyncOrders} />
                </div>
              </div>

              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !remoteUrl || !pairCode}
                className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black py-6 rounded-2xl gap-2 shadow-2xl shadow-indigo-600/30 text-base"
              >
                <Network className={`w-5 h-5 ${connectMutation.isPending ? "animate-spin" : ""}`} />
                {connectMutation.isPending ? "Performing Cryptographic Handshake..." : "🚀 Establish Secure Peer Link"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: MESH AUDIT LOGS */}
        <TabsContent value="logs" className="space-y-6">
          <Card className="bg-[#130d24]/90 border-white/10 backdrop-blur-xl rounded-3xl p-6">
            <CardHeader className="px-0 pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    Cryptographic Mesh Defense & Sync Ledger
                  </CardTitle>
                  <CardDescription className="text-white/50 text-xs">
                    Real-time audit log of mutual peer authentication handshakes, HMAC verifications, and sync events.
                  </CardDescription>
                </div>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 font-mono text-xs">
                  {logs.length} Logged Events
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="px-0">
              {isLogsLoading ? (
                <div className="py-12 text-center text-white/40 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  Loading logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs">No mesh events recorded yet.</div>
              ) : (
                <div className="rounded-2xl border border-white/5 overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-white/5 text-white/40 sticky top-0 backdrop-blur-md">
                        <tr>
                          <th className="p-3">Time</th>
                          <th className="p-3">Event</th>
                          <th className="p-3">Details</th>
                          <th className="p-3">IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {logs.map((log) => {
                          const isSuccess = log.eventType.includes("success") || log.eventType.includes("connected") || log.eventType.includes("synced");
                          const isReject = log.eventType.includes("reject") || log.eventType.includes("failed") || log.eventType.includes("unpair");

                          return (
                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 text-white/40 whitespace-nowrap">
                                {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : "-"}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <Badge
                                  className={`text-[10px] px-2 py-0.5 ${
                                    isSuccess
                                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                      : isReject
                                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                                      : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                  }`}
                                >
                                  {log.eventType}
                                </Badge>
                              </td>
                              <td className="p-3 text-white/80 font-sans">{log.message}</td>
                              <td className="p-3 text-white/40 whitespace-nowrap">{log.ip || "internal"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* EDIT STORE NODE MODAL */}
      <Dialog open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <DialogContent className="bg-[#130d24] border-white/10 text-white rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-purple-400" />
              Edit Paired Store Node
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Update alias, profit margin markup, and sync rules for [{editingNode?.nodeName}].
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-white/70">Store Friendly Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-white/5 border-white/10 text-white rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-white/70">Profit Markup %</Label>
              <Input
                type="number"
                value={editMarkup}
                onChange={(e) => setEditMarkup(e.target.value)}
                className="bg-white/5 border-white/10 text-white rounded-xl font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-white/70">Description / Notes</Label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="bg-white/5 border-white/10 text-white rounded-xl text-xs h-20"
              />
            </div>

            <div className="space-y-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-white block">Sync Products</Label>
                  <span className="text-[11px] text-white/40">Import products into active catalog</span>
                </div>
                <Switch checked={editSyncCatalog} onCheckedChange={setEditSyncCatalog} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>
                  <Label className="text-xs font-bold text-white block">Order Routing</Label>
                  <span className="text-[11px] text-white/40">Forward customer fulfillment requests</span>
                </div>
                <Switch checked={editSyncOrders} onCheckedChange={setEditSyncOrders} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingNode(null)}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
