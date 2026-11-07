import { useState, useRef, useEffect, useMemo } from "react";
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
  Layers,
  GripVertical,
  SlidersHorizontal,
  Save,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  ShoppingBag,
  Zap,
  Hand
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

  // View Mode: 'editor' (interactive drag & drop on phone) vs 'preview' (live iframe)
  const [phoneMode, setPhoneMode] = useState<"editor" | "preview">("editor");

  // Search & Catalog Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<"all" | "products" | "tunvn" | "sandromania" | "cssx">("all");

  // Inline Editing State (map of id -> { priceLkr, priceUsd })
  const [editingPrices, setEditingPrices] = useState<Record<string, { priceLkr: string; priceUsd: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Custom Order State (ordered array of item keys: 'sourceType_id')
  const [orderedItemKeys, setOrderedItemKeys] = useState<string[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Drag and Drop State
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

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

  // Fetch saved catalog custom order from settings
  const { data: savedOrderSetting } = useQuery<{ key: string; value: string }>({
    queryKey: ["/api/settings/CATALOG_CUSTOM_ORDER"],
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
  const unifiedItems = useMemo(() => {
    return [
      ...standardProducts.map((p) => ({
        ...p,
        sourceType: "standard",
        itemKey: `standard_${p.id}`,
        displayTitle: p.name,
        displayCat: p.type || "Cloud",
        priceLkrVal: p.priceLkr || Math.round(((p.price || 0) / 100) * 305.5),
        priceUsdVal: ((p.price || 0) / 100).toFixed(2),
        active: p.isActive !== false,
        telegram: p.showOnTelegram !== false,
        stock: p.stockCount ?? 0,
        badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      })),
      ...tunvnProducts.map((t) => ({
        ...t,
        sourceType: "tunvn",
        itemKey: `tunvn_${t.id}`,
        displayTitle: t.title,
        displayCat: t.category || "Subscriptions",
        priceLkrVal: t.sellingPriceLkr || Math.round(((t.sellingPriceUsd || 0) / 100) * 305.5),
        priceUsdVal: ((t.sellingPriceUsd || 0) / 100).toFixed(2),
        active: t.isActive !== false,
        telegram: t.showOnTelegram !== false,
        stock: t.stock ?? 0,
        badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      })),
      ...sandromaniaProducts.map((s) => ({
        ...s,
        sourceType: "sandromania",
        itemKey: `sandromania_${s.id}`,
        displayTitle: s.title,
        displayCat: s.category || "Digital Goods",
        priceLkrVal: s.sellingPriceLkr || Math.round(((s.sellingPriceUsd || 0) / 100) * 305.5),
        priceUsdVal: ((s.sellingPriceUsd || 0) / 100).toFixed(2),
        active: s.isActive !== false,
        telegram: s.showOnTelegram !== false,
        stock: s.stock ?? 0,
        badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      })),
      ...cssxProducts.map((c) => ({
        ...c,
        sourceType: "cssx",
        itemKey: `cssx_${c.id}`,
        displayTitle: c.title,
        displayCat: c.category || "CDK License",
        priceLkrVal: c.sellingPriceLkr || Math.round(((c.sellingPriceUsd || 0) / 100) * 305.5),
        priceUsdVal: ((c.sellingPriceUsd || 0) / 100).toFixed(2),
        active: c.isActive !== false,
        telegram: c.showOnTelegram !== false,
        stock: c.stock ?? 0,
        badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      })),
    ];
  }, [standardProducts, tunvnProducts, sandromaniaProducts, cssxProducts]);

  // Synchronize ordered keys when items or saved order load
  useEffect(() => {
    if (unifiedItems.length === 0) return;

    let initialKeys: string[] = [];
    try {
      const raw = savedOrderSetting?.value || localStorage.getItem("youuhost_catalog_custom_order");
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialKeys = parsed;
        }
      }
    } catch {}

    // Build complete keys list preserving custom order then appending any new items
    const existingKeys = new Set(initialKeys);
    const allCurrentKeys = unifiedItems.map((i) => i.itemKey);
    const missingKeys = allCurrentKeys.filter((k) => !existingKeys.has(k));
    const mergedKeys = [...initialKeys.filter((k) => allCurrentKeys.includes(k)), ...missingKeys];

    if (orderedItemKeys.length === 0) {
      setOrderedItemKeys(mergedKeys);
    }
  }, [unifiedItems, savedOrderSetting]);

  // Re-sorted items according to orderedItemKeys
  const orderedItems = useMemo(() => {
    if (orderedItemKeys.length === 0) return unifiedItems;
    const orderMap = new Map<string, number>();
    orderedItemKeys.forEach((key, idx) => orderMap.set(key, idx));

    return [...unifiedItems].sort((a, b) => {
      const idxA = orderMap.has(a.itemKey) ? orderMap.get(a.itemKey)! : 9999;
      const idxB = orderMap.has(b.itemKey) ? orderMap.get(b.itemKey)! : 9999;
      return idxA - idxB;
    });
  }, [unifiedItems, orderedItemKeys]);

  // Filtered items based on partner filter and search
  const filteredItems = useMemo(() => {
    return orderedItems.filter((item) => {
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
  }, [orderedItems, partnerFilter, searchQuery]);

  // Reorder Handler: moves item from sourceKey to targetKey
  const moveItem = (sourceKey: string, targetKey: string) => {
    if (sourceKey === targetKey) return;
    setOrderedItemKeys((prevKeys) => {
      const currentList = prevKeys.length > 0 ? [...prevKeys] : unifiedItems.map((i) => i.itemKey);
      const fromIndex = currentList.indexOf(sourceKey);
      const toIndex = currentList.indexOf(targetKey);
      if (fromIndex === -1 || toIndex === -1) return prevKeys;

      const updated = [...currentList];
      const [removed] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, removed);

      setHasUnsavedChanges(true);
      return updated;
    });
  };

  // Reorder: Move up / down by 1 index
  const shiftItemIndex = (itemKey: string, direction: "up" | "down" | "top" | "bottom") => {
    setOrderedItemKeys((prevKeys) => {
      const currentList = prevKeys.length > 0 ? [...prevKeys] : unifiedItems.map((i) => i.itemKey);
      const idx = currentList.indexOf(itemKey);
      if (idx === -1) return prevKeys;

      const updated = [...currentList];
      if (direction === "up" && idx > 0) {
        const [removed] = updated.splice(idx, 1);
        updated.splice(idx - 1, 0, removed);
      } else if (direction === "down" && idx < updated.length - 1) {
        const [removed] = updated.splice(idx, 1);
        updated.splice(idx + 1, 0, removed);
      } else if (direction === "top" && idx > 0) {
        const [removed] = updated.splice(idx, 1);
        updated.unshift(removed);
      } else if (direction === "bottom" && idx < updated.length - 1) {
        const [removed] = updated.splice(idx, 1);
        updated.push(removed);
      }

      setHasUnsavedChanges(true);
      return updated;
    });
  };

  // Save Custom Catalog Order to Database & LocalStorage
  const handleSaveCatalogOrder = async () => {
    setIsSavingOrder(true);
    try {
      const orderToSave = orderedItemKeys.length > 0 ? orderedItemKeys : unifiedItems.map((i) => i.itemKey);
      const jsonValue = JSON.stringify(orderToSave);

      await apiRequest("POST", "/api/settings", {
        key: "CATALOG_CUSTOM_ORDER",
        value: jsonValue,
      });

      localStorage.setItem("youuhost_catalog_custom_order", jsonValue);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/CATALOG_CUSTOM_ORDER"] });

      setHasUnsavedChanges(false);
      handleRefreshIframe();

      toast({
        title: "Store Catalog Order Saved! 🚀",
        description: `Successfully updated order for ${orderToSave.length} products on the live mobile store.`,
      });
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to persist catalog order.",
        variant: "destructive",
      });
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Reset to Default Order
  const handleResetOrder = () => {
    const defaultKeys = unifiedItems.map((i) => i.itemKey);
    setOrderedItemKeys(defaultKeys);
    setHasUnsavedChanges(true);
    toast({
      title: "Order Reset to Default",
      description: "Click 'Save & Apply to Live Store' to apply this order.",
    });
  };

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, key: string) => {
    setDraggedKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverKey !== key) {
      setDragOverKey(key);
    }
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const sourceKey = draggedKey || e.dataTransfer.getData("text/plain");
    if (sourceKey && targetKey && sourceKey !== targetKey) {
      moveItem(sourceKey, targetKey);
    }
    setDraggedKey(null);
    setDragOverKey(null);
  };

  const handleDragEnd = () => {
    setDraggedKey(null);
    setDragOverKey(null);
  };

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
    const edit = editingPrices[item.itemKey];
    if (!edit) return;

    setSavingId(item.itemKey);
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
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-4 sm:p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-900/40">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-[#5B42F3]/30 rounded-2xl border border-indigo-500/30">
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Live Store & Mobile Editor
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                  DRAG & REORDER ENABLED
                </Badge>
              </h1>
              <p className="text-slate-300 text-xs mt-0.5">
                Drag and drop products right on the phone screen to reorder catalog items live for all customers.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
          {hasUnsavedChanges && (
            <Button
              size="sm"
              onClick={handleSaveCatalogOrder}
              disabled={isSavingOrder}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-lg animate-pulse"
            >
              {isSavingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save Order Changes
            </Button>
          )}

          <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 flex items-center gap-1">
            <button
              onClick={() => setDeviceType("iphone")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                deviceType === "iphone" ? "bg-[#5B42F3] text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              iPhone
            </button>
            <button
              onClick={() => setDeviceType("android")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                deviceType === "android" ? "bg-[#5B42F3] text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Galaxy
            </button>
            <button
              onClick={() => setDeviceType("compact")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                deviceType === "compact" ? "bg-[#5B42F3] text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Compact
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => window.open("/", "_blank")}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open</span> Store
          </Button>
        </div>
      </div>

      {/* Main 2-Column Grid: Left Phone Mockup | Right Catalog Reorder Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Realistic Interactive Phone Screen Mockup */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-xl relative min-h-[860px]">
          {/* Phone Top Control Bar */}
          <div className="flex items-center justify-between w-full mb-3 px-2 flex-wrap gap-2">
            {/* View Mode Switcher: Interactive Drag Editor vs Live Iframe */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setPhoneMode("editor")}
                className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                  phoneMode === "editor"
                    ? "bg-[#5B42F3] text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                Interactive Drag Mode
              </button>
              <button
                onClick={() => setPhoneMode("preview")}
                className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                  phoneMode === "preview"
                    ? "bg-[#5B42F3] text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Live Preview
              </button>
            </div>

            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-800/40 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {currentDevice.label}
            </span>
          </div>

          {/* Smartphone Hardware Frame Mockup */}
          <div
            className={`relative bg-black shadow-2xl ${currentDevice.border} ${currentDevice.radius} overflow-hidden transition-all duration-300`}
            style={{ width: `${currentDevice.width}px`, height: `${currentDevice.height}px` }}
          >
            {/* Dynamic Island / Camera Notch */}
            <div className="absolute top-2 inset-x-0 mx-auto w-28 h-6 bg-black rounded-full z-30 flex items-center justify-end pr-2.5 shadow-md pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full bg-[#111] border border-slate-800 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-blue-900/60" />
              </div>
            </div>

            {/* Simulated Glass Reflection */}
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.05] pointer-events-none z-20" />

            {/* SCREEN CONTENT: EITHER INTERACTIVE DRAG-AND-DROP CATALOG OR LIVE IFRAME */}
            {phoneMode === "editor" ? (
              <div className="w-full h-full bg-[#0F0E17] text-white flex flex-col overflow-hidden select-none">
                {/* Simulated Mobile Top Navigation Bar */}
                <div className="pt-8 px-4 pb-3 bg-gradient-to-b from-[#181432] to-[#0F0E17] border-b border-white/5 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">YouuHost Store</p>
                      <h3 className="text-base font-black text-white flex items-center gap-1.5">
                        Interactive Catalog
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full font-bold">
                          Drag Any Card
                        </span>
                      </h3>
                    </div>
                    {hasUnsavedChanges && (
                      <Button
                        size="sm"
                        onClick={handleSaveCatalogOrder}
                        disabled={isSavingOrder}
                        className="h-7 px-2.5 text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                      >
                        {isSavingOrder ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                        Apply
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                    <Hand className="w-3 h-3 text-purple-400" />
                    Hold and drag cards up/down, or tap arrows to reorder.
                  </p>
                </div>

                {/* Interactive Drag & Drop Product Cards Scroll View */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-12 custom-scrollbar">
                  {filteredItems.map((item, index) => {
                    const isDragging = draggedKey === item.itemKey;
                    const isOver = dragOverKey === item.itemKey;

                    return (
                      <div
                        key={item.itemKey}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.itemKey)}
                        onDragOver={(e) => handleDragOver(e, item.itemKey)}
                        onDrop={(e) => handleDrop(e, item.itemKey)}
                        onDragEnd={handleDragEnd}
                        className={`group relative rounded-2xl p-3 border transition-all duration-200 cursor-grab active:cursor-grabbing ${
                          isDragging
                            ? "opacity-40 scale-95 border-purple-500 bg-purple-950/40 shadow-2xl"
                            : isOver
                            ? "border-amber-400 bg-amber-950/30 scale-[1.02] shadow-lg shadow-amber-500/20"
                            : item.active
                            ? "bg-gradient-to-r from-slate-900/90 to-slate-950/90 border-white/10 hover:border-purple-500/40"
                            : "bg-slate-950/60 border-slate-800/60 opacity-60"
                        }`}
                      >
                        {/* Drag Handle & Order Badge */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="p-1 text-gray-400 group-hover:text-purple-400 transition-colors">
                              <GripVertical className="w-4 h-4" />
                            </span>
                            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-[10px] font-black flex items-center justify-center">
                              #{index + 1}
                            </span>
                            <Badge className={`text-[9px] font-black px-1.5 py-0 border ${item.badgeColor}`}>
                              {item.sourceType.toUpperCase()}
                            </Badge>
                          </div>

                          {/* Quick Up / Down Reorder Buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                shiftItemIndex(item.itemKey, "top");
                              }}
                              title="Move to Very Top"
                              className="p-1 rounded-md bg-white/5 hover:bg-purple-600/40 text-gray-400 hover:text-white text-[9px] transition-colors"
                            >
                              <ChevronsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                shiftItemIndex(item.itemKey, "up");
                              }}
                              disabled={index === 0}
                              title="Move Up"
                              className="p-1 rounded-md bg-white/5 hover:bg-purple-600/40 text-gray-400 hover:text-white text-[9px] transition-colors disabled:opacity-30"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                shiftItemIndex(item.itemKey, "down");
                              }}
                              disabled={index === filteredItems.length - 1}
                              title="Move Down"
                              className="p-1 rounded-md bg-white/5 hover:bg-purple-600/40 text-gray-400 hover:text-white text-[9px] transition-colors disabled:opacity-30"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title and Category */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-white truncate leading-snug">
                              {item.displayTitle}
                            </h4>
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                              {item.displayCat} • Stock: <span className="text-white font-bold">{item.stock}</span>
                            </p>
                          </div>

                          {/* Active Toggle Switch right on card */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] font-bold text-gray-400">
                              {item.active ? "ON" : "OFF"}
                            </span>
                            <Switch
                              checked={item.active}
                              onCheckedChange={() => handleToggleActive(item)}
                              className="scale-75 origin-right"
                            />
                          </div>
                        </div>

                        {/* Price Badge and Direct Live Edit */}
                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-emerald-400 font-mono">
                            Rs. {item.priceLkrVal?.toLocaleString()}{" "}
                            <span className="text-gray-400 font-normal text-[10px]">(${item.priceUsdVal})</span>
                          </span>

                          <span className="text-[9px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 font-bold">
                            Live on Store
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Live Iframe Mode */
              <iframe
                ref={iframeRef}
                key={iframeKey}
                src="/"
                title="YouuHost Live Mobile Preview"
                className="w-full h-full bg-white select-none border-none"
                style={{ width: "100%", height: "100%" }}
              />
            )}

            {/* Bottom Home Indicator Bar */}
            <div className="absolute bottom-1.5 inset-x-0 mx-auto w-32 h-1 bg-white/40 rounded-full z-30 pointer-events-none" />
          </div>
        </div>

        {/* Right Column: Live Catalog Controller & Reorder Organizer */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-4 sm:p-6 border border-[#ECEEF8] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#181432] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#5B42F3]" />
                Catalog Controller & Drag-to-Reorder
              </h2>
              <p className="text-xs text-[#7E7998] mt-0.5">
                Drag cards with handle or use Up/Down arrows to customize store order. Changes sync live to the customer mini app!
              </p>
            </div>

            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <Button
                  size="sm"
                  onClick={handleSaveCatalogOrder}
                  disabled={isSavingOrder}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-md"
                >
                  {isSavingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  Save Order
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={handleResetOrder}
                className="text-xs font-bold text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset Order
              </Button>
            </div>
          </div>

          {/* Partner & Category Filter Tabs */}
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

          {/* Product Items List with Drag & Drop and Instant Controls */}
          <div className="space-y-3 max-h-[660px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No products match the selected filter.
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const editState = editingPrices[item.itemKey] || {
                  priceLkr: String(item.priceLkrVal || ""),
                  priceUsd: String(item.priceUsdVal || ""),
                };
                const isSaving = savingId === item.itemKey;
                const isDragging = draggedKey === item.itemKey;
                const isOver = dragOverKey === item.itemKey;

                return (
                  <div
                    key={item.itemKey}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.itemKey)}
                    onDragOver={(e) => handleDragOver(e, item.itemKey)}
                    onDrop={(e) => handleDrop(e, item.itemKey)}
                    onDragEnd={handleDragEnd}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-grab active:cursor-grabbing ${
                      isDragging
                        ? "opacity-40 scale-98 border-purple-400 bg-purple-50"
                        : isOver
                        ? "border-amber-400 bg-amber-50/60 shadow-md"
                        : item.active
                        ? "bg-white border-[#ECEEF8] hover:border-purple-200 shadow-2xs"
                        : "bg-slate-50/80 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Drag Handle, Position Index, & Product Info */}
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {/* Drag Handle & Reorder Arrows */}
                        <div className="flex items-center gap-1 shrink-0 pt-1 sm:pt-0">
                          <span className="p-1 text-slate-400 hover:text-purple-600 transition-colors" title="Drag to reorder">
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-black flex items-center justify-center">
                            #{index + 1}
                          </span>
                          <div className="flex flex-col -space-y-1">
                            <button
                              type="button"
                              onClick={() => shiftItemIndex(item.itemKey, "up")}
                              disabled={index === 0}
                              className="text-slate-400 hover:text-purple-600 p-0.5 disabled:opacity-20"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => shiftItemIndex(item.itemKey, "down")}
                              disabled={index === filteredItems.length - 1}
                              className="text-slate-400 hover:text-purple-600 p-0.5 disabled:opacity-20"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Product Title & Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black text-[#181432] truncate">
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
                      <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
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
                                [item.itemKey]: {
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
