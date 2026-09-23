import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Share2,
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
} from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaTiktok,
  FaTelegramPlane,
} from "react-icons/fa";
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

export default function N1PanelPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"services" | "orders" | "settings">("services");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Settings State
  const [inputApiKey, setInputApiKey] = useState("");
  const [inputApiUrl, setInputApiUrl] = useState("https://n1panel.com/api/v2");

  // Import Modal State
  const [importCategoryFilter, setImportCategoryFilter] = useState("all");
  const [importSearch, setImportSearch] = useState("");
  const [markupPercent, setMarkupPercent] = useState<number>(50);
  const [selectedServicesToImport, setSelectedServicesToImport] = useState<any[]>([]);

  // 1. Query N1Panel Settings & Balance
  const { data: n1Settings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery({
    queryKey: ["/api/admin/n1panel/settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/n1panel/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      if (data.apiKey && !inputApiKey) setInputApiKey(data.apiKey);
      if (data.apiUrl && !inputApiUrl) setInputApiUrl(data.apiUrl);
      return data;
    },
  });

  // 2. Query Saved SMM Services
  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = useQuery<any[]>({
    queryKey: ["/api/admin/n1panel/services"],
    queryFn: async () => {
      const res = await fetch("/api/admin/n1panel/services");
      if (!res.ok) throw new Error("Failed to load services");
      return res.json();
    },
  });

  // 3. Query SMM Orders Tracker
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<any[]>({
    queryKey: ["/api/admin/n1panel/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/n1panel/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
  });

  // 4. Query Live N1Panel Services for Import Modal
  const {
    data: liveServices = [],
    isLoading: liveServicesLoading,
    refetch: fetchLiveServices,
  } = useQuery<any[]>({
    queryKey: ["/api/admin/n1panel/fetch-services"],
    queryFn: async () => {
      const res = await fetch("/api/admin/n1panel/fetch-services");
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch from N1Panel");
      }
      return res.json();
    },
    enabled: showImportModal,
  });

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: { apiKey: string; apiUrl: string }) => {
      const res = await fetch("/api/admin/n1panel/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Settings Saved",
        description: data.message || "N1Panel configuration updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/n1panel/settings"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Import Services Mutation
  const importServicesMutation = useMutation({
    mutationFn: async (payload: { services: any[]; markupPercent: number }) => {
      const res = await fetch("/api/admin/n1panel/import-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to import services");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import Successful",
        description: data.message,
      });
      setShowImportModal(false);
      setSelectedServicesToImport([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/n1panel/services"] });
    },
    onError: (err: any) => {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  // Update Service Mutation
  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const res = await fetch(`/api/admin/n1panel/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update service");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/n1panel/services"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Delete Service Mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/n1panel/services/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete service");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Service removed from catalog." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/n1panel/services"] });
    },
  });

  // Sync Orders Mutation
  const syncOrdersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/n1panel/sync-orders", { method: "POST" });
      if (!res.ok) throw new Error("Failed to sync orders");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Orders Synced", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/n1panel/orders"] });
    },
    onError: (err: any) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
    toast({ title: "Copied", description: "Text copied to clipboard." });
  };

  const getPlatformIcon = (category: string) => {
    const c = (category || "").toLowerCase();
    if (c.includes("facebook") || c.includes("fb")) return <FaFacebook className="w-4 h-4 text-[#1877F2]" />;
    if (c.includes("instagram") || c.includes("ig")) return <FaInstagram className="w-4 h-4 text-[#E1306C]" />;
    if (c.includes("tiktok") || c.includes("tt")) return <FaTiktok className="w-4 h-4 text-neutral-900 dark:text-white" />;
    if (c.includes("telegram") || c.includes("tg")) return <FaTelegramPlane className="w-4 h-4 text-[#24A1DE]" />;
    return <Globe className="w-4 h-4 text-purple-500" />;
  };

  const filteredServices = services.filter((s) => {
    const matchesCategory =
      selectedCategory === "all" ||
      s.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      s.name.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.serviceId.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const filteredLiveServices = liveServices.filter((s) => {
    const matchesCat =
      importCategoryFilter === "all" ||
      (s.category && s.category.toLowerCase().includes(importCategoryFilter.toLowerCase()));
    const matchesSearch =
      !importSearch ||
      (s.name && s.name.toLowerCase().includes(importSearch.toLowerCase())) ||
      (s.category && s.category.toLowerCase().includes(importSearch.toLowerCase())) ||
      String(s.service).includes(importSearch);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-purple-500/20">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                N1Panel SMM Manager
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                Automated SMM Services for Facebook, TikTok, Instagram & Telegram
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSettings();
              refetchServices();
              refetchOrders();
            }}
            className="rounded-xl border-neutral-200 dark:border-neutral-800 text-xs font-bold gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-md shadow-purple-500/20"
          >
            <Plus className="w-3.5 h-3.5" /> Import Services
          </Button>
        </div>
      </div>

      {/* Stats & Status Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* N1Panel Balance */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
              N1Panel Balance
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white">
            {n1Settings?.balanceInfo?.balance !== undefined
              ? `$${parseFloat(n1Settings.balanceInfo.balance).toFixed(2)}`
              : n1Settings?.balanceInfo?.error
              ? "API Error"
              : "$0.00"}
          </div>
          <span className="text-[10px] text-neutral-400 font-medium">
            {n1Settings?.apiKey ? "Connected to n1panel.com" : "API Key Required"}
          </span>
        </div>

        {/* Active Catalog Services */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
              Catalog Services
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white">
            {services.filter((s) => s.isActive).length} / {services.length}
          </div>
          <span className="text-[10px] text-neutral-400 font-medium">Active in Store Catalog</span>
        </div>

        {/* Total SMM Orders */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
              Total SMM Orders
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white">{orders.length}</div>
          <span className="text-[10px] text-neutral-400 font-medium">
            {orders.filter((o) => o.status === "In progress" || o.status === "Pending").length} In Progress
          </span>
        </div>

        {/* API Connection Health */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
              API Connection
            </span>
            <div
              className={`p-2 rounded-xl ${
                n1Settings?.apiKey && !n1Settings?.balanceInfo?.error
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-600"
              }`}
            >
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-1.5">
            {n1Settings?.apiKey && !n1Settings?.balanceInfo?.error ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Online & Active
              </span>
            ) : (
              <span className="text-amber-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Setup Required
              </span>
            )}
          </div>
          <span className="text-[10px] text-neutral-400 font-mono truncate block mt-0.5">
            {n1Settings?.apiUrl || "https://n1panel.com/api/v2"}
          </span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
        <TabsList className="bg-white dark:bg-neutral-900 p-1 rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
          <TabsTrigger value="services" className="rounded-xl text-xs font-bold gap-2">
            <Package className="w-3.5 h-3.5" /> Services Manager ({services.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl text-xs font-bold gap-2">
            <ShoppingCart className="w-3.5 h-3.5" /> Orders Tracker ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl text-xs font-bold gap-2">
            <Key className="w-3.5 h-3.5" /> API Configuration
          </TabsTrigger>
        </TabsList>

        {/* 1. SERVICES TAB */}
        <TabsContent value="services" className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              {[
                { id: "all", label: "All Platforms" },
                { id: "facebook", label: "Facebook", icon: FaFacebook, color: "text-[#1877F2]" },
                { id: "tiktok", label: "TikTok", icon: FaTiktok, color: "text-neutral-900 dark:text-white" },
                { id: "instagram", label: "Instagram", icon: FaInstagram, color: "text-[#E1306C]" },
                { id: "telegram", label: "Telegram", icon: FaTelegramPlane, color: "text-[#24A1DE]" },
              ].map((tab) => {
                const isActive = selectedCategory === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                      isActive
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                    }`}
                  >
                    {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : tab.color}`} />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search services or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Services Table */}
          {servicesLoading ? (
            <div className="py-16 text-center text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
              <span className="text-xs font-medium">Loading catalog services...</span>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-12 text-center border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
              <Package className="w-10 h-10 mx-auto text-neutral-300 mb-3" />
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No Services Found</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Click <b>"Import Services"</b> to pull live Facebook, TikTok, Instagram, and Telegram packages from N1Panel.
              </p>
              <Button
                size="sm"
                onClick={() => setShowImportModal(true)}
                className="mt-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Import from N1Panel
              </Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50/80 dark:bg-neutral-800/50 text-[10px] font-black uppercase text-neutral-400 tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-5 py-3.5">Service ID & Name</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5">Cost / 1k</th>
                      <th className="px-4 py-3.5">Selling Price / 1k</th>
                      <th className="px-4 py-3.5">Min - Max</th>
                      <th className="px-4 py-3.5 text-center">Active in Store</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 font-medium">
                    {filteredServices.map((service) => {
                      const originalCostUsd = (service.rate / 100).toFixed(2);
                      const customSellingUsd = (service.customRate / 100).toFixed(2);

                      return (
                        <tr
                          key={service.id}
                          className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                                #{service.serviceId}
                              </span>
                              <span className="font-bold text-neutral-900 dark:text-white max-w-xs truncate">
                                {service.name}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              {getPlatformIcon(service.category)}
                              <span className="font-bold text-neutral-700 dark:text-neutral-300">
                                {service.category}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4 font-mono text-neutral-500">
                            ${originalCostUsd}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <span className="text-neutral-400 font-bold">$</span>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={customSellingUsd}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val > 0) {
                                    updateServiceMutation.mutate({
                                      id: service.id,
                                      updates: { customRate: Math.round(val * 100) },
                                    });
                                  }
                                }}
                                className="w-20 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
                              />
                            </div>
                          </td>

                          <td className="px-4 py-4 text-neutral-500 font-mono text-[11px]">
                            {service.min.toLocaleString()} - {service.max.toLocaleString()}
                          </td>

                          <td className="px-4 py-4 text-center">
                            <Switch
                              checked={service.isActive}
                              onCheckedChange={(checked) =>
                                updateServiceMutation.mutate({
                                  id: service.id,
                                  updates: { isActive: checked },
                                })
                              }
                            />
                          </td>

                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${service.name} from store catalog?`)) {
                                  deleteServiceMutation.mutate(service.id);
                                }
                              }}
                              className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

        {/* 2. ORDERS TRACKER TAB */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-neutral-900 dark:text-white">Customer SMM Orders</h3>
              <p className="text-xs text-neutral-400 font-medium">
                Live delivery progress & audit log of all social media orders
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => syncOrdersMutation.mutate()}
              disabled={syncOrdersMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold gap-1.5"
            >
              {syncOrdersMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync Live Status
            </Button>
          </div>

          {ordersLoading ? (
            <div className="py-16 text-center text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
              <span className="text-xs font-medium">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-12 text-center border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
              <ShoppingCart className="w-10 h-10 mx-auto text-neutral-300 mb-3" />
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No Orders Yet</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Customer purchases made through the Telegram Mini App or Web Store will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50/80 dark:bg-neutral-800/50 text-[10px] font-black uppercase text-neutral-400 tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-5 py-3.5">Order ID / Ext ID</th>
                      <th className="px-4 py-3.5">Customer</th>
                      <th className="px-4 py-3.5">Service</th>
                      <th className="px-4 py-3.5">Target Link</th>
                      <th className="px-4 py-3.5">Quantity</th>
                      <th className="px-4 py-3.5">Charge</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 font-medium">
                    {orders.map((ord) => {
                      const isComplete = ord.status === "Completed";
                      const isInProgress = ord.status === "In progress" || ord.status === "Processing";
                      const isCanceled = ord.status === "Canceled";

                      return (
                        <tr
                          key={ord.id}
                          className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div>
                              <span className="font-bold text-neutral-900 dark:text-white block">
                                #{ord.id}
                              </span>
                              <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400">
                                {ord.externalOrderId ? `N1 #${ord.externalOrderId}` : "Pending API"}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div>
                              <span className="font-bold text-neutral-900 dark:text-white block">
                                {ord.userFirstName || ord.username || "Customer"}
                              </span>
                              <span className="text-[10px] text-neutral-400 truncate max-w-[140px] block">
                                {ord.userEmail || `ID: ${ord.telegramId}`}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              {getPlatformIcon(ord.serviceCategory)}
                              <span className="font-bold text-neutral-800 dark:text-neutral-200 max-w-[160px] truncate block">
                                {ord.serviceName || "SMM Package"}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 max-w-[180px]">
                              <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 truncate">
                                {ord.link}
                              </span>
                              <button
                                onClick={() => copyToClipboard(ord.link)}
                                className="text-neutral-400 hover:text-neutral-600"
                              >
                                {copiedText === ord.link ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-4 font-mono font-bold text-neutral-900 dark:text-white">
                            {ord.quantity?.toLocaleString()}
                          </td>

                          <td className="px-4 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                            ${((ord.charge || 0) / 100).toFixed(2)}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${
                                isComplete
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                                  : isInProgress
                                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                                  : isCanceled
                                  ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                                  : "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                              }`}
                            >
                              {ord.status || "Pending"}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right text-neutral-400 text-[11px]">
                            {ord.createdAt ? format(new Date(ord.createdAt), "MMM d, HH:mm") : "-"}
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

        {/* 3. SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm max-w-2xl space-y-5">
            <div>
              <h3 className="text-base font-black text-neutral-900 dark:text-white">
                N1Panel API Credentials
              </h3>
              <p className="text-xs text-neutral-400 font-medium mt-0.5">
                Configure your API key from <a href="https://n1panel.com" target="_blank" rel="noreferrer" className="text-purple-600 underline">n1panel.com</a> account settings.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                  N1Panel API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    placeholder="Enter your N1Panel API Key..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                  N1Panel API URL Endpoint
                </label>
                <input
                  type="text"
                  value={inputApiUrl}
                  onChange={(e) => setInputApiUrl(e.target.value)}
                  placeholder="https://n1panel.com/api/v2"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  onClick={() =>
                    saveSettingsMutation.mutate({
                      apiKey: inputApiKey,
                      apiUrl: inputApiUrl,
                    })
                  }
                  disabled={saveSettingsMutation.isPending || !inputApiKey.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold px-6"
                >
                  {saveSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving...
                    </>
                  ) : (
                    "Save & Connect API"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* IMPORT SERVICES DIALOG */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-4xl w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-6 shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-600" /> Import Services from N1Panel
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Select social media packages to add to your Shopeefy catalog with custom profit margins.
            </DialogDescription>
          </DialogHeader>

          {/* Import Controls Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {[
                { id: "all", label: "All" },
                { id: "facebook", label: "Facebook" },
                { id: "tiktok", label: "TikTok" },
                { id: "instagram", label: "Instagram" },
                { id: "telegram", label: "Telegram" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setImportCategoryFilter(c.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    importCategoryFilter === c.id
                      ? "bg-purple-600 text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Profit Markup Input */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                Profit Margin:
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-16 px-2 py-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-center focus:outline-none focus:border-purple-500"
                />
                <span className="text-xs font-bold text-neutral-500">%</span>
              </div>
            </div>
          </div>

          {/* Search Live Services */}
          <div className="py-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search live services (e.g. Followers, Views, Likes)..."
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Live Services List */}
          <div className="flex-1 overflow-y-auto min-h-[300px] border border-neutral-100 dark:border-neutral-800 rounded-2xl p-2 space-y-1.5">
            {liveServicesLoading ? (
              <div className="py-20 text-center text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                <span className="text-xs font-medium">Fetching services from N1Panel API...</span>
              </div>
            ) : filteredLiveServices.length === 0 ? (
              <div className="py-20 text-center text-neutral-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                <span className="text-xs font-semibold">No matching services found.</span>
              </div>
            ) : (
              filteredLiveServices.map((item) => {
                const isSelected = selectedServicesToImport.some((s) => s.service === item.service);
                const rateNum = typeof item.rate === "number" ? item.rate : parseFloat(item.rate || "0");
                const sellingPrice = (rateNum * (1 + markupPercent / 100)).toFixed(3);

                return (
                  <div
                    key={item.service}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedServicesToImport((prev) =>
                          prev.filter((s) => s.service !== item.service)
                        );
                      } else {
                        setSelectedServicesToImport((prev) => [...prev, item]);
                      }
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-50/80 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 shadow-xs"
                        : "bg-white dark:bg-neutral-850 border-neutral-200/70 dark:border-neutral-800 hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-neutral-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">
                            #{item.service}
                          </span>
                          <span className="text-xs font-bold text-neutral-900 dark:text-white">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          Category: {item.category} • Min: {item.min} • Max: {item.max}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-purple-600 dark:text-purple-400 block">
                        ${sellingPrice} / 1k
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        Cost: ${rateNum.toFixed(3)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Import Footer Actions */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500">
              Selected: <b>{selectedServicesToImport.length}</b> services
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImportModal(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  importServicesMutation.mutate({
                    services: selectedServicesToImport,
                    markupPercent,
                  })
                }
                disabled={selectedServicesToImport.length === 0 || importServicesMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold px-5"
              >
                {importServicesMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Importing...
                  </>
                ) : (
                  `Import ${selectedServicesToImport.length} Services`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
