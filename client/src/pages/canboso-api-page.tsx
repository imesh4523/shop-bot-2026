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
  SlidersHorizontal,
  Edit,
  TrendingUp,
  Globe,
  Coins
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

const DEFAULT_BASE_URL = "https://canboso.com";
const SWAGGER_DOCS_URL = "https://canboso.com/api/swagger";

export default function CanbosoApiPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"products" | "remote" | "orders" | "settings">("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Settings State
  const [inputApiKey, setInputApiKey] = useState("");
  const [inputBaseUrl, setInputBaseUrl] = useState(DEFAULT_BASE_URL);

  // Import State
  const [importMarkup, setImportMarkup] = useState<number>(35);
  const [selectedRemoteIds, setSelectedRemoteIds] = useState<string[]>([]);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editSellingPriceUsd, setEditSellingPriceUsd] = useState<string>("");
  const [editSellingPriceLkr, setEditSellingPriceLkr] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("Digital Accounts");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editShowOnTelegram, setEditShowOnTelegram] = useState<boolean>(false);
  const [editTelegramPriceUsd, setEditTelegramPriceUsd] = useState<string>("");

  // 1. Settings & Balance Query
  const { data: settingsData, isLoading: isLoadingSettings, refetch: refetchSettings } = useQuery<any>({
    queryKey: ["/api/admin/canboso/settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/canboso/settings");
      if (!res.ok) throw new Error("Failed to load Canboso settings");
      const data = await res.json();
      if (data.apiKey && !inputApiKey) {
        setInputApiKey(data.apiKey);
      }
      if (data.baseUrl) {
        setInputBaseUrl(data.baseUrl);
      }
      return data;
    },
    refetchInterval: 15000,
  });

  // 2. Local Products Query
  const { data: localProducts = [], isLoading: isLoadingProducts, refetch: refetchProducts } = useQuery<any[]>({
    queryKey: ["/api/admin/canboso/products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/canboso/products");
      if (!res.ok) throw new Error("Failed to load Canboso products");
      return res.json();
    },
    refetchInterval: 15000,
  });

  // 3. Remote Catalog Query
  const { data: remoteProducts = [], isLoading: isLoadingRemote, refetch: refetchRemote } = useQuery<any[]>({
    queryKey: ["/api/admin/canboso/fetch-products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/canboso/fetch-products");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to fetch remote products");
      }
      return res.json();
    },
    enabled: activeTab === "remote",
  });

  // 4. Orders Query
  const { data: ordersList = [], isLoading: isLoadingOrders, refetch: refetchOrders } = useQuery<any[]>({
    queryKey: ["/api/admin/canboso/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/canboso/orders");
      if (!res.ok) throw new Error("Failed to load Canboso orders");
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: { apiKey: string; baseUrl: string }) => {
      const res = await fetch("/api/admin/canboso/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save settings");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Settings Saved! 🚀",
        description: data.message || "Canboso API configured successfully.",
      });
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

  // Live Connection Test Mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/canboso/test");
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || "Connection test failed");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Successful! 🟢",
        description: `Connected to Canboso Buyer API v2. ${data.balance?.balanceText ? `Live Balance: ${data.balance.balanceText}` : ""}`,
      });
      refetchSettings();
    },
    onError: (err: any) => {
      toast({
        title: "Connection Failed 🔴",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Sync Live Stock Mutation
  const syncStockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/canboso/sync-stock", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to sync stock");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Stock Synced! 📦",
        description: data.message || `Updated live stock for ${data.updatedCount || 0} items.`,
      });
      refetchProducts();
    },
    onError: (err: any) => {
      toast({
        title: "Sync Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Import Products Mutation
  const importMutation = useMutation({
    mutationFn: async (payload: { products: any[]; markupPercent: number }) => {
      const res = await fetch("/api/admin/canboso/import-products", {
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
        title: "Import Complete! 🎉",
        description: data.message,
      });
      setSelectedRemoteIds([]);
      refetchProducts();
      setActiveTab("products");
    },
    onError: (err: any) => {
      toast({
        title: "Import Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Update Product Mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/admin/canboso/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to update product");
      return resData;
    },
    onSuccess: () => {
      toast({ title: "Product Updated Successfully! ✅" });
      refetchProducts();
      setEditingProduct(null);
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Delete Product Mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/canboso/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete product");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Product Removed 🗑️" });
      refetchProducts();
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast({ title: "Copied to clipboard! 📋" });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleOpenEditModal = (product: any) => {
    setEditingProduct(product);
    setEditTitle(product.title || "");
    setEditSellingPriceUsd(((product.sellingPriceUsd || 0) / 100).toFixed(2));
    setEditSellingPriceLkr(product.sellingPriceLkr ? String(product.sellingPriceLkr) : "");
    setEditCategory(product.category || "Digital Accounts");
    setEditDescription(product.description || "");
    setEditIsActive(product.isActive !== false);
    setEditShowOnTelegram(Boolean(product.showOnTelegram));
    setEditTelegramPriceUsd(product.telegramPriceUsd ? ((product.telegramPriceUsd / 100).toFixed(2)) : "");
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const usdVal = parseFloat(editSellingPriceUsd);
    const usdCents = isNaN(usdVal) ? editingProduct.sellingPriceUsd : Math.round(usdVal * 100);

    const lkrVal = parseFloat(editSellingPriceLkr);
    const lkrInt = isNaN(lkrVal) ? null : Math.round(lkrVal);

    const tgUsdVal = parseFloat(editTelegramPriceUsd);
    const tgUsdCents = isNaN(tgUsdVal) ? null : Math.round(tgUsdVal * 100);

    updateProductMutation.mutate({
      id: editingProduct.id,
      data: {
        title: editTitle.trim(),
        sellingPriceUsd: usdCents,
        sellingPriceLkr: lkrInt,
        category: editCategory.trim(),
        description: editDescription.trim(),
        isActive: editIsActive,
        showOnTelegram: editShowOnTelegram,
        telegramPriceUsd: tgUsdCents,
      },
    });
  };

  // Filtered Local Products
  const filteredLocalProducts = localProducts.filter((p: any) => {
    const matchesSearch =
      !searchQuery.trim() ||
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.productId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const isConnected = settingsData?.status === "connected";

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-[#1E1145] via-[#2A185C] to-[#4A1D96] rounded-3xl p-6 sm:p-8 text-white border border-purple-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -translate-y-20 translate-x-20" />
        <div className="absolute left-0 bottom-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none translate-y-20 -translate-x-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Canboso Partner API</h1>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1.5 ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-400/30"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                    {isConnected ? "Connected (v2.2.0)" : "Not Configured"}
                  </span>
                </div>
                <p className="text-sm text-purple-200/80 font-medium">
                  Direct integration with Canboso Telegram Buyer API v2 for instant digital account fulfillment
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <a
              href={SWAGGER_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/10"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Swagger API Docs</span>
            </a>

            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending || !settingsData?.apiKey}
              className="bg-purple-950/40 border-purple-400/30 hover:bg-purple-900/60 text-white text-xs font-bold h-9 rounded-xl"
            >
              {testConnectionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Radio className="w-3.5 h-3.5 mr-1.5 text-cyan-300" />}
              <span>Test Connection</span>
            </Button>

            <Button
              size="sm"
              onClick={() => syncStockMutation.mutate()}
              disabled={syncStockMutation.isPending || !isConnected}
              className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold h-9 rounded-xl shadow-lg shadow-indigo-900/40"
            >
              {syncStockMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              <span>Sync Live Stock</span>
            </Button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300/80 block">
              Spendable Balance
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
              {settingsData?.balanceText || "$0.00"}
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
              Wallet Currency: {settingsData?.walletCurrency || "USD"}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300/80 block">
              VND Balance
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
              {Number(settingsData?.balanceVnd || 0).toLocaleString()} ₫
            </div>
            <span className="text-[10px] text-purple-200/60 block mt-0.5">
              USDT: {settingsData?.usdtBalance || 0}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300/80 block">
              Store Catalog Items
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
              {localProducts.length}
            </div>
            <span className="text-[10px] text-cyan-300 block mt-0.5 font-medium">
              {localProducts.filter((p: any) => p.isActive).length} Active in Store
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300/80 block">
              Fulfilled Orders
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
              {ordersList.length}
            </div>
            <span className="text-[10px] text-purple-200/60 block mt-0.5">
              Instant auto-delivery
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-6">
        <TabsList className="bg-[#1E1B38] p-1 rounded-2xl border border-white/10">
          <TabsTrigger value="products" className="rounded-xl data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white font-bold text-xs">
            <Package className="w-3.5 h-3.5 mr-1.5" />
            <span>Storefront Products ({localProducts.length})</span>
          </TabsTrigger>
          <TabsTrigger value="remote" className="rounded-xl data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white font-bold text-xs">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            <span>Live Remote Catalog ({remoteProducts.length})</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white font-bold text-xs">
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
            <span>Order History ({ordersList.length})</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white font-bold text-xs">
            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            <span>API Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MANAGED PRODUCTS */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#181135] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search products by title, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/10 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("remote")}
                className="w-full sm:w-auto rounded-xl text-xs font-bold border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                <span>Import From Canboso</span>
              </Button>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white dark:bg-[#181135] rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-black/40 text-slate-500 dark:text-purple-200/70 uppercase font-mono text-[10.5px] border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="p-4">Product</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Cost Price</th>
                    <th className="p-4">Store Price (USD / LKR)</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Telegram</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredLocalProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No Canboso products in store catalog yet. Click "Import From Canboso" to import items.
                      </td>
                    </tr>
                  ) : (
                    filteredLocalProducts.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{p.title}</div>
                          <span className="text-[10px] font-mono text-slate-400">ID: {p.productId}</span>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="text-[10px] font-mono capitalize">
                            {p.type || "standard"}
                          </Badge>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-600 dark:text-purple-200">
                          ${((p.costPriceUsd || 0) / 100).toFixed(2)}
                        </td>
                        <td className="p-4 font-mono">
                          <div className="font-black text-emerald-600 dark:text-emerald-400">
                            ${((p.sellingPriceUsd || 0) / 100).toFixed(2)} USD
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Rs. {p.sellingPriceLkr ? Number(p.sellingPriceLkr).toLocaleString() : Math.round(((p.sellingPriceUsd || 0) / 100) * 305.5).toLocaleString()} LKR
                          </span>
                        </td>
                        <td className="p-4 font-mono">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.stock > 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                          </span>
                        </td>
                        <td className="p-4">
                          <Switch
                            checked={Boolean(p.showOnTelegram)}
                            onCheckedChange={(checked) =>
                              updateProductMutation.mutate({ id: p.id, data: { showOnTelegram: checked } })
                            }
                          />
                        </td>
                        <td className="p-4">
                          <Switch
                            checked={p.isActive !== false}
                            onCheckedChange={(checked) =>
                              updateProductMutation.mutate({ id: p.id, data: { isActive: checked } })
                            }
                          />
                        </td>
                        <td className="p-4 text-right space-x-1 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(p)}
                            className="h-8 w-8 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete "${p.title}" from local catalog?`)) {
                                deleteProductMutation.mutate(p.id);
                              }
                            }}
                            className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: LIVE REMOTE CATALOG (IMPORT) */}
        <TabsContent value="remote" className="space-y-4">
          <div className="bg-white dark:bg-[#181135] p-5 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Live Canboso Catalog</h3>
              <p className="text-xs text-slate-500 dark:text-purple-200/70">
                Directly loaded from Canboso Buyer API. Select products and apply your custom profit markup.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-black/30 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-purple-200">
                <span>Profit Markup:</span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={importMarkup}
                  onChange={(e) => setImportMarkup(parseInt(e.target.value) || 0)}
                  className="w-14 bg-transparent font-mono font-black text-cyan-400 focus:outline-none"
                />
                <span>%</span>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  const toImport = remoteProducts.filter((r: any) =>
                    selectedRemoteIds.includes(String(r.productId || r.id))
                  );
                  if (toImport.length === 0) {
                    toast({ title: "Please select at least 1 product", variant: "destructive" });
                    return;
                  }
                  importMutation.mutate({ products: toImport, markupPercent: importMarkup });
                }}
                disabled={selectedRemoteIds.length === 0 || importMutation.isPending}
                className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs h-9 rounded-xl shadow-md"
              >
                {importMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                <span>Import Selected ({selectedRemoteIds.length})</span>
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#181135] rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-black/40 text-slate-500 dark:text-purple-200/70 uppercase font-mono text-[10.5px] border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedRemoteIds.length === remoteProducts.length && remoteProducts.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRemoteIds(remoteProducts.map((r: any) => String(r.productId || r.id)));
                          } else {
                            setSelectedRemoteIds([]);
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="p-4">Remote Product</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Supplier Cost</th>
                    <th className="p-4">Your Selling Price (+{importMarkup}%)</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Requirements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {isLoadingRemote ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                        Fetching live products from Canboso API...
                      </td>
                    </tr>
                  ) : remoteProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No remote products returned. Please check your API key in Settings.
                      </td>
                    </tr>
                  ) : (
                    remoteProducts.map((r: any) => {
                      const idStr = String(r.productId || r.id);
                      const isSelected = selectedRemoteIds.includes(idStr);
                      const costAmount = r.price?.amount || 0;
                      const costCurrency = r.price?.currency || "VND";
                      const costUsd = costCurrency === "VND" ? (costAmount / 25400) : costAmount;
                      const sellUsd = costUsd * (1 + importMarkup / 100);

                      return (
                        <tr key={idStr} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRemoteIds((prev) => [...prev, idStr]);
                                } else {
                                  setSelectedRemoteIds((prev) => prev.filter((id) => id !== idStr));
                                }
                              }}
                              className="rounded"
                            />
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{r.name}</div>
                            <span className="text-[10px] font-mono text-slate-400">ID: {idStr}</span>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-[10px] font-mono capitalize">
                              {r.productType || "standard"}
                            </Badge>
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-600 dark:text-purple-200">
                            {r.price?.text || `${costAmount} ${costCurrency}`}
                            <span className="text-[10px] text-slate-400 block font-normal">
                              ≈ ${costUsd.toFixed(2)} USD
                            </span>
                          </td>
                          <td className="p-4 font-mono font-black text-emerald-500">
                            ${sellUsd.toFixed(2)} USD
                          </td>
                          <td className="p-4 font-mono">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              {r.availability?.available ?? (r.available ? "In Stock" : "Out of stock")}
                            </span>
                          </td>
                          <td className="p-4 text-[10.5px] text-slate-400 font-mono">
                            {r.purchaseRequirements?.customerEmail && (
                              <span className="bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded mr-1">
                                Email Req.
                              </span>
                            )}
                            {r.purchaseRequirements?.slotMonths && (
                              <span className="bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded">
                                Months Req.
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: ORDER HISTORY */}
        <TabsContent value="orders" className="space-y-4">
          <div className="bg-white dark:bg-[#181135] rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-black/40 text-slate-500 dark:text-purple-200/70 uppercase font-mono text-[10.5px] border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="p-4">Order Code</th>
                    <th className="p-4">Product</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Amount Paid</th>
                    <th className="p-4">Delivered Credentials</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {ordersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No orders recorded yet.
                      </td>
                    </tr>
                  ) : (
                    ordersList.map((ord: any) => (
                      <tr key={ord.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-mono font-bold text-cyan-400">
                          {ord.externalOrderId || `#${ord.id}`}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-white">{ord.productTitle}</div>
                          <span className="text-[10px] text-slate-400">Qty: {ord.quantity}</span>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-slate-700 dark:text-purple-200">
                            {ord.user?.username ? `@${ord.user.username}` : ord.user?.firstName || "Customer"}
                          </div>
                          {ord.customerEmail && (
                            <span className="text-[10px] font-mono text-cyan-300 block">{ord.customerEmail}</span>
                          )}
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                          ${((ord.amountPaid || 0) / 100).toFixed(2)} USD
                          {ord.amountPaidLkr && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              Rs. {Number(ord.amountPaidLkr).toLocaleString()} LKR
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {ord.deliveryText ? (
                            <div className="bg-black/30 p-2 rounded-lg font-mono text-[10px] text-emerald-400 max-w-xs break-all">
                              {ord.deliveryText}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Processing / None</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                            {ord.status || "completed"}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 font-mono text-[10px]">
                          {ord.createdAt ? format(new Date(ord.createdAt), "yyyy-MM-dd HH:mm") : "N/A"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: API SETTINGS */}
        <TabsContent value="settings" className="space-y-4">
          <div className="max-w-2xl bg-white dark:bg-[#181135] p-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm space-y-5">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Canboso Buyer API Configuration</h3>
              <p className="text-xs text-slate-500 dark:text-purple-200/70">
                Enter your unique buyer API key issued from Canboso bot or developer dashboard.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-purple-200 mb-1 block">
                  Buyer API Key
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder="tgb_1234567890abcdef..."
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-purple-200 mb-1 block">
                  Base API URL
                </label>
                <Input
                  type="text"
                  placeholder="https://canboso.com"
                  value={inputBaseUrl}
                  onChange={(e) => setInputBaseUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <Button
                onClick={() =>
                  saveSettingsMutation.mutate({
                    apiKey: inputApiKey.trim(),
                    baseUrl: inputBaseUrl.trim(),
                  })
                }
                disabled={saveSettingsMutation.isPending}
                className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs h-9 rounded-xl"
              >
                {saveSettingsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                <span>Save API Credentials</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending || !inputApiKey.trim()}
                className="text-xs font-bold h-9 rounded-xl border-purple-400/30"
              >
                <span>Test Connection</span>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* EDIT PRODUCT MODAL */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-md bg-[#181135] text-white border-white/10 rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white">Edit Canboso Product</DialogTitle>
            <DialogDescription className="text-xs text-purple-200/70">
              Customize title, selling price, and Telegram store visibility.
            </DialogDescription>
          </DialogHeader>

          {editingProduct && (
            <form onSubmit={handleSaveProduct} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-bold text-purple-200 block mb-1">Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-black/30 border-white/10 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">Price (USD $)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editSellingPriceUsd}
                    onChange={(e) => setEditSellingPriceUsd(e.target.value)}
                    className="bg-black/30 border-white/10 text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-purple-200 block mb-1">Price (LKR Rs.)</label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="Auto (Live Rate)"
                    value={editSellingPriceLkr}
                    onChange={(e) => setEditSellingPriceLkr(e.target.value)}
                    className="bg-black/30 border-white/10 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs font-bold text-white">Show on Telegram</span>
                <Switch checked={editShowOnTelegram} onCheckedChange={setEditShowOnTelegram} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs font-bold text-white">Active in Storefront</span>
                <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingProduct(null)}
                  className="text-xs text-purple-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold"
                >
                  {updateProductMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
