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
  Hand,
  Sliders,
  Wallet,
  User as UserIcon,
  MessageCircle,
  Clock,
  LayoutGrid,
  Move
} from "lucide-react";
import { 
  FaAws, 
  FaSpotify, 
  FaYoutube, 
  FaInstagram, 
  FaFacebook, 
  FaTiktok, 
  FaTelegramPlane, 
  FaLinode, 
  FaWindows 
} from "react-icons/fa";
import { SiCanva, SiOpenai, SiGooglegemini, SiClaude, SiDigitalocean } from "react-icons/si";
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

  // Phone Mockup Mode: 'customerStore' (exact original customer UI with live touch & drag reorder) vs 'liveIframe'
  const [phoneMode, setPhoneMode] = useState<"customerStore" | "liveIframe">("customerStore");

  // Search & Catalog Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<"all" | "facebook" | "tunvn" | "products" | "sandromania" | "cssx">("all");
  const [storeCategoryFilter, setStoreCategoryFilter] = useState<string>("all");

  // Inline Editing State (map of id -> { priceLkr, priceUsd })
  const [editingPrices, setEditingPrices] = useState<Record<string, { priceLkr: string; priceUsd: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Custom Order State (ordered array of item keys: 'sourceType_id')
  const [orderedItemKeys, setOrderedItemKeys] = useState<string[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  // Drag and Drop State
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Touch tracking ref
  const activeTouchItemKey = useRef<string | null>(null);

  // 1. Fetch Standard Products
  const { data: standardProducts = [], isLoading: loadingProducts, refetch: refetchProducts } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  // 2. Fetch TunVN MMO Products (CapCut)
  const { data: tunvnProducts = [], isLoading: loadingTunvn, refetch: refetchTunvn } = useQuery<any[]>({
    queryKey: ["/api/admin/tunvn/products"],
  });

  // 3. Fetch Sandromania Products
  const { data: sandromaniaProducts = [], isLoading: loadingSandro, refetch: refetchSandro } = useQuery<any[]>({
    queryKey: ["/api/admin/sandromania/products"],
  });

  // 4. Fetch CSxStore Products
  const { data: cssxProducts = [], isLoading: loadingCssx, refetch: refetchCssx } = useQuery<any[]>({
    queryKey: ["/api/admin/cssx/products"],
  });

  // 5. Fetch SMM Services (Facebook, Instagram, TikTok, etc.)
  const { data: smmServices = [], isLoading: loadingSmm, refetch: refetchSmm } = useQuery<any[]>({
    queryKey: ["/api/mini/smm/services"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/mini/smm/services");
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
  });

  // 6. Fetch saved catalog custom order
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
    iphone: { label: "iPhone 15 Pro", radius: "rounded-[44px]", border: "border-[10px] sm:border-[12px] border-[#1C1C1E]" },
    android: { label: "Galaxy S24", radius: "rounded-[40px]", border: "border-[8px] sm:border-[10px] border-[#2C2C2E]" },
    compact: { label: "Compact SE", radius: "rounded-[34px]", border: "border-[8px] border-[#1C1C1E]" },
  };

  const currentDevice = deviceDimensions[deviceType];

  // Helper to determine brand icon
  const getProductIcon = (title: string = "", category: string = "", sourceType: string = "") => {
    const combined = `${title} ${category} ${sourceType}`.toLowerCase();
    if (combined.includes("facebook") || combined.includes("fb")) {
      return <FaFacebook className="w-5 h-5 text-[#1877F2]" />;
    }
    if (combined.includes("capcut")) {
      return <img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/capcut-icon.png" alt="CapCut" className="w-5 h-5 object-contain" />;
    }
    if (combined.includes("youtube")) {
      return <FaYoutube className="w-5 h-5 text-[#FF0000]" />;
    }
    if (combined.includes("canva")) {
      return <SiCanva className="w-5 h-5 text-[#00C4CC]" />;
    }
    if (combined.includes("hotmail") || combined.includes("outlook")) {
      return <img src="/assets/hotmail.png" alt="Hotmail" className="w-5 h-5 object-contain" />;
    }
    if (combined.includes("aws")) {
      return <FaAws className="w-5 h-5 text-[#FF9900]" />;
    }
    if (combined.includes("digitalocean")) {
      return <SiDigitalocean className="w-5 h-5 text-[#0080FF]" />;
    }
    if (combined.includes("gemini")) {
      return <SiGooglegemini className="w-5 h-5 text-[#1BA0E2]" />;
    }
    if (combined.includes("chatgpt") || combined.includes("openai")) {
      return <SiOpenai className="w-5 h-5 text-[#10A37F]" />;
    }
    if (combined.includes("spotify")) {
      return <FaSpotify className="w-5 h-5 text-[#1DB954]" />;
    }
    if (combined.includes("instagram")) {
      return <FaInstagram className="w-5 h-5 text-[#E1306C]" />;
    }
    if (combined.includes("tiktok")) {
      return <FaTiktok className="w-5 h-5 text-black" />;
    }
    if (combined.includes("telegram")) {
      return <FaTelegramPlane className="w-5 h-5 text-[#24A1DE]" />;
    }
    if (combined.includes("windows")) {
      return <FaWindows className="w-5 h-5 text-[#0078D7]" />;
    }
    return <Package className="w-5 h-5 text-[#5B42F3]" />;
  };

  // Combine and normalize all catalog items across all partners & SMM
  const unifiedItems = useMemo(() => {
    return [
      // 1. SMM Services (Facebook Video Views, Facebook Views, etc.)
      ...smmServices.map((s) => {
        const isFb = s.category?.toLowerCase().includes("facebook") || s.name?.toLowerCase().includes("facebook") || s.name?.toLowerCase().includes("fb");
        const rateLkr = s.customRateLkr || Math.round(((s.customRate || s.rate || 0) / 1000) * 305.5);
        const rateUsd = ((s.customRate || s.rate || 0) / 1000).toFixed(2);
        return {
          ...s,
          sourceType: "smm",
          itemKey: `smm_${s.id}`,
          displayTitle: s.name,
          displayCat: isFb ? "Facebook" : (s.category || "Social Boost"),
          isFacebook: isFb,
          priceLkrVal: rateLkr,
          priceUsdVal: rateUsd,
          active: s.isActive !== false,
          telegram: true,
          stock: "Instant API",
          badgeColor: isFb ? "bg-blue-600/10 text-[#1877F2] border-blue-500/30" : "bg-purple-500/10 text-purple-400 border-purple-500/20",
        };
      }),
      // 2. Direct Cloud & Accounts (Hotmail, AWS, Gemini, Canva, YouTube)
      ...standardProducts.map((p) => {
        const isFb = p.name?.toLowerCase().includes("facebook") || p.type?.toLowerCase().includes("facebook") || p.name?.toLowerCase().includes("fb");
        const isActive = p.status !== "disabled" && p.isActive !== false;
        return {
          ...p,
          sourceType: "standard",
          itemKey: `standard_${p.id}`,
          displayTitle: p.name,
          displayCat: p.type || "Cloud",
          isFacebook: isFb,
          priceLkrVal: p.priceLkr || Math.round(((p.price || 0) / 100) * 305.5),
          priceUsdVal: ((p.price || 0) / 100).toFixed(2),
          active: isActive,
          telegram: p.showOnTelegram !== false,
          stock: p.stockCount ?? 0,
          badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        };
      }),
      // 3. TunVN MMO (CapCut Pro)
      ...tunvnProducts.map((t) => ({
        ...t,
        sourceType: "tunvn",
        itemKey: `tunvn_${t.id}`,
        displayTitle: t.title,
        displayCat: t.category || "Subscriptions",
        isFacebook: false,
        priceLkrVal: t.sellingPriceLkr || Math.round(((t.sellingPriceUsd || 0) / 100) * 305.5),
        priceUsdVal: ((t.sellingPriceUsd || 0) / 100).toFixed(2),
        active: t.isActive !== false,
        telegram: t.showOnTelegram !== false,
        stock: t.stock ?? 0,
        badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      })),
      // 4. Sandromania
      ...sandromaniaProducts.map((s) => {
        const isFb = s.title?.toLowerCase().includes("facebook") || s.category?.toLowerCase().includes("facebook");
        return {
          ...s,
          sourceType: "sandromania",
          itemKey: `sandromania_${s.id}`,
          displayTitle: s.title,
          displayCat: s.category || "Digital Goods",
          isFacebook: isFb,
          priceLkrVal: s.sellingPriceLkr || Math.round(((s.sellingPriceUsd || 0) / 100) * 305.5),
          priceUsdVal: ((s.sellingPriceUsd || 0) / 100).toFixed(2),
          active: s.isActive !== false,
          telegram: s.showOnTelegram !== false,
          stock: s.stock ?? 0,
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      }),
      // 5. CSxStore
      ...cssxProducts.map((c) => ({
        ...c,
        sourceType: "cssx",
        itemKey: `cssx_${c.id}`,
        displayTitle: c.title,
        displayCat: c.category || "CDK License",
        isFacebook: false,
        priceLkrVal: c.sellingPriceLkr || Math.round(((c.sellingPriceUsd || 0) / 100) * 305.5),
        priceUsdVal: ((c.sellingPriceUsd || 0) / 100).toFixed(2),
        active: c.isActive !== false,
        telegram: c.showOnTelegram !== false,
        stock: c.stock ?? 0,
        badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      })),
    ];
  }, [smmServices, standardProducts, tunvnProducts, sandromaniaProducts, cssxProducts]);

  // Synchronize ordered keys
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

  // Filtered items based on partner filter, store category, and search query
  const filteredItems = useMemo(() => {
    return orderedItems.filter((item) => {
      // 1. Partner Filter
      if (partnerFilter !== "all") {
        if (partnerFilter === "facebook" && !item.isFacebook) return false;
        if (partnerFilter === "tunvn" && item.sourceType !== "tunvn") return false;
        if (partnerFilter === "products" && item.sourceType !== "standard") return false;
        if (partnerFilter === "sandromania" && item.sourceType !== "sandromania") return false;
        if (partnerFilter === "cssx" && item.sourceType !== "cssx") return false;
      }

      // 2. Store Category Pill Filter (Inside phone screen)
      if (storeCategoryFilter !== "all") {
        const cat = storeCategoryFilter.toLowerCase();
        const itemCombined = `${item.displayTitle} ${item.displayCat} ${item.sourceType}`.toLowerCase();
        if (cat === "facebook" || cat === "fb") {
          if (!item.isFacebook && !itemCombined.includes("facebook") && !itemCombined.includes("fb")) return false;
        } else if (!itemCombined.includes(cat)) {
          return false;
        }
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.displayTitle || "").toLowerCase().includes(q);
        const matchCat = (item.displayCat || "").toLowerCase().includes(q);
        return matchTitle || matchCat;
      }
      return true;
    });
  }, [orderedItems, partnerFilter, storeCategoryFilter, searchQuery]);

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

      if (autoSync) {
        debouncedAutoSave(updated);
      }
      return updated;
    });
  };

  // Reorder: Shift by index
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

      if (autoSync) {
        debouncedAutoSave(updated);
      }
      return updated;
    });
  };

  // Auto-save debouncer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedAutoSave = (keysToSave: string[]) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const jsonValue = JSON.stringify(keysToSave);
        await apiRequest("POST", "/api/settings", {
          key: "CATALOG_CUSTOM_ORDER",
          value: jsonValue,
        });
        localStorage.setItem("youuhost_catalog_custom_order", jsonValue);
        queryClient.invalidateQueries({ queryKey: ["/api/settings/CATALOG_CUSTOM_ORDER"] });
        setHasUnsavedChanges(false);
      } catch (e) {
        console.error("Auto-sync error:", e);
      }
    }, 1200);
  };

  // Save Custom Catalog Order Manually
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
        title: "Store Order Saved! 🚀",
        description: `Successfully applied custom order for ${orderToSave.length} products to customer live store.`,
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
    if (autoSync) debouncedAutoSave(defaultKeys);
    toast({
      title: "Order Reset to Default",
      description: "Default order restored and synced to store.",
    });
  };

  // HTML5 Drag Handlers
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

  // TRUE TOUCH DRAG & DROP FOR MOBILE PHONES
  // Uses document.elementFromPoint to find whichever card is under the user's finger!
  const handleTouchStart = (e: React.TouchEvent, itemKey: string) => {
    activeTouchItemKey.current = itemKey;
    setDraggedKey(itemKey);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!activeTouchItemKey.current) return;
    const touch = e.touches[0];
    if (!touch) return;

    // Detect card directly underneath finger on touch screen
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const targetCard = element.closest("[data-item-key]");
    if (targetCard) {
      const targetKey = targetCard.getAttribute("data-item-key");
      if (targetKey && targetKey !== activeTouchItemKey.current) {
        moveItem(activeTouchItemKey.current, targetKey);
        setDragOverKey(targetKey);
      }
    }
  };

  const handleTouchEnd = () => {
    activeTouchItemKey.current = null;
    setDraggedKey(null);
    setDragOverKey(null);
  };

  // Toggle active status (Fixed bug: maps isActive to status for products & SMM services)
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
      } else if (item.sourceType === "smm") {
        await apiRequest("PATCH", `/api/admin/smm/services/${item.id}/toggle`, { isActive: newActive });
        refetchSmm();
      }

      toast({
        title: newActive ? "Product Visible 🟢" : "Product Hidden 🔴",
        description: `${item.displayTitle} is now ${newActive ? "active" : "hidden"} on live store.`,
      });

      handleRefreshIframe();
    } catch (err: any) {
      toast({
        title: "Toggle Failed",
        description: err.message || "Failed to update item visibility.",
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
        title: "Price Saved! 💰",
        description: `${item.displayTitle}: Rs. ${lkr.toLocaleString()} ($${usd.toFixed(2)})`,
      });

      handleRefreshIframe();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to save price.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  // List of Category Pills for the Phone Mockup
  const storeCategories = [
    { id: "all", label: "All", icon: <LayoutGrid className="w-4 h-4" /> },
    { id: "facebook", label: "Facebook", icon: <FaFacebook className="w-4 h-4 text-[#1877F2]" />, badge: "FB" },
    { id: "capcut", label: "CapCut", icon: <img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/capcut-icon.png" alt="" className="w-4 h-4 object-contain" />, badge: "PRO" },
    { id: "canva", label: "Canva", icon: <SiCanva className="w-4 h-4 text-[#00C4CC]" />, badge: "PRO" },
    { id: "youtube", label: "YouTube", icon: <FaYoutube className="w-4 h-4 text-[#FF0000]" />, badge: "4K" },
    { id: "hotmail", label: "Hotmail", icon: <img src="/assets/hotmail.png" alt="" className="w-4 h-4 object-contain" />, badge: "MAIL" },
    { id: "aws", label: "AWS", icon: <FaAws className="w-4 h-4 text-[#FF9900]" />, badge: "HOT" },
    { id: "gemini", label: "Gemini", icon: <SiGooglegemini className="w-4 h-4 text-[#1BA0E2]" />, badge: "AI" },
    { id: "chatgpt", label: "ChatGPT", icon: <SiOpenai className="w-4 h-4 text-[#10A37F]" />, badge: "AI" },
    { id: "spotify", label: "Spotify", icon: <FaSpotify className="w-4 h-4 text-[#1DB954]" /> },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full pb-16">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-4 sm:p-6 rounded-2xl sm:rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-900/40">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-[#5B42F3]/30 rounded-2xl border border-indigo-500/30">
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2 flex-wrap">
                Live Store & Mobile Editor
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                  MOBILE TOUCH DRAG
                </Badge>
              </h1>
              <p className="text-slate-300 text-xs mt-0.5">
                Exact Customer Store UI with real-time mobile touch dragging and 1-tap reorder arrows.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Sync */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-white/10">
            <span className="text-[11px] font-bold text-gray-300">Auto-Sync</span>
            <Switch
              checked={autoSync}
              onCheckedChange={setAutoSync}
              className="scale-75"
            />
          </div>

          {hasUnsavedChanges && (
            <Button
              size="sm"
              onClick={handleSaveCatalogOrder}
              disabled={isSavingOrder}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-lg animate-pulse"
            >
              {isSavingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save Order
            </Button>
          )}

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

      {/* Main Grid: Left Real Customer Phone UI | Right Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Smartphone Mockup with Real Customer Store */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-slate-800 shadow-xl relative min-h-[780px]">
          {/* Phone Top Switcher */}
          <div className="flex items-center justify-between w-full mb-3 px-1 sm:px-2 flex-wrap gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setPhoneMode("customerStore")}
                className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                  phoneMode === "customerStore"
                    ? "bg-[#5B42F3] text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                Customer UI (Drag & Reorder)
              </button>
              <button
                onClick={() => setPhoneMode("liveIframe")}
                className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                  phoneMode === "liveIframe"
                    ? "bg-[#5B42F3] text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Iframe
              </button>
            </div>

            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-800/40 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Preview
            </span>
          </div>

          {/* Smartphone Hardware Frame Mockup (Responsive width to fit mobile screens) */}
          <div
            className={`relative bg-[#F8F9FE] shadow-2xl ${currentDevice.border} ${currentDevice.radius} overflow-hidden transition-all duration-300 flex flex-col w-full max-w-[400px] h-[780px] sm:h-[830px]`}
          >
            {/* Dynamic Island Notch */}
            <div className="absolute top-2.5 inset-x-0 mx-auto w-28 h-6 bg-black rounded-full z-40 flex items-center justify-end pr-2.5 shadow-md pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full bg-[#111] border border-slate-800 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-blue-900/60" />
              </div>
            </div>

            {phoneMode === "customerStore" ? (
              /* EXACT ORIGINAL CUSTOMER UI WITH LIVE TOUCH DRAG & DROP */
              <div className="w-full h-full flex flex-col bg-[#F8F9FE] overflow-hidden select-none text-slate-800">
                {/* 1. Mobile Header (Greeting, Logo, Balance) */}
                <div className="pt-9 px-4 pb-3 bg-white border-b border-[#ECEEF8] shrink-0 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-[#5B42F3] tracking-wider uppercase">youuhost</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">Good Afternoon,</p>
                      <h3 className="text-base font-black text-[#181432] leading-tight">Cheak Imesh</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="bg-[#FAF9FE] border border-[#ECEEF8] px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-2xs">
                        <Wallet className="w-3.5 h-3.5 text-[#5B42F3]" />
                        <span className="text-xs font-black text-[#181432] font-mono">Rs. 246</span>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>
                  </div>

                  {/* Search Bar in Phone */}
                  <div className="mt-3 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search cloud servers, accounts, AI..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#F5F4FC] border border-[#ECEEF8] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5B42F3]"
                    />
                  </div>
                </div>

                {/* 2. Scrollable Body: Banners, Categories, and Drag-and-Drop Product Cards */}
                <div 
                  className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 custom-scrollbar pb-16"
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* Category Pills Slider (Including Facebook!) */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {storeCategories.map((cat) => {
                      const isCatActive = storeCategoryFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setStoreCategoryFilter(cat.id)}
                          className={`relative flex flex-col items-center justify-center min-w-[62px] h-[64px] px-2 rounded-2xl transition-all shrink-0 ${
                            isCatActive
                              ? "bg-gradient-to-b from-[#FF5E62] to-[#6C5CE7] text-white shadow-md shadow-[#6C5CE7]/30 scale-102"
                              : "bg-white text-slate-700 shadow-2xs border border-[#ECEEF8] hover:bg-[#F5F4FC]"
                          }`}
                        >
                          {cat.badge && (
                            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[7.5px] font-black uppercase bg-red-500 text-white shadow-xs">
                              {cat.badge}
                            </span>
                          )}
                          <div className="h-5 w-5 flex items-center justify-center mb-1">
                            {cat.icon}
                          </div>
                          <span className="text-[10px] font-black tracking-tight truncate max-w-[56px]">
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Section Title & Reorder Notice */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <h4 className="text-xs font-black text-[#181432] uppercase tracking-wider flex items-center gap-1.5">
                        <Hand className="w-3.5 h-3.5 text-[#5B42F3]" />
                        All Catalog Products
                      </h4>
                      <p className="text-[9.5px] text-slate-500">
                        Hold `Drag` button to move with touch, or use ▲ / ▼ arrows!
                      </p>
                    </div>

                    <Badge className="bg-purple-100 text-[#5B42F3] text-[9.5px] font-bold border-none">
                      {filteredItems.length} items
                    </Badge>
                  </div>

                  {/* PRODUCT CARDS LIST - AUTHENTIC CUSTOMER CARD DESIGN WITH MOBILE TOUCH DRAG */}
                  {filteredItems.map((item, index) => {
                    const isDragging = draggedKey === item.itemKey;
                    const isOver = dragOverKey === item.itemKey;

                    return (
                      <div
                        key={item.itemKey}
                        data-item-key={item.itemKey}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.itemKey)}
                        onDragOver={(e) => handleDragOver(e, item.itemKey)}
                        onDrop={(e) => handleDrop(e, item.itemKey)}
                        onDragEnd={handleDragEnd}
                        className={`relative bg-white rounded-2xl p-3.5 border transition-all duration-150 shadow-2xs ${
                          isDragging
                            ? "opacity-40 scale-95 border-purple-500 bg-purple-50/50 shadow-2xl"
                            : isOver
                            ? "border-[#5B42F3] bg-purple-50/40 scale-[1.02] shadow-md shadow-purple-500/20"
                            : item.active
                            ? "border-[#ECEEF8] hover:border-purple-200"
                            : "opacity-60 bg-slate-50 border-slate-200"
                        }`}
                      >
                        {/* Top Card Bar: Brand Icon, Order Index, Drag Handle & Quick Arrows */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Brand Icon */}
                            <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                              {getProductIcon(item.displayTitle, item.displayCat, item.sourceType)}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded-md bg-purple-50 text-[#5B42F3]">
                                  #{index + 1}
                                </span>
                                <span className="text-[9px] font-black uppercase text-slate-400 truncate">
                                  {item.sourceType}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* TACTILE MOBILE TOUCH DRAG & INSTANT 1-TAP REORDER BUTTONS */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Dedicated Touch Drag Button with touch-action: none */}
                            <div
                              onTouchStart={(e) => handleTouchStart(e, item.itemKey)}
                              className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-[#5B42F3] rounded-lg text-[9px] font-black flex items-center gap-1 cursor-grab active:cursor-grabbing border border-purple-300 shadow-2xs select-none touch-none"
                              style={{ touchAction: "none" }}
                              title="Hold and drag with finger"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                              <span>Drag</span>
                            </div>

                            {/* Up / Down Instant Tap Buttons */}
                            <button
                              type="button"
                              onClick={() => shiftItemIndex(item.itemKey, "top")}
                              title="Move to Very Top"
                              className="p-1 rounded-md bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-[#5B42F3] active:scale-90"
                            >
                              <ChevronsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => shiftItemIndex(item.itemKey, "up")}
                              disabled={index === 0}
                              title="Move Up"
                              className="p-1 rounded-md bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-[#5B42F3] disabled:opacity-30 active:scale-90"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => shiftItemIndex(item.itemKey, "down")}
                              disabled={index === filteredItems.length - 1}
                              title="Move Down"
                              className="p-1 rounded-md bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-[#5B42F3] disabled:opacity-30 active:scale-90"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Middle Card: Product Title & Badges */}
                        <div className="py-2.5">
                          <h4 className="text-xs font-black text-[#181432] leading-tight line-clamp-2">
                            {item.displayTitle}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                              {item.displayCat}
                            </span>
                            <span>•</span>
                            <span>Stock: <b className="text-slate-800">{item.stock}</b></span>
                          </div>
                        </div>

                        {/* Bottom Card: Live Price & Active Switch */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-black text-[#181432] font-mono">
                              Rs. {Number(item.priceLkrVal || 0).toLocaleString()}
                            </span>{" "}
                            <span className="text-[10px] text-slate-400">
                              (${item.priceUsdVal})
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] font-bold text-slate-500">
                              {item.active ? "Active" : "Hidden"}
                            </span>
                            <Switch
                              checked={item.active}
                              onCheckedChange={() => handleToggleActive(item)}
                              className="scale-75 origin-right"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3. Bottom Customer App Navigation Bar */}
                <div className="h-14 bg-white border-t border-[#ECEEF8] px-4 flex items-center justify-around shrink-0 relative z-30">
                  <div className="flex flex-col items-center text-[#5B42F3]">
                    <ShoppingBag className="w-4 h-4" />
                    <span className="text-[8.5px] font-bold mt-0.5">Store</span>
                  </div>
                  <div className="flex flex-col items-center text-slate-400">
                    <Layers className="w-4 h-4" />
                    <span className="text-[8.5px] font-medium mt-0.5">Categories</span>
                  </div>
                  <div className="flex flex-col items-center text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-[8.5px] font-medium mt-0.5">Orders</span>
                  </div>
                  <div className="flex flex-col items-center text-slate-400">
                    <Wallet className="w-4 h-4" />
                    <span className="text-[8.5px] font-medium mt-0.5">Wallet</span>
                  </div>
                  <div className="flex flex-col items-center text-slate-400">
                    <UserIcon className="w-4 h-4" />
                    <span className="text-[8.5px] font-medium mt-0.5">Profile</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Live Iframe Preview Mode */
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
            <div className="absolute bottom-1 inset-x-0 mx-auto w-32 h-1 bg-slate-300 rounded-full z-40 pointer-events-none" />
          </div>
        </div>

        {/* Right Column: Full Catalog Reorder Controller & Partner Manager */}
        <div className="lg:col-span-6 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#ECEEF8] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#181432] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#5B42F3]" />
                Catalog Controller & Partner Filter
              </h2>
              <p className="text-xs text-[#7E7998] mt-0.5">
                Manage Facebook Video Views, TunVN CapCut, Cloud VPS & Accounts in one unified dashboard.
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
                Reset
              </Button>
            </div>
          </div>

          {/* Partner & Category Filter Tabs - Including Facebook & SMM */}
          <div className="flex items-center gap-1.5 flex-wrap border-b border-[#ECEEF8] pb-3">
            {[
              { id: "all", label: "All Items" },
              { id: "facebook", label: "Facebook & Social (SMM)" },
              { id: "tunvn", label: "TunVN MMO (CapCut)" },
              { id: "products", label: "Cloud & Accounts" },
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

          {/* Search Bar */}
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
                            <span>Live: <b className="text-emerald-600">Rs. {Number(item.priceLkrVal || 0).toLocaleString()}</b> (${item.priceUsdVal})</span>
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
