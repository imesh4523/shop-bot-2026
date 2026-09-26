import { useQuery } from "@tanstack/react-query";
import MiniAppShopClassic from "./mini-app-shop-classic";
import MiniAppShopModern from "./mini-app-shop-modern";
import { LottieLoader } from "@/components/lottie-loader";

export default function MiniAppShop() {
  const { data: themeSetting, isLoading } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/MINI_APP_THEME"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FD] select-none">
        <LottieLoader size={180} />
      </div>
    );
  }

  const activeTheme = themeSetting?.value || "v2_modern";

  if (activeTheme === "v1_classic") {
    return <MiniAppShopClassic />;
  }

  return <MiniAppShopModern />;
}
