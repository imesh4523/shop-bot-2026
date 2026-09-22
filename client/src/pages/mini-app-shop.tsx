import { useQuery } from "@tanstack/react-query";
import MiniAppShopClassic from "./mini-app-shop-classic";
import MiniAppShopModern from "./mini-app-shop-modern";
import { Loader2 } from "lucide-react";

export default function MiniAppShop() {
  const { data: themeSetting, isLoading } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/MINI_APP_THEME"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8F4]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D4F38]" />
      </div>
    );
  }

  const activeTheme = themeSetting?.value || "v2_modern";

  if (activeTheme === "v1_classic") {
    return <MiniAppShopClassic />;
  }

  return <MiniAppShopModern />;
}
