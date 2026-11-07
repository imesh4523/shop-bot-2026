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
  Send,
  Edit3,
} from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaTiktok,
  FaTelegramPlane,
  FaYoutube,
  FaTwitter,
} from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

export default function SocialPanelPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"services" | "orders" | "settings">("services");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Settings State
  const [inputApiKey, setInputApiKey] = useState("");
  const [inputApiUrl, setInputApiUrl] = useState("https://socialpanel.pro/api/v2");
  const [isTesting, setIsTesting] = useState(false);

  // Import Modal State
  const [importCategoryFilter, setImportCategoryFilter] = useState("all");
  const [importSearch, setImportSearch] = useState("");
  const [markupPercent, setMarkupPercent] = useState<number>(50);
  const [selectedServicesToImport, setSelectedServicesToImport] = useState<any[]>([]);

  // Edit Service Modal State (USD, LKR, Description, Limits)
  const [editingService, setEditingService] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSellingPriceUsd, setEditSellingPriceUsd] = useState("");
  const [editSellingPriceLkr, setEditSellingPriceLkr] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editMax, setEditMax] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  // 1. Query SocialPanel Settings & Balance
  const { data: socialSettings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery({
    queryKey: ["/api/admin/socialpanel/settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/socialpanel/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      if (data.apiKey && !inputApiKey) setInputApiKey(data.apiKey);
      if (data.apiUrl && !inputApiUrl) setInputApiUrl(data.apiUrl);
      return data;
    },
  });

  // 2. Query Saved SMM Services
  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = useQuery<any[]>({
    queryKey: ["/api/admin/socialpanel/services"],
    queryFn: async () => {
      const res = await fetch("/api/admin/socialpanel/services");
      if (!res.ok) throw new Error("Failed to load services");
      return res.json();
    },
  });

  // 3. Query SMM Orders Tracker
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<any[]>({
    queryKey: ["/api/admin/socialpanel/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/socialpanel/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
  });

  // 4. Query Available Services from SocialPanel API (for import modal)
  const { data: remoteServices = [], isLoading: remoteServicesLoading, refetch: refetchRemoteServices } = useQuery<any[]>({
    queryKey: ["/api/admin/socialpanel/fetch-services"],
    queryFn: async () => {
      const res = await fetch("/api/admin/socialpanel/fetch-services");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch remote services");
      }
      return res.json();
    },
    enabled: showImportModal,
  });

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: { apiKey: string; apiUrl: string }) => {
      const res = await fetch("/api/admin/socialpanel/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Settings Saved",
        description: data.message || "SocialPanel.pro configuration updated successfully!",
      });
      refetchSettings();
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api/admin/socialpanel/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: inputApiKey, apiUrl: inputApiUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Connection Successful! ✅",
          description: `SocialPanel.pro API connected! Live Balance: $${data.balance?.toFixed(2)} ${data.currency || 'USD'}`,
        });
      } else {
        toast({
          title: "Connection Failed ❌",
          description: data.error || "Could not connect to SocialPanel.pro API.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Test Error",
        description: e.message || "Network request failed.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Toggle Service Active Mutation
  const toggleServiceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/admin/socialpanel/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update service status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/socialpanel/services"] });
      toast({ title: "Updated", description: "Service visibility status changed." });
    },
  });

  // Update Full Service Mutation (Title, USD, LKR, Limits, Description, Status)
  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const res = await fetch(`/api/admin/socialpanel/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update service");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/socialpanel/services"] });
      toast({ title: "Service Updated", description: "Pricing, description, and limits saved successfully." });
      setEditingService(null);
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenEdit = (svc: any) => {
    setEditingService(svc);
    setEditName(svc.name || "");
    setEditCategory(svc.category || "General");
    const usdVal = ((svc.customRate || 0) / 100).toFixed(2);
    setEditSellingPriceUsd(usdVal);
    setEditSellingPriceLkr(
      svc.customRateLkr != null && svc.customRateLkr > 0
        ? String(svc.customRateLkr)
        : String(Math.round(((svc.customRate || 0) / 100) * 305.5))
    );
    setEditMin(String(svc.min || 10));
    setEditMax(String(svc.max || 100000));
    setEditDescription(svc.description || "");
    setEditIsActive(svc.isActive !== false);
  };

  const handleSaveEdit = () => {
    if (!editingService) return;
    let usdVal = parseFloat(editSellingPriceUsd);
    let lkrVal = editSellingPriceLkr ? parseFloat(editSellingPriceLkr) : 0;

    if ((isNaN(usdVal) || usdVal <= 0) && lkrVal > 0) {
      usdVal = parseFloat((lkrVal / 305.5).toFixed(2));
    }
    if (usdVal > 0 && lkrVal <= 0) {
      lkrVal = Math.round(usdVal * 305.5);
    }

    if ((isNaN(usdVal) || usdVal <= 0) && (isNaN(lkrVal) || lkrVal <= 0)) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid rate in USD or LKR.",
        variant: "destructive",
      });
      return;
    }

    updateServiceMutation.mutate({
      id: editingService.id,
      updates: {
        name: editName.trim() || editingService.name,
        category: editCategory.trim() || editingService.category,
        customRate: Math.round(usdVal * 100),
        customRateLkr: Math.round(lkrVal),
        min: parseInt(editMin) || editingService.min || 10,
        max: parseInt(editMax) || editingService.max || 100000,
        description: editDescription.trim() || null,
        isActive: editIsActive,
      },
    });
  };

  // Delete Service Mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/socialpanel/services/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete service");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/socialpanel/services"] });
      toast({ title: "Deleted", description: "Service removed from local store." });
    },
  });

  // Import Services Mutation
  const importServicesMutation = useMutation({
    mutationFn: async (payload: { services: any[]; markupPercent: number }) => {
      const res = await fetch("/api/admin/socialpanel/import-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to import services");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setShowImportModal(false);
      setSelectedServicesToImport([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/socialpanel/services"] });
      toast({
        title: "Import Complete! 🎉",
        description: data.message || "Services added to catalog successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Import Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Sync Orders Status Mutation
  const syncOrdersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/socialpanel/sync-orders", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sync orders");
      return res.json();
    },
    onSuccess: (data) => {
      refetchOrders();
      toast({
        title: "Orders Synchronized",
        description: data.message || "Active orders updated from SocialPanel.pro.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Sync Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
  };

  // Category Icon Resolver
  const getCategoryIcon = (categoryName: string) => {
    const lower = (categoryName || "").toLowerCase();
    if (lower.includes("facebook") || lower.includes("fb")) return <FaFacebook className="w-4 h-4 text-blue-500" />;
    if (lower.includes("instagram") || lower.includes("ig")) return <FaInstagram className="w-4 h-4 text-pink-500" />;
    if (lower.includes("tiktok")) return <FaTiktok className="w-4 h-4 text-rose-400" />;
    if (lower.includes("telegram")) return <FaTelegramPlane className="w-4 h-4 text-sky-400" />;
    if (lower.includes("youtube")) return <FaYoutube className="w-4 h-4 text-red-500" />;
    if (lower.includes("twitter") || lower.includes("x")) return <FaTwitter className="w-4 h-4 text-blue-400" />;
    return <Share2 className="w-4 h-4 text-purple-400" />;
  };

  // Filter Saved Services
  const filteredServices = services.filter((s) => {
    const matchesCategory = selectedCategory === "all" || s.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.serviceId.includes(searchQuery) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Unique categories for filtering
  const uniqueCategories = Array.from(new Set(services.map((s) => s.category)));

  // Filter Remote Services in Modal
  const remoteCategories = Array.from(new Set(remoteServices.map((s) => s.category || "General")));
  const filteredRemoteServices = remoteServices.filter((s) => {
    const matchesCategory = importCategoryFilter === "all" || (s.category || "").toLowerCase() === importCategoryFilter.toLowerCase();
    const matchesSearch =
      (s.name || "").toLowerCase().includes(importSearch.toLowerCase()) ||
      String(s.service || "").includes(importSearch);
    return matchesCategory && matchesSearch;
  });

  const liveBalance = socialSettings?.balanceInfo?.balance;
  const liveCurrency = socialSettings?.balanceInfo?.currency || "USD";

  return (
    <div className="space-y-6 sm:space-y-8 animate-in w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/25 border border-white/20">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-md">
                SocialPanel.pro SMM
              </h1>
              <p className="text-white/40 text-xs sm:text-sm mt-0.5">
                Automated SMM order fulfillment, live services importer & balance sync via SocialPanel.pro API v2.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => syncOrdersMutation.mutate()}
            disabled={syncOrdersMutation.isPending}
            variant="outline"
            className="glass-panel border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncOrdersMutation.isPending ? "animate-spin" : ""}`} />
            Sync Orders
          </Button>
          <Button
            onClick={() => setShowImportModal(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 gap-2 border border-white/20"
          >
            <Plus className="w-4 h-4" />
            Import Services
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Account Balance */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 bg-white/[0.02] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">API Balance</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {settingsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            ) : liveBalance !== undefined ? (
              <div>
                <div className="text-2xl font-black text-white font-mono">
                  ${liveBalance.toFixed(2)} <span className="text-xs text-white/40 font-normal">{liveCurrency}</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Account Connected
                </div>
              </div>
            ) : (
              <div>
                <div className="text-lg font-bold text-rose-400">Not Connected</div>
                <p className="text-[10px] text-white/30 mt-1">Configure your API Key in Settings tab</p>
              </div>
            )}
          </div>
        </div>

        {/* 2. Active Services */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Active Services</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">
              {services.filter((s) => s.isActive).length}{" "}
              <span className="text-xs text-white/40 font-normal">/ {services.length} Total</span>
            </div>
            <p className="text-[10px] text-white/40 mt-1">Ready for automated Telegram/Web orders</p>
          </div>
        </div>

        {/* 3. Total Orders Processed */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Orders Tracked</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">{orders.length}</div>
            <p className="text-[10px] text-white/40 mt-1">
              {orders.filter((o) => o.status === "Completed").length} Completed •{" "}
              {orders.filter((o) => o.status === "Pending" || o.status === "In progress").length} In Progress
            </p>
          </div>
        </div>

        {/* 4. API Status & Protocol */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Protocol</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-white">SocialPanel v2</div>
            <div className="text-[10px] text-purple-300 font-mono mt-1 truncate">
              {socialSettings?.apiUrl || "https://socialpanel.pro/api/v2"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
        <TabsList className="bg-[#130b24] border border-white/10 p-1 rounded-2xl h-auto">
          <TabsTrigger
            value="services"
            className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            Catalog Services ({services.length})
          </TabsTrigger>
          <TabsTrigger
            value="orders"
            className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            Order Audit ({orders.length})
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60"
          >
            API Credentials & Settings
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SAVED SERVICES */}
        <TabsContent value="services" className="space-y-4 mt-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              <Input
                placeholder="Search service name, ID, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#130b24] border-white/10 pl-10 text-white rounded-xl text-xs h-10"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Button
                size="sm"
                variant={selectedCategory === "all" ? "default" : "outline"}
                onClick={() => setSelectedCategory("all")}
                className={`rounded-xl text-xs font-bold ${
                  selectedCategory === "all" ? "bg-purple-600 text-white" : "border-white/10 text-white/60"
                }`}
              >
                All
              </Button>
              {uniqueCategories.slice(0, 6).map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={selectedCategory === cat ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-xl text-xs font-bold whitespace-nowrap ${
                    selectedCategory === cat ? "bg-purple-600 text-white" : "border-white/10 text-white/60"
                  }`}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Services Table */}
          <div className="glass-card rounded-2xl border border-white/10 bg-white/[0.01] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Service ID</th>
                    <th className="py-3.5 px-4">Service Name</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Provider Rate (1k)</th>
                    <th className="py-3.5 px-4">Selling Rate (1k)</th>
                    <th className="py-3.5 px-4">Min / Max</th>
                    <th className="py-3.5 px-4 text-center">Active</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {servicesLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/40">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                        Loading services...
                      </td>
                    </tr>
                  ) : filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/40">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No services found. Click "Import Services" to fetch live services from SocialPanel.pro!
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((service) => (
                      <tr key={service.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-purple-300">
                          #{service.serviceId}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white max-w-sm truncate">{service.name}</div>
                          <span className="text-[10px] text-white/30">{service.type || "Default"}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {getCategoryIcon(service.category)}
                            <span className="truncate max-w-[120px]">{service.category}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-white/50">
                          ${((service.rate || 0) / 100).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-bold text-emerald-400">
                            ${((service.customRate || 0) / 100).toFixed(2)}
                          </div>
                          <div className="text-[10px] font-bold text-emerald-500/80">
                            Rs. {(service.customRateLkr || Math.round(((service.customRate || 0) / 100) * 305.5)).toLocaleString()} / 1k
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-white/50 font-mono text-[11px]">
                          {service.min?.toLocaleString()} - {service.max?.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Switch
                            checked={service.isActive}
                            onCheckedChange={(checked) =>
                              toggleServiceMutation.mutate({ id: service.id, isActive: checked })
                            }
                          />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(service)}
                              className="h-8 w-8 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg"
                              title="Edit Title, Prices (Rs/USD), Description & Limits"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Remove ${service.name} from catalog?`)) {
                                  deleteServiceMutation.mutate(service.id);
                                }
                              }}
                              className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                              title="Delete Service"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ORDERS AUDIT TRACKER */}
        <TabsContent value="orders" className="space-y-4 mt-6">
          <div className="glass-card rounded-2xl border border-white/10 bg-white/[0.01] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4">Provider ID</th>
                    <th className="py-3.5 px-4">Service</th>
                    <th className="py-3.5 px-4">Target Link</th>
                    <th className="py-3.5 px-4">Quantity</th>
                    <th className="py-3.5 px-4">Charge</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {ordersLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/40">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                        Loading orders...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/40">
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No orders recorded yet. SMM orders placed via shop will automatically be dispatched here!
                      </td>
                    </tr>
                  ) : (
                    orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-white">#{ord.id}</td>
                        <td className="py-3.5 px-4 font-mono text-purple-300">
                          {ord.externalOrderId ? `#${ord.externalOrderId}` : "Pending Dispatch"}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white max-w-xs truncate">
                            {ord.serviceName || "Social Service"}
                          </div>
                          <span className="text-[10px] text-white/30">{ord.serviceCategory}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <a
                            href={ord.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-400 hover:underline max-w-[150px] truncate block font-mono text-[11px]"
                          >
                            {ord.link}
                          </a>
                        </td>
                        <td className="py-3.5 px-4 font-mono">{ord.quantity?.toLocaleString()}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          ${((ord.charge || 0) / 100).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            className={`rounded-full text-[10px] font-bold ${
                              ord.status === "Completed"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : ord.status === "In progress" || ord.status === "Processing"
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                : ord.status === "Canceled" || ord.status === "Partial"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {ord.status || "Pending"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-white/40 text-[11px]">
                          {ord.createdAt ? format(new Date(ord.createdAt), "MMM d, HH:mm") : "N/A"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: SETTINGS & CREDENTIALS */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <div className="glass-card rounded-2xl p-6 border border-white/10 bg-white/[0.01] max-w-2xl">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-400" />
              SocialPanel.pro API Configuration
            </h2>
            <p className="text-xs text-white/40 mt-1">
              Configure your secret API key from your SocialPanel.pro account settings. All requests are authenticated securely via POST over HTTPS.
            </p>

            <div className="space-y-4 mt-6">
              {/* API URL */}
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1.5">API Endpoint URL</label>
                <Input
                  value={inputApiUrl}
                  onChange={(e) => setInputApiUrl(e.target.value)}
                  placeholder="https://socialpanel.pro/api/v2"
                  className="bg-[#130b24] border-white/10 text-white rounded-xl text-xs font-mono h-11"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1.5">SocialPanel.pro API Key</label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    placeholder="Enter your SocialPanel API Key here..."
                    className="bg-[#130b24] border-white/10 text-white rounded-xl text-xs font-mono h-11 pr-20"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="h-7 w-7 text-white/50 hover:text-white"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    {inputApiKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(inputApiKey, "API Key")}
                        className="h-7 w-7 text-white/50 hover:text-white"
                      >
                        {copiedText === "API Key" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() =>
                    saveSettingsMutation.mutate({
                      apiKey: inputApiKey,
                      apiUrl: inputApiUrl,
                    })
                  }
                  disabled={saveSettingsMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs px-6 h-11 shadow-lg shadow-purple-600/30 gap-2"
                >
                  {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save API Settings
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !inputApiKey.trim()}
                  className="border-white/10 text-white hover:bg-white/10 font-bold rounded-xl text-xs px-5 h-11 gap-2"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4 text-emerald-400" />}
                  Test Connection
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* IMPORT SERVICES MODAL */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] bg-[#0f0a1a] border border-white/15 text-white flex flex-col p-6 rounded-3xl overflow-hidden shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-purple-400" />
              Import Services from SocialPanel.pro
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50">
              Select available services to import into your storefront catalog with custom profit markup.
            </DialogDescription>
          </DialogHeader>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 py-3 border-y border-white/10">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
              <Input
                placeholder="Search remote services..."
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                className="bg-[#18102a] border-white/10 pl-9 text-xs text-white rounded-xl h-9 w-full"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white/60 whitespace-nowrap">Markup:</span>
                <Input
                  type="number"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(Number(e.target.value))}
                  className="bg-[#18102a] border-white/10 text-xs text-white rounded-xl h-9 w-20 text-center font-bold"
                />
                <span className="text-xs text-white/40">%</span>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (selectedServicesToImport.length === filteredRemoteServices.length) {
                    setSelectedServicesToImport([]);
                  } else {
                    setSelectedServicesToImport([...filteredRemoteServices]);
                  }
                }}
                className="border-white/10 text-white text-xs rounded-xl h-9 whitespace-nowrap"
              >
                {selectedServicesToImport.length === filteredRemoteServices.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>

          {/* Remote Services List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
            {remoteServicesLoading ? (
              <div className="py-20 text-center text-white/40">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-400" />
                Fetching live services from SocialPanel.pro...
              </div>
            ) : filteredRemoteServices.length === 0 ? (
              <div className="py-20 text-center text-white/40">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No services match your search or filter.
              </div>
            ) : (
              filteredRemoteServices.map((item) => {
                const isSelected = selectedServicesToImport.some((s) => s.service === item.service);
                const rawRate = typeof item.rate === "number" ? item.rate : parseFloat(item.rate || "0");
                const calculatedSellingPrice = (rawRate * (1 + markupPercent / 100)).toFixed(2);

                return (
                  <div
                    key={item.service}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedServicesToImport(selectedServicesToImport.filter((s) => s.service !== item.service));
                      } else {
                        setSelectedServicesToImport([...selectedServicesToImport, item]);
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected
                        ? "bg-purple-950/40 border-purple-500 shadow-md"
                        : "bg-white/[0.02] border-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-purple-600 border-purple-500 text-white" : "border-white/20"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate">{item.name}</div>
                        <div className="text-[10px] text-white/40 flex items-center gap-2 mt-0.5">
                          <span>#{item.service}</span>
                          <span>•</span>
                          <span>{item.category || "General"}</span>
                          <span>•</span>
                          <span>Min: {item.min} / Max: {item.max}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        ${calculatedSellingPrice} / 1k
                      </div>
                      <div className="text-[10px] text-white/30 font-mono">
                        Cost: ${rawRate.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Action */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/50">
              Selected: <b className="text-white">{selectedServicesToImport.length}</b> services
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportModal(false)}
                className="border-white/10 text-white text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  importServicesMutation.mutate({
                    services: selectedServicesToImport,
                    markupPercent,
                  })
                }
                disabled={selectedServicesToImport.length === 0 || importServicesMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl gap-2 shadow-lg shadow-purple-600/30"
              >
                {importServicesMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Import {selectedServicesToImport.length} Services
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT SERVICE MODAL (USD, LKR, DESCRIPTION, LIMITS) */}
      <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent className="max-w-xl bg-neutral-900 border border-white/10 text-white p-6 rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-white">
              <SlidersHorizontal className="w-4 h-4 text-purple-400" />
              Edit SocialPanel Service #{editingService?.serviceId}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50">
              Customize title, selling rates in USD ($) and LKR (Rs.), instructions, and limits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Service Name */}
            <div>
              <label className="text-xs font-bold text-white/70 block mb-1">
                Service Title / Name
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Instagram Followers [HQ - Real]"
                className="bg-white/5 border-white/10 text-xs text-white rounded-xl font-medium focus:border-purple-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-bold text-white/70 block mb-1">
                Category
              </label>
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="e.g. Instagram Followers"
                className="bg-white/5 border-white/10 text-xs text-white rounded-xl font-medium focus:border-purple-500"
              />
            </div>

            {/* Rates: USD & LKR Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Selling Rate ($ USD / 1k)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={editSellingPriceUsd}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditSellingPriceUsd(v);
                      const n = parseFloat(v);
                      if (!isNaN(n) && n > 0) {
                        setEditSellingPriceLkr(String(Math.round(n * 305.5)));
                      }
                    }}
                    placeholder="e.g. 1.20"
                    className="pl-7 bg-white/5 border-white/10 text-xs font-mono font-bold text-emerald-400 rounded-xl"
                  />
                </div>
                <span className="text-[10px] text-white/40 mt-1 block">
                  Original Cost: ${((editingService?.rate || 0) / 100).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-400 block mb-1">
                  Selling Rate (Rs. LKR / 1k)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold text-xs">Rs.</span>
                  <Input
                    type="number"
                    step="1"
                    value={editSellingPriceLkr}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditSellingPriceLkr(v);
                      const n = parseFloat(v);
                      if (!isNaN(n) && n > 0) {
                        setEditSellingPriceUsd((n / 305.5).toFixed(2));
                      }
                    }}
                    placeholder="e.g. 367"
                    className="pl-9 bg-emerald-500/5 border-emerald-500/20 text-xs font-mono font-bold text-emerald-300 rounded-xl"
                  />
                </div>
                <span className="text-[10px] text-emerald-400/70 mt-1 block font-semibold">
                  Type Rs. to auto-convert USD
                </span>
              </div>
            </div>

            {/* Min and Max Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Min Order Quantity
                </label>
                <Input
                  type="number"
                  value={editMin}
                  onChange={(e) => setEditMin(e.target.value)}
                  placeholder="10"
                  className="bg-white/5 border-white/10 text-xs text-white rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Max Order Quantity
                </label>
                <Input
                  type="number"
                  value={editMax}
                  onChange={(e) => setEditMax(e.target.value)}
                  placeholder="100000"
                  className="bg-white/5 border-white/10 text-xs text-white rounded-xl"
                />
              </div>
            </div>

            {/* Description & Instructions */}
            <div>
              <label className="text-xs font-bold text-white/70 block mb-1">
                Service Description & Instructions
              </label>
              <Textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter service details, speed, drop rate, guarantee, and format requirements for customers..."
                className="bg-white/5 border-white/10 text-xs text-white rounded-xl resize-y placeholder:text-white/30"
              />
              <span className="text-[10px] text-white/40 mt-1 block">
                Displayed cleanly in the service detail card on Telegram Mini App and Web Store.
              </span>
            </div>

            {/* Active Status Switch */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/10">
              <div>
                <span className="text-xs font-bold text-white block">Active in Store</span>
                <span className="text-[10px] text-white/40">Enable this service for customers to browse & order</span>
              </div>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingService(null)}
                className="text-xs text-white/60 hover:text-white rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={updateServiceMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl gap-1.5"
              >
                {updateServiceMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
