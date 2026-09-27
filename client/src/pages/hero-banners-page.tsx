import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  CheckCircle2,
  Eye,
  Sliders,
  RotateCcw,
  Save,
  Link as LinkIcon,
  Tag,
  Package,
  Layers,
  Image as ImageIcon,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_CATEGORIES } from "./categories-manager-page";

export interface HeroBannerItem {
  id: string;
  title: string;
  subtitle: string;
  features: string[];
  ctaText: string;
  image: string;
  bgGradient: string;
  badgeText?: string;
  bannerType?: "card" | "full_image"; // "card" (designed card) or "full_image" (direct full-size banner)
  actionType: "product" | "category" | "custom";
  actionTarget: string; // product ID, category name, or URL
  isActive: boolean;
  order: number;
}

const DEFAULT_BANNERS: HeroBannerItem[] = [
  {
    id: "capcut_pro_default",
    title: "CapCut Pro 1 & 12 Month",
    subtitle: "Unlock 4K 60fps export, AI auto captions, smart removal & cloud space.",
    features: ["4K 60FPS AI Export", "Auto Caption Pro", "Official Account Activation"],
    ctaText: "Buy Now",
    image: "/assets/banner_capcut_3d.png",
    bgGradient: "from-[#F0FDF4] via-[#E0F2FE] to-[#F3E8FF]",
    bannerType: "card",
    actionType: "category",
    actionTarget: "CapCut",
    isActive: true,
    order: 0,
  },
  {
    id: "gemini_pro_default",
    title: "Gemini AI 1.5 Pro (18 Mos)",
    subtitle: "Advanced 2M token context, workspace integration & top-tier reasoning.",
    features: ["2M Token Deep Context", "Workspace AI Sync", "Instant Key Delivery"],
    ctaText: "Buy Now",
    image: "/assets/banner_gemini_3d.png",
    bgGradient: "from-[#EFF6FF] via-[#EEF2FF] to-[#FAF5FF]",
    bannerType: "card",
    actionType: "category",
    actionTarget: "AI",
    isActive: true,
    order: 1,
  },
  {
    id: "cloud_vps_default",
    title: "Dedicated Cloud VPS & Servers",
    subtitle: "Ultra-fast NVMe cloud nodes on Kamatera & Oracle Cloud with 10Gbps uplinks.",
    features: ["Kamatera & Oracle Nodes", "Dedicated NVMe SSD", "99.99% Guaranteed Uptime"],
    ctaText: "Buy Now",
    image: "/assets/banner_cloud_3d.png",
    bgGradient: "from-[#ECFDF5] via-[#F0FDF4] to-[#EFF6FF]",
    bannerType: "card",
    actionType: "category",
    actionTarget: "Cloud",
    isActive: true,
    order: 2,
  },
  {
    id: "telegram_premium_default",
    title: "Telegram & Spotify Premium",
    subtitle: "Double limits, 4GB uploads, zero ads, no-login direct gifting with warranty.",
    features: ["4GB File Uploads", "Zero Login Needed", "Instant Official Gift"],
    ctaText: "Buy Now",
    image: "/assets/banner_premium_3d.png",
    bgGradient: "from-[#F0FDF4] via-[#E0F2FE] to-[#F3E8FF]",
    bannerType: "card",
    actionType: "category",
    actionTarget: "Subscriptions",
    isActive: true,
    order: 3,
  },
];

const GRADIENT_PRESETS = [
  { label: "Fresh Pastel (Telegram Style)", value: "from-[#F0FDF4] via-[#E0F2FE] to-[#F3E8FF]" },
  { label: "Ocean Breeze", value: "from-[#EFF6FF] via-[#EEF2FF] to-[#FAF5FF]" },
  { label: "Emerald Glow", value: "from-[#ECFDF5] via-[#F0FDF4] to-[#EFF6FF]" },
  { label: "Sunrise Peach", value: "from-[#FFF7ED] via-[#FEF2F2] to-[#FAF5FF]" },
  { label: "Lavender Dream", value: "from-[#FAF5FF] via-[#F3E8FF] to-[#E0E7FF]" },
  { label: "Dark Obsidian", value: "from-slate-900 via-indigo-950 to-slate-900" },
];

