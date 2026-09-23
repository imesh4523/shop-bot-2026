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
  Plus,
  Trash2,
  Search,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Copy,
  Check,
  Globe,
  Radio,
  Clock,
  User,
  ShieldCheck,
  Zap,
  Sparkles,
  Layers,
  FileText,
  KeyRound,
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

export default function SandromaniaPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "settings">("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Settings State
  const [inputApiKey, setInputApiKey] = useState("");
  const [inputApiSecret, setInputApiSecret] = useState("");

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editSellingPriceUsd, setEditSellingPriceUsd] = useState<string>("");
  const [editSellingPriceLkr, setEditSellingPriceLkr] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("general");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Import Modal State
  const [importSearch, setImportSearch] = useState("");
  const [markupPercent, setMarkupPercent] = useState<number>(40);
  const [selectedProductsToImport, setSelectedProductsToImport] = useState<any[]>([]);

  // 1. Query Sandromania Settings & Balance
  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } = useQuery({
    queryKey: ["/api/admin/sandromania/settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sandromania/settings");
      if (!res.ok) throw new Error("Failed to load Sandromania settings");
      const data = await res.json();
      if (data.apiKey && !inputApiKey) setInputApiKey(data.apiKey);
      return data;
    },
  });

  // 2. Query Managed Sandromania Products
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useQuery<any[]>({
    queryKey: ["/api/admin/sandromania/products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sandromania/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  // 3. Query Orders Tracker
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<any[]>({
    queryKey: ["/api/admin/sandromania/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sandromania/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
  });

  // 4. Query Live Remote Catalog from Sandromania
  const { data: remoteProducts = [], isLoading: remoteProductsLoading, refetch: refetchRemoteProducts } = useQuery<any[]>({
    queryKey: ["/api/admin/sandromania/fetch-products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sandromania/fetch-products");
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch live products");
      }
      return res.json();
    },
    enabled: showImportModal,
  });

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: { apiKey: string; apiSecret: string }) => {
      const res = await fetch("/api/admin/sandromania/settings", {
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
        title: "✅ Settings Saved!",
        description: data.message || "Sandromania API credentials updated successfully.",
      });
      setInputApiSecret("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sandromania/settings"] });
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message || "Could not save Sandromania settings.",
        variant: "destructive",
      });
    },
  });

  // Import Products Mutation
  const importProductsMutation = useMutation({
    mutationFn: async (payload: { products: any[]; markupPercent: number }) => {
      const res = await fetch("/api/admin/sandromania/import-products", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sandromania/products"] });
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
      const res = await fetch(`/api/admin/sandromania/products/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sandromania/products"] });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  // Delete Product Mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/sandromania/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete product");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Product Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sandromania/products"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, label = "Copied to clipboard") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
    toast({ title: label, description: text });
  };

  const handleOpenEdit = (prod: any) => {
    setEditingProduct(prod);
    setEditSellingPriceUsd(((prod.sellingPriceUsd || 0) / 100).toFixed(2));
    setEditSellingPriceLkr(prod.sellingPriceLkr ? String(prod.sellingPriceLkr) : "");
    setEditCategory(prod.category || "general");
    setEditIsActive(prod.isActive !== false);
  };

  const handleSaveEdit = () => {
    if (!editingProduct) return;
    const usdVal = parseFloat(editSellingPriceUsd);
    if (isNaN(usdVal) || usdVal < 0) {
      toast({ title: "Invalid Price", description: "Please enter a valid selling price in USD.", variant: "destructive" });
      return;
    }
    const lkrVal = editSellingPriceLkr ? parseInt(editSellingPriceLkr) : 0;
    updateProductMutation.mutate({
      id: editingProduct.id,
      updates: {
        sellingPriceUsd: Math.round(usdVal * 100),
        sellingPriceLkr: lkrVal,
        category: editCategory.trim(),
        isActive: editIsActive,
      },
    });
  };

  // Filter products by category & search
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      selectedCategory === "all" ||
      (p.category || "").toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  const categories = Array.from(new Set(products.map((p) => p.category || "general"))).filter(Boolean);

  // Filter remote products in import modal
  const filteredRemoteProducts = remoteProducts.filter((p) => {
    const matchesSearch =
      !importSearch.trim() ||
      p.title.toLowerCase().includes(importSearch.toLowerCase()) ||
      String(p.id).includes(importSearch);
    return matchesSearch;
  });

  const isAllRemoteSelected =
    filteredRemoteProducts.length > 0 &&
    selectedProductsToImport.length === filteredRemoteProducts.length;

  const toggleSelectAllRemote = () => {
    if (isAllRemoteSelected) {
      setSelectedProductsToImport([]);
    } else {
      setSelectedProductsToImport([...filteredRemoteProducts]);
    }
  };

  const toggleSelectRemote = (item: any) => {
    const exists = selectedProductsToImport.some((s) => s.id === item.id);
    if (exists) {
      setSelectedProductsToImport(selectedProductsToImport.filter((s) => s.id !== item.id));
    } else {
      setSelectedProductsToImport([...selectedProductsToImport, item]);
    }
  };

  const balanceUsd = settingsData?.balanceInfo?.balance_usd ?? 0;
  const balanceRub = settingsData?.balanceInfo?.balance_rub ?? 0;
  const isHealthy = settingsData?.health?.ok !== false;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#311042] p-6 sm:p-8 text-white shadow-2xl border border-white/10">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#8B5CF6]/15 rounded-full blur-3xl pointer-events-none -translate-y-24 translate-x-24" />
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-[#EC4899]/15 rounded-full blur-3xl pointer-events-none translate-y-24" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/10 backdrop-blur-md text-purple-200 border border-white/10 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-pink-400" /> Sandromania Partner API
              </span>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                  isHealthy ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                {isHealthy ? "API Online (HMAC-SHA256)" : "API Disconnected"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Sandromania Shop Integration
            </h1>
            <p className="text-sm text-purple-200/80 max-w-xl leading-relaxed">
              Automated digital goods, ChatGPT CDK tokens, premium subscriptions, and instant code auto-delivery via partner balance.
            </p>
          </div>

          {/* Partner Balance Display & Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-white/10 min-w-[200px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200/70 block mb-0.5 flex items-center justify-between">
                <span>Partner Balance</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              </span>
              <div className="text-2xl font-black text-white flex items-baseline gap-1">
                ${balanceUsd.toFixed(2)} <span className="text-xs font-semibold text-purple-300">USD</span>
              </div>
              <span className="text-[11px] font-semibold text-purple-300/80 block mt-0.5">
                ≈ {balanceRub.toLocaleString()} RUB
              </span>
            </div>

            <div className="flex flex-row sm:flex-col gap-2">
              <Button
                onClick={() => {
                  refetchSettings();
                  refetchProducts();
                  refetchOrders();
                  toast({ title: "Refreshing Data..." });
                }}
                variant="outline"
                className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/15 rounded-xl text-xs font-bold gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sync
              </Button>

              <Button
                onClick={() => setShowImportModal(true)}
                className="flex-1 bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] hover:opacity-95 text-white font-black rounded-xl text-xs shadow-lg shadow-[#8B5CF6]/30 gap-1.5"
              >
                <Plus className="w-4 h-4" /> Import Products
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-2xl border flex flex-wrap max-w-md">
          <TabsTrigger value="products" className="rounded-xl font-black text-xs flex-1 gap-2">
            <Package className="w-4 h-4" /> Products ({products.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl font-black text-xs flex-1 gap-2">
            <ShoppingCart className="w-4 h-4" /> Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl font-black text-xs flex-1 gap-2">
            <Key className="w-4 h-4" /> API Settings
          </TabsTrigger>
        </TabsList>

        {/* 1. PRODUCTS MANAGEMENT TAB */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search imported products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className="rounded-xl text-xs font-bold"
              >
                All ({products.length})
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="rounded-xl text-xs font-bold capitalize"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {productsLoading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
              <span>Loading Sandromania products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-card rounded-3xl p-10 text-center border space-y-3">
              <Package className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="text-base font-bold">No products found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {products.length === 0
                  ? "You haven't imported any products from Sandromania yet. Click 'Import Products' to import items into your store catalog."
                  : "No products matched your search or category filter."}
              </p>
              {products.length === 0 && (
                <Button
                  onClick={() => setShowImportModal(true)}
                  className="bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] text-white font-bold rounded-xl text-xs shadow-md"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Import Live Catalog
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((prod) => {
                const costUsd = ((prod.costPriceUsd || 0) / 100).toFixed(2);
                const sellingUsd = ((prod.sellingPriceUsd || 0) / 100).toFixed(2);
                const profitUsd = (
                  ((prod.sellingPriceUsd || 0) - (prod.costPriceUsd || 0)) /
                  100
                ).toFixed(2);
                const profitMargin =
                  prod.costPriceUsd > 0
                    ? Math.round(
                        (((prod.sellingPriceUsd || 0) - prod.costPriceUsd) / prod.costPriceUsd) *
                          100
                      )
                    : 0;

                return (
                  <div
                    key={prod.id}
                    className={`bg-card rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-all ${
                      prod.isActive ? "hover:border-purple-400 hover:shadow-md" : "opacity-60 bg-muted/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                          {prod.category || "General"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              prod.stock > 0
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-600 border border-red-500/20"
                            }`}
                          >
                            Stock: {prod.stock}
                          </span>
                          <Switch
                            checked={prod.isActive}
                            onCheckedChange={(checked) =>
                              updateProductMutation.mutate({
                                id: prod.id,
                                updates: { isActive: checked },
                              })
                            }
                          />
                        </div>
                      </div>

                      <h4 className="text-sm font-black line-clamp-2 mb-1">{prod.title}</h4>
                      <span className="text-[10px] font-mono text-muted-foreground block mb-3">
                        External ID: #{prod.externalProductId}
                      </span>

                      {/* Pricing Breakdown Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-xl border text-center mb-4">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Cost (API)</span>
                          <span className="text-xs font-bold text-muted-foreground">${costUsd}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Selling Price</span>
                          <span className="text-xs font-black text-primary">${sellingUsd}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Profit (+{profitMargin}%)</span>
                          <span className="text-xs font-bold text-emerald-600">+${profitUsd}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(prod)}
                        className="rounded-xl text-xs font-bold flex-1"
                      >
                        Edit Pricing & Details
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${prod.title}?`)) {
                            deleteProductMutation.mutate(prod.id);
                          }
                        }}
                        className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 2. ORDERS TRACKER TAB */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider">
              Sandromania Auto-Fulfillment Orders ({orders.length})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchOrders()}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Orders
            </Button>
          </div>

          {ordersLoading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
              <span>Loading order audit logs...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-card rounded-3xl p-10 text-center border space-y-2">
              <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="text-base font-bold">No orders placed yet</h3>
              <p className="text-xs text-muted-foreground">
                When customers purchase Sandromania products, full fulfillment and license deliveries will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((ord) => {
                const paidUsd = ((ord.amountPaid || 0) / 100).toFixed(2);
                const costUsd = ((ord.costPriceUsd || 0) / 100).toFixed(2);
                const profitUsd = (((ord.amountPaid || 0) - (ord.costPriceUsd || 0)) / 100).toFixed(2);

                return (
                  <div key={ord.id} className="bg-card rounded-2xl p-4 border shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                          Order #{ord.id}
                        </span>
                        {ord.externalOrderId && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Sandromania #{ord.externalOrderId}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border-emerald-200">
                          {ord.status || "approved"}
                        </Badge>
                      </div>

                      <span className="text-[11px] text-muted-foreground">
                        {ord.createdAt ? format(new Date(ord.createdAt), "MMM d, yyyy • HH:mm:ss") : "Recent"}
                      </span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-black">{ord.productTitle}</h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>Qty: <b>{ord.quantity}</b></span>
                          <span>•</span>
                          <span>
                            Customer: <b>{ord.userFirstName || ord.userEmail || `@${ord.username}` || `User #${ord.telegramUserId}`}</b>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Customer Paid</span>
                          <span className="font-black text-primary">${paidUsd}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Cost Price</span>
                          <span className="font-bold text-muted-foreground">${costUsd}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Net Profit</span>
                          <span className="font-black text-emerald-600">+${profitUsd}</span>
                        </div>
                      </div>
                    </div>

                    {/* Issued Delivery Text / CDK Credentials */}
                    {ord.deliveryText && (
                      <div className="bg-muted/40 p-3 rounded-xl border flex items-center justify-between gap-3">
                        <div className="overflow-hidden flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                            Delivered License Keys / Credentials
                          </span>
                          <p className="text-xs font-mono text-purple-700 dark:text-purple-300 truncate select-all">
                            {ord.deliveryText}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(ord.deliveryText, "Credentials Copied")}
                          className="text-xs font-bold text-primary hover:underline shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 3. API & SECURITY SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-4 max-w-2xl">
          <div className="bg-card rounded-3xl p-6 border shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-black flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-purple-600" /> Sandromania Partner API Settings
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Configure your API Key and API Secret to connect to <code>https://api.sandromania.shop</code>.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1.5">
                  Partner API Key (X-Api-Key)
                </label>
                <Input
                  value={inputApiKey}
                  onChange={(e) => setInputApiKey(e.target.value)}
                  placeholder="pk_..."
                  className="font-mono text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1.5">
                  Partner API Secret (HMAC-SHA256 Secret)
                </label>
                <div className="relative">
                  <Input
                    type={showApiSecret ? "text" : "password"}
                    value={inputApiSecret}
                    onChange={(e) => setInputApiSecret(e.target.value)}
                    placeholder={settingsData?.hasSecret ? "•••••••••••••••• (Leave blank to keep current secret)" : "ps_..."}
                    className="font-mono text-xs rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiSecret(!showApiSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Used exclusively on the server for generating cryptographic HMAC-SHA256 request signatures.
                </span>
              </div>

              <Button
                onClick={() =>
                  saveSettingsMutation.mutate({
                    apiKey: inputApiKey.trim(),
                    apiSecret: inputApiSecret.trim(),
                  })
                }
                disabled={saveSettingsMutation.isPending || !inputApiKey.trim()}
                className="w-full bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] text-white font-bold rounded-xl text-xs shadow-md"
              >
                {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Save API Credentials & Verify
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* IMPORT MODAL */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" /> Import Products from Sandromania
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select products from Sandromania live catalog and set your profit markup percentage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Markup Selector & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">
                  Profit Margin Markup: <span className="font-black text-primary">+{markupPercent}%</span>
                </label>
                <div className="flex gap-1.5">
                  {[20, 30, 40, 50, 75, 100].map((pct) => (
                    <Button
                      key={pct}
                      type="button"
                      size="sm"
                      variant={markupPercent === pct ? "default" : "outline"}
                      onClick={() => setMarkupPercent(pct)}
                      className="flex-1 text-xs rounded-xl font-bold py-1 h-8"
                    >
                      {pct}%
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">Search Catalog</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search product title or ID..."
                    value={importSearch}
                    onChange={(e) => setImportSearch(e.target.value)}
                    className="pl-10 text-xs rounded-xl h-8"
                  />
                </div>
              </div>
            </div>

            {/* Select All Toggle Bar */}
            <div className="flex items-center justify-between pt-1 border-t text-xs">
              <button
                type="button"
                onClick={toggleSelectAllRemote}
                className="font-bold text-primary hover:underline flex items-center gap-1.5"
              >
                <input
                  type="checkbox"
                  checked={isAllRemoteSelected}
                  onChange={() => {}}
                  className="rounded"
                />
                <span>Select All ({filteredRemoteProducts.length} items)</span>
              </button>

              <span className="text-muted-foreground font-semibold">
                {selectedProductsToImport.length} selected
              </span>
            </div>
          </div>

          {/* Scrollable Products List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 border-t pt-3 max-h-[360px]">
            {remoteProductsLoading ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin mb-2 text-primary" />
                <span>Fetching live products from Sandromania...</span>
              </div>
            ) : filteredRemoteProducts.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <p className="text-xs">No products found in Sandromania catalog.</p>
              </div>
            ) : (
              filteredRemoteProducts.map((item) => {
                const isSelected = selectedProductsToImport.some((s) => s.id === item.id);
                const rawCost = typeof item.price_usd === "number" ? item.price_usd : parseFloat(item.price_usd || "0");
                const calculatedSelling = (rawCost * (1 + markupPercent / 100)).toFixed(2);

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelectRemote(item)}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isSelected ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded shrink-0"
                      />
                      <div>
                        <h5 className="text-xs font-black truncate">{item.title}</h5>
                        <span className="text-[10px] text-muted-foreground">
                          ID: #{item.id} • Stock: {item.stock} • Type: {item.type}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-primary">${calculatedSelling}</div>
                      <span className="text-[10px] text-muted-foreground">Cost: ${rawCost.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Import Footer Actions */}
          <div className="pt-3 border-t flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setShowImportModal(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                importProductsMutation.mutate({
                  products: selectedProductsToImport,
                  markupPercent,
                })
              }
              disabled={importProductsMutation.isPending || selectedProductsToImport.length === 0}
              className="bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-2"
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

      {/* EDIT PRODUCT MODAL */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-md w-full p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">Edit Product Pricing</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingProduct?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                Selling Price (USD $)
              </label>
              <Input
                type="number"
                step="0.01"
                value={editSellingPriceUsd}
                onChange={(e) => setEditSellingPriceUsd(e.target.value)}
                className="font-bold text-sm rounded-xl"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Cost Price: ${((editingProduct?.costPriceUsd || 0) / 100).toFixed(2)} USD
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                Selling Price (LKR Rs - Optional)
              </label>
              <Input
                type="number"
                placeholder="Auto-converts if blank"
                value={editSellingPriceLkr}
                onChange={(e) => setEditSellingPriceLkr(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Category</label>
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="e.g. ChatGPT, VPN, Streaming"
                className="text-xs rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
              <div>
                <span className="text-xs font-bold block">Active in Store</span>
                <span className="text-[10px] text-muted-foreground">Enable customer purchases</span>
              </div>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>

            <Button
              onClick={handleSaveEdit}
              disabled={updateProductMutation.isPending}
              className="w-full bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] text-white font-bold rounded-xl text-xs shadow-md"
            >
              {updateProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
