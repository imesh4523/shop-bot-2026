import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  CreditCard, 
  ShoppingBag, 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Trash2, 
  Ban, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  Layers, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Sparkles, 
  Code2, 
  Receipt, 
  Coins, 
  Activity, 
  ChevronRight,
  User,
  Calendar,
  Wallet,
  Globe,
  Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyData {
  id: number;
  telegramUserId: number;
  key: string;
  status: "active" | "revoked";
  totalOrders: number;
  successOrders: number;
  failedOrders: number;
  revenue: number;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ApiKeysApiResponse {
  success: boolean;
  keys: ApiKeyData[];
  activeKey: ApiKeyData | null;
  baseUrl: string;
  docsUrl: string;
  totalOrders: number;
  successOrders: number;
  revenueCents: number;
}

interface TransactionItem {
  id: string;
  type: "deposit" | "purchase" | "smm" | "partner";
  category: string;
  title: string;
  amountCents: number;
  amountFormatted: string;
  currency: string;
  method: string;
  status: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiOrder {
  id: number;
  productId: number;
  productName: string;
  priceCents: number;
  priceUsd: string;
  status: string;
  deliveredContent: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"overview" | "api" | "transactions">("overview");
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedApiKeyForOrders, setSelectedApiKeyForOrders] = useState<ApiKeyData | null>(null);
  const [viewDeliveryContent, setViewDeliveryContent] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<"all" | "deposit" | "purchase" | "smm">("all");
  const [txSearch, setTxSearch] = useState("");

  // 1. Fetch User Live Data (balance, etc.)
  const { data: miniUser, refetch: refetchUser } = useQuery<any>({
    queryKey: ["/api/mini/user"],
    staleTime: 1000 * 30,
  });

  const currentUser = miniUser?.isLoggedIn ? miniUser : user;

  // 2. Fetch User API Keys
  const { 
    data: apiKeysData, 
    isLoading: isLoadingApiKeys, 
    refetch: refetchApiKeys 
  } = useQuery<ApiKeysApiResponse>({
    queryKey: ["/api/mini/api-keys"],
  });

  // 3. Fetch User Transactions Timeline
  const { 
    data: transactions = [], 
    isLoading: isLoadingTransactions, 
    refetch: refetchTransactions 
  } = useQuery<TransactionItem[]>({
    queryKey: ["/api/mini/transactions"],
  });

  // 4. Fetch specific API Key orders when clicked
  const { 
    data: apiKeyOrders = [], 
    isLoading: isLoadingKeyOrders 
  } = useQuery<ApiOrder[]>({
    queryKey: [`/api/mini/api-keys/${selectedApiKeyForOrders?.id}/orders`],
    enabled: !!selectedApiKeyForOrders?.id,
  });

  // --- MUTATIONS ---

  // Generate New API Key
  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/mini/api-keys/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to generate API key");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "API Key Generated! 🔑",
        description: "Your new Developer API key is now active and ready for use.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/api-keys"] });
      refetchApiKeys();
      setShowKeySecret(true);
    },
    onError: (err: any) => {
      toast({
        title: "Generation Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // Revoke API Key
  const revokeKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/mini/api-keys/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to revoke API key");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "API Key Revoked 🚫",
        description: "The API key has been disabled and can no longer make authenticated requests.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/api-keys"] });
      refetchApiKeys();
    },
    onError: (err: any) => {
      toast({
        title: "Revoke Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // Delete API Key
  const deleteKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/mini/api-keys/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete API key");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "API Key Deleted 🗑️",
        description: "API key removed from your account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/api-keys"] });
      refetchApiKeys();
    },
    onError: (err: any) => {
      toast({
        title: "Delete Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const handleCopyKey = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(true);
    toast({
      title: "API Key Copied! 📋",
      description: "Keep your API key safe and do not expose it publicly.",
    });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const calculateDaysSinceRegistration = () => {
    if (!currentUser?.createdAt) return 0;
    const createdDate = new Date(currentUser.createdAt);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - createdDate.getTime());
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const formatRegistrationDate = () => {
    if (!currentUser?.createdAt) return "N/A";
    const date = new Date(currentUser.createdAt);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const activeKey = apiKeysData?.activeKey;
  const userBalanceUsd = ((currentUser?.balance || 0) / 100).toFixed(2);
  const userBalanceLkr = Math.round(((currentUser?.balance || 0) / 100) * 305.5).toLocaleString();

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (txFilter !== "all" && tx.type !== txFilter) return false;
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase();
      return (
        tx.title.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.status.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "completed" || s === "success" || s === "approved") {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold px-2 py-0.5 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> SUCCESS
        </Badge>
      );
    }
    if (s === "pending" || s === "processing") {
      return (
        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10.5px] font-bold px-2 py-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3 animate-spin" /> PENDING
        </Badge>
      );
    }
    if (s === "cancelled" || s === "canceled" || s === "failed" || s === "revoked") {
      return (
        <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10.5px] font-bold px-2 py-0.5 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> CANCELLED
        </Badge>
      );
    }
    if (s === "refunded") {
      return (
        <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10.5px] font-bold px-2 py-0.5 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> REFUNDED
        </Badge>
      );
    }
    return (
      <Badge className="bg-white/10 text-white/70 border border-white/10 text-[10.5px] font-bold px-2 py-0.5">
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 px-2 sm:px-4">
      {/* HEADER & TOP BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl text-white/60 hover:text-white hover:bg-white/10 h-10 w-10 border border-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Account Dashboard</h1>
              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-extrabold uppercase">
                {activeKey ? "Developer Mode" : "Verified Customer"}
              </Badge>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              Manage your balance, developer API keys, and transaction history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchUser();
              refetchApiKeys();
              refetchTransactions();
              toast({ title: "Account Data Refreshed 🔄" });
            }}
            className="border-white/10 text-xs text-white hover:bg-white/5 rounded-xl h-10 px-4"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>

          <Link href="/payments">
            <Button
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl h-10 px-5 shadow-lg shadow-purple-600/25"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Top-Up Balance
            </Button>
          </Link>
        </div>
      </div>

      {/* USER HERO & STATS BANNER */}
      <Card className="glass-panel border-purple-500/20 bg-gradient-to-br from-[#120B24] via-[#170E30] to-[#0D0719] relative overflow-hidden shadow-2xl rounded-3xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-600/10 blur-3xl rounded-full pointer-events-none" />

        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8">
            {/* Left: Avatar & Identity */}
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <div className="relative group">
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl ring-4 ring-purple-500/30 bg-gradient-to-br from-purple-500 via-indigo-600 to-pink-600 flex items-center justify-center text-white text-4xl sm:text-5xl font-black shadow-2xl shadow-purple-500/30 overflow-hidden">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser?.firstName?.[0] || currentUser?.username?.[0] || "U"}</span>
                  )}
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#120B24] flex items-center justify-center text-white text-[10px] font-black shadow">
                  ✓
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    {currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ""}` : (currentUser?.username || "Shopeefy User")}
                  </h2>
                  <Badge className="bg-white/10 text-white/80 border border-white/10 text-[10px] font-mono">
                    ID: #{currentUser?.id || "1"}
                  </Badge>
                </div>
                
                <p className="text-xs text-white/50 font-mono flex items-center justify-center sm:justify-start gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  <span>@{currentUser?.username || currentUser?.email || "anonymous_user"}</span>
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2 text-[11px] text-white/60">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" /> Member since {formatRegistrationDate()}
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="text-purple-300 font-bold">{calculateDaysSinceRegistration()} days active</span>
                </div>
              </div>
            </div>

            {/* Right: Balance & Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              {/* Metric 1: Available Balance */}
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/20 backdrop-blur-md flex flex-col justify-between col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-purple-300 text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Wallet Balance
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-white font-mono">${userBalanceUsd}</div>
                  <div className="text-[11px] text-purple-300/70 font-mono mt-0.5">≈ Rs {userBalanceLkr}</div>
                </div>
              </div>

              {/* Metric 2: API Keys Count */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-white/50 text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" /> API Keys
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-amber-300 font-mono">
                    {apiKeysData?.keys?.filter(k => k.status === "active").length || 0}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    {activeKey ? "🟢 Active Key" : "⚪ No active key"}
                  </div>
                </div>
              </div>

              {/* Metric 3: Total Transactions */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-white/50 text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" /> Transactions
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-300 font-mono">
                    {transactions.length}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    {transactions.filter(t => t.type === "deposit").length} Deposits
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABS NAVIGATION */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="bg-black/40 border border-white/10 p-1 rounded-2xl grid grid-cols-3 max-w-xl">
          <TabsTrigger 
            value="overview" 
            className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2.5"
          >
            <User className="w-3.5 h-3.5 mr-1.5" /> Overview
          </TabsTrigger>
          <TabsTrigger 
            value="api" 
            className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2.5"
          >
            <Key className="w-3.5 h-3.5 mr-1.5" /> Developer API
          </TabsTrigger>
          <TabsTrigger 
            value="transactions" 
            className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2.5"
          >
            <Receipt className="w-3.5 h-3.5 mr-1.5" /> Transactions
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & PROFILE INFO */}
        {/* ========================================================================= */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Details Card */}
            <Card className="glass-panel border-white/10 bg-[#120B24]">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" /> Account & Security Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
                  <span className="text-white/50 font-medium">User Identifier (UID)</span>
                  <span className="text-white font-mono font-bold">#{currentUser?.id || "1"}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
                  <span className="text-white/50 font-medium">Telegram ID</span>
                  <span className="text-white font-mono font-bold">{currentUser?.telegramId || "Linked"}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
                  <span className="text-white/50 font-medium">Account Status</span>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                    🟢 Active & Verified
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
                  <span className="text-white/50 font-medium">Authentication Provider</span>
                  <span className="text-purple-300 font-bold uppercase">{currentUser?.authProvider || "Telegram"}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
                  <span className="text-white/50 font-medium">Referral Balance</span>
                  <span className="text-emerald-400 font-mono font-bold">${((currentUser?.referralBalance || 0) / 100).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions & Shortcuts Card */}
            <Card className="glass-panel border-white/10 bg-[#120B24]">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Quick Actions & Navigation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <Link href="/payments">
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-purple-600/10 border border-white/5 hover:border-purple-500/30 transition-all flex items-center justify-between group cursor-pointer mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-purple-300">Deposit / Top-up Wallet</div>
                        <div className="text-[11px] text-white/40">PayHere, Binance Pay, Cryptomus</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>

                <Link href="/orders">
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-blue-600/10 border border-white/5 hover:border-blue-500/30 transition-all flex items-center justify-between group cursor-pointer mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-blue-300">My Purchased Goods</div>
                        <div className="text-[11px] text-white/40">View delivered credentials & licenses</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>

                <div 
                  onClick={() => setActiveTab("api")}
                  className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-amber-600/10 border border-white/5 hover:border-amber-500/30 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-amber-300">Developer API Keys</div>
                      <div className="text-[11px] text-white/40">Integrate bot & store into your software</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: DEVELOPER & RESELLER API MANAGEMENT */}
        {/* ========================================================================= */}
        <TabsContent value="api" className="space-y-6">
          {/* Active Key Main Card */}
          <Card className="glass-panel border-purple-500/30 bg-[#120B24] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/10 blur-3xl rounded-full pointer-events-none" />
            
            <CardHeader className="border-b border-white/5 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white font-black flex items-center gap-2">
                      🧩 Reseller / Developer API Key
                    </CardTitle>
                    <CardDescription className="text-white/60 text-xs">
                      Authenticate automated orders, inventory queries, and account balance via HTTP REST API.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href="/api-docs">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold rounded-xl h-10 px-4 flex items-center gap-1.5"
                    >
                      <Terminal className="w-3.5 h-3.5" /> Full API Docs
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </Button>
                  </Link>

                  <Button
                    onClick={() => generateKeyMutation.mutate()}
                    disabled={generateKeyMutation.isPending}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl h-10 px-5 shadow-lg shadow-purple-600/25 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> {activeKey ? "Regenerate Key" : "Create API Key"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* KEY DISPLAY BANNER */}
              {activeKey ? (
                <div className="p-5 rounded-2xl bg-black/40 border border-purple-500/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-bold px-2.5 py-0.5">
                        🟢 ACTIVE KEY
                      </Badge>
                      <span className="text-xs text-white/50">Created on {new Date(activeKey.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowKeySecret(!showKeySecret)}
                        className="text-xs text-white/60 hover:text-white h-8 px-2.5 rounded-lg"
                      >
                        {showKeySecret ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 mr-1" /> Hide Key
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 mr-1" /> Reveal Key
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyKey(activeKey.key)}
                        className="border-white/10 hover:bg-white/5 text-xs text-white h-8 px-3 rounded-lg flex items-center gap-1.5"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey ? "Copied" : "Copy"}</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeKeyMutation.mutate(activeKey.id)}
                        disabled={revokeKeyMutation.isPending}
                        className="border-red-500/20 hover:bg-red-500/10 text-xs text-red-400 hover:text-red-300 h-8 px-2.5 rounded-lg"
                      >
                        <Ban className="w-3.5 h-3.5 mr-1" /> Revoke
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteKeyMutation.mutate(activeKey.id)}
                        disabled={deleteKeyMutation.isPending}
                        className="border-red-500/20 hover:bg-red-500/10 text-xs text-red-400 hover:text-red-300 h-8 px-2.5 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* The Key String Input Box */}
                  <div className="relative">
                    <Input
                      readOnly
                      type={showKeySecret ? "text" : "password"}
                      value={activeKey.key}
                      className="bg-black/60 border-purple-500/30 text-purple-200 font-mono text-sm h-12 pr-28 rounded-xl selection:bg-purple-600"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <Badge className="bg-purple-500/20 text-purple-300 border-0 text-[10px] font-mono">
                        X-API-Key
                      </Badge>
                    </div>
                  </div>

                  <p className="text-[11px] text-white/40">
                    🔒 Keep your active key private. Use the HTTP header <code className="text-purple-300 font-mono">X-API-Key: {activeKey.key.substring(0, 8)}...</code> for all requests.
                  </p>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-black/30 border border-dashed border-white/10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">No Active API Key</h3>
                    <p className="text-xs text-white/50 max-w-md mx-auto mt-1">
                      Generate your personal Developer / Reseller API Key to automate purchases, stock checking, and batch orders.
                    </p>
                  </div>
                  <Button
                    onClick={() => generateKeyMutation.mutate()}
                    disabled={generateKeyMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl h-10 px-6 mt-2"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Generate My API Key
                  </Button>
                </div>
              )}

              {/* API PERFORMANCE METRICS */}
              {activeKey && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                    <div className="text-xs font-bold text-white/50 uppercase">Total API Orders</div>
                    <div className="text-xl font-black text-white font-mono">{activeKey.totalOrders || 0}</div>
                    <div className="text-[10px] text-white/40">Lifetime orders placed</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                    <div className="text-xs font-bold text-emerald-400/70 uppercase">Successful Orders</div>
                    <div className="text-xl font-black text-emerald-300 font-mono">{activeKey.successOrders || 0}</div>
                    <div className="text-[10px] text-emerald-400/50">Fulfilled instantly</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                    <div className="text-xs font-bold text-red-400/70 uppercase">Failed Orders</div>
                    <div className="text-xl font-black text-red-400 font-mono">{activeKey.failedOrders || 0}</div>
                    <div className="text-[10px] text-red-400/50">Out of stock / error</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                    <div className="text-xs font-bold text-purple-400/70 uppercase">Total API Spend</div>
                    <div className="text-xl font-black text-purple-300 font-mono">
                      ${((activeKey.revenue || 0) / 100).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-purple-400/50">Processed via key</div>
                  </div>
                </div>
              )}

              {/* ALL API KEYS LIST TABLE */}
              {(apiKeysData?.keys && apiKeysData.keys.length > 0) && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" /> Account API Keys History:
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-white/5">
                    <table className="w-full text-left text-xs text-white">
                      <thead className="bg-white/5 text-[11px] font-bold text-white/40 uppercase">
                        <tr>
                          <th className="p-3">Key Preview</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Orders</th>
                          <th className="p-3">Total Spent</th>
                          <th className="p-3">Created</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {apiKeysData.keys.map((k) => (
                          <tr key={k.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-bold text-purple-300">
                              {k.key.substring(0, 10)}••••••••{k.key.substring(k.key.length - 4)}
                            </td>
                            <td className="p-3">
                              {k.status === "active" ? (
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px]">Active</Badge>
                              ) : (
                                <Badge className="bg-red-500/20 text-red-300 border-0 text-[10px]">Revoked</Badge>
                              )}
                            </td>
                            <td className="p-3 text-white/70">
                              <span className="text-white font-bold">{k.totalOrders || 0}</span> ({k.successOrders || 0} ok)
                            </td>
                            <td className="p-3 text-purple-200">
                              ${((k.revenue || 0) / 100).toFixed(2)}
                            </td>
                            <td className="p-3 text-white/40 text-[10.5px]">
                              {new Date(k.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-right space-x-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedApiKeyForOrders(k)}
                                className="border-white/10 text-[10px] h-7 text-purple-300 hover:text-white"
                              >
                                View Orders
                              </Button>
                              {k.status === "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => revokeKeyMutation.mutate(k.id)}
                                  className="border-red-500/20 text-[10px] h-7 text-red-400 hover:text-red-300"
                                >
                                  Revoke
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteKeyMutation.mutate(k.id)}
                                className="text-[10px] h-7 text-white/40 hover:text-red-400 px-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* QUICK INTEGRATION CODE CARD */}
              <div className="p-5 rounded-2xl bg-black/60 border border-white/5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-white/60 pb-2 border-b border-white/5">
                  <span className="font-bold flex items-center gap-2 text-white">
                    <Terminal className="w-4 h-4 text-purple-400" /> Quick cURL Request Example
                  </span>
                  <span className="text-[11px] text-white/40">Base: {apiKeysData?.baseUrl || "https://api.youuhost.com"}</span>
                </div>
                <pre className="text-purple-300 overflow-x-auto p-3 bg-black/40 rounded-xl">
{`curl -X GET "${apiKeysData?.baseUrl || "https://api.youuhost.com"}/api/v1/products" \\
  -H "X-API-Key: ${activeKey?.key || "YOUR_ACTIVE_KEY"}"`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: TRANSACTIONS & PAYMENT ACTIVITY */}
        {/* ========================================================================= */}
        <TabsContent value="transactions" className="space-y-6">
          <Card className="glass-panel border-white/10 bg-[#120B24] shadow-2xl">
            <CardHeader className="border-b border-white/5 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-white font-black flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-400" /> All Account Transactions
                  </CardTitle>
                  <CardDescription className="text-white/60 text-xs mt-0.5">
                    Real-time timeline of wallet deposits, purchases, SMM orders, and refunds.
                  </CardDescription>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48">
                    <Input
                      placeholder="Search ref / title..."
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      className="bg-black/40 border-white/10 text-white text-xs h-9 rounded-xl pr-8"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTxFilter("all")}
                      className={`h-7 text-[11px] font-bold px-2.5 rounded-lg ${txFilter === "all" ? "bg-purple-600 text-white" : "text-white/60 hover:text-white"}`}
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTxFilter("deposit")}
                      className={`h-7 text-[11px] font-bold px-2.5 rounded-lg ${txFilter === "deposit" ? "bg-emerald-600 text-white" : "text-white/60 hover:text-white"}`}
                    >
                      Deposits
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTxFilter("purchase")}
                      className={`h-7 text-[11px] font-bold px-2.5 rounded-lg ${txFilter === "purchase" ? "bg-blue-600 text-white" : "text-white/60 hover:text-white"}`}
                    >
                      Purchases
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoadingTransactions ? (
                <div className="p-12 text-center text-white/40 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                  Loading transactions...
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <Receipt className="w-10 h-10 text-white/20 mx-auto" />
                  <div className="text-sm font-bold text-white/70">No Transactions Found</div>
                  <p className="text-xs text-white/40">
                    {txSearch ? "No transactions match your search filter." : "Your account has no transactions yet."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-white">
                    <thead className="bg-white/5 text-[11px] font-bold text-white/40 uppercase">
                      <tr>
                        <th className="p-4">Type & Details</th>
                        <th className="p-4">Reference ID</th>
                        <th className="p-4">Payment Method</th>
                        <th className="p-4">Date & Time</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono text-xs">
                      {filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                          {/* Type & Title */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                                tx.type === "deposit"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              }`}>
                                {tx.type === "deposit" ? (
                                  <ArrowDownLeft className="w-4 h-4" />
                                ) : (
                                  <ArrowUpRight className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-white font-sans">{tx.title}</div>
                                <div className="text-[10.5px] text-white/40 font-sans">{tx.category}</div>
                              </div>
                            </div>
                          </td>

                          {/* Reference */}
                          <td className="p-4 font-mono text-white/70">
                            <span className="text-purple-300">{tx.reference}</span>
                          </td>

                          {/* Method */}
                          <td className="p-4 text-white/60 uppercase text-[11px]">
                            {tx.method.replace(/_/g, " ")}
                          </td>

                          {/* Date */}
                          <td className="p-4 text-white/50 text-[11px] whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            })}{" "}
                            {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>

                          {/* Amount */}
                          <td className="p-4 font-black">
                            <span className={tx.type === "deposit" ? "text-emerald-400" : "text-white"}>
                              {tx.amountFormatted}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-4 text-right">
                            <div className="inline-block">
                              {getStatusBadge(tx.status)}
                            </div>
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
      </Tabs>

      {/* MODAL: API KEY ORDER HISTORY */}
      <Dialog open={!!selectedApiKeyForOrders} onOpenChange={() => setSelectedApiKeyForOrders(null)}>
        <DialogContent className="max-w-2xl bg-[#0f0a1a] border border-white/10 text-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              Orders Placed Via Key: <span className="text-purple-300 font-mono">{selectedApiKeyForOrders?.key.substring(0, 10)}...</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Complete automated order history for this specific API key.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {isLoadingKeyOrders ? (
              <div className="p-8 text-center text-xs text-white/40">Loading order history...</div>
            ) : apiKeyOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/40 bg-black/40 rounded-2xl border border-white/5 font-mono">
                No orders have been placed using this API key yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/5 max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs text-white">
                  <thead className="bg-white/5 text-[11px] font-bold text-white/40 uppercase sticky top-0">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Delivery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {apiKeyOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 text-purple-300 font-bold">#ORD-{ord.id}</td>
                        <td className="p-3 text-white font-sans">{ord.productName}</td>
                        <td className="p-3 text-emerald-400">${ord.priceUsd}</td>
                        <td className="p-3">{getStatusBadge(ord.status)}</td>
                        <td className="p-3 text-white/40">{new Date(ord.createdAt).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          {ord.deliveredContent ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewDeliveryContent(ord.deliveredContent)}
                              className="border-white/10 text-[10px] h-6 px-2 text-purple-300"
                            >
                              View
                            </Button>
                          ) : (
                            <span className="text-white/30">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: VIEW DELIVERED CONTENT */}
      <Dialog open={!!viewDeliveryContent} onOpenChange={() => setViewDeliveryContent(null)}>
        <DialogContent className="max-w-md bg-[#0f0a1a] border border-white/10 text-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black">Delivered Digital Item</DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Credentials / License key delivered for this order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <pre className="p-4 rounded-2xl bg-black/60 border border-purple-500/30 text-purple-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap selection:bg-purple-600">
              {viewDeliveryContent}
            </pre>
            <Button
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl h-10"
              onClick={() => {
                if (viewDeliveryContent) {
                  navigator.clipboard.writeText(viewDeliveryContent);
                  toast({ title: "Copied credentials! 📋" });
                }
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-2" /> Copy Credentials
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
