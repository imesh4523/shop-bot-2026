import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  Key,
  DollarSign,
  Package,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  Globe,
  Radio,
  Clock,
  ShieldCheck,
  Zap,
  Sparkles,
  Layers,
  FileText,
  KeyRound,
  Code2,
  Send,
  Puzzle,
  Terminal,
  Server,
  Database,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const BASE_URL = "https://api.cssx.store";
const DOCS_URL = "https://api.cssx.store/docs";

const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/me",
    title: "Account Profile & Wallet",
    description: "Returns account details, email, status, and live USDT wallet balance.",
    samplePayload: null,
    curlExample: `curl -X GET "${BASE_URL}/api/v1/me" \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Accept: application/json"`
  },
  {
    method: "GET",
    path: "/api/v1/products",
    title: "Products Catalog",
    description: "Fetches list of all available products with stock, pricing, and variant details.",
    samplePayload: null,
    curlExample: `curl -X GET "${BASE_URL}/api/v1/products" \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Accept: application/json"`
  },
  {
    method: "POST",
    path: "/api/v1/order",
    title: "Create Single Order",
    description: "Purchases and provisions a product instantly. Deducts cost from your USDT wallet.",
    samplePayload: { product_id: "PROD_123", quantity: 1, custom_data: { note: "Order via Bot" } },
    curlExample: `curl -X POST "${BASE_URL}/api/v1/order" \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"product_id": "PROD_123", "quantity": 1}'`
  },
  {
    method: "POST",
    path: "/api/v1/batch-order",
    title: "Create Batch Orders",
    description: "Places multiple product orders in a single atomic transaction.",
    samplePayload: {
      orders: [
        { product_id: "PROD_123", quantity: 2 },
        { product_id: "PROD_456", quantity: 1 }
      ]
    },
    curlExample: `curl -X POST "${BASE_URL}/api/v1/batch-order" \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"orders": [{"product_id": "PROD_123", "quantity": 2}]}'`
  },
  {
    method: "GET",
    path: "/api/v1/orders",
    title: "Order History",
    description: "Fetches all recent placed orders with delivery data and statuses.",
    samplePayload: null,
    curlExample: `curl -X GET "${BASE_URL}/api/v1/orders" \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Accept: application/json"`
  },
  {
    method: "GET",
    path: "/api/v1/order/{id}",
    title: "Get Order by ID",
    description: "Fetches complete order details, delivered keys, license codes, or download links.",
    samplePayload: null,
    curlExample: `curl -X GET "${BASE_URL}/api/v1/order/ORD_98765" \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Accept: application/json"`
  },
  {
    method: "GET",
    path: "/api/v1/stats",
    title: "Account Statistics",
    description: "Returns total orders, successful orders count, spent USDT, and failure rates.",
    samplePayload: null,
    curlExample: `curl -X GET "${BASE_URL}/api/v1/stats" \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Accept: application/json"`
  }
];