export default function HeroBannersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullBannerInputRef = useRef<HTMLInputElement>(null);

  // Fetch products & categories config for linking
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: categoryConfig } = useQuery<{ categories: any[]; productBadges: any }>({
    queryKey: ["/api/categories/config"],
  });

  // Calculate comprehensive, deduplicated categories list
  const allAvailableCategories = React.useMemo(() => {
    const list = new Set<string>();

    // 1. From Category Config
    if (categoryConfig?.categories && Array.isArray(categoryConfig.categories)) {
      categoryConfig.categories.forEach((c: any) => {
        const name = c.label || c.name || c.id;
        if (name && name.toLowerCase() !== "all") list.add(name.trim());
      });
    } else {
      DEFAULT_CATEGORIES.forEach((c) => {
        if (c.label && c.label.toLowerCase() !== "all") list.add(c.label.trim());
      });
    }

    // 2. From actual products types
    if (Array.isArray(products)) {
      products.forEach((p: any) => {
        if (p.type && typeof p.type === "string" && p.type.trim()) {
          list.add(p.type.trim());
        }
      });
    }

    // Standard popular categories
    ["CapCut", "Gemini", "ChatGPT", "Claude", "Spotify", "YouTube", "AWS", "DigitalOcean", "Azure", "Oracle", "Kamatera", "Linode", "Telegram", "SMM Boost", "Accounts"].forEach((cat) => list.add(cat));

    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [categoryConfig, products]);

  // Fetch current banner configuration
  const { data: bannerData, isLoading } = useQuery<{ banners: HeroBannerItem[] }>({
    queryKey: ["/api/admin/hero-banners"],
  });

  const [banners, setBanners] = useState<HeroBannerItem[]>(DEFAULT_BANNERS);
  const [editingBanner, setEditingBanner] = useState<HeroBannerItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);

  useEffect(() => {
    if (bannerData?.banners && Array.isArray(bannerData.banners) && bannerData.banners.length > 0) {
      setBanners(bannerData.banners);
    }
  }, [bannerData]);

  // Auto rotate preview every 3 seconds
  useEffect(() => {
    const activeBanners = banners.filter((b) => b.isActive);
    if (activeBanners.length === 0) return;
    const interval = setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % activeBanners.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [banners]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (updatedBanners: HeroBannerItem[]) => {
      const res = await apiRequest("POST", "/api/admin/hero-banners", { banners: updatedBanners });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/hero-banners"] });
      toast({
        title: "Banners Published! 🚀",
        description: "Your hero banner slider has been updated instantly in the Mini-App.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to update banners",
        variant: "destructive",
      });
    },
  });

  // Reorder handlers
  const moveBanner = (index: number, direction: "up" | "down") => {
    const newBanners = [...banners];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBanners.length) return;
    const temp = newBanners[index];
    newBanners[index] = newBanners[targetIndex];
    newBanners[targetIndex] = temp;
    newBanners.forEach((b, i) => (b.order = i));
    setBanners(newBanners);
  };

  const deleteBanner = (id: string) => {
    const filtered = banners.filter((b) => b.id !== id);
    filtered.forEach((b, i) => (b.order = i));
    setBanners(filtered);
    toast({ title: "Banner Removed", description: "Click Save & Publish to apply changes." });
  };

  const openNewBannerDialog = () => {
    setEditingBanner({
      id: "banner_" + Date.now(),
      title: "New Featured Special",
      subtitle: "Add high converting subtitle description here.",
      features: ["Feature Bullet 1", "Feature Bullet 2", "Instant Delivery"],
      ctaText: "Buy Now",
      image: "/assets/banner_capcut_3d.png",
      bgGradient: "from-[#F0FDF4] via-[#E0F2FE] to-[#F3E8FF]",
      actionType: "category",
      actionTarget: "",
      isActive: true,
      order: banners.length,
    });
    setIsDialogOpen(true);
  };

  const saveEditingBanner = () => {
    if (!editingBanner) return;
    const exists = banners.some((b) => b.id === editingBanner.id);
    let updated: HeroBannerItem[];
    if (exists) {
      updated = banners.map((b) => (b.id === editingBanner.id ? editingBanner : b));
    } else {
      updated = [...banners, editingBanner];
    }
    updated.forEach((b, i) => (b.order = i));
    setBanners(updated);
    setIsDialogOpen(false);
    setEditingBanner(null);
  };

  // Canvas-based image compression for 3D Icon (max 480x480 PNG)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingBanner) return;

    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 480;
        const MAX_HEIGHT = 480;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL("image/png", 0.9);
          setEditingBanner({
            ...editingBanner,
            image: compressedDataUrl,
          });
          toast({
            title: "3D Icon Processed & Compressed! ⚡",
            description: `Compressed to ${Math.round(compressedDataUrl.length / 1024)}KB for instant loading.`,
          });
        }
        setIsCompressing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Canvas-based image compression for Full-Width Banner Graphic (Target 1200x520 max WebP/JPEG/PNG under 120KB)
  const handleFullBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingBanner) return;

    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP with 88% quality, fallback to JPEG
          let compressedDataUrl = canvas.toDataURL("image/webp", 0.88);
          if (!compressedDataUrl.startsWith("data:image/webp")) {
            compressedDataUrl = canvas.toDataURL("image/jpeg", 0.88);
          }

          setEditingBanner({
            ...editingBanner,
            bannerType: "full_image",
            image: compressedDataUrl,
          });

          toast({
            title: "Full Banner Compressed Successfully! ⚡",
            description: `Auto-compressed to ${Math.round(compressedDataUrl.length / 1024)}KB for instant 0ms mobile rendering!`,
          });
        }
        setIsCompressing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const activeBanners = banners.filter((b) => b.isActive);
  const currentPreview = activeBanners[previewIndex % (activeBanners.length || 1)] || banners[0];

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-violet-950 via-indigo-900 to-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-purple-200 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
            Mini-App Hero Slider Manager
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Hero Banners & Slider Studio
          </h1>
          <p className="text-sm md:text-base text-purple-200/80 max-w-2xl">
            Customize top rotating banners in the customer shop. Upload full-bleed ready graphic photos or design 3D interactive cards, add instant product/category redirects, and compress images with 0ms loading.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setBanners(DEFAULT_BANNERS);
              toast({ title: "Reset to Default Banners", description: "Click Save to apply defaults." });
            }}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Defaults
          </Button>
          <Button
            onClick={openNewBannerDialog}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Slide
          </Button>
          <Button
            onClick={() => saveMutation.mutate(banners)}
            disabled={saveMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Publishing..." : "Save & Publish"}
          </Button>
        </div>
      </div>

      {/* Main Grid: Left = Sliders List, Right = Live Phone Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Banner Cards Manager */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-600" />
              Active Slides ({banners.length})
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Drag or use arrows to change display order
            </span>
          </div>

          <div className="space-y-3">
            {banners.map((banner, index) => (
              <Card
                key={banner.id}
                className={`transition-all border-2 overflow-hidden shadow-sm hover:shadow-md ${
                  banner.isActive
                    ? "border-purple-200 dark:border-purple-900/40 bg-white dark:bg-slate-900"
                    : "border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-950"
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  {/* Thumbnail */}
                  <div className="w-24 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-1 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                    <img
                      src={banner.image}
                      alt={banner.title}
                      className={`w-full h-full ${banner.bannerType === "full_image" ? "object-cover rounded-xl" : "object-contain"} drop-shadow-md`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {banner.title || "Custom Banner Graphic"}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      >
                        Slide #{index + 1}
                      </Badge>
                      {banner.bannerType === "full_image" ? (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40">
                          <ImageIcon className="w-3 h-3 mr-1" /> Full Banner
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-200">
                          <Sparkles className="w-3 h-3 mr-1" /> 3D Card
                        </Badge>
                      )}
                      {banner.actionType === "product" && (
                        <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200">
                          <Package className="w-3 h-3 mr-1" /> Product
                        </Badge>
                      )}
                      {banner.actionType === "category" && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">
                          <Tag className="w-3 h-3 mr-1" /> Cat: {banner.actionTarget || "All"}
                        </Badge>
                      )}
                    </div>
                    {banner.bannerType === "full_image" ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">✨ Full edge-to-edge custom graphic</p>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 line-clamp-1">{banner.subtitle}</p>
                        <div className="flex items-center gap-2 pt-1">
                          {banner.features?.slice(0, 2).map((feat, fi) => (
                            <span
                              key={fi}
                              className="inline-flex items-center text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full"
                            >
                              <Check className="w-2.5 h-2.5 mr-1 text-emerald-500" />
                              {feat}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={banner.isActive}
                      onCheckedChange={(checked) => {
                        const updated = banners.map((b) =>
                          b.id === banner.id ? { ...b, isActive: checked } : b
                        );
                        setBanners(updated);
                      }}
                    />

                    <div className="flex flex-col gap-1 ml-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => moveBanner(index, "up")}
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={index === banners.length - 1}
                        onClick={() => moveBanner(index, "down")}
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 font-bold text-xs"
                      onClick={() => {
                        setEditingBanner({ ...banner });
                        setIsDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => deleteBanner(banner.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: Live Customer Mini-App Phone Simulator */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-sm sticky top-6">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-purple-600" />
                Live Mini-App Preview
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() =>
                    setPreviewIndex((prev) => (prev > 0 ? prev - 1 : activeBanners.length - 1))
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                  {activeBanners.length > 0 ? (previewIndex % activeBanners.length) + 1 : 0} /{" "}
                  {activeBanners.length}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() =>
                    setPreviewIndex((prev) => (prev + 1) % (activeBanners.length || 1))
                  }
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Simulated Phone Frame */}
            <div className="rounded-[40px] border-[10px] border-slate-900 bg-[#0B0F19] p-4 shadow-2xl relative overflow-hidden">
              <div className="w-32 h-5 bg-slate-900 rounded-b-2xl mx-auto -mt-4 mb-4 flex items-center justify-center">
                <div className="w-12 h-1 bg-slate-700 rounded-full" />
              </div>

              {/* Mini App Shop Hero Component */}
              {currentPreview ? (
                <div className="space-y-4">
                  {currentPreview.bannerType === "full_image" ? (
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-md group cursor-pointer">
                      <img
                        src={currentPreview.image}
                        alt={currentPreview.title || "Full Banner"}
                        className="w-full h-36 object-cover rounded-2xl"
                      />
                      {/* Dots overlay */}
                      <div className="absolute bottom-2.5 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full z-10">
                        {activeBanners.map((_, dotIdx) => (
                          <div
                            key={dotIdx}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              dotIdx === previewIndex % (activeBanners.length || 1)
                                ? "w-4 bg-white"
                                : "w-1.5 bg-white/40"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${currentPreview.bgGradient} p-4 border border-slate-200/80 shadow-md text-slate-900`}
                    >
                      <div className="relative z-10 flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div>
                            <h3 className="text-base font-black text-slate-900 leading-tight">
                              {currentPreview.title}
                            </h3>
                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-0.5 line-clamp-2">
                              {currentPreview.subtitle}
                            </p>
                          </div>

                          {/* Features with checkmarks */}
                          <div className="space-y-1 pt-1">
                            {currentPreview.features?.map((feat, fidx) => (
                              <div
                                key={fidx}
                                className="flex items-center gap-1 text-[10px] font-bold text-slate-800"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="truncate">{feat}</span>
                              </div>
                            ))}
                          </div>

                          {/* Buy Now Button */}
                          <div className="pt-2">
                            <button className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-black text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1">
                              {currentPreview.ctaText || "Buy Now"}
                            </button>
                          </div>
                        </div>

                        {/* 3D Image */}
                        <div className="w-24 h-24 shrink-0 flex items-center justify-center">
                          <img
                            src={currentPreview.image}
                            alt="Banner Preview"
                            className="w-full h-full object-contain drop-shadow-xl"
                          />
                        </div>
                      </div>

                      {/* Dots */}
                      <div className="flex items-center justify-center gap-1 mt-3">
                        {activeBanners.map((_, dotIdx) => (
                          <div
                            key={dotIdx}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              dotIdx === previewIndex % (activeBanners.length || 1)
                                ? "w-5 bg-emerald-600"
                                : "w-1.5 bg-slate-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-slate-800/60 rounded-xl text-center">
                    <p className="text-[11px] text-slate-400 font-medium">
                      Rotating automatically every 3s in customer Telegram Mini-App
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No active banners configured.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit / Add Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              {editingBanner?.id.startsWith("banner_") ? "Create New Slide" : "Edit Slide"}
            </DialogTitle>
          </DialogHeader>

          {editingBanner && (
            <div className="space-y-6 py-2">
              {/* BANNER MODE SELECTOR */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Banner Style / Mode
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingBanner({ ...editingBanner, bannerType: "full_image" })
                    }
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                      editingBanner.bannerType === "full_image"
                        ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 opacity-70"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        🖼️ Full Photo Banner
                        {editingBanner.bannerType === "full_image" && (
                          <Badge className="bg-amber-500 text-[10px] h-4 px-1.5">Selected</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Upload a ready artwork photo. No need to fill titles or bullet points!
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingBanner({ ...editingBanner, bannerType: "card" })
                    }
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                      editingBanner.bannerType !== "full_image"
                        ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 opacity-70"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        🎨 Designed 3D Card
                        {editingBanner.bannerType !== "full_image" && (
                          <Badge className="bg-purple-600 text-[10px] h-4 px-1.5">Selected</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Dynamic title, subtitle description, feature bullet points & 3D badge.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* MODE 1: FULL PHOTO BANNER UPLOAD */}
              {editingBanner.bannerType === "full_image" ? (
                <div className="space-y-4 p-5 rounded-2xl bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/80 dark:border-amber-900/40">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Full Banner Graphic Photo (Auto-Compressed)</span>
                      <span className="text-[10px] text-emerald-600 font-bold">⚡ HTML5 0ms Load Compressor</span>
                    </Label>

                    {/* Preview Box */}
                    <div className="relative w-full h-44 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-amber-300 dark:border-amber-700/60 flex items-center justify-center overflow-hidden group">
                      {editingBanner.image ? (
                        <>
                          <img
                            src={editingBanner.image}
                            alt="Full Banner Preview"
                            className="w-full h-full object-cover rounded-2xl"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              type="button"
                              onClick={() => fullBannerInputRef.current?.click()}
                              className="bg-white text-slate-900 font-bold text-xs"
                            >
                              <Upload className="w-3.5 h-3.5 mr-1.5" /> Replace Photo
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center space-y-2 p-4">
                          <ImageIcon className="w-10 h-10 text-amber-500 mx-auto" />
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            No full banner uploaded yet. Click below to select image.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={() => fullBannerInputRef.current?.click()}
                        disabled={isCompressing}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shadow-md"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {isCompressing ? "Compressing..." : "Upload & Compress Full Banner"}
                      </Button>
                      <input
                        type="file"
                        ref={fullBannerInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleFullBannerUpload}
                      />
                      <span className="text-[11px] text-slate-500 font-medium">
                        Recommended: 1200x500 or 16:9 ratio (PNG, JPG, WebP)
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Internal Banner Label (Optional)
                    </Label>
                    <Input
                      value={editingBanner.title || ""}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, title: e.target.value })
                      }
                      placeholder="e.g. Summer Promo Special 2026"
                      className="mt-1 font-bold text-sm bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              ) : (
                /* MODE 2: DESIGNED 3D CARD MODE */
                <div className="space-y-5">
                  {/* Title & Subtitle */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Slide Headline Title
                      </Label>
                      <Input
                        value={editingBanner.title}
                        onChange={(e) =>
                          setEditingBanner({ ...editingBanner, title: e.target.value })
                        }
                        placeholder="e.g. CapCut Pro 1 Month"
                        className="mt-1 font-bold text-sm"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Subtitle Description
                      </Label>
                      <Input
                        value={editingBanner.subtitle}
                        onChange={(e) =>
                          setEditingBanner({ ...editingBanner, subtitle: e.target.value })
                        }
                        placeholder="e.g. Unlock 4K 60fps export, AI auto captions & cloud space."
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  {/* Feature Bullets (3 items) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Feature Bullets (With Checkmarks)
                    </Label>
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <Input
                          value={editingBanner.features?.[idx] || ""}
                          onChange={(e) => {
                            const newFeats = [...(editingBanner.features || [])];
                            newFeats[idx] = e.target.value;
                            setEditingBanner({ ...editingBanner, features: newFeats });
                          }}
                          placeholder={`Feature Bullet #${idx + 1}`}
                          className="text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Image Selection & Canvas Compressor */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      3D Icon / Graphic (Instant Loading Canvas Compressed)
                    </Label>
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                      <div className="w-20 h-20 rounded-xl bg-white dark:bg-slate-800 border p-2 flex items-center justify-center shrink-0">
                        <img
                          src={editingBanner.image}
                          alt="Thumbnail"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isCompressing}
                            className="font-bold text-xs"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            {isCompressing ? "Compressing..." : "Upload & Compress Image"}
                          </Button>
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400">Presets:</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingBanner({
                                ...editingBanner,
                                image: "/assets/banner_capcut_3d.png",
                              })
                            }
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border hover:border-purple-500"
                          >
                            CapCut
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingBanner({
                                ...editingBanner,
                                image: "/assets/banner_gemini_3d.png",
                              })
                            }
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border hover:border-purple-500"
                          >
                            Gemini AI
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingBanner({
                                ...editingBanner,
                                image: "/assets/banner_cloud_3d.png",
                              })
                            }
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border hover:border-purple-500"
                          >
                            Cloud VPS
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingBanner({
                                ...editingBanner,
                                image: "/assets/banner_premium_3d.png",
                              })
                            }
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border hover:border-purple-500"
                          >
                            Telegram
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Background Gradient */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Background Color Gradient Style
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {GRADIENT_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setEditingBanner({ ...editingBanner, bgGradient: preset.value })
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all text-xs font-bold flex items-center justify-between ${
                            editingBanner.bgGradient === preset.value
                              ? "border-purple-600 ring-2 ring-purple-600/20 bg-purple-50/50 dark:bg-purple-950/30"
                              : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                          }`}
                        >
                          <span className="truncate">{preset.label}</span>
                          <div
                            className={`w-4 h-4 rounded-full bg-gradient-to-r ${preset.value} border border-slate-300 shrink-0 ml-2`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Target Selection & CTA Action Link (Common to both modes) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Click / CTA Action
                  </Label>
                  <Select
                    value={editingBanner.actionType}
                    onValueChange={(val: any) =>
                      setEditingBanner({ ...editingBanner, actionType: val, actionTarget: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Filter by Category</SelectItem>
                      <SelectItem value="product">Open Specific Product</SelectItem>
                      <SelectItem value="custom">Custom URL / Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Target Destination
                  </Label>
                  {editingBanner.actionType === "product" ? (
                    <Select
                      value={editingBanner.actionTarget}
                      onValueChange={(val) =>
                        setEditingBanner({ ...editingBanner, actionTarget: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.title || p.name} (LKR {p.price})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : editingBanner.actionType === "category" ? (
                    <Select
                      value={editingBanner.actionTarget}
                      onValueChange={(val) =>
                        setEditingBanner({ ...editingBanner, actionTarget: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="ALL">All Categories</SelectItem>
                        {allAvailableCategories.map((catName) => (
                          <SelectItem key={catName} value={catName}>
                            {catName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={editingBanner.actionTarget}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, actionTarget: e.target.value })
                      }
                      placeholder="e.g. /shop or https://..."
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveEditingBanner}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold"
            >
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
