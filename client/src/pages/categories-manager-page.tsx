import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw,
  Sparkles,
  Tag,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LayoutGrid,
} from "lucide-react";
import { FaAws, FaSpotify, FaYoutube, FaInstagram, FaFacebook, FaTiktok, FaTelegramPlane, FaLinode, FaWindows } from "react-icons/fa";
import { SiDigitalocean, SiGooglecloud, SiOpenai, SiDuolingo, SiGooglegemini, SiClaude, SiCanva } from "react-icons/si";
import { VscAzure } from "react-icons/vsc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface CustomCategoryItem {
  id: string;
  label: string;
  iconType?: string;
  customIconUrl?: string;
  enabled: boolean;
  order: number;
  badgeEnabled?: boolean;
  badgeText?: string;
  badgeColor?: string; // "red" | "purple" | "amber" | "emerald" | "blue" | "pink"
  badgePosition?: "top-right" | "top-left";
}

export const DEFAULT_CATEGORIES: CustomCategoryItem[] = [
  { id: "all", label: "All", iconType: "all", enabled: true, order: 0 },
  { id: "windows", label: "Windows", iconType: "windows", enabled: true, order: 1, badgeEnabled: true, badgeText: "KEY", badgeColor: "blue" },
  { id: "canva", label: "Canva", iconType: "canva", enabled: true, order: 2, badgeEnabled: true, badgeText: "PRO", badgeColor: "pink" },
  { id: "hotmail", label: "Hotmail", iconType: "hotmail", enabled: true, order: 3, badgeEnabled: true, badgeText: "MAIL", badgeColor: "blue" },
  { id: "adobe", label: "Adobe", iconType: "adobe", enabled: true, order: 4, badgeEnabled: true, badgeText: "VIP", badgeColor: "red" },
  { id: "aws", label: "AWS", iconType: "aws", enabled: true, order: 5, badgeEnabled: true, badgeText: "HOT", badgeColor: "red" },
  { id: "digitalocean", label: "DigitalOcean", iconType: "digitalocean", enabled: true, order: 6, badgeEnabled: false, badgeText: "PROMO", badgeColor: "blue" },
  { id: "azure", label: "Azure", iconType: "azure", enabled: true, order: 7, badgeEnabled: true, badgeText: "POPULAR", badgeColor: "purple" },
  { id: "oracle", label: "Oracle", iconType: "oracle", enabled: true, order: 8, badgeEnabled: false, badgeText: "NEW", badgeColor: "amber" },
  { id: "linode", label: "Linode", iconType: "linode", enabled: true, order: 9, badgeEnabled: false, badgeText: "", badgeColor: "emerald" },
  { id: "google", label: "GCP", iconType: "google", enabled: true, order: 10, badgeEnabled: true, badgeText: "PRO", badgeColor: "blue" },
  { id: "telegram", label: "Telegram", iconType: "telegram", enabled: true, order: 11, badgeEnabled: false, badgeText: "", badgeColor: "blue" },
  { id: "spotify", label: "Spotify", iconType: "spotify", enabled: true, order: 12, badgeEnabled: false, badgeText: "MUSIC", badgeColor: "emerald" },
  { id: "youtube", label: "YouTube", iconType: "youtube", enabled: true, order: 13, badgeEnabled: true, badgeText: "4K", badgeColor: "red" },
  { id: "tiktok", label: "TikTok", iconType: "tiktok", enabled: true, order: 14, badgeEnabled: false, badgeText: "", badgeColor: "pink" },
  { id: "instagram", label: "Instagram", iconType: "instagram", enabled: true, order: 15, badgeEnabled: false, badgeText: "", badgeColor: "pink" },
  { id: "facebook", label: "Facebook", iconType: "facebook", enabled: true, order: 16, badgeEnabled: false, badgeText: "", badgeColor: "blue" },
  { id: "chatgpt", label: "ChatGPT", iconType: "chatgpt", enabled: true, order: 17, badgeEnabled: true, badgeText: "AI", badgeColor: "emerald" },
  { id: "gemini", label: "Gemini", iconType: "gemini", enabled: true, order: 18, badgeEnabled: true, badgeText: "AI", badgeColor: "blue" },
  { id: "claude", label: "Claude", iconType: "claude", enabled: true, order: 19, badgeEnabled: true, badgeText: "NEW", badgeColor: "amber" },
  { id: "capcut", label: "CapCut", iconType: "capcut", enabled: true, order: 20, badgeEnabled: true, badgeText: "PRO", badgeColor: "pink" },
  { id: "kamatera", label: "Kamatera", iconType: "kamatera", enabled: true, order: 21, badgeEnabled: false, badgeText: "", badgeColor: "amber" },
  { id: "duolingo", label: "Duolingo", iconType: "duolingo", enabled: true, order: 22, badgeEnabled: false, badgeText: "PRO", badgeColor: "emerald" },
];