export default function CssxApiPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "orders" | "docs" | "settings">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Settings form state
  const [inputApiKey, setInputApiKey] = useState("");
  const [inputBaseUrl, setInputBaseUrl] = useState(BASE_URL);

  // Order modal state
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<any | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [orderCustomNote, setOrderCustomNote] = useState<string>("");

  // Interactive playground state
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState<string>("/api/v1/me");
  const [playgroundMethod, setPlaygroundMethod] = useState<string>("GET");
  const [playgroundPayload, setPlaygroundPayload] = useState<string>('{\n  "product_id": "1",\n  "quantity": 1\n}');
  const [playgroundOrderId, setPlaygroundOrderId] = useState<string>("1");
  const [playgroundResponse, setPlaygroundResponse] = useState<any | null>(null);
  const [isPlayingLoading, setIsPlayingLoading] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
    setTimeout(() => setCopiedText(null), 2000);
  };

  // 1. Query CSxStore Settings & Live Balance
  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } = useQuery({
    queryKey: ["/api/admin/cssx/settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cssx/settings");
      if (!res.ok) throw new Error("Failed to load CSxStore settings");
      const data = await res.json();
      if (data.apiKey && !inputApiKey) setInputApiKey(data.apiKey);
      if (data.baseUrl) setInputBaseUrl(data.baseUrl);
      return data;
    },
  });

  // 2. Query Live Products
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useQuery<any[]>({
    queryKey: ["/api/admin/cssx/products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cssx/products");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to load products");
      }
      return res.json();
    },
    enabled: activeTab === "products" || activeTab === "overview",
    retry: false
  });

  // 3. Query Orders History
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<any[]>({
    queryKey: ["/api/admin/cssx/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cssx/orders");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to load orders");
      }
      return res.json();
    },
    enabled: activeTab === "orders" || activeTab === "overview",
    retry: false
  });

  // 4. Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async ({ apiKey, baseUrl }: { apiKey: string; baseUrl: string }) => {
      const res = await fetch("/api/admin/cssx/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, baseUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save settings");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: data.status === "connected" ? "Connected Successfully!" : "Settings Saved",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cssx/settings"] });
      refetchSettings();
    },
    onError: (err: any) => {
      toast({
        title: "Configuration Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // 5. Create Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/admin/cssx/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to place order");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Order Placed!", description: "Product has been provisioned successfully." });
      setSelectedProductForOrder(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cssx/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cssx/settings"] });
    },
    onError: (err: any) => {
      toast({ title: "Order Failed", description: err.message, variant: "destructive" });
    },
  });

  // Interactive playground execution
  const executePlayground = async () => {
    setIsPlayingLoading(true);
    setPlaygroundResponse(null);
    try {
      let endpoint = playgroundEndpoint;
      if (endpoint === "/api/v1/order/{id}") {
        endpoint = `/api/v1/orders/${playgroundOrderId || "1"}`;
      }

      let res: Response;
      if (playgroundMethod === "GET") {
        if (endpoint === "/api/v1/me") res = await fetch("/api/admin/cssx/me");
        else if (endpoint === "/api/v1/stats") res = await fetch("/api/admin/cssx/stats");
        else if (endpoint === "/api/v1/products") res = await fetch("/api/admin/cssx/products");
        else if (endpoint === "/api/v1/orders") res = await fetch("/api/admin/cssx/orders");
        else res = await fetch(`/api/admin/cssx/orders/${playgroundOrderId || "1"}`);
      } else {
        let bodyJson = {};
        try { bodyJson = JSON.parse(playgroundPayload); } catch { throw new Error("Invalid JSON body in payload."); }
        
        if (endpoint === "/api/v1/order") {
          res = await fetch("/api/admin/cssx/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyJson)
          });
        } else {
          res = await fetch("/api/admin/cssx/batch-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyJson)
          });
        }
      }

      const data = await res.json();
      setPlaygroundResponse({ status: res.status, ok: res.ok, data });
    } catch (err: any) {
      setPlaygroundResponse({ status: 500, ok: false, error: err.message });
    } finally {
      setIsPlayingLoading(false);
    }
  };

  const isConnected = settingsData?.status === "connected";
  const activeKeyDisplay = settingsData?.apiKey
    ? (showApiKey ? settingsData.apiKey : (settingsData.maskedApiKey || "••••••••••••••••"))
    : "No active key";

  const walletUsdt = Number(settingsData?.walletUsdt ?? 0).toFixed(4);
  const totalOrders = Number(settingsData?.stats?.orders ?? orders.length ?? 0);
  const successfulOrders = Number(settingsData?.stats?.successful ?? orders.filter((o: any) => o.status === "completed" || o.status === "success").length ?? 0);

  // Filter products by search
  const filteredProducts = products.filter((p: any) => {
    const title = (p.title || p.name || "").toLowerCase();
    const cat = (p.category || "").toLowerCase();
    const id = String(p.id || p.product_id || "");
    const q = searchQuery.toLowerCase();
    return title.includes(q) || cat.includes(q) || id.includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#120B24] via-[#1A1035] to-[#25134A] border border-purple-500/20 shadow-2xl p-6 md:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-2xl">🧩</span>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Reseller / Developer API
              </h1>
              <Badge
                variant="outline"
                className={`text-xs font-black uppercase px-3 py-1 rounded-full ${
                  isConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : settingsData?.apiKey
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                }`}
              >
                <Radio className="w-3 h-3 mr-1.5 animate-pulse inline" />
                {isConnected ? "API Active & Connected" : (settingsData?.apiKey ? "Connection Warning" : "No Active Key")}
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-purple-200/70 max-w-2xl font-medium">
              Direct high-performance integration with <b className="text-white font-bold">CSxStore Reseller API</b>. Provision products, manage USDT wallet balance, execute batch orders, and query live delivery data.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-all hover:scale-105 active:scale-95 shadow-sm"
            >
              <FileText className="w-4 h-4 text-purple-400" />
              <span>📚 API Docs</span>
              <ExternalLink className="w-3.5 h-3.5 text-white/50" />
            </a>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchSettings();
                refetchProducts();
                refetchOrders();
                toast({ title: "Refreshing...", description: "Fetching live CSxStore balance & data." });
              }}
              disabled={settingsLoading}
              className="rounded-2xl border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 font-bold text-xs h-10 px-4"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${settingsLoading ? "animate-spin text-purple-400" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Live Metrics Grid matching exact specs */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-purple-500/15">
          {/* 1. API Status */}
          <div className="bg-black/30 rounded-2xl p-3.5 border border-white/5">
            <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider block mb-1">
              API Status
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-400 animate-ping" : "bg-red-500"}`} />
              <span className="text-xs font-black text-white truncate">
                {isConnected ? "Connected" : (settingsData?.apiKey ? "Check Key" : "No active key")}
              </span>
            </div>
          </div>

          {/* 2. Wallet USDT */}
          <div className="bg-black/30 rounded-2xl p-3.5 border border-white/5">
            <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider block mb-1">
              💰 Wallet
            </span>
            <div className="text-sm font-black text-emerald-400">
              {walletUsdt} <span className="text-[10px] font-bold text-emerald-400/70">USDT</span>
            </div>
          </div>

          {/* 3. Orders */}
          <div className="bg-black/30 rounded-2xl p-3.5 border border-white/5">
            <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider block mb-1">
              📦 Orders
            </span>
            <div className="text-sm font-black text-white">
              {totalOrders}
            </div>
          </div>

          {/* 4. Successful */}
          <div className="bg-black/30 rounded-2xl p-3.5 border border-white/5">
            <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider block mb-1">
              ✅ Successful
            </span>
            <div className="text-sm font-black text-purple-300">
              {successfulOrders}
            </div>
          </div>

          {/* 5. API Key */}
          <div className="bg-black/30 rounded-2xl p-3.5 border border-white/5 relative group">
            <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider block mb-1 flex items-center justify-between">
              <span>🔑 API Key</span>
              {settingsData?.apiKey && (
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-purple-300 hover:text-white transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              )}
            </span>
            <div className="text-xs font-black text-white font-mono truncate">
              {activeKeyDisplay}
            </div>
          </div>

          {/* 6. Base URL */}
          <div className="bg-black/30 rounded-2xl p-3.5 border border-white/5">
            <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider block mb-1 flex items-center justify-between">
              <span>🌐 Base URL</span>
              <button
                type="button"
                onClick={() => copyToClipboard(settingsData?.baseUrl || BASE_URL, "Base URL")}
                className="text-purple-300 hover:text-white"
              >
                {copiedText === "Base URL" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </span>
            <div className="text-[11px] font-bold text-white/90 truncate font-mono">
              {settingsData?.baseUrl || BASE_URL}
            </div>
          </div>
        </div>

        {/* Notice banner matching user request */}
        <div className="mt-4 px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-200/90 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Your full active key is shown only inside your own CSxStore account. Keep it private.</span>
          </div>
          <span className="text-[11px] font-mono text-purple-300/80">Header Auth: <b className="text-white">X-API-Key: YOUR_KEY</b></span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="bg-[#130B24] border border-purple-500/20 p-1.5 rounded-2xl grid grid-cols-2 md:grid-cols-5 gap-1.5 h-auto">
          <TabsTrigger
            value="overview"
            className="rounded-xl font-black text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="products"
            className="rounded-xl font-black text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            <Package className="w-3.5 h-3.5 mr-2" />
            Live Products ({products.length})
          </TabsTrigger>
          <TabsTrigger
            value="orders"
            className="rounded-xl font-black text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            <ShoppingCart className="w-3.5 h-3.5 mr-2" />
            Orders History ({orders.length})
          </TabsTrigger>
          <TabsTrigger
            value="docs"
            className="rounded-xl font-black text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            <Code2 className="w-3.5 h-3.5 mr-2" />
            📚 API Docs & Playground
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-xl font-black text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            <KeyRound className="w-3.5 h-3.5 mr-2" />
            API Key & Settings
          </TabsTrigger>
        </TabsList>

        {/* 1. TAB: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Action: Account & Wallet Status */}
            <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-black">
                  LIVE WALLET
                </Badge>
              </div>
              <h3 className="text-xs font-bold text-purple-300/60 uppercase">Available USDT Balance</h3>
              <div className="text-3xl font-black text-white mt-1">
                ${walletUsdt} <span className="text-sm font-bold text-emerald-400">USDT</span>
              </div>
              <p className="text-xs text-purple-200/60 mt-2">
                Used for instant API product purchases and batch automated provisioning.
              </p>
              <div className="mt-4 pt-4 border-t border-purple-500/10 flex items-center justify-between">
                <span className="text-xs text-white/50">Status: <b className="text-white">{settingsData?.statusMessage || "Active"}</b></span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refetchSettings()}
                  className="h-8 text-xs font-bold text-purple-300 hover:text-white hover:bg-purple-500/10"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Check Balance
                </Button>
              </div>
            </div>

            {/* Quick Action: Product Catalog summary */}
            <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <Package className="w-5 h-5 text-purple-400" />
                </div>
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] font-black">
                  CATALOG
                </Badge>
              </div>
              <h3 className="text-xs font-bold text-purple-300/60 uppercase">Available Products</h3>
              <div className="text-3xl font-black text-white mt-1">
                {products.length} <span className="text-sm font-bold text-purple-400">Items</span>
              </div>
              <p className="text-xs text-purple-200/60 mt-2">
                Live products in CSxStore catalog with automated provisioning.
              </p>
              <div className="mt-4 pt-4 border-t border-purple-500/10 flex items-center justify-between">
                <Button
                  size="sm"
                  onClick={() => setActiveTab("products")}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl h-8 flex items-center justify-center gap-1"
                >
                  Browse Catalog <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Quick Action: Developer & Reseller Docs */}
            <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Code2 className="w-5 h-5 text-blue-400" />
                </div>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-black">
                  API V1
                </Badge>
              </div>
              <h3 className="text-xs font-bold text-purple-300/60 uppercase">API Documentation</h3>
              <div className="text-xl font-black text-white mt-1">
                7 Endpoints Ready
              </div>
              <p className="text-xs text-purple-200/60 mt-2">
                Interactive playground for /me, /products, /order, /orders, /stats.
              </p>
              <div className="mt-4 pt-4 border-t border-purple-500/10 flex items-center justify-between">
                <Button
                  size="sm"
                  onClick={() => setActiveTab("docs")}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl h-8 flex items-center justify-center gap-1"
                >
                  Open Docs & Playground <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Endpoints Cheatsheet on Overview */}
          <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-black text-white">Supported Reseller API Endpoints</h3>
              </div>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-300 hover:text-white font-bold flex items-center gap-1"
              >
                View Full Docs <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {API_ENDPOINTS.map((ep) => (
                <div
                  key={ep.path + ep.method}
                  onClick={() => {
                    setPlaygroundEndpoint(ep.path);
                    setPlaygroundMethod(ep.method);
                    if (ep.samplePayload) {
                      setPlaygroundPayload(JSON.stringify(ep.samplePayload, null, 2));
                    }
                    setActiveTab("docs");
                  }}
                  className="p-3.5 rounded-2xl bg-black/40 border border-purple-500/15 hover:border-purple-500/40 cursor-pointer transition-all hover:scale-[1.02] group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        ep.method === "GET"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="text-[10px] text-purple-300/50 font-mono group-hover:text-purple-300">Try in Playground →</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-white mb-1">{ep.path}</div>
                  <div className="text-[11px] text-purple-200/60 leading-snug">{ep.title}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* 2. TAB: LIVE PRODUCTS */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search products by title, category, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#120B24] border-purple-500/20 text-white placeholder:text-purple-300/40 rounded-2xl text-xs h-10"
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchProducts()}
              disabled={productsLoading}
              className="rounded-2xl border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 font-bold text-xs h-10"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${productsLoading ? "animate-spin text-purple-400" : ""}`} />
              Reload Products
            </Button>
          </div>

          {productsLoading ? (
            <div className="p-12 text-center bg-[#120B24] border border-purple-500/20 rounded-3xl">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
              <p className="text-xs font-bold text-purple-200/70">Fetching live products from CSxStore API...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center bg-[#120B24] border border-purple-500/20 rounded-3xl">
              <Package className="w-10 h-10 text-purple-400/40 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-white">No products found</h4>
              <p className="text-xs text-purple-300/60 mt-1 max-w-md mx-auto">
                {settingsData?.apiKey
                  ? "No products returned matching your search query, or your API key has no catalog permissions."
                  : "Please configure your CSxStore API key in settings to fetch the live product catalog."}
              </p>
              {!settingsData?.apiKey && (
                <Button
                  size="sm"
                  onClick={() => setActiveTab("settings")}
                  className="mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl"
                >
                  Configure API Key
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((p: any) => {
                const prodId = p.id || p.product_id || p.code;
                const prodName = p.title || p.name || `Product #${prodId}`;
                const price = p.price_usdt || p.price || p.cost || 0;
                const stock = p.stock ?? p.quantity ?? p.inventory ?? "In Stock";
                const category = p.category || "General";

                return (
                  <div
                    key={prodId}
                    className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-5 shadow-lg flex flex-col justify-between hover:border-purple-500/40 transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[10px] font-black">
                          {category}
                        </Badge>
                        <span className="text-[10px] font-mono text-purple-400/60">ID: {prodId}</span>
                      </div>
                      <h4 className="text-sm font-black text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                        {prodName}
                      </h4>
                      {p.description && (
                        <p className="text-xs text-purple-200/50 mt-1.5 line-clamp-2 font-medium">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-purple-500/15 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-purple-300/60 block font-bold">Price / Stock</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-emerald-400">${Number(price).toFixed(2)} USDT</span>
                          <span className="text-[10px] font-bold text-white/50">• Stock: {stock}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedProductForOrder(p);
                          setOrderQuantity(1);
                        }}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl h-8 px-3 shadow-md shadow-purple-600/20"
                      >
                        Order Now
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 3. TAB: ORDERS HISTORY */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Placed CSxStore Orders</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchOrders()}
              disabled={ordersLoading}
              className="rounded-2xl border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 font-bold text-xs h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${ordersLoading ? "animate-spin text-purple-400" : ""}`} />
              Refresh Orders
            </Button>
          </div>

          {ordersLoading ? (
            <div className="p-12 text-center bg-[#120B24] border border-purple-500/20 rounded-3xl">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
              <p className="text-xs font-bold text-purple-200/70">Loading order records...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center bg-[#120B24] border border-purple-500/20 rounded-3xl">
              <ShoppingCart className="w-10 h-10 text-purple-400/40 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-white">No orders found</h4>
              <p className="text-xs text-purple-300/60 mt-1 max-w-md mx-auto">
                No orders have been placed through this CSxStore API key yet.
              </p>
            </div>
          ) : (
            <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 border-b border-purple-500/15 text-purple-300/60 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Product / Item</th>
                      <th className="p-4">Qty</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Delivered Data / Key</th>
                      <th className="p-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/10">
                    {orders.map((o: any) => {
                      const orderId = o.id || o.order_id;
                      const prodName = o.product_name || o.product_title || o.product_id || "Item";
                      const qty = o.quantity || 1;
                      const price = o.total_price || o.price || 0;
                      const status = o.status || "completed";
                      const delivery = o.delivery_data || o.keys || o.item_data || o.license || "Delivered";

                      return (
                        <tr key={orderId} className="hover:bg-purple-500/5 transition-colors">
                          <td className="p-4 font-mono font-bold text-white">#{orderId}</td>
                          <td className="p-4 font-bold text-white/90">{prodName}</td>
                          <td className="p-4 text-purple-200">{qty}</td>
                          <td className="p-4 font-black text-emerald-400">${Number(price).toFixed(2)}</td>
                          <td className="p-4">
                            <Badge
                              className={`text-[9px] font-black uppercase ${
                                status === "completed" || status === "success"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {status}
                            </Badge>
                          </td>
                          <td className="p-4 font-mono text-[11px] text-purple-200/80 max-w-xs truncate">
                            {typeof delivery === "object" ? JSON.stringify(delivery) : delivery}
                          </td>
                          <td className="p-4 text-right text-white/40">
                            {o.created_at ? format(new Date(o.created_at), "MMM d, HH:mm") : "Recent"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 4. TAB: INTERACTIVE API DOCS & PLAYGROUND */}
        <TabsContent value="docs" className="space-y-6">
          {/* Top Docs Banner */}
          <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>📚 Reseller API Documentation</span>
                </h3>
                <p className="text-xs text-purple-200/70 mt-1">
                  Full reference and interactive live testing playground for <b className="text-white">api.cssx.store</b>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <span>Official Swagger Docs</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Endpoints Table View */}
            <div className="overflow-x-auto rounded-2xl border border-purple-500/15">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/50 text-[10px] font-bold uppercase tracking-wider text-purple-300/70 border-b border-purple-500/15">
                  <tr>
                    <th className="p-3.5">Method</th>
                    <th className="p-3.5">Endpoint</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5">Auth Header</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10 font-mono">
                  {API_ENDPOINTS.map((ep) => (
                    <tr key={ep.path} className="hover:bg-purple-500/5 transition-colors">
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            ep.method === "GET"
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {ep.method}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-white">{ep.path}</td>
                      <td className="p-3.5 font-sans text-purple-200/80 text-[11px]">{ep.description}</td>
                      <td className="p-3.5 text-purple-300 text-[10.5px]">X-API-Key: YOUR_KEY</td>
                      <td className="p-3.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setPlaygroundEndpoint(ep.path);
                            setPlaygroundMethod(ep.method);
                            if (ep.samplePayload) {
                              setPlaygroundPayload(JSON.stringify(ep.samplePayload, null, 2));
                            }
                          }}
                          className="h-7 text-[10px] font-black bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg px-2.5"
                        >
                          Test in Playground
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Playground Console */}
          <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-white">Live API Request Playground</h3>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-mono">
                Authenticated
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Request Config */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <select
                    value={playgroundMethod}
                    onChange={(e) => setPlaygroundMethod(e.target.value)}
                    className="bg-black/50 border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-black text-white focus:outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>

                  <select
                    value={playgroundEndpoint}
                    onChange={(e) => {
                      setPlaygroundEndpoint(e.target.value);
                      const ep = API_ENDPOINTS.find((x) => x.path === e.target.value);
                      if (ep) {
                        setPlaygroundMethod(ep.method);
                        if (ep.samplePayload) {
                          setPlaygroundPayload(JSON.stringify(ep.samplePayload, null, 2));
                        }
                      }
                    }}
                    className="flex-1 bg-black/50 border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none"
                  >
                    {API_ENDPOINTS.map((ep) => (
                      <option key={ep.path} value={ep.path}>
                        {ep.method} {ep.path} - {ep.title}
                      </option>
                    ))}
                  </select>
                </div>

                {playgroundEndpoint === "/api/v1/order/{id}" && (
                  <div>
                    <label className="text-[10px] font-bold text-purple-300/60 uppercase block mb-1">
                      Order ID:
                    </label>
                    <Input
                      value={playgroundOrderId}
                      onChange={(e) => setPlaygroundOrderId(e.target.value)}
                      placeholder="e.g. ORD_12345"
                      className="bg-black/50 border-purple-500/30 text-white rounded-xl text-xs font-mono"
                    />
                  </div>
                )}

                {playgroundMethod === "POST" && (
                  <div>
                    <label className="text-[10px] font-bold text-purple-300/60 uppercase block mb-1">
                      JSON Request Body:
                    </label>
                    <textarea
                      value={playgroundPayload}
                      onChange={(e) => setPlaygroundPayload(e.target.value)}
                      rows={6}
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                )}

                <Button
                  onClick={executePlayground}
                  disabled={isPlayingLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl h-11 shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2"
                >
                  {isPlayingLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Executing Request...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send Live API Request
                    </>
                  )}
                </Button>
              </div>

              {/* Right: Response Console */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-purple-300/60 uppercase">
                    Response Output:
                  </span>
                  {playgroundResponse && (
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        playgroundResponse.ok ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      HTTP {playgroundResponse.status}
                    </span>
                  )}
                </div>

                <div className="bg-black/70 border border-purple-500/30 rounded-2xl p-4 min-h-[220px] max-h-[350px] overflow-auto font-mono text-xs text-purple-200">
                  {isPlayingLoading ? (
                    <div className="flex items-center justify-center h-40 text-purple-400 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Contacting https://api.cssx.store...</span>
                    </div>
                  ) : playgroundResponse ? (
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(playgroundResponse.data || playgroundResponse.error, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-white/30 text-center flex flex-col items-center justify-center h-40">
                      <Terminal className="w-8 h-8 mb-2 opacity-40" />
                      <span>Select an endpoint and click "Send Live API Request"</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 5. TAB: SETTINGS & API KEY CONFIGURATION */}
        <TabsContent value="settings" className="space-y-6">
          <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-6 md:p-8 shadow-xl max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-purple-500/15">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <KeyRound className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">CSxStore API Key Configuration</h3>
                <p className="text-xs text-purple-200/60 mt-0.5">
                  Save your secret reseller API key to authenticate all product and wallet requests.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSettingsMutation.mutate({ apiKey: inputApiKey, baseUrl: inputBaseUrl });
              }}
              className="space-y-5"
            >
              <div>
                <label className="text-xs font-black text-purple-200 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Reseller API Key (X-API-Key)</span>
                  <span className="text-[10px] font-normal text-purple-400">Required</span>
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder="Enter your secret CSxStore API Key..."
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    className="bg-black/40 border-purple-500/30 text-white rounded-2xl text-xs font-mono h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-purple-300/60 mt-1.5 leading-relaxed">
                  Your full active key is shown only inside your own CSxStore account. Keep it private.
                </p>
              </div>

              <div>
                <label className="text-xs font-black text-purple-200 uppercase tracking-wider block mb-1.5">
                  API Base URL
                </label>
                <Input
                  type="url"
                  placeholder="https://api.cssx.store"
                  value={inputBaseUrl}
                  onChange={(e) => setInputBaseUrl(e.target.value)}
                  className="bg-black/40 border-purple-500/30 text-white rounded-2xl text-xs font-mono h-12"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={saveSettingsMutation.isPending}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:opacity-90 text-white font-black text-xs rounded-2xl shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2"
                >
                  {saveSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying & Connecting...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Save & Test Connection
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>
      </Tabs>

      {/* Place Order Modal */}
      <Dialog open={!!selectedProductForOrder} onOpenChange={(open) => !open && setSelectedProductForOrder(null)}>
        <DialogContent className="bg-[#120B24] border border-purple-500/30 text-white rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-400" />
              Place Instant Product Order
            </DialogTitle>
            <DialogDescription className="text-xs text-purple-200/70">
              This will place an order via <b className="text-white">POST /api/v1/order</b> and deduct from your USDT wallet.
            </DialogDescription>
          </DialogHeader>

          {selectedProductForOrder && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-2xl bg-black/40 border border-purple-500/20">
                <span className="text-[10px] text-purple-300/60 uppercase font-bold block">Product</span>
                <h4 className="text-sm font-black text-white">{selectedProductForOrder.title || selectedProductForOrder.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-black text-emerald-400">
                    ${Number(selectedProductForOrder.price_usdt || selectedProductForOrder.price || 0).toFixed(2)} USDT
                  </span>
                  <span className="text-[10px] text-white/50">• ID: {selectedProductForOrder.id || selectedProductForOrder.product_id}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-purple-200 block mb-1">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-black/40 border-purple-500/30 text-white rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-purple-200 block mb-1">Custom Note (Optional)</label>
                <Input
                  placeholder="e.g. Order from Telegram Bot"
                  value={orderCustomNote}
                  onChange={(e) => setOrderCustomNote(e.target.value)}
                  className="bg-black/40 border-purple-500/30 text-white rounded-xl text-xs"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-between font-bold">
                <span className="text-purple-200">Total USDT to Deduct:</span>
                <span className="text-emerald-400 text-sm font-black">
                  ${(Number(selectedProductForOrder.price_usdt || selectedProductForOrder.price || 0) * orderQuantity).toFixed(2)} USDT
                </span>
              </div>

              <Button
                onClick={() => {
                  createOrderMutation.mutate({
                    product_id: selectedProductForOrder.id || selectedProductForOrder.product_id,
                    quantity: orderQuantity,
                    custom_data: { note: orderCustomNote }
                  });
                }}
                disabled={createOrderMutation.isPending}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-2xl h-11 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Provisioning Order...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Confirm & Execute Order
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
