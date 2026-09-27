import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { 
  Flame, 
  Sparkles, 
  Save, 
  RefreshCw, 
  Search, 
  Star, 
  TrendingUp, 
  CheckCircle2, 
  ShoppingBag, 
  Sliders, 
  Package, 
  Eye, 
  Plus, 
  Tag, 
  ArrowUpDown,
  Zap,
  Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface BestSellerItem {
  id: number;
  name: string;
  price: number;
  type: string;
  realOrdersCount: number;
  baseSoldCount: number;
  totalSoldCount: number;
  customRating: number;
  customReviewsCount: number;
  isFeatured: boolean;
  badge: string;
  orderIndex: number;
}

const PRESET_BADGES = [
  "BEST SELLER",
  "HOT DEAL",
  "INSTANT 2FA",
  "TOP PICK",
  "99.9% UPTIME",
  "POPULAR",
  "SPECIAL"
];

export default function BestSellersPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<BestSellerItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ products: BestSellerItem[]; config: any[] }>({
    queryKey: ["/api/admin/best-sellers"],
  });

  useEffect(() => {
    if (data?.products) {
      setItems(data.products);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (updatedConfig: any[]) => {
      const res = await fetch("/api/admin/best-sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: updatedConfig }),
      });
      if (!res.ok) throw new Error("Failed to save best sellers configuration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/best-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/best-sellers"] });
      setHasChanges(false);
      toast({
        title: "Settings Saved! 🎉",
        description: "Best Sellers & Hot Deals slider and sold counts are now live in Mini App.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateItem = (id: number, fields: Partial<BestSellerItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, ...fields };
          if (fields.baseSoldCount !== undefined) {
            updated.totalSoldCount = Number(fields.baseSoldCount || 0) + (updated.realOrdersCount || 0);
          }
          return updated;
        }
        return item;
      })
    );
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    const configToSave = items.map((item) => ({
      productId: item.id,
      isFeatured: item.isFeatured,
      badge: item.badge,
      orderIndex: Number(item.orderIndex || 0),
      baseSoldCount: Number(item.baseSoldCount || 0),
      customRating: Number(item.customRating || 4.9),
      customReviewsCount: Number(item.customReviewsCount || 120),
    }));
    saveMutation.mutate(configToSave);
  };

  const handleSetAllBaseSold = (amount: number) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        baseSoldCount: amount,
        totalSoldCount: amount + (item.realOrdersCount || 0),
      }))
    );
    setHasChanges(true);
    toast({
      title: "Bulk Applied",
      description: `All products base sold count set to ${amount.toLocaleString()}. Click 'Save Changes' to apply.`,
    });
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.badge || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const featuredCount = items.filter((i) => i.isFeatured).length;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-pink-950/40 via-purple-950/40 to-slate-950 border border-pink-500/20 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-bold">
            <Flame className="w-3.5 h-3.5 text-pink-400" />
            Live Store Showcase
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Best Sellers & Hot Deals Manager
          </h1>
          <p className="text-white/60 max-w-2xl text-xs sm:text-sm leading-relaxed">
            Customize which items appear in the <b>"Best Sellers & Hot Deals"</b> horizontal slider, customize ribbon badges, and set base sold quantities & review scores that automatically increment on every real purchase.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          <Button
            onClick={handleSaveAll}
            disabled={saveMutation.isPending || !hasChanges}
            className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-black px-6 py-6 rounded-2xl shadow-lg shadow-pink-500/25 gap-2 text-sm transition-all"
          >
            {saveMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes {hasChanges ? "●" : ""}
          </Button>
        </div>
      </div>

      {/* Metrics Row & Quick Presets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card border-0 bg-pink-950/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-pink-300 uppercase tracking-wider">Featured in Slider</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
                {featuredCount} <span className="text-xs text-white/40 font-normal">/ {items.length}</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
              <Flame className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-purple-950/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-purple-300 uppercase tracking-wider">Total Catalog Items</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">{items.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 bg-emerald-950/20 col-span-1 sm:col-span-2">
          <CardContent className="p-5 flex flex-col justify-between h-full space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">⚡ 1-Click Sold Count Presets</p>
              <span className="text-[11px] text-white/40">Real purchases add +1 automatically</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[1000, 2500, 3000, 5000].map((amt) => (
                <Button
                  key={amt}
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetAllBaseSold(amt)}
                  className="glass-panel border-white/10 hover:bg-emerald-500/20 hover:text-emerald-300 text-white text-xs rounded-xl h-8 font-bold"
                >
                  Set all to {amt.toLocaleString()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search product name, badge..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 text-xs sm:text-sm glass-panel border-white/10 text-white rounded-xl"
          />
        </div>

        <div className="text-xs text-white/50 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Live calculation: <code>Total Sold = Base Sold + Real Orders</code>
        </div>
      </div>

      {/* Products Config Table / Cards */}
      {isLoading ? (
        <div className="py-20 text-center text-white/40">Loading products & best sellers config...</div>
      ) : filteredItems.length === 0 ? (
        <Card className="glass-card border-0 py-16 text-center">
          <CardContent className="space-y-3">
            <Package className="w-12 h-12 text-white/20 mx-auto" />
            <h3 className="text-lg font-bold text-white">No products found</h3>
            <p className="text-white/40 text-xs">Try adjusting your search query.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => {
            return (
              <Card
                key={item.id}
                className={`glass-card border-0 transition-all ${
                  item.isFeatured ? "ring-1 ring-pink-500/40 bg-pink-950/10" : "opacity-80"
                }`}
              >
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Product Info & Toggle */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <Switch
                          checked={item.isFeatured}
                          onCheckedChange={(checked) => handleUpdateItem(item.id, { isFeatured: checked })}
                        />
                        <span className="text-[10px] font-bold text-white/50">
                          {item.isFeatured ? "Featured" : "Hidden"}
                        </span>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-black text-white truncate">{item.name}</h4>
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] font-bold px-2 py-0.5">
                            ${((item.price || 0) / 100).toFixed(2)} USD
                          </Badge>
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-2 py-0.5">
                            {item.realOrdersCount} Real Purchases
                          </Badge>
                        </div>
                        <p className="text-xs text-white/40">
                          Display Live in Store: <b className="text-emerald-400">{item.totalSoldCount.toLocaleString()} Sold</b> • ⭐ {item.customRating} ({item.customReviewsCount.toLocaleString()} reviews)
                        </p>
                      </div>
                    </div>

                    {/* Right: Controls (Badge, Base Sold, Reviews, Order) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:w-auto">
                      {/* Ribbon Badge */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/50 uppercase">Ribbon Badge</label>
                        <Input
                          value={item.badge}
                          onChange={(e) => handleUpdateItem(item.id, { badge: e.target.value.toUpperCase() })}
                          placeholder="BEST SELLER"
                          className="h-9 text-xs glass-panel border-white/10 text-pink-400 font-black rounded-lg uppercase"
                        />
                      </div>

                      {/* Base Sold Count */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/50 uppercase">Base Sold Qty</label>
                        <Input
                          type="number"
                          value={item.baseSoldCount}
                          onChange={(e) => handleUpdateItem(item.id, { baseSoldCount: parseInt(e.target.value) || 0 })}
                          placeholder="3000"
                          className="h-9 text-xs glass-panel border-white/10 text-emerald-400 font-bold rounded-lg"
                        />
                      </div>

                      {/* Rating Score */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/50 uppercase">Rating (1-5)</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={item.customRating}
                          onChange={(e) => handleUpdateItem(item.id, { customRating: parseFloat(e.target.value) || 4.9 })}
                          placeholder="4.9"
                          className="h-9 text-xs glass-panel border-white/10 text-amber-400 font-bold rounded-lg"
                        />
                      </div>

                      {/* Slider Order */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/50 uppercase">Display Order</label>
                        <Input
                          type="number"
                          value={item.orderIndex}
                          onChange={(e) => handleUpdateItem(item.id, { orderIndex: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                          className="h-9 text-xs glass-panel border-white/10 text-purple-400 font-bold rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Badge Preset Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5">
                    <span className="text-[10px] text-white/40 mr-1">Quick Badges:</span>
                    {PRESET_BADGES.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => handleUpdateItem(item.id, { badge: b })}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                          item.badge === b
                            ? "bg-pink-500/20 text-pink-300 border-pink-500/40 font-black"
                            : "bg-white/5 text-white/60 border-white/10 hover:text-white"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
