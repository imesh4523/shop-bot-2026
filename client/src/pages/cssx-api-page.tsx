import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  DollarSign,
  Package,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
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
  Terminal,
  SlidersHorizontal,
  Edit,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export const PRESET_CATEGORIES = [
  { id: "Gemini AI", label: "Gemini AI" },
  { id: "ChatGPT / OpenAI", label: "ChatGPT / OpenAI" },
  { id: "Claude AI", label: "Claude AI" },
  { id: "AWS Cloud", label: "AWS Cloud" },
  { id: "DigitalOcean", label: "DigitalOcean" },
  { id: "MS Azure", label: "MS Azure" },
  { id: "Oracle Cloud", label: "Oracle Cloud" },
  { id: "Linode", label: "Linode" },
  { id: "GCP Cloud", label: "GCP Cloud" },
  { id: "Canva Pro", label: "Canva Pro" },
  { id: "Adobe Creative", label: "Adobe Creative" },
  { id: "Hotmail / Outlook", label: "Hotmail / Outlook" },
  { id: "Windows OS", label: "Windows OS" },
  { id: "Spotify", label: "Spotify" },
  { id: "YouTube", label: "YouTube" },
  { id: "TikTok", label: "TikTok" },
  { id: "Instagram", label: "Instagram" },
  { id: "Facebook", label: "Facebook" },
  { id: "Telegram", label: "Telegram" },
  { id: "Duolingo", label: "Duolingo" },
  { id: "CapCut", label: "CapCut" },
  { id: "Kamatera", label: "Kamatera" },
  { id: "General / Other", label: "General / Other" },
];