export const BADGE_COLOR_STYLES: Record<string, string> = {
  red: "bg-gradient-to-r from-[#FF5E62] to-[#D92078] text-white",
  purple: "bg-gradient-to-r from-[#8A2387] via-[#E94057] to-[#F27121] text-white",
  blue: "bg-gradient-to-r from-[#00C0FF] to-[#4285F4] text-white",
  emerald: "bg-gradient-to-r from-[#10B981] to-[#059669] text-white",
  amber: "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white",
  pink: "bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] text-white",
};

export const renderCategoryBrandIcon = (iconType?: string, customUrl?: string, className = "w-5 h-5") => {
  if (customUrl) {
    return <img src={customUrl} alt="" className={`${className} object-contain rounded-md`} />;
  }
  switch (iconType) {
    case "all": return <LayoutGrid className={className} />;
    case "windows": return <FaWindows className={`${className} text-[#0078D7]`} />;
    case "canva": return <SiCanva className={`${className} text-[#00C4CC]`} />;
    case "hotmail":
    case "outlook":
      return (
        <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
          <path d="M14 6.5h7.5A2.5 2.5 0 0124 9v6a2.5 2.5 0 01-2.5 2.5H14v-11z" fill="#0078D4"/>
          <path d="M14 6.5l-5 4.5v-9l5 4.5z" fill="#106EBE"/>
          <path d="M0 6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V6z" fill="#0078D4"/>
          <circle cx="7" cy="12" r="3" fill="#FFFFFF"/>
          <circle cx="7" cy="12" r="1.5" fill="#0078D4"/>
        </svg>
      );
    case "adobe":
    case "adobe_express":
      return (
        <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
          <path d="M14.5 3h7.5v18l-7.5-18zM9.5 3H2v18l7.5-18zm2.5 9.2l3.8 8.8h-3l-1.3-3.4h-3.4l2.4-5.4h1.5z" fill="#FA0F00"/>
        </svg>
      );
    case "aws": return <FaAws className={`${className} text-[#FF9900]`} />;
    case "digitalocean": return <SiDigitalocean className={`${className} text-[#0080FF]`} />;
    case "azure": return <VscAzure className={`${className} text-[#0089D6]`} />;
    case "oracle": return (
      <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M16.54 4.5H7.46C3.34 4.5 0 7.84 0 11.96c0 4.12 3.34 7.46 7.46 7.46h9.08c4.12 0 7.46-3.34 7.46-7.46 0-4.12-3.34-7.46-7.46-7.46zm-9.08 11.72c-2.35 0-4.26-1.91-4.26-4.26 0-2.35 1.91-4.26 4.26-4.26h9.08c2.35 0 4.26 1.91 4.26 4.26 0 2.35-1.91 4.26-4.26 4.26H7.46z" fill="#F80000" />
      </svg>
    );
    case "linode": return <FaLinode className={`${className} text-[#00A95C]`} />;
    case "google": return <SiGooglecloud className={`${className} text-[#4285F4]`} />;
    case "telegram": return <FaTelegramPlane className={`${className} text-[#24A1DE]`} />;
    case "spotify": return <FaSpotify className={`${className} text-[#1DB954]`} />;
    case "youtube": return <FaYoutube className={`${className} text-[#FF0000]`} />;
    case "tiktok": return <FaTiktok className={`${className} text-black dark:text-white`} />;
    case "instagram": return <FaInstagram className={`${className} text-[#E1306C]`} />;
    case "facebook": return <FaFacebook className={`${className} text-[#1877F2]`} />;
    case "chatgpt": return <SiOpenai className={`${className} text-[#10A37F]`} />;
    case "gemini": return <SiGooglegemini className={`${className} text-[#1BA0E2]`} />;
    case "claude": return <SiClaude className={`${className} text-[#D97757]`} />;
    case "capcut": return <img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/capcut-icon.png" alt="CapCut" className={`${className} object-contain mix-blend-multiply dark:brightness-125`} />;
    case "kamatera": return <img src="/assets/kamatera.png" alt="Kamatera" className={`${className} object-contain`} />;
    case "duolingo": return <SiDuolingo className={`${className} text-[#58CC02]`} />;
    default: return <Tag className={className} />;
  }
};

