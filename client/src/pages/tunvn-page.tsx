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
  Globe,
  TrendingUp,
  Percent,
  SlidersHorizontal,
  Layers,
  FileText,
  KeyRound,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function TunvnPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("products");

  // Settings State
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("https://tunvnmmo.duckdns.org");
  const [showApiKey, setShowApiKey] = useState(false);

  // Import State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [markupPercent, setMarkupPercent] = useState<number>(35);
  const [selectedRemoteIds, setSelectedRemoteIds] = useState<number[]>([]);
  const [remoteSearchQuery, setRemoteSearchQuery] = useState("");

  // Edit Product Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editSellingUsd, setEditSellingUsd] = useState<string>("");
  const [editSellingLkr, setEditSellingLkr] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editShowOnTelegram, setEditShowOnTelegram] = useState<boolean>(false);

  // Search Filter
  const [catalogSearch, setCatalogSearch] = useState("");
  const [ordersSearch, setOrdersSearch] = useState("");

  // 1. Settings & Balance Query
  const {
    data: settingsData,
    isLoading: settingsLoading,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["/api/admin/tunvn/settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tunvn/settings");
      if (!res.ok) throw new Error("Failed to load TunVN settings");
      const data = await res.json();
      if (data.baseUrl) setBaseUrlInput(data.baseUrl);
      return data;
    },
  });

  // 2. Managed Catalog Query
  const {
    data: managedProducts = [],
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useQuery<any[]>({
    queryKey: ["/api/admin/tunvn/products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tunvn/products");
      if (!res.ok) throw new Error("Failed to load managed products");
      return res.json();
    },
  });

  // 3. Orders Audit Query
  const {
    data: tunvnOrders = [],
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery<any[]>({
    queryKey: ["/api/admin/tunvn/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tunvn/orders");
      if (!res.ok) throw new Error("Failed to load TunVN orders");
      return res.json();
    },
  });

  // 4. Remote Catalog Query (for Import)
  const {
    data: remoteProducts = [],
    isLoading: remoteLoading,
    refetch: refetchRemote,
  } = useQuery<any[]>({
    queryKey: ["/api/admin/tunvn/fetch-products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tunvn/fetch-products");
      if (!res.ok) throw new Error("Failed to fetch remote catalog");
      return res.json();
    },
    enabled: importModalOpen,
  });

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/tunvn/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKeyInput,
          baseUrl: baseUrlInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save settings");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tunvn/settings"] });
      toast({
        title: "Settings Saved",
        description: data.message,
      });
      setApiKeyInput("");
    },
    onError: (err: any) => {
      toast({
        title: "Error Saving Settings",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Sync Live Stock Mutation
  const syncStockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/tunvn/sync-stock", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to sync stock");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tunvn/products"] });
      toast({
        title: "Stock Synced! 🔄",
        description: data.message,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Sync Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Import Products Mutation
  const importMutation = useMutation({
    mutationFn: async (selected: any[]) => {
      const res = await fetch("/api/admin/tunvn/import-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: selected,
          markupPercent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to import products");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tunvn/products"] });
      toast({
        title: "Import Successful! 🎉",
        description: data.message,
      });
      setImportModalOpen(false);
      setSelectedRemoteIds([]);
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
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const res = await fetch(`/api/admin/tunvn/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update product");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tunvn/products"] });
      toast({
        title: "Product Updated",
        description: "Catalog pricing and status updated successfully.",
      });
      setEditModalOpen(false);
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
      const res = await fetch(`/api/admin/tunvn/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete product");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tunvn/products"] });
      toast({
        title: "Product Removed",
        description: "Product removed from managed catalog.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Delete Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const isConnected = settingsData?.status === "connected";

  // Filter Catalog
  const filteredCatalog = managedProducts.filter((p) => {
    const q = catalogSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.title?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      String(p.externalProductId).includes(q)
    );
  });

  // Filter Remote for Import
  const filteredRemote = remoteProducts.filter((p: any) => {
    const q = remoteSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = (p.name || p.title || "").toLowerCase();
    const cat = (p.category || "").toLowerCase();
    return name.includes(q) || cat.includes(q) || String(p.id).includes(q);
  });

  // Filter Orders
  const filteredOrders = tunvnOrders.filter((ord: any) => {
    const q = ordersSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      ord.productTitle?.toLowerCase().includes(q) ||
      ord.externalOrderId?.toLowerCase().includes(q) ||
      ord.username?.toLowerCase().includes(q) ||
      String(ord.telegramId || "").includes(q)
    );
  });

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/20 p-6 rounded-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                TunVN MMO Partner Integration
                <Badge
                  className={`text-xs uppercase font-black ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/20 text-red-300 border-red-500/30"
                  }`}
                >
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Automated MMO accounts, live stock sync, balance monitor & store reseller API
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSettings();
              refetchProducts();
              refetchOrders();
            }}
            className="border-blue-500/30 hover:bg-blue-500/10 text-blue-300"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setImportModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Import Catalog
          </Button>
        </div>
      </div>

      {/* Live Balance & Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* USDT Balance */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-emerald-400">
                USDT Balance
              </p>
              <h3 className="text-2xl font-black text-white mt-1">
                ${Number(settingsData?.balanceUsdt || 0).toFixed(2)} USDT
              </h3>
              <p className="text-xs text-gray-400 mt-1">TunVN MMO Wallet</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* VND Balance */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-blue-400">
                VND Balance
              </p>
              <h3 className="text-2xl font-black text-white mt-1">
                {Number(settingsData?.balanceVnd || 0).toLocaleString()} ₫
              </h3>
              <p className="text-xs text-gray-400 mt-1">Vietnamese Dong</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Managed Products */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-purple-400">
                Active Catalog
              </p>
              <h3 className="text-2xl font-black text-white mt-1">
                {managedProducts.filter((p) => p.isActive).length} Products
              </h3>
              <p className="text-xs text-gray-400 mt-1">{managedProducts.length} total imported</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-amber-400">
                TunVN Orders
              </p>
              <h3 className="text-2xl font-black text-white mt-1">{tunvnOrders.length}</h3>
              <p className="text-xs text-gray-400 mt-1">Completed orders</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-1">
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4" /> Products Catalog ({managedProducts.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingCart className="w-4 h-4" /> Order History ({tunvnOrders.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <KeyRound className="w-4 h-4" /> API & Settings
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <FileText className="w-4 h-4" /> API Docs
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PRODUCTS CATALOG */}
        <TabsContent value="products" className="space-y-4">
          <Card className="bg-slate-900/40 border-slate-800">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search managed products..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="pl-9 bg-slate-950/60 border-slate-800 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncStockMutation.mutate()}
                  disabled={syncStockMutation.isPending}
                  className="border-slate-800 hover:bg-slate-800 text-gray-300"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-1.5 ${
                      syncStockMutation.isPending ? "animate-spin text-blue-400" : ""
                    }`}
                  />
                  Sync Live Stock
                </Button>

                <Button
                  size="sm"
                  onClick={() => setImportModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Import from TunVN
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Products List */}
          {productsLoading ? (
            <div className="p-12 text-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 mb-2" />
              Loading catalog...
            </div>
          ) : filteredCatalog.length === 0 ? (
            <Card className="bg-slate-900/30 border-slate-800 text-center p-12">
              <Package className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">No Products Imported</h3>
              <p className="text-sm text-gray-400 mt-1 mb-4">
                Fetch and import products from TunVN MMO to sell them in your store.
              </p>
              <Button
                onClick={() => setImportModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" /> Import Products Now
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCatalog.map((prod) => {
                const costUsd = (prod.costPriceUsd || 0) / 100;
                const sellUsd = (prod.sellingPriceUsd || 0) / 100;
                const sellLkr = prod.sellingPriceLkr || 0;
                const profitUsd = Math.max(0, sellUsd - costUsd);

                return (
                  <Card
                    key={prod.id}
                    className={`bg-slate-900/60 border transition-all ${
                      prod.isActive
                        ? "border-slate-800 hover:border-blue-500/40"
                        : "border-slate-800/40 opacity-60"
                    }`}
                  >
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-[10px] uppercase font-bold mb-1">
                            {prod.category || "TunVN MMO"}
                          </Badge>
                          <h4 className="font-bold text-white text-base line-clamp-1">
                            {prod.title}
                          </h4>
                          <span className="text-xs text-gray-500 font-mono">
                            ID: #{prod.externalProductId}
                          </span>
                        </div>

                        <Badge
                          className={`text-[10px] font-bold ${
                            prod.stock > 0
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : "bg-red-500/20 text-red-300 border-red-500/30"
                          }`}
                        >
                          {prod.stock > 0 ? `${prod.stock} in stock` : "Out of stock"}
                        </Badge>
                      </div>

                      {/* Pricing Table */}
                      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Cost Price:</span>
                          <span className="font-mono text-gray-300">${costUsd.toFixed(2)} USDT</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-gray-400">Selling Price:</span>
                          <span className="font-mono text-emerald-400">
                            Rs. {sellLkr.toLocaleString()} (${sellUsd.toFixed(2)})
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-800/60 pt-1.5 text-[11px]">
                          <span className="text-gray-500">Margin / Profit:</span>
                          <span className="font-mono text-purple-400">
                            +${profitUsd.toFixed(2)}/unit
                          </span>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingProduct(prod);
                              setEditSellingUsd(String(sellUsd));
                              setEditSellingLkr(String(sellLkr));
                              setEditIsActive(prod.isActive);
                              setEditShowOnTelegram(prod.showOnTelegram);
                              setEditModalOpen(true);
                            }}
                            className="h-8 border-slate-800 text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-800"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateProductMutation.mutate({
                                id: prod.id,
                                updates: { isActive: !prod.isActive },
                              })
                            }
                            className={`h-8 text-xs ${
                              prod.isActive
                                ? "text-amber-400 hover:text-amber-300"
                                : "text-emerald-400 hover:text-emerald-300"
                            }`}
                          >
                            {prod.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remove "${prod.title}" from store catalog?`)) {
                              deleteProductMutation.mutate(prod.id);
                            }
                          }}
                          className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: ORDERS AUDIT */}
        <TabsContent value="orders" className="space-y-4">
          <Card className="bg-slate-900/40 border-slate-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search orders by product, ID, or user..."
                  value={ordersSearch}
                  onChange={(e) => setOrdersSearch(e.target.value)}
                  className="pl-9 bg-slate-950/60 border-slate-800 text-sm"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchOrders()}
                className="border-slate-800 hover:bg-slate-800 text-gray-300"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
              </Button>
            </CardContent>
          </Card>

          {ordersLoading ? (
            <div className="p-12 text-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 mb-2" />
              Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <Card className="bg-slate-900/30 border-slate-800 text-center p-12">
              <ShoppingCart className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">No TunVN Orders Found</h3>
              <p className="text-sm text-gray-400 mt-1">
                Customer purchases made for TunVN products will be logged here.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((ord: any) => (
                <Card key={ord.id} className="bg-slate-900/60 border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-400">
                            #{ord.id}
                          </span>
                          <h4 className="font-bold text-white text-base">{ord.productTitle}</h4>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                            {ord.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          External Order ID:{" "}
                          <span className="font-mono text-gray-300">{ord.externalOrderId}</span> •
                          Qty: <span className="font-bold text-white">{ord.quantity}</span> • User:{" "}
                          <span className="text-purple-400">
                            {ord.userFirstName || ord.username || `User #${ord.telegramUserId}`}
                          </span>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-emerald-400 text-sm">
                          Rs. {Number(ord.amountPaidLkr || 0).toLocaleString()} ($
                          {((ord.amountPaid || 0) / 100).toFixed(2)})
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {ord.createdAt ? new Date(ord.createdAt).toLocaleString() : ""}
                        </p>
                      </div>
                    </div>

                    {ord.deliveryText && (
                      <div className="mt-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                          Delivered Account Credentials:
                        </p>
                        <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                          {ord.deliveryText}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: API & SETTINGS */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-400" /> TunVN API Configuration
              </CardTitle>
              <CardDescription>
                Configure your API key and base URL from{" "}
                <a
                  href="https://tunvnmmo.duckdns.org/api/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  tunvnmmo.duckdns.org <ExternalLink className="w-3 h-3" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300">Base API Endpoint</label>
                <Input
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder="https://tunvnmmo.duckdns.org"
                  className="bg-slate-950 border-slate-800 text-white font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-300">
                    TunVN MMO API Key (X-API-Key)
                  </label>
                  {settingsData?.maskedApiKey && (
                    <span className="text-xs text-emerald-400 font-mono">
                      Current: {settingsData.maskedApiKey}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter new API key to update..."
                    className="bg-slate-950 border-slate-800 text-white font-mono text-sm pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-gray-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-300">Connection Status</p>
                  <p
                    className={`text-sm font-semibold mt-0.5 ${
                      isConnected ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {settingsData?.statusMessage || "Checking..."}
                  </p>
                </div>
                <Badge
                  className={`uppercase text-xs font-black ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/20 text-red-300 border-red-500/30"
                  }`}
                >
                  {settingsData?.status || "offline"}
                </Badge>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={saveSettingsMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  {saveSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                    </>
                  ) : (
                    "Save & Connect API"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: API DOCS */}
        <TabsContent value="docs" className="space-y-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" /> TunVN MMO API Reference
              </CardTitle>
              <CardDescription>
                Full specification according to{" "}
                <a
                  href="https://tunvnmmo.duckdns.org/api/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  tunvnmmo.duckdns.org/api/docs <ExternalLink className="w-3 h-3" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-mono text-gray-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-300">GET</Badge>
                  <span className="font-bold text-white">/api/balance</span>
                </div>
                <p className="text-gray-400">Returns your live USDT and VND wallet balance.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-300">GET</Badge>
                  <span className="font-bold text-white">/api/products</span>
                </div>
                <p className="text-gray-400">Fetches all available products, pricing and live stock.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300">POST</Badge>
                  <span className="font-bold text-white">/api/buy</span>
                </div>
                <p className="text-gray-400">
                  Purchases accounts. Body: <code>&#123; product_id, quantity, currency: "usdt"|"vnd" &#125;</code>
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-300">GET</Badge>
                  <span className="font-bold text-white">/api/orders</span>
                </div>
                <p className="text-gray-400">Returns order history and delivered accounts.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-300">GET</Badge>
                  <span className="font-bold text-white">/api/rate</span>
                </div>
                <p className="text-gray-400">Returns live VND / USDT exchange rate.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* IMPORT MODAL */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-400">
              <Plus className="w-5 h-5" /> Import Catalog from TunVN MMO
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Select products to add or update in your YouuHost store catalog with custom markup.
            </DialogDescription>
          </DialogHeader>

          {/* Markup & Search Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 border-b border-slate-800">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-blue-400" /> Markup Percentage (%)
              </label>
              <Input
                type="number"
                min="0"
                max="500"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(Number(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300">Search Remote Products</label>
              <Input
                placeholder="Search products..."
                value={remoteSearchQuery}
                onChange={(e) => setRemoteSearchQuery(e.target.value)}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>

          {/* Remote Products List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-3 min-h-[250px] max-h-[360px] pr-1">
            {remoteLoading ? (
              <div className="p-8 text-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
                Connecting to TunVN API...
              </div>
            ) : filteredRemote.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No products found from TunVN.</div>
            ) : (
              filteredRemote.map((p: any) => {
                const pId = Number(p.id || p.product_id);
                const isSelected = selectedRemoteIds.includes(pId);
                const costUsd = typeof p.price_usdt === "number" ? p.price_usdt : (typeof p.price === "number" ? p.price : parseFloat(p.price_usdt || p.price || "0"));
                const sellUsd = costUsd * (1 + markupPercent / 100);
                const sellLkr = Math.round(sellUsd * 305.5);

                return (
                  <div
                    key={pId}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedRemoteIds(selectedRemoteIds.filter((id) => id !== pId));
                      } else {
                        setSelectedRemoteIds([...selectedRemoteIds, pId]);
                      }
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-blue-600/15 border-blue-500/60 shadow-sm"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                          isSelected
                            ? "bg-blue-600 border-blue-500 text-white"
                            : "border-slate-700 bg-slate-900"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>

                      <div className="overflow-hidden">
                        <p className="font-bold text-white text-sm truncate">{p.name || p.title}</p>
                        <p className="text-xs text-gray-400">
                          ID: #{pId} • Stock:{" "}
                          <span className={p.stock > 0 ? "text-emerald-400" : "text-red-400"}>
                            {p.stock}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-emerald-400">
                        Rs. {sellLkr.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-gray-400 font-mono">
                        Cost: ${costUsd.toFixed(2)} → Sell: ${sellUsd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="border-t border-slate-800 pt-3 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              <span className="font-bold text-white">{selectedRemoteIds.length}</span> products selected
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedRemoteIds.length === filteredRemote.length) {
                    setSelectedRemoteIds([]);
                  } else {
                    setSelectedRemoteIds(filteredRemote.map((p: any) => Number(p.id || p.product_id)));
                  }
                }}
                className="border-slate-800 text-xs"
              >
                {selectedRemoteIds.length === filteredRemote.length ? "Deselect All" : "Select All"}
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  const toImport = remoteProducts.filter((p: any) =>
                    selectedRemoteIds.includes(Number(p.id || p.product_id))
                  );
                  importMutation.mutate(toImport);
                }}
                disabled={selectedRemoteIds.length === 0 || importMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Importing...
                  </>
                ) : (
                  `Import Selected (${selectedRemoteIds.length})`
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT PRODUCT MODAL */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-400 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5" /> Edit TunVN Product
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingProduct?.title} (ID: #{editingProduct?.externalProductId})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300">Selling Price (LKR - Rs.)</label>
              <Input
                type="number"
                value={editSellingLkr}
                onChange={(e) => setEditSellingLkr(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300">Selling Price (USD - $)</label>
              <Input
                type="number"
                step="0.01"
                value={editSellingUsd}
                onChange={(e) => setEditSellingUsd(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-gray-300">Active in Store</span>
              <Button
                type="button"
                size="sm"
                variant={editIsActive ? "default" : "outline"}
                onClick={() => setEditIsActive(!editIsActive)}
                className={editIsActive ? "bg-emerald-600 text-white" : "text-gray-400"}
              >
                {editIsActive ? "Active" : "Disabled"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              className="border-slate-800 text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const usdCents = Math.round(parseFloat(editSellingUsd || "0") * 100);
                const lkr = parseInt(editSellingLkr || "0", 10);
                updateProductMutation.mutate({
                  id: editingProduct.id,
                  updates: {
                    sellingPriceUsd: usdCents,
                    sellingPriceLkr: lkr,
                    isActive: editIsActive,
                    showOnTelegram: editShowOnTelegram,
                  },
                });
              }}
              disabled={updateProductMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {updateProductMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