export default function CssxApiPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "docs" | "settings">("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Settings State
  const [inputApiKey, setInputApiKey] = useState("");
  const [inputBaseUrl, setInputBaseUrl] = useState(BASE_URL);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editSellingPriceUsd, setEditSellingPriceUsd] = useState<string>("");
  const [editSellingPriceLkr, setEditSellingPriceLkr] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("General");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editShowOnTelegram, setEditShowOnTelegram] = useState<boolean>(false);
  const [editTelegramPriceUsd, setEditTelegramPriceUsd] = useState<string>("");

  // Import Modal State
  const [importSearch, setImportSearch] = useState("");
  const [markupPercent, setMarkupPercent] = useState<number>(40);
  const [selectedProductsToImport, setSelectedProductsToImport] = useState<any[]>([]);

  // Interactive playground state
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState<string>("/api/v1/me");
  const [playgroundMethod, setPlaygroundMethod] = useState<string>("GET");
  const [playgroundPayload, setPlaygroundPayload] = useState<string>('{\n  "service_id": "5",\n  "quantity": 1\n}');
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

  // 2. Query Managed Products in Store (stored in local database with custom prices)
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useQuery<any[]>({
    queryKey: ["/api/admin/cssx/products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cssx/products");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load products");
      }
      return res.json();
    },
  });

  // 3. Query Orders Tracker
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<any[]>({
    queryKey: ["/api/admin/cssx/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cssx/orders");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load orders");
      }
      return res.json();
    },
  });

  // 4. Query Live Remote Catalog from CSxStore API (for import modal)
  const { data: remoteProducts = [], isLoading: remoteProductsLoading, refetch: refetchRemoteProducts } = useQuery<any[]>({
    queryKey: ["/api/admin/cssx/fetch-products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cssx/fetch-products");
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch live products from CSxStore");
      }
      return res.json();
    },
    enabled: showImportModal,
  });

  // Diagnostic Test Connection Mutation
  const [testResult, setTestResult] = useState<any | null>(null);
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cssx/test");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection test failed");
      return data;
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.connected) {
        toast({
          title: "Connection Successful! ⚡",
          description: `Latency: ${data.latencyMs}ms | Account: ${data.account?.username || "@partner"} | Wallet: $${Number(data.walletUsdt || 0).toFixed(2)} USDT | Catalog: ${data.productCount} items`,
        });
      } else {
        toast({
          title: "Connection Warning",
          description: data.error || data.statusMessage || "Could not authenticate with CSxStore API",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cssx/settings"] });
      refetchSettings();
    },
    onError: (err: any) => {
      toast({
        title: "Test Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Save Settings Mutation
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
        title: data.status === "connected" ? "Connected Successfully! ⚡" : "Settings Saved",
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

  // Import Products Mutation
  const importProductsMutation = useMutation({
    mutationFn: async (payload: { products: any[]; markupPercent: number }) => {
      const res = await fetch("/api/admin/cssx/import-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to import products");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "🎉 Import Complete!",
        description: data.message,
      });
      setShowImportModal(false);
      setSelectedProductsToImport([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cssx/products"] });
      refetchProducts();
    },
    onError: (err: any) => {
      toast({
        title: "Import Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Update Product Mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const res = await fetch(`/api/admin/cssx/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update product");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Product Updated" });
      setEditingProduct(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cssx/products"] });
      refetchProducts();
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  // Delete Product Mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/cssx/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete product");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Product Deleted from Store" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cssx/products"] });
      refetchProducts();
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  // Sync Live Stock from CSxStore Mutation
  const syncStockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cssx/sync-stock", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to sync stock");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "⚡ Stock Synced Successfully!",
        description: data.message || "Updated live stock counts from CSxStore API.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cssx/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cssx/settings"] });
      refetchProducts();
    },
    onError: (err: any) => {
      toast({
        title: "Stock Sync Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenEdit = (prod: any) => {
    setEditingProduct(prod);
    setEditTitle(prod.title || "");
    setEditSellingPriceUsd(((prod.sellingPriceUsd || 0) / 100).toFixed(2));
    setEditSellingPriceLkr(prod.sellingPriceLkr ? String(prod.sellingPriceLkr) : String(Math.round(((prod.sellingPriceUsd || 0) / 100) * 305.5)));
    setEditCategory(prod.category || "General");
    setEditDescription(prod.description || "");
    setEditIsActive(prod.isActive !== false);
    setEditShowOnTelegram(Boolean(prod.showOnTelegram));
    setEditTelegramPriceUsd(prod.telegramPriceUsd ? ((prod.telegramPriceUsd / 100).toFixed(2)) : ((prod.sellingPriceUsd || 0) / 100).toFixed(2));
  };

  const handleSaveEdit = () => {
    if (!editingProduct) return;
    let usdVal = parseFloat(editSellingPriceUsd);
    let lkrVal = editSellingPriceLkr ? parseFloat(editSellingPriceLkr) : 0;

    if ((isNaN(usdVal) || usdVal <= 0) && lkrVal > 0) {
      usdVal = parseFloat((lkrVal / 305.5).toFixed(2));
    }
    if (usdVal > 0 && lkrVal <= 0) {
      lkrVal = Math.round(usdVal * 305.5);
    }

    if (isNaN(usdVal) || usdVal < 0) {
      toast({ title: "Invalid Price", description: "Please enter a valid price.", variant: "destructive" });
      return;
    }

    const priceCents = Math.round(usdVal * 100);
    let tgUsdVal = parseFloat(editTelegramPriceUsd);
    const tgPriceCents = (!isNaN(tgUsdVal) && tgUsdVal > 0) ? Math.round(tgUsdVal * 100) : null;

    updateProductMutation.mutate({
      id: editingProduct.id,
      updates: {
        title: editTitle.trim() || editingProduct.title,
        sellingPriceUsd: priceCents,
        sellingPriceLkr: Math.round(lkrVal),
        category: editCategory,
        description: editDescription,
        isActive: editIsActive,
        showOnTelegram: editShowOnTelegram,
        telegramPriceUsd: tgPriceCents,
      },
    });
  };

  // Interactive playground execution
  const executePlayground = async () => {
    setIsPlayingLoading(true);
    setPlaygroundResponse(null);
    try {
      let res: Response;
      if (playgroundMethod === "GET") {
        if (playgroundEndpoint === "/api/v1/me") res = await fetch("/api/admin/cssx/settings");
        else if (playgroundEndpoint === "/api/v1/products") res = await fetch("/api/admin/cssx/fetch-products");
        else res = await fetch("/api/admin/cssx/orders");
      } else {
        let bodyJson = {};
        try { bodyJson = JSON.parse(playgroundPayload); } catch { throw new Error("Invalid JSON body in payload."); }
        res = await fetch("/api/admin/cssx/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyJson),
        });
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

  const walletUsdt = Number(settingsData?.walletUsdt ?? 0).toFixed(2);
  const totalOrders = Number(orders.length);
  const successfulOrders = Number(orders.filter((o: any) => o.status === "completed" || o.status === "success" || o.status === "approved").length);

  // Filter local managed products
  const filteredProducts = products.filter((p: any) => {
    const title = (p.title || "").toLowerCase();
    const cat = (p.category || "").toLowerCase();
    const sid = String(p.serviceId || p.id || "");
    const q = searchQuery.toLowerCase();
    const matchesSearch = title.includes(q) || cat.includes(q) || sid.includes(q);
    const matchesCategory = selectedCategory === "all" || cat === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  // Filter remote products for import modal
  const filteredRemote = remoteProducts.filter((r: any) => {
    const title = (r.name || r.title || "").toLowerCase();
    const sid = String(r.service_id || r.id || "");
    const q = importSearch.toLowerCase();
    return title.includes(q) || sid.includes(q);
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
                CSxStore Integration & Pricing
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
              Integrate <b className="text-white font-bold">CSxStore Catalog</b> into your store. Import products, configure custom selling prices in <b className="text-emerald-400">Rs (LKR) / USD</b>, and enable automated instant provisioning.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending}
              className="rounded-2xl border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold text-xs h-10 px-4"
            >
              <Zap className={`w-3.5 h-3.5 mr-1.5 ${testConnectionMutation.isPending ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
              {testConnectionMutation.isPending ? "Testing..." : (testResult?.latencyMs ? `${testResult.latencyMs}ms Ping` : "Test Ping")}
            </Button>

            <Button
              onClick={() => setShowImportModal(true)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl h-10 px-4 shadow-lg shadow-purple-600/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Import Products ({remoteProducts.length || "Live"})
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchSettings();
                refetchProducts();
                refetchOrders();
                toast({ title: "Refreshing...", description: "Fetching live CSxStore balance & products." });
              }}
              disabled={settingsLoading || productsLoading}
              className="rounded-2xl border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 font-bold text-xs h-10 px-4"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${(settingsLoading || productsLoading) ? "animate-spin text-purple-400" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Live Metrics Grid */}
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
              💰 CSx Wallet
            </span>
            <div className="text-sm font-black text-emerald-400">
              ${walletUsdt} <span className="text-[10px] font-bold text-emerald-400/70">USDT</span>
            </div>
          </div>

          {/* 3. Managed Store Products */}
          <div className="bg-black/30 rounded-2xl p-3.5 border border-white/5">
            <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider block mb-1">
              🛍 In Store
            </span>
            <div className="text-sm font-black text-purple-300">
              {products.length} Products
            </div>
          </div>

          {/* 4. Orders */}
          <div className="bg-black/30 rounded-2xl p-3.5 border border-white/5">
            <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider block mb-1">
              📦 Orders
            </span>
            <div className="text-sm font-black text-white">
              {totalOrders}
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
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="bg-[#130B24] border border-purple-500/20 p-1.5 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-1.5 h-auto">
          <TabsTrigger
            value="products"
            className="rounded-xl font-black text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            <Package className="w-3.5 h-3.5 mr-2" />
            Managed Products ({products.length})
          </TabsTrigger>
          <TabsTrigger
            value="orders"
            className="rounded-xl font-black text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            <ShoppingCart className="w-3.5 h-3.5 mr-2" />
            Orders & Delivery ({orders.length})
          </TabsTrigger>
          <TabsTrigger
            value="docs"
            className="rounded-xl font-black text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            <Code2 className="w-3.5 h-3.5 mr-2" />
            📚 Playground & Docs
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-xl font-black text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            <KeyRound className="w-3.5 h-3.5 mr-2" />
            API Key & Settings
          </TabsTrigger>
        </TabsList>

        {/* 1. TAB: MANAGED PRODUCTS */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search products in your store..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#120B24] border-purple-500/20 text-white placeholder:text-purple-300/40 rounded-2xl text-xs h-10"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncStockMutation.mutate()}
                disabled={syncStockMutation.isPending}
                className="rounded-2xl border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 font-bold text-xs h-10 px-4"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncStockMutation.isPending ? "animate-spin text-purple-400" : ""}`} />
                Sync Live Stock
              </Button>

              <Button
                size="sm"
                onClick={() => setShowImportModal(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-2xl h-10 px-4 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Import More Products
              </Button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all ${
                selectedCategory === "all"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "bg-[#120B24] border border-purple-500/20 text-purple-300/70 hover:text-white"
              }`}
            >
              All Categories ({products.length})
            </button>
            {PRESET_CATEGORIES.map((cat) => {
              const count = products.filter((p: any) => (p.category || "").toLowerCase() === cat.id.toLowerCase()).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all ${
                    selectedCategory.toLowerCase() === cat.id.toLowerCase()
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "bg-[#120B24] border border-purple-500/20 text-purple-300/70 hover:text-white"
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {productsLoading ? (
            <div className="p-12 text-center bg-[#120B24] border border-purple-500/20 rounded-3xl">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
              <p className="text-xs font-bold text-purple-200/70">Loading store catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center bg-[#120B24] border border-purple-500/20 rounded-3xl">
              <Package className="w-10 h-10 text-purple-400/40 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-white">No products imported yet</h4>
              <p className="text-xs text-purple-300/60 mt-1 max-w-md mx-auto">
                {products.length === 0
                  ? "Import products from CSxStore to set your own custom Rs LKR / USD selling prices and start selling."
                  : "No products match your current search or category filter."}
              </p>
              {products.length === 0 && (
                <Button
                  onClick={() => setShowImportModal(true)}
                  className="mt-4 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Import Products from CSxStore
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((p: any) => {
                const costUsd = (p.costPriceUsd || 0) / 100;
                const sellUsd = (p.sellingPriceUsd || 0) / 100;
                const sellLkr = p.sellingPriceLkr ? Number(p.sellingPriceLkr) : Math.round(sellUsd * 305.5);
                const profitUsd = sellUsd - costUsd;
                const stock = p.stock ?? 0;
                const isAvail = p.available && stock > 0;

                return (
                  <div
                    key={p.id}
                    className={`bg-[#120B24] border ${
                      p.isActive ? "border-purple-500/20 hover:border-purple-500/40" : "border-white/5 opacity-60"
                    } rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-all group`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[10px] font-black">
                          {p.category || "General"}
                        </Badge>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <span className="text-[10px] font-mono text-purple-400/60">CSX #{p.serviceId}</span>

                          {/* Quick Toggle: Show in Telegram */}
                          <div 
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${
                              p.showOnTelegram 
                                ? "bg-blue-500/15 border-blue-500/30 text-blue-400 font-extrabold" 
                                : "bg-white/5 border-white/10 text-white/40 font-medium"
                            }`}
                            title="Toggle Show on Telegram"
                          >
                            <Send className="w-2.5 h-2.5" />
                            <span className="text-[9px]">TG: {p.showOnTelegram ? "ON" : "OFF"}</span>
                            <Switch
                              className="scale-75"
                              checked={!!p.showOnTelegram}
                              onCheckedChange={(checked) => {
                                updateProductMutation.mutate({
                                  id: p.id,
                                  updates: { showOnTelegram: checked },
                                });
                              }}
                            />
                          </div>

                          <Switch
                            title="Active in Store"
                            checked={p.isActive !== false}
                            onCheckedChange={(checked) => {
                              updateProductMutation.mutate({
                                id: p.id,
                                updates: { isActive: checked },
                              });
                            }}
                          />
                        </div>
                      </div>

                      <h4 className="text-sm font-black text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                        {p.title}
                      </h4>
                      {p.description && (
                        <p className="text-xs text-purple-200/50 mt-1 line-clamp-2 font-medium">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-purple-500/15 space-y-2">
                      {/* Price Grid */}
                      <div className="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-2xl border border-white/5 text-xs">
                        <div>
                          <span className="text-[10px] text-purple-300/60 uppercase block font-bold">Selling Price</span>
                          <div className="font-black text-emerald-400">
                            Rs. {sellLkr.toLocaleString()}
                          </div>
                          <div className="text-[10px] font-bold text-white/50">
                            (${sellUsd.toFixed(2)} USD)
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-purple-300/60 uppercase block font-bold">Cost / Profit</span>
                          <div className="font-bold text-purple-200">
                            Cost: ${costUsd.toFixed(2)}
                          </div>
                          <div className="text-[10px] font-black text-emerald-300 flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3 inline" /> +${profitUsd.toFixed(2)} Profit
                          </div>
                        </div>
                      </div>

                      {p.showOnTelegram && (
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-bold">
                          <span className="flex items-center gap-1 text-[11px]">
                            <Send className="w-3 h-3" /> Telegram Price:
                          </span>
                          <span className="font-black text-blue-300">
                            ${p.telegramPriceUsd ? ((p.telegramPriceUsd / 100).toFixed(2)) : sellUsd.toFixed(2)} USD
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className={`w-2 h-2 rounded-full ${isAvail ? "bg-emerald-400" : "bg-red-500"}`} />
                          <span className="font-bold text-white/70">
                            {isAvail ? `Stock: ${stock}` : "Out of Stock"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(p)}
                            className="h-8 px-2.5 rounded-xl border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-xs font-bold"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" /> Edit Price
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remove "${p.title}" from your store catalog?`)) {
                                deleteProductMutation.mutate(p.id);
                              }
                            }}
                            className="h-8 px-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 2. TAB: ORDERS HISTORY & AUDIT TRACKER */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">CSxStore Customer Purchases & Deliveries</h3>
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
              <h4 className="text-sm font-bold text-white">No CSxStore orders yet</h4>
              <p className="text-xs text-purple-300/60 mt-1 max-w-md mx-auto">
                When customers purchase CSxStore products from your store, their orders, CDK licenses, and delivery data will appear here.
              </p>
            </div>
          ) : (
            <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 border-b border-purple-500/15 text-purple-300/60 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Buyer</th>
                      <th className="p-4">Product</th>
                      <th className="p-4">Qty</th>
                      <th className="p-4">Amount Paid</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Delivered Data / CDK</th>
                      <th className="p-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/10">
                    {orders.map((o: any) => {
                      const buyer = o.username ? `@${o.username}` : (o.userFirstName || o.userEmail || `User #${o.telegramId || o.telegramUserId}`);
                      const paidCents = o.amountPaid || 0;
                      const paidUsd = (paidCents / 100).toFixed(2);
                      const paidLkr = Math.round((paidCents / 100) * 305.5);

                      return (
                        <tr key={o.id} className="hover:bg-purple-500/5 transition-colors">
                          <td className="p-4 font-mono font-bold text-white">#{o.externalOrderId || `CSX-${o.id}`}</td>
                          <td className="p-4 font-bold text-purple-300">{buyer}</td>
                          <td className="p-4 font-bold text-white/90">{o.productTitle}</td>
                          <td className="p-4 text-purple-200">{o.quantity}</td>
                          <td className="p-4 font-black text-emerald-400">
                            Rs. {paidLkr.toLocaleString()} <span className="text-[10px] text-white/50">(${paidUsd})</span>
                          </td>
                          <td className="p-4">
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px] font-black uppercase">
                              {o.status || "completed"}
                            </Badge>
                          </td>
                          <td className="p-4 font-mono text-[11px] text-purple-200/80 max-w-xs truncate">
                            {o.deliveryText || "Delivered"}
                          </td>
                          <td className="p-4 text-right text-white/40">
                            {o.createdAt ? format(new Date(o.createdAt), "MMM d, HH:mm") : "Recent"}
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

        {/* 3. TAB: PLAYGROUND & DOCS */}
        <TabsContent value="docs" className="space-y-6">
          <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>📚 CSxStore API Playground</span>
                </h3>
                <p className="text-xs text-purple-200/70 mt-1">
                  Direct live interaction with <b className="text-white">api.cssx.store</b>.
                </p>
              </div>

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

            {/* Interactive Console */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      if (e.target.value === "/api/v1/order") {
                        setPlaygroundMethod("POST");
                      } else {
                        setPlaygroundMethod("GET");
                      }
                    }}
                    className="flex-1 bg-black/50 border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none"
                  >
                    <option value="/api/v1/me">GET /api/v1/me - Account Profile & Wallet</option>
                    <option value="/api/v1/products">GET /api/v1/products - Full Catalog</option>
                    <option value="/api/v1/order">POST /api/v1/order - Purchase Product</option>
                    <option value="/api/v1/orders">GET /api/v1/orders - Reseller Orders</option>
                  </select>
                </div>

                {playgroundMethod === "POST" && (
                  <div>
                    <label className="text-[10px] font-bold text-purple-300/60 uppercase block mb-1">
                      JSON Payload:
                    </label>
                    <textarea
                      value={playgroundPayload}
                      onChange={(e) => setPlaygroundPayload(e.target.value)}
                      rows={5}
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none"
                    />
                  </div>
                )}

                <Button
                  onClick={executePlayground}
                  disabled={isPlayingLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl h-11 shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2"
                >
                  {isPlayingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Live Request
                </Button>
              </div>

              <div>
                <span className="text-[10px] font-bold text-purple-300/60 uppercase block mb-1.5">
                  Output:
                </span>
                <div className="bg-black/70 border border-purple-500/30 rounded-2xl p-4 min-h-[200px] max-h-[300px] overflow-auto font-mono text-xs text-purple-200">
                  {isPlayingLoading ? (
                    <div className="flex items-center justify-center h-36 text-purple-400 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Sending request...</span>
                    </div>
                  ) : playgroundResponse ? (
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(playgroundResponse.data || playgroundResponse.error, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-white/30 text-center flex flex-col items-center justify-center h-36">
                      <Terminal className="w-8 h-8 mb-2 opacity-40" />
                      <span>Click "Send Live Request" to test</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 4. TAB: SETTINGS & API KEY */}
        <TabsContent value="settings" className="space-y-6">
          <div className="bg-[#120B24] border border-purple-500/20 rounded-3xl p-6 md:p-8 shadow-xl max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-purple-500/15">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <KeyRound className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">CSxStore API Credentials</h3>
                <p className="text-xs text-purple-200/60 mt-0.5">
                  Configure your secret reseller API key to authenticate requests.
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
                    placeholder="Enter your CSxStore API Key..."
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
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying Connection...
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

      {/* EDIT PRODUCT MODAL (Same UI as Sandromania) */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-md w-full p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black">Edit Product Details & Pricing</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Customize product title, category, and selling price in your store.
            </DialogDescription>
          </DialogHeader>

          {editingProduct && (
            <div className="space-y-4 pt-2">
              {/* Custom Product Title */}
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Custom Product Name (Title)
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Gemini Pro 18 Months"
                  className="font-bold text-sm rounded-xl"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Original CSxStore ID: #{editingProduct?.serviceId}
                </span>
              </div>

              {/* Category Selector with Quick Preset Pills */}
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Store Category
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2 max-h-36 overflow-y-auto pr-1">
                  {PRESET_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEditCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        editCategory.toLowerCase() === cat.id.toLowerCase()
                          ? "bg-purple-600 text-white shadow-xs"
                          : "bg-muted/70 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <Input
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="Or type custom category (e.g. Gemini, ChatGPT, Software, AI Tools)"
                  className="text-xs rounded-xl"
                />
              </div>

              {/* Pricing USD & LKR */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">
                    Selling Price ($ USD)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 0.98"
                    value={editSellingPriceUsd}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditSellingPriceUsd(v);
                      const n = parseFloat(v);
                      if (!isNaN(n) && n > 0) {
                        setEditSellingPriceLkr(String(Math.round(n * 305.5)));
                      }
                    }}
                    className="font-bold text-sm rounded-xl"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Cost: ${((editingProduct?.costPriceUsd || 0) / 100).toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                    Price (Rs LKR – Fix / Easy)
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 300"
                    value={editSellingPriceLkr}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditSellingPriceLkr(v);
                      const n = parseFloat(v);
                      if (!isNaN(n) && n > 0) {
                        setEditSellingPriceUsd((n / 305.5).toFixed(2));
                      }
                    }}
                    className="text-xs rounded-xl font-bold border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20"
                  />
                  <span className="text-[10px] text-emerald-600/80 mt-0.5 block font-semibold">
                    Type Rs. to auto-set USD
                  </span>
                </div>
              </div>

              {/* Telegram Price & Telegram Show Switch */}
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-blue-400 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Show in Telegram
                    </span>
                    <span className="text-[10px] text-purple-200/60 block">
                      Enable product in Telegram Bot catalog & Telegram Mini-App
                    </span>
                  </div>
                  <Switch checked={editShowOnTelegram} onCheckedChange={setEditShowOnTelegram} />
                </div>

                {editShowOnTelegram && (
                  <div className="pt-1">
                    <label className="text-xs font-bold text-blue-400 block mb-1">
                      Telegram Price ($ USD - Strictly USD)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 1.20"
                      value={editTelegramPriceUsd}
                      onChange={(e) => setEditTelegramPriceUsd(e.target.value)}
                      className="font-bold text-xs rounded-xl border-blue-500/30 bg-blue-950/20 text-white"
                    />
                    <span className="text-[10px] text-purple-200/60 mt-0.5 block">
                      Special price used exclusively when customers browse and purchase via Telegram (USD only).
                    </span>
                  </div>
                )}
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                <div>
                  <span className="text-xs font-bold block text-white">Active in Store</span>
                  <span className="text-[10px] text-purple-200/60">Enable customer purchases on Web Store</span>
                </div>
                <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveEdit}
                disabled={updateProductMutation.isPending}
                className="w-full bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] text-white font-bold rounded-xl text-xs shadow-md"
              >
                {updateProductMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Products Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="bg-[#120B24] border border-purple-500/30 text-white rounded-3xl max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" />
              Import Products from CSxStore Catalog
            </DialogTitle>
            <DialogDescription className="text-xs text-purple-200/70">
              Select products to add to your shop catalog and apply profit markup.
            </DialogDescription>
          </DialogHeader>

          {/* Import Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2 border-y border-purple-500/15">
            <div className="relative">
              <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search remote catalog..."
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                className="pl-10 bg-black/40 border-purple-500/30 text-white rounded-xl text-xs h-10"
              />
            </div>

            <div className="flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-purple-500/20">
              <span className="text-xs font-bold text-purple-200 shrink-0">Profit Markup:</span>
              <Input
                type="number"
                min="0"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 bg-black/60 border-purple-500/40 text-emerald-400 font-black rounded-lg text-xs h-7 text-center"
              />
              <span className="text-xs font-bold text-emerald-400">%</span>
              <div className="flex gap-1 ml-auto">
                {[20, 40, 60, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setMarkupPercent(pct)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      markupPercent === pct ? "bg-purple-600 text-white" : "bg-white/5 text-purple-300 hover:bg-white/10"
                    }`}
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Remote Products List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
            {remoteProductsLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
                <p className="text-xs font-bold text-purple-200/70">Connecting to CSxStore API...</p>
              </div>
            ) : filteredRemote.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-8 h-8 text-purple-400/40 mx-auto mb-2" />
                <p className="text-xs text-purple-300/60">No remote products found.</p>
              </div>
            ) : (
              filteredRemote.map((item: any) => {
                const sId = String(item.service_id || item.id);
                const costUsd = typeof item.price === "number" ? item.price : parseFloat(item.price || "0");
                const sellUsd = costUsd * (1 + markupPercent / 100);
                const sellLkr = Math.round(sellUsd * 305.5);
                const isSelected = selectedProductsToImport.some((x) => String(x.service_id || x.id) === sId);
                const alreadyImported = products.some((p: any) => String(p.serviceId) === sId);

                return (
                  <div
                    key={sId}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedProductsToImport(selectedProductsToImport.filter((x) => String(x.service_id || x.id) !== sId));
                      } else {
                        setSelectedProductsToImport([...selectedProductsToImport, item]);
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected
                        ? "bg-purple-600/20 border-purple-500 shadow-md"
                        : "bg-black/30 border-purple-500/15 hover:border-purple-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-purple-600 border-purple-400 text-white" : "border-purple-500/30"
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-black text-white truncate">{item.name || item.title}</h5>
                          {alreadyImported && (
                            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] font-bold">
                              In Store
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-purple-300/60 mt-0.5">
                          ID: #{sId} • Stock: <b className="text-white/80">{item.stock ?? "In Stock"}</b>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-emerald-400">
                        Rs. {sellLkr.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-purple-200/60">
                        Cost: ${costUsd.toFixed(2)} ➜ Sell: ${sellUsd.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Import Footer */}
          <div className="pt-3 border-t border-purple-500/15 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedProductsToImport.length === filteredRemote.length) {
                    setSelectedProductsToImport([]);
                  } else {
                    setSelectedProductsToImport([...filteredRemote]);
                  }
                }}
                className="text-xs font-bold text-purple-300 hover:text-white"
              >
                {selectedProductsToImport.length === filteredRemote.length ? "Deselect All" : "Select All"}
              </Button>
              <span className="text-xs text-purple-200/60">
                ({selectedProductsToImport.length} selected)
              </span>
            </div>

            <Button
              onClick={() => {
                if (selectedProductsToImport.length === 0) {
                  toast({ title: "No products selected", description: "Please select at least one product.", variant: "destructive" });
                  return;
                }
                importProductsMutation.mutate({
                  products: selectedProductsToImport,
                  markupPercent,
                });
              }}
              disabled={importProductsMutation.isPending || selectedProductsToImport.length === 0}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl h-10 px-6 shadow-lg shadow-purple-600/25 flex items-center gap-2"
            >
              {importProductsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Import Selected ({selectedProductsToImport.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
