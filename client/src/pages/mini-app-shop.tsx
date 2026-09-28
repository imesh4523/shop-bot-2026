import { useQuery } from "@tanstack/react-query";
import MiniAppShopClassic from "./mini-app-shop-classic";
import MiniAppShopModern from "./mini-app-shop-modern";
import { LottiePayment } from "@/components/lottie-loader";

export default function MiniAppShop() {
  const { data: themeSetting, isLoading } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/MINI_APP_THEME"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FD]">
        <LottiePayment size={160} />
      </div>
    );
  }

  const activeTheme = themeSetting?.value || "v2_modern";

  if (activeTheme === "v1_classic") {
    return <MiniAppShopClassic />;
  }

  return <MiniAppShopModern />;
}
