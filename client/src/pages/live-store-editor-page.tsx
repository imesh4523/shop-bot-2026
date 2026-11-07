import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Smartphone, 
  RotateCcw, 
  ExternalLink, 
  Search, 
  Check, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ArrowUp, 
  ArrowDown, 
  Tag, 
  Send,
  Loader2,
  RefreshCw,
  Package,
  Layers
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LiveStoreEditorPage() {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Device Frame State
  const [deviceType, setDeviceType] = useState<"iphone" | "android" | "compact">("iphone");
  const [iframeKey, setIframeKey] = useState(Date.now());
  const [isIframeLoading, setIsIframeLoading] = useState(false);

  // Search & Catalog Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<"all" | "products" | "tunvn" | "sandromania" | "cssx">("all");

  // Inline Editing State (map of id -> { priceLkr, priceUsd })
  const [editingPrices, setEditingPrices] = useState<Record<string, { priceLkr: string; priceUsd: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Fetch all product catalogs
  const { data: standardProducts = [], isLoading: loadingProducts, refetch: refetchProducts } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: tunvnProducts = [], isLoading: loadingTunvn, refetch: refetchTunvn } = useQuery<any[]>({
    queryKey: ["/api/admin/tunvn/products"],
  });

  const { data: sandromaniaProducts = [], isLoading: loadingSandro, refetch: refetchSandro } = useQuery<any[]>({
    queryKey: ["/api/admin/sandromania/products"],
  });

  const { data: cssxProducts = [], isLoading: loadingCssx, refetch: refetchCssx } = useQuery<any[]>({
    queryKey: ["/api/admin/cssx/products"],
  });

  const handleRefreshIframe = () => {
    setIsIframeLoading(true);
    setIframeKey(Date.now());
    setTimeout(() => setIsIframeLoading(false), 800);
  };

  // Device dimensions
  const deviceDimensions = {
    iphone: { width: 393, height: 820, label: "iPhone 15 Pro", radius: "rounded-[52px]", border: "border-[12px] border-[#1C1C1E]" },
    android: { width: 412, height: 840, label: "Samsung Galaxy S24", radius: "rounded-[44px]", border: "border-[10px] border-[#2C2C2E]" },
    compact: { width: 375, height: 720, label: "Compact / SE", radius: "rounded-[36px]", border: "border-[8px] border-[#1C1C1E]" },
  };

  const currentDevice = deviceDimensions[deviceType];

  // Combine and normalize all catalog items
  const unifiedItems = [
    ...standardProducts.map((p) => ({
      ...p,
      sourceType: "standard",
      displayTitle: p.name,
      displayCat: p.type || "Cloud",
      priceLkrVal: p.priceLkr || Math.round(((p.price || 0) / 100) * 305.5),
      priceUsdVal: ((p.price || 0) / 100).toFixed(2),
      active: p.isActive !== false,
      telegram: p.showOnTelegram !== false,
      stock: p.stockCount ?? 0,
    })),
    ...tunvnProducts.map((t) => ({
      ...t,
      sourceType: "tunvn",
      displayTitle: t.title,
      displayCat: t.category || "Subscriptions",
      priceLkrVal: t.sellingPriceLkr || Math.round(((t.sellingPriceUsd || 0) / 100) * 305.5),
      priceUsdVal: ((t.sellingPriceUsd || 0) / 100).toFixed(2),
      active: t.isActive !== false,
      telegram: t.showOnTelegram !== false,
      stock: t.stock ?? 0,
    })),
    ...sandromaniaProducts.map((s) => ({
      ...s,
      sourceType: "sandromania",
      displayTitle: s.title,
      displayCat: s.category || "Digital Goods",
      priceLkrVal: s.sellingPriceLkr || Math.round(((s.sellingPriceUsd || 0) / 100) * 305.5),
      priceUsdVal: ((s.sellingPriceUsd || 0) / 100).toFixed(2),
      active: s.isActive !== false,
      telegram: s.showOnTelegram !== false,
      stock: s.stock ?? 0,
    })),
    ...cssxProducts.map((c) => ({
      ...c,
      sourceType: "cssx",
      displayTitle: c.title,
      displayCat: c.category || "CDK License",
      priceLkrVal: c.sellingPriceLkr || Math.round(((c.sellingPriceUsd || 0) / 100) * 305.5),
      priceUsdVal: ((c.sellingPriceUsd || 0) / 100).toFixed(2),
      active: c.isActive !== false,
      telegram: c.showOnTelegram !== false,
      stock: c.stock ?? 0,
    })),
  ];

  const filteredItems = unifiedItems.filter((item) => {
    if (partnerFilter !== "all") {
      if (partnerFilter === "products" && item.sourceType !== "standard") return false;
      if (partnerFilter === "tunvn" && item.sourceType !== "tunvn") return false;
      if (partnerFilter === "sandromania" && item.sourceType !== "sandromania") return false;
      if (partnerFilter === "cssx" && item.sourceType !== "cssx") return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (item.displayTitle || "").toLowerCase().includes(q);
      const matchCat = (item.displayCat || "").toLowerCase().includes(q);
      return matchTitle || matchCat;
    }
    return true;
  });

  // Toggle active status
  const handleToggleActive = async (item: any) => {
    try {
      const newActive = !item.active;
      if (item.sourceType === "standard") {
        await apiRequest("PATCH", `/api/admin/products/${item.id}/quick-edit`, { isActive: newActive });
        refetchProducts();
      } else if (item.sourceType === "tunvn") {
        await apiRequest("PUT", `/api/admin/tunvn/products/${item.id}`, { isActive: newActive });
        refetchTunvn();
      } else if (item.sourceType === "sandromania") {
        await apiRequest("PUT", `/api/admin/sandromania/products/${item.id}`, { isActive: newActive });
        refetchSandro();
      } else if (item.sourceType === "cssx") {
        await apiRequest("PUT", `/api/admin/cssx/products/${item.id}`, { isActive: newActive });
        refetchCssx();
      }

      toast({
        title: newActive ? "Product Enabled 🟢" : "Product Disabled 🔴",
        description: `${item.displayTitle} is now ${newActive ? "active" : "inactive"} in the live store.`,
      });

      handleRefreshIframe();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to toggle status.",
        variant: "destructive",
      });
    }
  };

  // Toggle Telegram visibility
  const handleToggleTelegram = async (item: any) => {
    try {
      const newTelegram = !item.telegram;
      if (item.sourceType === "standard") {
        await apiRequest("PATCH", `/api/products/${item.id}/toggle-telegram`, { showOnTelegram: newTelegram });
        refetchProducts();
      } else if (item.sourceType === "tunvn") {
        await apiRequest("PUT", `/api/admin/tunvn/products/${item.id}`, { showOnTelegram: newTelegram });
        refetchTunvn();
      }

      toast({
        title: newTelegram ? "Visible on Telegram 📱" : "Hidden from Telegram 🔒",
        description: `${item.displayTitle} visibility updated.`,
      });

      handleRefreshIframe();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update Telegram visibility.",
        variant: "destructive",
      });
    }
  };

  // Save quick price edit
  const handleSavePrice = async (item: any) => {
    const edit = editingPrices[`${item.sourceType}_${item.id}`];
    if (!edit) return;

    setSavingId(`${item.sourceType}_${item.id}`);
    try {
      const lkr = parseInt(edit.priceLkr, 10);
      const usd = parseFloat(edit.priceUsd);
      const usdCents = Math.round(usd * 100);

      if (item.sourceType === "standard") {
        await apiRequest("PATCH", `/api/admin/products/${item.id}/quick-edit`, {
          priceLkr: isNaN(lkr) ? undefined : lkr,
          price: isNaN(usdCents) ? undefined : usdCents,
        });
        refetchProducts();
      } else if (item.sourceType === "tunvn") {
        await apiRequest("PUT", `/api/admin/tunvn/products/${item.id}`, {
          sellingPriceLkr: isNaN(lkr) ? undefined : lkr,
          sellingPriceUsd: isNaN(usdCents) ? undefined : usdCents,
        });
        refetchTunvn();
      }

      toast({
        title: "Price Updated! 💰",
        description: `${item.displayTitle} price saved: Rs. ${lkr.toLocaleString()} ($${usd.toFixed(2)})`,
      });

      handleRefreshIframe();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to save new price.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-full pb-16">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-900/40">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#5B42F3]/30 rounded-2xl border border-indigo-500/30">
              <Smartphone className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Live Store & Mobile Editor
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                  LIVE SYNC
                </Badge>
              </h1>
              <p className="text-slate-300 text-xs mt-0.5">
                Interact with the live customer mobile store, adjust prices & toggle product visibility in real time.
              </p>
            </div>
          </div>
        </div>

        {/* Top Control Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-800/80 p-1 rounded-2xl border border-slate-700/80 flex items-center gap-1">
            <button
              onClick={() => setDeviceType("iphone")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                deviceType === "iphone"
                  ? "bg-[#5B42F3] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              iPhone 15 Pro
            </button>
            <button
              onClick={() => setDeviceType("android")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                deviceType === "android"
                  ? "bg-[#5B42F3] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Galaxy S24
            </button>
            <button
              onClick={() => setDeviceType("compact")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                deviceType === "compact"
                  ? "bg-[#5B42F3] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Compact
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshIframe}
            className="rounded-2xl bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isIframeLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => window.open("/", "_blank")}
            className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Store Tab
          </Button>
        </div>
      </div>

      {/* Main 2-Column Grid: Left Phone Mockup | Right Catalog Tweaker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Realistic Interactive Phone Mockup */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-slate-800 shadow-xl relative min-h-[860px]">
          {/* Frame Label */}
          <div className="flex items-center justify-between w-full mb-3 px-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {currentDevice.label} ({currentDevice.width}px × {currentDevice.height}px)
            </span>
            <span className="text-[11px] font-mono text-indigo-400 font-bold bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-800/40">
              Live Customer View
            </span>
          </div>

          {/* Smartphone Hardware Frame Mockup */}
          <div
            className={`relative bg-black shadow-2xl ${currentDevice.border} ${currentDevice.radius} overflow-hidden transition-all duration-300`}
            style={{ width: `${currentDevice.width}px`, height: `${currentDevice.height}px` }}
          >
            {/* Dynamic Island / Camera Notch */}
            <div className="absolute top-2 inset-x-0 mx-auto w-28 h-6 bg-black rounded-full z-30 flex items-center justify-end pr-2.5 shadow-md">
              <div className="w-2.5 h-2.5 rounded-full bg-[#111] border border-slate-800 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-blue-900/60" />
              </div>
            </div>

            {/* Simulated Glass Reflection Highlight */}
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.06] pointer-events-none z-20" />

            {/* Embedded Live Web Store Iframe */}
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src="/"
              title="YouuHost Live Mobile Preview"
              className="w-full h-full bg-white select-none border-none"
              style={{ width: "100%", height: "100%" }}
            />

            {/* Bottom Home Indicator Bar */}
            <div className="absolute bottom-1.5 inset-x-0 mx-auto w-32 h-1 bg-white/40 rounded-full z-30 pointer-events-none" />
          </div>
        </div>

        {/* Right Column: Live Catalog Controller & Quick Tweaker */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-[#ECEEF8] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#181432] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#5B42F3]" />
                Catalog Controller & Live Tweaker
              </h2>
              <p className="text-xs text-[#7E7998] mt-0.5">
                Toggle products on/off, adjust prices, and control Telegram visibility instantly.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-black text-[#5B42F3] bg-[#F5F4FC] border-purple-200">
              {filteredItems.length} Products Found
            </Badge>
          </div>

          {/* Partner & Category Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap border-b border-[#ECEEF8] pb-3">
            {[
              { id: "all", label: "All Items" },
              { id: "tunvn", label: "TunVN MMO (CapCut)" },
              { id: "products", label: "Direct Products" },
              { id: "sandromania", label: "Sandromania" },
              { id: "cssx", label: "CSxStore" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPartnerFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  partnerFilter === tab.id
                    ? "bg-[#5B42F3] text-white shadow-xs"
                    : "bg-[#F8F7FD] text-slate-600 hover:bg-[#ECEEF8]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              type="text"
              placeholder="Search by product name, category, or service ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-2xl border-[#ECEEF8] text-xs h-10 bg-[#FAF9FE] focus:bg-white"
            />
          </div>

          {/* Product Items List with Live Controls */}
          <div className="space-y-3 max-h-[660px] overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No products match the selected filter.
              </div>
            ) : (
              filteredItems.map((item) => {
                const itemKey = `${item.sourceType}_${item.id}`;
                const editState = editingPrices[itemKey] || {
                  priceLkr: String(item.priceLkrVal || ""),
                  priceUsd: String(item.priceUsdVal || ""),
                };
                const isSaving = savingId === itemKey;

                return (
                  <div
                    key={itemKey}
                    className={`p-4 rounded-2xl border transition-all ${
                      item.active
                        ? "bg-white border-[#ECEEF8] hover:border-purple-200 shadow-2xs"
                        : "bg-slate-50/80 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Product Info & Source Badge */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-[#5B42F3]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-black text-[#181432] truncate">
                              {item.displayTitle}
                            </h4>
                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {item.displayCat}
                            </span>
                            <Badge className="text-[9px] font-black bg-purple-100 text-[#5B42F3] border-none uppercase">
                              {item.sourceType}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                            <span>Stock: <b className="text-slate-800">{item.stock}</b></span>
                            <span>•</span>
                            <span>Live: <b className="text-emerald-600">Rs. {item.priceLkrVal?.toLocaleString()}</b> (${item.priceUsdVal})</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Action Controls */}
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        {/* Quick Price Inputs */}
                        <div className="flex items-center gap-1.5 bg-[#FAF9FE] p-1.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400">Rs.</span>
                          <input
                            type="number"
                            value={editState.priceLkr}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingPrices((prev) => ({
                                ...prev,
                                [itemKey]: {
                                  priceLkr: val,
                                  priceUsd: (Number(val) / 305.5).toFixed(2),
                                },
                              }));
                            }}
                            className="w-16 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#5B42F3]"
                          />

                          <Button
                            size="sm"
                            disabled={isSaving}
                            onClick={() => handleSavePrice(item)}
                            className="h-6 px-2 text-[10px] font-bold bg-[#5B42F3] hover:bg-[#4532B8] text-white rounded-lg"
                          >
                            {isSaving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Save"}
                          </Button>
                        </div>

                        {/* Telegram Visibility Toggle */}
                        <div className="flex items-center gap-1.5" title="Toggle Show on Telegram Bot">
                          <button
                            type="button"
                            onClick={() => handleToggleTelegram(item)}
                            className={`p-1.5 rounded-xl border transition-all ${
                              item.telegram
                                ? "bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100"
                                : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Store Active Toggle Switch */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500">
                            {item.active ? "Active" : "Hidden"}
                          </span>
                          <Switch
                            checked={item.active}
                            onCheckedChange={() => handleToggleActive(item)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