export default function CategoriesManagerPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"categories" | "productBadges">("categories");
  const [categoriesList, setCategoriesList] = useState<CustomCategoryItem[]>(DEFAULT_CATEGORIES);
  const [productBadges, setProductBadges] = useState<Record<string, { text: string; color: string; enabled: boolean }>>({});
  const [editingCat, setEditingCat] = useState<CustomCategoryItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewActiveId, setPreviewActiveId] = useState<string>("aws");

  const { data: serverData, isLoading } = useQuery<{ categories: CustomCategoryItem[] | null; productBadges?: Record<string, any> }>({
    queryKey: ["/api/admin/categories/config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/categories/config");
      return res.json();
    },
  });

  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  useEffect(() => {
    if (serverData) {
      if (serverData.categories && Array.isArray(serverData.categories) && serverData.categories.length > 0) {
        setCategoriesList(serverData.categories);
      }
      if (serverData.productBadges && typeof serverData.productBadges === "object") {
        setProductBadges(serverData.productBadges);
      }
    }
  }, [serverData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { categories: CustomCategoryItem[]; productBadges: Record<string, any> }) => {
      const res = await fetch("/api/admin/categories/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save categories & badges");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/config"] });
      toast({
        title: "Configuration Saved! 🎉",
        description: "Category buttons and corner angle badges updated live across the Mini-App.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message || "Could not save category settings.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ categories: categoriesList, productBadges });
  };

  const handleResetToDefault = () => {
    if (confirm("Reset all categories, badges and ordering to default?")) {
      setCategoriesList(DEFAULT_CATEGORIES);
      setProductBadges({});
      saveMutation.mutate({ categories: DEFAULT_CATEGORIES, productBadges: {} });
    }
  };

  const updateProductBadge = (productId: number | string, patch: Partial<{ text: string; color: string; enabled: boolean }>) => {
    const key = String(productId);
    const current = productBadges[key] || { text: "HOT DEAL", color: "red", enabled: true };
    setProductBadges({
      ...productBadges,
      [key]: { ...current, ...patch },
    });
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categoriesList.length) return;

    const updated = [...categoriesList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Update order values
    updated.forEach((c, idx) => {
      c.order = idx;
    });

    setCategoriesList(updated);
  };

  const toggleCategoryEnabled = (id: string, enabled: boolean) => {
    const updated = categoriesList.map((c) => (c.id === id ? { ...c, enabled } : c));
    setCategoriesList(updated);
  };

  const openAddDialog = () => {
    setEditingCat({
      id: `custom_${Date.now()}`,
      label: "New Provider",
      iconType: "custom",
      customIconUrl: "",
      enabled: true,
      order: categoriesList.length,
      badgeEnabled: true,
      badgeText: "NEW",
      badgeColor: "purple",
      badgePosition: "top-right",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (cat: CustomCategoryItem) => {
    setEditingCat({ ...cat });
    setIsDialogOpen(true);
  };

  const saveDialogItem = () => {
    if (!editingCat || !editingCat.id.trim() || !editingCat.label.trim()) {
      toast({ title: "Validation Error", description: "Category ID and Label are required.", variant: "destructive" });
      return;
    }

    const exists = categoriesList.some((c) => c.id === editingCat.id);
    let updated: CustomCategoryItem[];
    if (exists) {
      updated = categoriesList.map((c) => (c.id === editingCat.id ? editingCat : c));
    } else {
      updated = [...categoriesList, { ...editingCat, order: categoriesList.length }];
    }
    setCategoriesList(updated);
    setIsDialogOpen(false);
    setEditingCat(null);
  };

  const deleteCategory = (id: string) => {
    if (id === "all") {
      toast({ title: "Cannot Delete", description: "'All' category is mandatory.", variant: "destructive" });
      return;
    }
    if (confirm(`Are you sure you want to remove the '${id}' category?`)) {
      const updated = categoriesList.filter((c) => c.id !== id);
      setCategoriesList(updated);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#181432] via-[#2A1F52] to-[#181432] p-8 rounded-3xl text-white shadow-xl border border-white/10">
        <div>
          <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-widest text-[#FF5E62] bg-white/10 px-3 py-1 rounded-full w-fit mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Mini-App Category & Badges Manager
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Categories, Brands & Corner Badges</h1>
          <p className="text-white/60 text-xs sm:text-sm mt-1.5 max-w-2xl">
            Customize cloud provider tabs, corner angle badge labels (e.g. HOT, NEW, PROMO), icons/logos, ordering, and visibility.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={handleResetToDefault}
            variant="outline"
            className="border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-2xl h-11"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" /> Reset Default
          </Button>
          <Button
            onClick={openAddDialog}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-2xl h-11 shadow-lg shadow-purple-600/30"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Category
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-gradient-to-r from-[#FF5E62] via-[#D92078] to-[#6C5CE7] hover:opacity-90 text-white font-black text-xs rounded-2xl h-11 shadow-lg shadow-[#6C5CE7]/30"
          >
            <Save className="w-4 h-4 mr-1.5" /> {saveMutation.isPending ? "Saving..." : "Save Live Changes"}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs: Categories vs Product Angle Badges */}
      <div className="flex items-center gap-2 p-1.5 bg-[#F4F2FA] rounded-2xl w-fit border border-[#ECEEF8]">
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === "categories"
              ? "bg-white text-[#181432] shadow-sm"
              : "text-[#7E7998] hover:text-[#181432]"
          }`}
        >
          <Layers className="w-4 h-4 text-purple-600" />
          <span>Categories & Provider Tabs ({categoriesList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("productBadges")}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === "productBadges"
              ? "bg-white text-[#181432] shadow-sm"
              : "text-[#7E7998] hover:text-[#181432]"
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#FF5E62]" />
          <span>Product Angle Badges & Special Offers ({allProducts.length})</span>
        </button>
      </div>

      {activeTab === "categories" ? (
        <>
          {/* Live Mini-App Preview Bar */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#ECEEF8]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-sm font-black text-[#181432] uppercase tracking-wider">Live Mini-App Preview</h2>
              </div>
              <span className="text-xs text-[#7E7998] font-bold">Click any pill to test active state</span>
            </div>

            <div className="bg-[#F8F9FD] p-5 rounded-2xl border border-[#ECEEF8] overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-3 pt-3 pb-3">
                {categoriesList
                  .filter((c) => c.enabled)
                  .map((cat) => {
                    const isActive = previewActiveId === cat.id;
                    const badgeStyle = BADGE_COLOR_STYLES[cat.badgeColor || "red"] || BADGE_COLOR_STYLES.red;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setPreviewActiveId(cat.id)}
                        className={`relative flex flex-col items-center justify-center min-w-[80px] h-[86px] px-3 rounded-2xl transition-all duration-200 shrink-0 ${
                          isActive
                            ? "bg-gradient-to-b from-[#FF5E62] to-[#6C5CE7] text-white shadow-lg shadow-[#6C5CE7]/30 scale-105"
                            : "bg-white text-[#4A4568] shadow-sm border border-[#ECEEF8] hover:bg-[#F5F4FC]"
                        }`}
                      >
                        {/* Corner Angle Badge */}
                        {cat.badgeEnabled && cat.badgeText && (
                          <span
                            className={`absolute -top-1.5 -left-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shadow-md leading-none z-10 border border-white/60 ${badgeStyle}`}
                          >
                            {cat.badgeText}
                          </span>
                        )}

                        {/* Stock Counter Dummy */}
                        <span
                          className={`absolute top-2 right-2 px-1.5 min-w-[18px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-black tracking-tight leading-none ${
                            isActive ? "bg-white text-[#5B42F3] shadow-sm" : "bg-gradient-to-r from-[#FF5E62] to-[#D92078] text-white shadow-xs"
                          }`}
                        >
                          5
                        </span>

                        <div className="h-7 w-7 flex items-center justify-center mb-1.5">
                          {renderCategoryBrandIcon(cat.iconType, cat.customIconUrl)}
                        </div>
                        <span className={`text-[11px] font-bold tracking-tight whitespace-nowrap text-center ${isActive ? "text-white" : "text-[#4A4568]"}`}>
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Categories Grid / Manager List */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#ECEEF8]">
            <h2 className="text-base font-black text-[#181432] mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" /> Configured Categories & Cloud Providers ({categoriesList.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoriesList.map((cat, index) => {
                const badgeStyle = BADGE_COLOR_STYLES[cat.badgeColor || "red"] || BADGE_COLOR_STYLES.red;
                return (
                  <div
                    key={cat.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      cat.enabled ? "bg-[#FDFCFE] border-[#ECEEF8] hover:border-purple-200" : "bg-gray-50/70 border-gray-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-white border border-[#ECEEF8] flex items-center justify-center shadow-xs shrink-0">
                          {renderCategoryBrandIcon(cat.iconType, cat.customIconUrl, "w-6 h-6")}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-[#181432]">{cat.label}</span>
                            {cat.badgeEnabled && cat.badgeText && (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${badgeStyle}`}>
                                {cat.badgeText}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#7E7998] font-semibold">ID: {cat.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Switch
                          checked={cat.enabled}
                          onCheckedChange={(checked) => toggleCategoryEnabled(cat.id, checked)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-3 border-t border-[#F0F2FA]">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => moveCategory(index, "up")}
                          className="h-8 w-8 p-0 rounded-lg text-gray-500 hover:text-purple-600"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={index === categoriesList.length - 1}
                          onClick={() => moveCategory(index, "down")}
                          className="h-8 w-8 p-0 rounded-lg text-gray-500 hover:text-purple-600"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(cat)}
                          className="h-8 px-2.5 rounded-xl border-[#ECEEF8] text-xs font-bold text-[#181432] hover:bg-purple-50 hover:text-purple-600"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        {cat.id !== "all" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteCategory(cat.id)}
                            className="h-8 w-8 p-0 rounded-xl text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* PRODUCT ANGLE BADGES & SPECIAL OFFERS TAB */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#ECEEF8] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#ECEEF8]">
            <div>
              <h2 className="text-base font-black text-[#181432] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FF5E62]" /> Product Card Angle Badges & Special Offers ({allProducts.length})
              </h2>
              <p className="text-xs text-[#7E7998] font-semibold mt-0.5">
                Customize the top-right corner angle label (e.g. 🔥 SPECIAL OFFER, ⚡ 20% OFF, 💎 PREMIUM) for any catalog product.
              </p>
            </div>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-100 px-3 py-1 rounded-full w-fit">
              Live Real-time Sync
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {allProducts.map((prod: any) => {
              const badgeKey = String(prod.id);
              const badge = productBadges[badgeKey] || { text: "HOT DEAL", color: "red", enabled: false };
              const currentGrad = BADGE_COLOR_STYLES[badge.color || "red"] || BADGE_COLOR_STYLES.red;

              return (
                <div
                  key={`prod-badge-${prod.id}`}
                  className="bg-[#FDFCFE] rounded-2xl p-4 border border-[#ECEEF8] shadow-xs flex flex-col justify-between space-y-3 hover:border-purple-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {prod.type}
                        </span>
                        <span className="text-xs font-bold text-emerald-600 font-mono">
                          ${(prod.price / 100).toFixed(2)}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-[#181432] line-clamp-1 mt-1">{prod.name}</h4>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-gray-500 font-bold">Badge</Label>
                      <Switch
                        checked={badge.enabled}
                        onCheckedChange={(checked) => updateProductBadge(prod.id, { enabled: checked })}
                      />
                    </div>
                  </div>

                  {/* Live Badge Preview Card Mini */}
                  <div className="relative p-3.5 bg-[#F8F9FD] rounded-xl border border-[#ECEEF8] flex items-center justify-between overflow-hidden min-h-[58px]">
                    <div>
                      <span className="text-[11px] font-bold text-[#181432] block">Card Corner Preview</span>
                      <span className="text-[9px] text-[#7E7998] block">45° Top-Right Ribbon</span>
                    </div>

                    {/* Mini Corner Ribbon */}
                    <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none overflow-hidden z-10">
                      <div
                        className={`absolute transform rotate-45 text-center text-[6.5px] font-black uppercase tracking-wider py-0.5 shadow-xs w-28 -right-8 top-3 leading-none ${
                          badge.enabled ? currentGrad : "bg-gray-300 text-gray-600 line-through"
                        }`}
                        style={{ letterSpacing: '0.04em' }}
                      >
                        {badge.text || "NO LABEL"}
                      </div>
                    </div>
                  </div>

                  {/* Badge Controls */}
                  <div className="space-y-2 pt-1">
                    <div>
                      <Label className="text-[10px] font-bold text-[#7E7998]">Angle Badge Text</Label>
                      <Input
                        placeholder="e.g. SPECIAL OFFER, 20% OFF, ⚡ INSTANT"
                        value={badge.text || ""}
                        onChange={(e) => updateProductBadge(prod.id, { text: e.target.value.toUpperCase() })}
                        className="mt-0.5 h-8 text-xs font-black rounded-lg border-[#ECEEF8]"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] font-bold text-[#7E7998] block mb-1">Color Gradient</Label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                          { id: "red", label: "Red Flame" },
                          { id: "purple", label: "Purple Sunset" },
                          { id: "pink", label: "Neon Pink" },
                          { id: "emerald", label: "Emerald" },
                          { id: "blue", label: "Cyan Blue" },
                          { id: "amber", label: "Amber Gold" },
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => updateProductBadge(prod.id, { color: c.id })}
                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all border ${
                              (badge.color || "red") === c.id
                                ? "ring-2 ring-purple-600 font-black border-transparent"
                                : "opacity-70 hover:opacity-100 border-gray-200"
                            } ${BADGE_COLOR_STYLES[c.id]}`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit / Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white border border-[#ECEEF8]">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#181432]">
              {editingCat?.id?.startsWith("custom_") ? "Add New Category / Provider" : `Edit Category: ${editingCat?.label}`}
            </DialogTitle>
          </DialogHeader>

          {editingCat && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-[#181432]">Category ID (Slug)</Label>
                  <Input
                    value={editingCat.id}
                    onChange={(e) => setEditingCat({ ...editingCat, id: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                    className="mt-1 rounded-xl h-10 text-xs font-bold border-[#ECEEF8]"
                    disabled={editingCat.id === "all"}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-[#181432]">Display Label</Label>
                  <Input
                    value={editingCat.label}
                    onChange={(e) => setEditingCat({ ...editingCat, label: e.target.value })}
                    className="mt-1 rounded-xl h-10 text-xs font-bold border-[#ECEEF8]"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-[#181432]">Built-in Brand Icon</Label>
                <select
                  value={editingCat.iconType || "custom"}
                  onChange={(e) => setEditingCat({ ...editingCat, iconType: e.target.value })}
                  className="w-full mt-1 h-10 rounded-xl border border-[#ECEEF8] px-3 text-xs font-bold text-[#181432] bg-white"
                >
                  <option value="all">All (Grid)</option>
                  <option value="windows">Windows (OS & Keys)</option>
                  <option value="canva">Canva (Canva Pro)</option>
                  <option value="hotmail">Hotmail / Outlook</option>
                  <option value="adobe">Adobe (Express / VIP)</option>
                  <option value="aws">AWS (Amazon Web Services)</option>
                  <option value="digitalocean">DigitalOcean</option>
                  <option value="azure">Azure (Microsoft)</option>
                  <option value="oracle">Oracle Cloud</option>
                  <option value="linode">Linode / Akamai</option>
                  <option value="google">Google Cloud (GCP)</option>
                  <option value="telegram">Telegram</option>
                  <option value="spotify">Spotify</option>
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="chatgpt">ChatGPT / OpenAI</option>
                  <option value="gemini">Gemini (Google AI)</option>
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="capcut">CapCut</option>
                  <option value="kamatera">Kamatera</option>
                  <option value="duolingo">Duolingo</option>
                  <option value="custom">Custom Image URL</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-[#181432]">Custom Logo / Image URL (Optional)</Label>
                <Input
                  placeholder="https://example.com/logo.png"
                  value={editingCat.customIconUrl || ""}
                  onChange={(e) => setEditingCat({ ...editingCat, customIconUrl: e.target.value })}
                  className="mt-1 rounded-xl h-10 text-xs font-medium border-[#ECEEF8]"
                />
                {editingCat.customIconUrl && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-purple-50 rounded-xl border border-purple-100">
                    <img src={editingCat.customIconUrl} alt="Preview" className="w-8 h-8 object-contain rounded-lg bg-white p-1 border" />
                    <span className="text-[11px] font-bold text-purple-700">Logo preview active</span>
                  </div>
                )}
              </div>

              {/* Corner Badge Settings */}
              <div className="p-4 bg-[#F8F9FD] rounded-2xl border border-[#ECEEF8] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-black text-[#181432]">Corner Angle Badge Label</Label>
                    <p className="text-[10px] text-[#7E7998] font-semibold">Shows promotional tag on top-left angle</p>
                  </div>
                  <Switch
                    checked={editingCat.badgeEnabled || false}
                    onCheckedChange={(checked) => setEditingCat({ ...editingCat, badgeEnabled: checked })}
                  />
                </div>

                {editingCat.badgeEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <Label className="text-[11px] font-bold text-[#181432]">Badge Text</Label>
                      <Input
                        placeholder="e.g. HOT, NEW, 20% OFF"
                        value={editingCat.badgeText || ""}
                        onChange={(e) => setEditingCat({ ...editingCat, badgeText: e.target.value.toUpperCase() })}
                        className="mt-1 rounded-xl h-9 text-xs font-black border-[#ECEEF8]"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-bold text-[#181432]">Badge Color</Label>
                      <select
                        value={editingCat.badgeColor || "red"}
                        onChange={(e) => setEditingCat({ ...editingCat, badgeColor: e.target.value })}
                        className="w-full mt-1 h-9 rounded-xl border border-[#ECEEF8] px-2.5 text-xs font-black bg-white"
                      >
                        <option value="red">Red / Orange Flame</option>
                        <option value="purple">Purple / Sunset</option>
                        <option value="blue">Cyan / Blue Pro</option>
                        <option value="emerald">Emerald Green</option>
                        <option value="amber">Amber Gold</option>
                        <option value="pink">Neon Pink</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-10 text-xs font-bold">
              Cancel
            </Button>
            <Button onClick={saveDialogItem} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 text-xs font-black">
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
