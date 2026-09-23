import { useEffect, useRef, useState, useMemo } from "react";
import { generateTOTP, getRemainingSeconds } from "@/lib/totp";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product, TelegramUser, Order, Payment, SpecialOffer } from "@shared/schema";
import { getTelegramInitData, expandTelegramWebApp } from "@/lib/telegram";
import { queryClient } from "@/lib/queryClient";
import {
  Loader2,
  ShoppingCart,
  User as UserIcon,
  Package,
  Wallet,
  ChevronRight,
  CreditCard,
  History as HistoryIcon,
  Store as StoreIcon,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  ExternalLink,
  ChevronDown,
  MessageCircle,
  Send,
  X,
  Copy,
  SlidersHorizontal,
  Search,
  Heart,
  Plus,
  Minus,
  Star,
  Sparkles,
  ArrowLeft,
  Check,
  RefreshCw,
  LayoutGrid,
  Mail,
  KeyRound,
  LogOut,
  Shield,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import { FaAws, FaSpotify, FaYoutube, FaInstagram, FaFacebook, FaTiktok, FaTelegramPlane } from "react-icons/fa";
import { SiDigitalocean, SiGooglecloud, SiOpenai, SiDuolingo, SiGooglegemini, SiBinance } from "react-icons/si";
import { VscAzure } from "react-icons/vsc";
import youuHostLogo from "@/assets/youuhost_logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Helper for MiniApp API requests
const miniApiRequest = async (method: string, path: string, body?: any) => {
  const initData = getTelegramInitData();
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": initData,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Request failed");
  }
  return res;
};

// Custom Crisp Vector SVG Components for Brands not in basic icon sets
const OracleLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="24" fill="#F80000" />
    <path
      d="M50 28C36.7 28 26 37.8 26 50C26 62.2 36.7 72 50 72C63.3 72 74 62.2 74 50C74 37.8 63.3 28 50 28ZM50 62C42 62 35.5 56.6 35.5 50C35.5 43.4 42 38 50 38C58 38 64.5 43.4 64.5 50C64.5 56.6 58 62 50 62Z"
      fill="white"
    />
  </svg>
);

const LinodeLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="24" fill="#00A95C" />
    <circle cx="50" cy="30" r="10" fill="white" />
    <rect x="26" y="46" width="20" height="34" rx="10" fill="white" />
    <rect x="54" y="46" width="20" height="34" rx="10" fill="white" />
  </svg>
);

const ClaudeLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="24" fill="#D97757" />
    <path
      d="M50 22L56 42L76 48L56 54L50 74L44 54L24 48L44 42L50 22Z"
      fill="white"
    />
  </svg>
);

const GoogleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

const BinanceLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <div className={`rounded-full bg-[#F3BA2F] flex items-center justify-center p-[15%] shrink-0 overflow-hidden ${className}`}>
    <SiBinance className="w-full h-full text-[#1E2026]" />
  </div>
);

const CryptomusLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="28" fill="#1C1838" />
    <path
      d="M50 20C33.43 20 20 33.43 20 50C20 66.57 33.43 80 50 80C62.8 80 73.6 72 77.8 60.5L66.4 56.2C63.8 63.8 57.5 69 50 69C39.51 69 31 60.49 31 50C31 39.51 39.51 31 50 31C57.5 31 63.8 36.2 66.4 43.8L77.8 39.5C73.6 28 62.8 20 50 20Z"
      fill="#FFFFFF"
    />
    <circle cx="72" cy="50" r="8" fill="#00D287" />
  </svg>
);

const CapCutLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="24" fill="#000000" />
    <path
      d="M30 26L50 46L70 26V42L50 62L30 42V26ZM30 74L50 54L70 74V58L50 38L30 58V74Z"
      fill="white"
    />
  </svg>
);

const KamateraLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="24" fill="#FF5E00" />
    <path
      d="M28 26H42V45L62 26H78L54 49L78 74H62L42 53V74H28V26Z"
      fill="white"
    />
  </svg>
);

// Real Brand Visual Renderer
const BrandIcon = ({
  name,
  type,
  className = "w-7 h-7",
}: {
  name?: string;
  type?: string;
  className?: string;
}) => {
  const n = ((name || "") + " " + (type || "")).toLowerCase();

  // 1. Cloud & VPS
  if (n.includes("aws") || n.includes("amazon")) {
    return <FaAws className={`${className} text-[#FF9900]`} />;
  }
  if (n.includes("digitalocean") || n.includes("digital ocean")) {
    return <SiDigitalocean className={`${className} text-[#0080FF]`} />;
  }
  if (n.includes("azure") || n.includes("microsoft")) {
    return <VscAzure className={`${className} text-[#0089D6]`} />;
  }
  if (n.includes("oracle")) {
    return <OracleLogo className={className} />;
  }
  if (n.includes("linod") || n.includes("linode") || n.includes("akamai")) {
    return <LinodeLogo className={className} />;
  }
  if (n.includes("google") || n.includes("gcp")) {
    return <SiGooglecloud className={`${className} text-[#4285F4]`} />;
  }
  if (n.includes("kamatera")) {
    return <KamateraLogo className={className} />;
  }

  // 2. Social & Media Accounts
  if (n.includes("spotify")) {
    return <FaSpotify className={`${className} text-[#1DB954]`} />;
  }
  if (n.includes("youtube")) {
    return <FaYoutube className={`${className} text-[#FF0000]`} />;
  }
  if (n.includes("tiktok")) {
    return <FaTiktok className={`${className} text-[#000000]`} />;
  }
  if (n.includes("instagram")) {
    return <FaInstagram className={`${className} text-[#E1306C]`} />;
  }
  if (n.includes("facebook") || n.includes("fb")) {
    return <FaFacebook className={`${className} text-[#1877F2]`} />;
  }
  if (n.includes("telegram")) {
    return <FaTelegramPlane className={`${className} text-[#24A1DE]`} />;
  }

  // 3. AI & Tools
  if (n.includes("chatgpt") || n.includes("openai") || n.includes("gpt")) {
    return <SiOpenai className={`${className} text-[#10A37F]`} />;
  }
  if (n.includes("gemini")) {
    return <SiGooglegemini className={`${className} text-[#1BA0E2]`} />;
  }
  if (n.includes("claude") || n.includes("anthropic")) {
    return <ClaudeLogo className={className} />;
  }
  if (n.includes("capcut")) {
    return <CapCutLogo className={className} />;
  }
  if (n.includes("duolingo")) {
    return <SiDuolingo className={`${className} text-[#58CC02]`} />;
  }
  if (n.includes("binance")) {
    return <SiBinance className={`${className} text-[#F3BA2F]`} />;
  }

  return <Package className={`${className} text-[#2D4F38]`} />;
};

// Provider Metadata
const getProviderConfig = (name: string, type: string) => {
  const n = (name + " " + type).toLowerCase();
  if (n.includes("aws") || n.includes("amazon")) {
    return {
      tag: "AWS Cloud",
      accent: "#FF9900",
      bgBadge: "bg-[#FFF3E0] text-[#E65100]",
      blobColor: "from-amber-100/70 to-orange-100/40",
      category: "aws",
    };
  }
  if (n.includes("digitalocean") || n.includes("digital ocean")) {
    return {
      tag: "DigitalOcean",
      accent: "#0080FF",
      bgBadge: "bg-[#E1F5FE] text-[#0277BD]",
      blobColor: "from-sky-100/70 to-blue-100/40",
      category: "digitalocean",
    };
  }
  if (n.includes("azure") || n.includes("microsoft")) {
    return {
      tag: "MS Azure",
      accent: "#0089D6",
      bgBadge: "bg-[#E3F2FD] text-[#1565C0]",
      blobColor: "from-blue-100/70 to-indigo-100/40",
      category: "azure",
    };
  }
  if (n.includes("oracle")) {
    return {
      tag: "Oracle Cloud",
      accent: "#F11010",
      bgBadge: "bg-[#FFEBEE] text-[#C62828]",
      blobColor: "from-red-100/70 to-rose-100/40",
      category: "oracle",
    };
  }
  if (n.includes("linod") || n.includes("linode") || n.includes("akamai")) {
    return {
      tag: "Linode",
      accent: "#00A95C",
      bgBadge: "bg-[#E8F5E9] text-[#2E7D32]",
      blobColor: "from-emerald-100/70 to-teal-100/40",
      category: "linode",
    };
  }
  if (n.includes("spotify")) {
    return {
      tag: "Spotify",
      accent: "#1DB954",
      bgBadge: "bg-[#E8F8EE] text-[#1DB954]",
      blobColor: "from-green-100/70 to-emerald-100/40",
      category: "spotify",
    };
  }
  if (n.includes("youtube")) {
    return {
      tag: "YouTube",
      accent: "#FF0000",
      bgBadge: "bg-[#FFEBEE] text-[#D32F2F]",
      blobColor: "from-red-100/70 to-rose-100/40",
      category: "youtube",
    };
  }
  if (n.includes("tiktok")) {
    return {
      tag: "TikTok",
      accent: "#000000",
      bgBadge: "bg-[#F3F4F6] text-[#111827]",
      blobColor: "from-gray-100/70 to-slate-100/40",
      category: "tiktok",
    };
  }
  if (n.includes("instagram")) {
    return {
      tag: "Instagram",
      accent: "#E1306C",
      bgBadge: "bg-[#FCE4EC] text-[#C2185B]",
      blobColor: "from-pink-100/70 to-rose-100/40",
      category: "instagram",
    };
  }
  if (n.includes("facebook") || n.includes("fb")) {
    return {
      tag: "Facebook",
      accent: "#1877F2",
      bgBadge: "bg-[#E7F3FF] text-[#1877F2]",
      blobColor: "from-blue-100/70 to-indigo-100/40",
      category: "facebook",
    };
  }
  if (n.includes("chatgpt") || n.includes("openai")) {
    return {
      tag: "ChatGPT",
      accent: "#10A37F",
      bgBadge: "bg-[#E6F4EA] text-[#137333]",
      blobColor: "from-emerald-100/70 to-teal-100/40",
      category: "chatgpt",
    };
  }
  if (n.includes("gemini")) {
    return {
      tag: "Gemini AI",
      accent: "#1BA0E2",
      bgBadge: "bg-[#E8F0FE] text-[#1967D2]",
      blobColor: "from-blue-100/70 to-cyan-100/40",
      category: "gemini",
    };
  }
  if (n.includes("claude")) {
    return {
      tag: "Claude AI",
      accent: "#D97757",
      bgBadge: "bg-[#FBE9E7] text-[#D84315]",
      blobColor: "from-orange-100/70 to-amber-100/40",
      category: "claude",
    };
  }
  if (n.includes("capcut")) {
    return {
      tag: "CapCut",
      accent: "#000000",
      bgBadge: "bg-[#F3F4F6] text-[#111827]",
      blobColor: "from-slate-100/70 to-gray-100/40",
      category: "capcut",
    };
  }
  if (n.includes("duolingo")) {
    return {
      tag: "Duolingo",
      accent: "#58CC02",
      bgBadge: "bg-[#F1F8E9] text-[#33691E]",
      blobColor: "from-lime-100/70 to-green-100/40",
      category: "duolingo",
    };
  }
  if (n.includes("kamatera")) {
    return {
      tag: "Kamatera",
      accent: "#FF6F00",
      bgBadge: "bg-[#FFF8E1] text-[#F57F17]",
      blobColor: "from-amber-100/70 to-yellow-100/40",
      category: "kamatera",
    };
  }
  return {
    tag: type || "Digital Product",
    accent: "#2D4F38",
    bgBadge: "bg-[#F1F4EE] text-[#2D4F38]",
    blobColor: "from-emerald-100/60 to-green-100/40",
    category: "other",
  };
};

// Live 2FA Component
function LiveTOTP({ secret, onCopy }: { secret: string; onCopy: (text: string) => void }) {
  const [code, setCode] = useState("000000");
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const updateCode = async () => {
      const newCode = await generateTOTP(secret);
      setCode(newCode);
    };

    updateCode();
    const timer = setInterval(() => {
      const remaining = getRemainingSeconds();
      setTimeLeft(remaining);
      if (remaining === 30) {
        updateCode();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [secret]);

  return (
    <div className="bg-gradient-to-br from-[#203a2a] to-[#2D4F38] p-4 rounded-3xl text-white shadow-md relative overflow-hidden mb-4">
      <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 blur-2xl rounded-full translate-x-8 -translate-y-8" />
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live 2FA Code
          </div>
          <div className="text-3xl font-black tracking-widest font-mono mt-1">
            {code.slice(0, 3)} {code.slice(3)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="19"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                className="text-white/20"
              />
              <circle
                cx="24"
                cy="24"
                r="19"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={119.38}
                strokeDashoffset={119.38 - (119.38 * timeLeft) / 30}
                strokeLinecap="round"
                className="text-emerald-400 transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="absolute text-[10px] font-bold">{timeLeft}s</span>
          </div>
          <button
            onClick={() => onCopy(code)}
            className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-transform active:scale-95 text-white"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

type TabType = "home" | "categories" | "orders" | "wallet" | "profile";

export default function MiniAppShopModern() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("shop_favorites") || "[]");
    } catch {
      return [];
    }
  });

  // Selected Product Detail Modal
  const [detailProduct, setDetailProduct] = useState<(Product & { stockCount?: number }) | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // AI Support Chat Drawer
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "bot"; content: string }[]>([
    { role: "bot", content: "👋 Hi! Welcome to youuhost. How can I help you choose the best cloud server or account today?" },
  ]);
  const [isChatSending, setIsChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Category Horizontal Scroll & Drag Support for Mobile and Desktop
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [isCatDown, setIsCatDown] = useState(false);
  const [catStartX, setCatStartX] = useState(0);
  const [catScrollLeft, setCatScrollLeft] = useState(0);
  const [catMoved, setCatMoved] = useState(false);

  // Top-Up State
  const [cryptomusAmount, setCryptomusAmount] = useState("10");
  const [isCreatingCryptomus, setIsCreatingCryptomus] = useState(false);

  const handleCatMouseDown = (e: React.MouseEvent) => {
    if (!catScrollRef.current) return;
    setIsCatDown(true);
    setCatMoved(false);
    setCatStartX(e.pageX - catScrollRef.current.offsetLeft);
    setCatScrollLeft(catScrollRef.current.scrollLeft);
  };

  const handleCatMouseMove = (e: React.MouseEvent) => {
    if (!isCatDown || !catScrollRef.current) return;
    const x = e.pageX - catScrollRef.current.offsetLeft;
    const walk = (x - catStartX) * 1.5;
    if (Math.abs(walk) > 5) {
      setCatMoved(true);
    }
    catScrollRef.current.scrollLeft = catScrollLeft - walk;
  };

  const handleCatMouseUp = () => {
    setIsCatDown(false);
  };

  useEffect(() => {
    expandTelegramWebApp();
    document.body.style.background = "#F8F9FD";
    document.body.style.backgroundColor = "#F8F9FD";
    return () => {
      document.body.style.background = "";
      document.body.style.backgroundColor = "";
    };
  }, []);

  const toggleFavorite = (productId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId];
      try {
        localStorage.setItem("shop_favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Customer Auth State
  const [authEmail, setAuthEmail] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState("");
  const [googleNameInput, setGoogleNameInput] = useState("");

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  // Queries
  const { data: user, isLoading: userLoading, refetch: refetchUser } = useQuery<TelegramUser & { isLoggedIn?: boolean }>({
    queryKey: ["/api/mini/user"],
    queryFn: async () => {
      const res = await miniApiRequest("GET", "/api/mini/user");
      return res.json();
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<(Product & { stockCount?: number })[]>({
    queryKey: ["/api/mini/products"],
    queryFn: async () => {
      const res = await miniApiRequest("GET", "/api/mini/products");
      return res.json();
    },
  });

  const { data: offers = [] } = useQuery<SpecialOffer[]>({
    queryKey: ["/api/mini/offers"],
    queryFn: async () => {
      const res = await miniApiRequest("GET", "/api/mini/offers");
      return res.json();
    },
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/mini/orders"],
    queryFn: async () => {
      const res = await miniApiRequest("GET", "/api/mini/orders");
      return res.json();
    },
    enabled: activeTab === "orders" || activeTab === "profile",
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/mini/payments"],
    queryFn: async () => {
      const res = await miniApiRequest("GET", "/api/mini/payments");
      return res.json();
    },
    enabled: activeTab === "wallet" || activeTab === "profile",
  });

  const { data: supportUserSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/SUPPORT_USERNAME"],
  });

  const supportUser = supportUserSetting?.value || "@rochana_imesh";

  const { data: depositMethods } = useQuery<{ binancePayId: string; cryptomusEnabled: boolean; supportUsername: string }>({
    queryKey: ["/api/mini/deposit/methods"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/mini/deposit/methods");
        return res.json();
      } catch {
        return { binancePayId: "284910485", cryptomusEnabled: true, supportUsername: "@rochana_imesh" };
      }
    },
  });

  const binancePayId = depositMethods?.binancePayId || "410975578";

  // Currency State (USD / LKR)
  const [selectedCurrency, setSelectedCurrency] = useState<"USD" | "LKR">(() => {
    return (localStorage.getItem("app_currency") as "USD" | "LKR") || "USD";
  });

  const { data: currencyData } = useQuery<{ rates: Record<string, number> }>({
    queryKey: ["/api/currency/rates"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/currency/rates");
        return res.json();
      } catch {
        return { rates: { USD: 1.0, LKR: 305.50 } };
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const lkrRate = currencyData?.rates?.LKR || 305.50;

  // Binance Pay Interactive State
  const [binanceAmount, setBinanceAmount] = useState<string>(() => {
    return (localStorage.getItem("app_currency") === "LKR") ? "1000" : "5";
  });
  const [binanceTxId, setBinanceTxId] = useState<string>("");
  const [isVerifyingBinance, setIsVerifyingBinance] = useState<boolean>(false);
  const [binanceSuccessMsg, setBinanceSuccessMsg] = useState<string | null>(null);
  const [binanceErrorMsg, setBinanceErrorMsg] = useState<string | null>(null);

  const handleCurrencyChange = (curr: "USD" | "LKR") => {
    setSelectedCurrency(curr);
    localStorage.setItem("app_currency", curr);
    if (curr === "LKR") {
      setBinanceAmount("1000");
      setCryptomusAmount("1000");
    } else {
      setBinanceAmount("5");
      setCryptomusAmount("10");
    }
  };

  // Formatter for product pricing
  const formatProductPrice = (prod: Product, qty: number = 1) => {
    if (selectedCurrency === "LKR") {
      if ((prod as any).priceLkr && (prod as any).priceLkr > 0) {
        const totalLkr = (prod as any).priceLkr * qty;
        return `Rs. ${totalLkr.toLocaleString()}`;
      }
      const totalLkr = Math.round(((prod.price * qty) / 100) * lkrRate);
      return `Rs. ${totalLkr.toLocaleString()}`;
    }
    const totalUsd = (prod.price * qty) / 100;
    return `$${totalUsd.toFixed(2)}`;
  };

  const formatBalanceInCurrentCurrency = (balanceCents: number) => {
    const usd = (balanceCents || 0) / 100;
    if (selectedCurrency === "LKR") {
      const lkr = usd * lkrRate;
      return `Rs. ${lkr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${usd.toFixed(2)}`;
  };

  // Effective USD amount to send / verify
  const binanceCalculatedUsd = useMemo(() => {
    const val = parseFloat(binanceAmount || "0");
    if (isNaN(val) || val <= 0) return 0;
    if (selectedCurrency === "LKR") {
      return parseFloat((val / lkrRate).toFixed(2));
    }
    return parseFloat(val.toFixed(2));
  }, [binanceAmount, selectedCurrency, lkrRate]);

  const cryptomusCalculatedUsd = useMemo(() => {
    const val = parseFloat(cryptomusAmount || "0");
    if (isNaN(val) || val <= 0) return 0;
    if (selectedCurrency === "LKR") {
      return parseFloat((val / lkrRate).toFixed(2));
    }
    return parseFloat(val.toFixed(2));
  }, [cryptomusAmount, selectedCurrency, lkrRate]);

  const handleBinanceSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const usdNum = binanceCalculatedUsd;
    if (usdNum < 0.5) {
      toast({
        title: "Invalid Amount",
        description: selectedCurrency === "LKR" ? "Minimum top-up is Rs. 150" : "Minimum top-up is $0.50",
        variant: "destructive"
      });
      return;
    }
    if (!binanceTxId.trim() || binanceTxId.trim().length < 4) {
      toast({
        title: "Order ID Required",
        description: "Please enter your Binance Pay Order ID or Transaction ID (TxID).",
        variant: "destructive"
      });
      return;
    }

    setIsVerifyingBinance(true);
    setBinanceSuccessMsg(null);
    setBinanceErrorMsg(null);
    try {
      const res = await miniApiRequest("POST", "/api/mini/deposit/binance", {
        amount: usdNum,
        orderId: binanceTxId.trim(),
        txId: binanceTxId.trim(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBinanceSuccessMsg(data.message);
        toast({
          title: "✅ Payment Verified!",
          description: data.message,
        });
        setBinanceTxId("");
        queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
        queryClient.invalidateQueries({ queryKey: ["/api/mini/payments"] });
      } else {
        const errorText = data.message || "Could not verify Binance Pay payment.";
        setBinanceErrorMsg(errorText);
        toast({
          title: "Verification Failed",
          description: errorText,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      const errorText = err.message || "Failed to submit Binance payment verification.";
      setBinanceErrorMsg(errorText);
      toast({
        title: "Verification Failed",
        description: errorText,
        variant: "destructive",
      });
    } finally {
      setIsVerifyingBinance(false);
    }
  };

  // Check if current visitor is inside Telegram Mini App or has real Telegram ID
  const isTelegramUser = useMemo(() => {
    const tg = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (tg?.id) return true;
    if (user?.telegramId && user.telegramId !== "0" && user.telegramId !== "web_guest" && !user.telegramId.startsWith("email:") && !user.telegramId.startsWith("google:")) return true;
    return false;
  }, [user]);

  const isCustomerLoggedIn = useMemo(() => {
    if (isTelegramUser) return true;
    if (user?.isLoggedIn === true) return true;
    if (user?.telegramId && user.telegramId !== "0" && user.telegramId !== "web_guest") return true;
    return false;
  }, [user, isTelegramUser]);

  // Dynamic Greeting based on client time
  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning,";
    if (hr < 17) return "Good Afternoon,";
    return "Good Evening,";
  }, []);

  const displayName = useMemo(() => {
    if (user?.firstName) return user.firstName;
    if (user?.email) return user.email.split('@')[0];
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.first_name) return tgUser.first_name;
    return isTelegramUser ? "Telegram User" : "Web Visitor";
  }, [user, isTelegramUser]);

  // Handle Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authEmail || !authEmail.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/auth/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send code.");
      }
      setOtpSent(true);
      setResendTimer(60);
      toast({
        title: "Verification Code Sent!",
        description: data.devCode
          ? `Code sent to ${authEmail}! (Demo Code: ${data.devCode})`
          : `We've sent a 6-digit code to ${authEmail}. Please check your inbox.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to send code.",
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authOtp || authOtp.length < 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await fetch("/api/auth/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), code: authOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Verification failed.");
      }
      toast({
        title: "Welcome!",
        description: `Successfully signed in as ${data.user?.email || data.user?.firstName}!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/payments"] });
      refetchUser();
      setAuthOtp("");
      setOtpSent(false);
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message || "Invalid or expired code.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async (customEmail?: string, customName?: string) => {
    setIsGoogleLoading(true);
    try {
      const emailToUse = customEmail || googleEmailInput || "";
      const nameToUse = customName || googleNameInput || (emailToUse ? emailToUse.split("@")[0] : "");

      if (!emailToUse || !emailToUse.includes("@")) {
        setShowGoogleModal(true);
        setIsGoogleLoading(false);
        return;
      }

      const res = await fetch("/api/auth/customer/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToUse.trim(),
          name: nameToUse.trim(),
          picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameToUse)}&backgroundColor=4285F4`,
          sub: "google_" + Math.random().toString(36).substring(2, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Google sign-in failed.");
      }
      toast({
        title: "Google Sign-In Successful!",
        description: `Welcome, ${data.user?.firstName || data.user?.email}!`,
      });
      setShowGoogleModal(false);
      setGoogleEmailInput("");
      setGoogleNameInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/payments"] });
      refetchUser();
    } catch (err: any) {
      toast({
        title: "Sign-In Failed",
        description: err.message || "Google sign-in failed.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/customer/logout", { method: "POST" });
      toast({
        title: "Signed Out",
        description: "You have been logged out successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/payments"] });
      refetchUser();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleCryptomusPay = async () => {
    const usdNum = cryptomusCalculatedUsd;
    if (usdNum < 0.5) {
      toast({
        title: "Invalid Amount",
        description: selectedCurrency === "LKR" ? "Minimum top-up is Rs. 150" : "Minimum top-up is $0.50",
        variant: "destructive"
      });
      return;
    }
    setIsCreatingCryptomus(true);
    try {
      const res = await miniApiRequest("POST", "/api/mini/deposit/cryptomus", { amount: usdNum });
      const data = await res.json();
      if (data.url) {
        toast({ title: "Invoice Created", description: "Opening Cryptomus checkout...", duration: 2500 });
        if ((window as any).Telegram?.WebApp?.openLink) {
          (window as any).Telegram.WebApp.openLink(data.url);
        } else {
          window.open(data.url, "_blank");
        }
      } else {
        toast({ title: "Payment Error", description: data.message || "Failed to create invoice", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not connect to payment gateway", variant: "destructive" });
    } finally {
      setIsCreatingCryptomus(false);
    }
  };

  // Real Brand Categories with Crisp Vector Icons
  const categories = [
    { id: "all", label: "All", renderIcon: () => <LayoutGrid className="w-5 h-5" /> },
    { id: "aws", label: "AWS", renderIcon: () => <FaAws className="w-5 h-5 text-[#FF9900]" /> },
    { id: "digitalocean", label: "DigitalOcean", renderIcon: () => <SiDigitalocean className="w-5 h-5 text-[#0080FF]" /> },
    { id: "azure", label: "Azure", renderIcon: () => <VscAzure className="w-5 h-5 text-[#0089D6]" /> },
    { id: "oracle", label: "Oracle", renderIcon: () => <OracleLogo className="w-5 h-5" /> },
    { id: "linode", label: "Linode", renderIcon: () => <LinodeLogo className="w-5 h-5" /> },
    { id: "google", label: "GCP", renderIcon: () => <SiGooglecloud className="w-5 h-5 text-[#4285F4]" /> },
    { id: "telegram", label: "Telegram", renderIcon: () => <FaTelegramPlane className="w-5 h-5 text-[#24A1DE]" /> },
    { id: "spotify", label: "Spotify", renderIcon: () => <FaSpotify className="w-5 h-5 text-[#1DB954]" /> },
    { id: "youtube", label: "YouTube", renderIcon: () => <FaYoutube className="w-5 h-5 text-[#FF0000]" /> },
    { id: "tiktok", label: "TikTok", renderIcon: () => <FaTiktok className="w-5 h-5 text-[#000000]" /> },
    { id: "instagram", label: "Instagram", renderIcon: () => <FaInstagram className="w-5 h-5 text-[#E1306C]" /> },
    { id: "facebook", label: "Facebook", renderIcon: () => <FaFacebook className="w-5 h-5 text-[#1877F2]" /> },
    { id: "chatgpt", label: "ChatGPT", renderIcon: () => <SiOpenai className="w-5 h-5 text-[#10A37F]" /> },
    { id: "gemini", label: "Gemini", renderIcon: () => <SiGooglegemini className="w-5 h-5 text-[#1BA0E2]" /> },
    { id: "claude", label: "Claude", renderIcon: () => <ClaudeLogo className="w-5 h-5" /> },
    { id: "capcut", label: "CapCut", renderIcon: () => <CapCutLogo className="w-5 h-5" /> },
    { id: "duolingo", label: "Duolingo", renderIcon: () => <SiDuolingo className="w-5 h-5 text-[#58CC02]" /> },
  ];

  // Helper to compute available stock quantity for each category
  const getCategoryCount = useMemo(() => {
    return (categoryId: string) => {
      if (categoryId === "all") {
        const totalStock = products.reduce((acc, p) => acc + (p.stockCount || 0), 0);
        return totalStock > 0 ? totalStock : products.length;
      }
      const matching = products.filter((p) => {
        const conf = getProviderConfig(p.name, p.type);
        return (
          conf.category === categoryId ||
          p.type.toLowerCase().includes(categoryId) ||
          p.name.toLowerCase().includes(categoryId)
        );
      });
      const totalStock = matching.reduce((acc, p) => acc + (p.stockCount || 0), 0);
      return totalStock > 0 ? totalStock : matching.length;
    };
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const conf = getProviderConfig(p.name, p.type);
      const matchesCategory =
        selectedCategory === "all" ||
        conf.category === selectedCategory ||
        p.type.toLowerCase().includes(selectedCategory) ||
        p.name.toLowerCase().includes(selectedCategory);
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Handle Quick Purchase
  const handlePurchase = async () => {
    if (!detailProduct) return;
    const userBalanceUsd = (user?.balance || 0) / 100;
    const totalPriceUsd = (detailProduct.price * quantity) / 100;

    if (userBalanceUsd < totalPriceUsd) {
      const neededStr = formatProductPrice(detailProduct, quantity);
      const currentBalStr = formatBalanceInCurrentCurrency(user?.balance || 0);

      toast({
        title: "Insufficient Balance",
        description: `You need ${neededStr}, but your balance is ${currentBalStr}. Please top up your wallet.`,
        variant: "destructive",
      });
      setActiveTab("wallet");
      setDetailProduct(null);
      return;
    }

    setIsPurchasing(true);
    try {
      const res = await miniApiRequest("POST", "/api/mini/purchase", {
        productId: detailProduct.id,
        quantity,
      });
      await res.json();
      toast({
        title: "🎉 Purchase Successful!",
        description: "Your cloud credentials are ready in your Orders tab.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/orders"] });
      setDetailProduct(null);
      setActiveTab("orders");
    } catch (err: any) {
      toast({
        title: "Order Notice",
        description: err.message || "Please complete purchase via the Telegram Bot.",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const res = document.execCommand("copy");
      document.body.removeChild(textArea);
      return res;
    } catch (e) {
      console.warn("Fallback copy error:", e);
      return false;
    }
  };

  const copyToClipboard = (text: string, title = "Copied to Clipboard") => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    } catch {
      fallbackCopy(text);
    }
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2500);
    toast({ title, description: `${text} copied to clipboard.`, duration: 2000 });
  };

  const handleSendChat = async () => {
    if (!chatMsg.trim() || isChatSending) return;
    const msg = chatMsg.trim();
    setChatHistory((prev) => [...prev, { role: "user", content: msg }]);
    setChatMsg("");
    setIsChatSending(true);

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setChatHistory((prev) => [
        ...prev,
        { role: "bot", content: data.answer || "I'm always here to help!" },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "bot", content: `Please message our human support at ${supportUser}.` },
      ]);
    } finally {
      setIsChatSending(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#181432] font-sans antialiased pb-28 select-none">
      <div className="max-w-md mx-auto px-5 pt-5 sm:pt-7">
        
        {/* TOP BRANDING HEADER: youuhost Logo */}
        <div className="flex items-center mb-3">
          <img
            src={youuHostLogo}
            alt="youuhost"
            className="h-6 sm:h-7 w-auto object-contain drop-shadow-sm"
          />
        </div>

        {/* Greeting & Avatar Bar */}
        <header className="flex items-center justify-between mb-5">
          <div>
            <span className="text-xs font-semibold text-[#7E7998] tracking-wide block">{greeting}</span>
            <h1 className="text-2xl font-black text-[#181432] tracking-tight">{displayName}</h1>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Balance Pill */}
            <button
              onClick={() => setActiveTab("wallet")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-sm border border-[#ECEEF8] hover:border-[#6C5CE7] transition-all group"
            >
              <Wallet className="w-3.5 h-3.5 text-[#D92078] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-[#181432]">
                {formatBalanceInCurrentCurrency(user?.balance || 0)}
              </span>
            </button>

            {/* Profile Avatar */}
            <button
              onClick={() => setActiveTab("profile")}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FFE4E6] to-[#EDE9FE] border-2 border-white shadow-sm flex items-center justify-center overflow-hidden hover:scale-105 transition-transform"
            >
              {user?.username && isTelegramUser ? (
                <span className="text-sm font-black bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7] bg-clip-text text-transparent">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              ) : (
                <UserIcon className="w-5 h-5 text-[#5B42F3]" />
              )}
            </button>
          </div>
        </header>

        {/* Search Bar with Filter Icon */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-[#9490A8] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cloud servers, accounts, AI..."
              className="w-full pl-11 pr-4 py-3.5 bg-white rounded-2xl text-xs font-semibold text-[#181432] placeholder-[#9490A8] shadow-sm border border-transparent focus:border-[#6C5CE7] focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9490A8] hover:text-[#181432]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setSelectedCategory("all")}
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF5E62] to-[#6C5CE7] text-white flex items-center justify-center shadow-md shadow-[#6C5CE7]/25 hover:opacity-95 transition-all active:scale-95"
            title="Reset Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* MAIN TAB CONTENT */}
        {activeTab === "home" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            
            {/* Real Brand Icons Category Badges */}
            <div
              ref={catScrollRef}
              onMouseDown={handleCatMouseDown}
              onMouseMove={handleCatMouseMove}
              onMouseUp={handleCatMouseUp}
              onMouseLeave={handleCatMouseUp}
              className="flex items-center gap-3 overflow-x-auto pb-2.5 mb-6 scrollbar-none overscroll-x-contain touch-pan-x cursor-grab active:cursor-grabbing -mx-5 px-5"
              style={{
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                touchAction: "pan-x",
              }}
            >
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                const count = getCategoryCount(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (!catMoved) {
                        setSelectedCategory(cat.id);
                      }
                    }}
                    className={`relative flex flex-col items-center justify-center min-w-[78px] h-[84px] px-3 rounded-2xl transition-all duration-200 shrink-0 ${
                      isActive
                        ? "bg-gradient-to-b from-[#FF5E62] to-[#6C5CE7] text-white shadow-lg shadow-[#6C5CE7]/30 scale-105"
                        : "bg-white text-[#4A4568] shadow-sm border border-[#ECEEF8] hover:bg-[#F5F4FC]"
                    }`}
                  >
                    {/* Top-Right Available Quantity Badge */}
                    <span
                      className={`absolute top-2 right-2 px-1.5 min-w-[18px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-black tracking-tight leading-none ${
                        isActive
                          ? "bg-white text-[#5B42F3] shadow-sm"
                          : count > 0
                          ? "bg-gradient-to-r from-[#FF5E62] to-[#D92078] text-white shadow-xs"
                          : "bg-[#ECEEF8] text-[#9490A8]"
                      }`}
                    >
                      {count}
                    </span>

                    <div className="h-7 w-7 flex items-center justify-center mb-1.5">
                      {cat.renderIcon()}
                    </div>
                    <span className={`text-[11px] font-bold tracking-tight whitespace-nowrap text-center ${isActive ? "text-white" : "text-[#4A4568]"}`}>
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Featured Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#FFF0F5] via-[#F5EDFF] to-[#EDE9FE] p-5 shadow-sm mb-7 border border-[#E4DCFA]">
              <div className="relative z-10 max-w-[65%]">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#D92078] bg-white/90 shadow-sm px-2.5 py-1 rounded-full inline-block mb-2">
                  ⚡ Verified Cloud & AI
                </span>
                <h2 className="text-lg font-black text-[#181432] leading-tight mb-1.5">
                  High Performance Dedicated Cloud
                </h2>
                <p className="text-[11px] text-[#6B658B] leading-snug mb-4">
                  Handpicked & automated cloud accounts with guaranteed quotas.
                </p>
                <button
                  onClick={() => setSelectedCategory("aws")}
                  className="px-4 py-2 bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7] text-white rounded-full text-xs font-bold shadow-md shadow-[#6C5CE7]/25 hover:opacity-95 transition-transform active:scale-95 flex items-center gap-1.5"
                >
                  Explore Now <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Decorative 3D Cloud Banner */}
              <div className="absolute -right-4 -bottom-4 w-36 h-36 opacity-90 pointer-events-none flex items-center justify-center">
                <div className="w-28 h-28 rounded-full bg-white/40 blur-xl absolute" />
                <img
                  src="/imesh_cloudbot_banner.png"
                  alt="Feature"
                  className="w-28 h-28 object-contain drop-shadow-md transform -rotate-6 hover:rotate-0 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as any).style.display = "none";
                  }}
                />
              </div>
            </div>

            {/* Best Sellers Section */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-[#181432] tracking-tight">Best Sellers</h3>
              <button
                onClick={() => setSelectedCategory("all")}
                className="text-xs font-bold text-[#5B42F3] hover:text-[#D92078] transition-colors"
              >
                View all
              </button>
            </div>

            {/* Products Grid */}
            {productsLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#7E7998]">
                <Loader2 className="w-7 h-7 animate-spin mb-2 text-[#5B42F3]" />
                <span className="text-xs font-semibold">Loading catalog...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-[#ECEEF8]">
                <Package className="w-10 h-10 mx-auto text-[#8FA597] mb-2" />
                <h4 className="text-sm font-bold text-[#1C3324]">No products found</h4>
                <p className="text-xs text-[#6B8574] mt-1">Try another category or search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {filteredProducts.map((prod) => {
                  const conf = getProviderConfig(prod.name, prod.type);
                  const isFav = favorites.includes(prod.id);
                  const priceFormatted = formatProductPrice(prod);

                  return (
                    <motion.div
                      key={prod.id}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setDetailProduct(prod);
                        setQuantity(1);
                      }}
                      className="bg-white rounded-3xl p-3.5 shadow-sm border border-[#ECEEF8] flex flex-col justify-between cursor-pointer hover:shadow-md transition-all relative group"
                    >
                      {/* Top Action: Provider Tag & Heart Favorite */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${conf.bgBadge}`}>
                          {conf.tag}
                        </span>
                        <button
                          onClick={(e) => toggleFavorite(prod.id, e)}
                          className="w-7 h-7 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#7E7998] hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
                        </button>
                      </div>

                      {/* Centered Image with Real Brand Icon and Organic Blob Background */}
                      <div className="relative my-2 py-3 flex items-center justify-center">
                        <div
                          className={`w-20 h-20 rounded-full bg-gradient-to-br ${conf.blobColor} absolute blur-sm`}
                        />
                        <div className="relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-300">
                          <BrandIcon name={prod.name} type={prod.type} className="w-12 h-12" />
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="mt-1">
                        <h4 className="text-xs font-extrabold text-[#181432] line-clamp-1 group-hover:text-[#5B42F3] transition-colors">
                          {prod.name}
                        </h4>
                        <p className="text-[10px] text-[#7E7998] line-clamp-1 mt-0.5">
                          {prod.description || `${prod.type} Verified Account`}
                        </p>
                      </div>

                      {/* Bottom Price & Add (+) Button */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F5F4FC]">
                        <div>
                          <span className="text-xs font-black text-[#181432]">{priceFormatted}</span>
                          <span className="text-[9px] text-[#7E7998] block">per unit</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailProduct(prod);
                            setQuantity(1);
                          }}
                          className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF5E62] to-[#6C5CE7] text-white flex items-center justify-center shadow-md shadow-[#6C5CE7]/20 hover:opacity-95 active:scale-90 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* CATEGORIES FULL TAB */}
        {activeTab === "categories" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-lg font-black text-[#181432] mb-4">All Product Categories</h2>
            <div className="grid grid-cols-2 gap-3.5">
              {categories
                .filter((c) => c.id !== "all")
                .map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setActiveTab("home");
                    }}
                    className="bg-white rounded-3xl p-4 shadow-sm border border-[#ECEEF8] flex flex-col items-center text-center cursor-pointer hover:border-[#6C5CE7] hover:shadow-md transition-all"
                  >
                    <div className="mb-2 h-8 w-8 flex items-center justify-center">{cat.renderIcon()}</div>
                    <h4 className="text-sm font-bold text-[#181432]">{cat.label}</h4>
                    <span className="text-[10px] text-[#7E7998] mt-0.5">
                      {getCategoryCount(cat.id)} Available
                    </span>
                  </div>
                ))}
            </div>
          </motion.div>
        )}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#181432]">My Orders & 2FA Keys</h2>
              <span className="text-xs font-bold text-[#7E7998]">{orders.length} Purchases</span>
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-[#ECEEF8]">
                <Package className="w-10 h-10 mx-auto text-[#9490A8] mb-2" />
                <h4 className="text-sm font-bold text-[#181432]">No orders yet</h4>
                <p className="text-xs text-[#7E7998] mt-1">Explore our catalog and make your first purchase!</p>
                <Button
                  onClick={() => setActiveTab("home")}
                  className="mt-4 bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7] hover:opacity-95 text-white rounded-full text-xs font-bold px-6 shadow-md shadow-[#6C5CE7]/25"
                >
                  Start Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((ord: any) => (
                  <div
                    key={ord.id}
                    className="bg-white rounded-3xl p-4 shadow-sm border border-[#ECEEF8] hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-extrabold text-[#5B42F3] bg-[#EDE9FE] px-2.5 py-0.5 rounded-full">
                        Order #{ord.id}
                      </span>
                      <span className="text-[10px] text-[#7E7998]">
                        {ord.createdAt ? format(new Date(ord.createdAt), "MMM d, yyyy • HH:mm") : "Recent"}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-[#181432] mb-1">
                      {ord.product?.name || "Cloud Account Order"}
                    </h4>

                    {/* Show 2FA if credential exists */}
                    {ord.credential?.twoFactorSecret && (
                      <div className="mt-3">
                        <LiveTOTP
                          secret={ord.credential.twoFactorSecret}
                          onCopy={(c) => copyToClipboard(c, "2FA Code Copied")}
                        />
                      </div>
                    )}

                    {ord.credential?.data && (
                      <div className="bg-[#F8F7FD] p-2.5 rounded-2xl border border-[#ECEEF8] mt-2 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#5B42F3] truncate max-w-[220px]">
                          {ord.credential.data}
                        </span>
                        <button
                          onClick={() => copyToClipboard(ord.credential.data, "Credentials Copied")}
                          className="text-xs font-bold text-[#D92078] hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* WALLET TAB */}
        {activeTab === "wallet" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Ultra-Modern Live Balance & Currency Switcher Card */}
            <div className="bg-gradient-to-br from-[#120B2E] via-[#21124C] to-[#4E2ECF] rounded-3xl p-6 text-white shadow-2xl shadow-[#4E2ECF]/30 border border-white/10 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-44 h-44 bg-[#FF5E62]/15 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none" />
              <div className="absolute left-0 bottom-0 w-40 h-40 bg-[#5B42F3]/20 rounded-full blur-3xl translate-y-10 -translate-x-10 pointer-events-none" />

              {/* Top Row: Available Balance Label & Currency Switcher */}
              <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/80" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-200/90">
                    Available Balance
                  </span>
                </div>

                {/* Currency Switcher Pill */}
                <div className="flex items-center bg-black/40 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-inner">
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange("USD")}
                    className={`px-3 py-1 rounded-xl text-[11px] font-black tracking-wide transition-all ${
                      selectedCurrency === "USD"
                        ? "bg-gradient-to-r from-[#FF5E62] to-[#D92078] text-white shadow-md shadow-[#D92078]/40 scale-105"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange("LKR")}
                    className={`px-3 py-1 rounded-xl text-[11px] font-black tracking-wide transition-all ${
                      selectedCurrency === "LKR"
                        ? "bg-gradient-to-r from-[#5B42F3] to-[#00C9FF] text-white shadow-md shadow-[#5B42F3]/40 scale-105"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    LKR (Rs)
                  </button>
                </div>
              </div>

              {/* Big Balance Amount */}
              <div className="relative z-10 mb-2">
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-baseline gap-1.5">
                  {formatBalanceInCurrentCurrency(user?.balance || 0)}
                </h2>
                <span className="text-xs font-bold text-purple-200/75 block mt-0.5">
                  {selectedCurrency === "USD"
                    ? `≈ Rs. ${(((user?.balance || 0) / 100) * lkrRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR`
                    : `≈ $${((user?.balance || 0) / 100).toFixed(2)} USD`}
                </span>
              </div>

              {/* Bottom Row: Live Exchange Rate Badge & User Info */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10 relative z-10 text-[11px]">
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full text-purple-100 font-bold">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-300" />
                  <span>1 USD = {lkrRate.toFixed(2)} LKR</span>
                </div>
                <span className="text-purple-300/80 font-mono text-[10px] truncate max-w-[140px]">
                  ID: {user?.telegramId || (user?.email ? user.email.split('@')[0] : "Guest")}
                </span>
              </div>
            </div>

            {/* PAYMENT METHODS */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-[#181432] uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#D92078]" /> PAYMENT METHODS
              </h3>

              {/* 1. BINANCE PAY REAL GATEWAY */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ECEEF8] relative overflow-hidden">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-[#F3BA2F]/15 flex items-center justify-center shadow-sm">
                      <BinanceLogo className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#181432]">Binance Pay Gateway</h4>
                      <span className="text-[10px] font-bold text-[#7E7998]">Zero Fee • Real-time Verification</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold text-[#F3BA2F] bg-[#F3BA2F]/10 px-2.5 py-1 rounded-full border border-[#F3BA2F]/20">
                    FAST PAY
                  </span>
                </div>

                {/* Step 1: Amount Selection */}
                <div className="mb-3.5">
                  <label className="text-[10px] font-bold text-[#7E7998] block uppercase mb-1.5 flex items-center justify-between">
                    <span>1. Select Top-Up Amount ({selectedCurrency})</span>
                    {selectedCurrency === "LKR" ? (
                      <span className="text-purple-600 font-black text-[10px] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                        Pay: ${binanceCalculatedUsd.toFixed(2)} USDT
                      </span>
                    ) : (
                      <span className="text-purple-600 font-black text-[10px]">
                        ≈ Rs. {Math.round(parseFloat(binanceAmount || "0") * lkrRate).toLocaleString()} LKR
                      </span>
                    )}
                  </label>
                  <div className={`grid ${selectedCurrency === "LKR" ? "grid-cols-4" : "grid-cols-5"} gap-1.5 mb-2`}>
                    {(selectedCurrency === "LKR" ? ["500", "1000", "5000", "20000"] : ["5", "10", "20", "50", "100"]).map((amt) => {
                      const isSelected = binanceAmount === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setBinanceAmount(amt)}
                          className={`py-2 rounded-xl text-xs font-black transition-all ${
                            isSelected
                              ? "bg-[#F3BA2F] text-[#181432] shadow-md shadow-[#F3BA2F]/30 scale-105"
                              : "bg-[#F8F7FD] border border-[#ECEEF8] text-[#181432] hover:bg-white"
                          }`}
                        >
                          {selectedCurrency === "LKR" ? `Rs. ${parseInt(amt) >= 1000 ? `${parseInt(amt) / 1000}k` : amt}` : `$${amt}`}
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#7E7998]">
                      {selectedCurrency === "LKR" ? "Rs." : "$"}
                    </span>
                    <input
                      type="number"
                      min="1"
                      step={selectedCurrency === "LKR" ? "100" : "0.5"}
                      value={binanceAmount}
                      onChange={(e) => setBinanceAmount(e.target.value)}
                      placeholder={selectedCurrency === "LKR" ? "Custom Amount in LKR (e.g. 2500)" : "Custom Amount in USD (e.g. 15)"}
                      className="w-full bg-[#F8F7FD] border border-[#ECEEF8] rounded-xl pl-8 pr-3 py-2 text-xs font-black text-[#181432] focus:outline-none focus:border-[#F3BA2F]"
                    />
                  </div>
                  {selectedCurrency === "LKR" && (
                    <div className="mt-1.5 px-3 py-1.5 bg-purple-50/80 border border-purple-100 rounded-xl text-[10.5px] font-bold text-purple-900 flex items-center justify-between">
                      <span>Send to Binance: <b className="text-purple-700">${binanceCalculatedUsd.toFixed(2)} USDT</b></span>
                      <span className="text-[9.5px] text-purple-600/80 font-normal">Rate: 1 USD ≈ Rs.{lkrRate.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Step 2: Binance Pay ID Card with Copy */}
                <div className="bg-[#FFFDF5] p-3 rounded-2xl border border-[#F3BA2F]/30 mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#A67C00] block uppercase font-extrabold">
                      2. Send {selectedCurrency === "LKR" ? `$${binanceCalculatedUsd.toFixed(2)} USDT` : `$${binanceAmount || "0"} USDT`} to Binance Pay ID
                    </span>
                    <span className="text-base font-mono font-black text-[#181432] tracking-wider">{binancePayId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(binancePayId, "Binance Pay ID Copied")}
                    className="px-3.5 py-2 bg-gradient-to-r from-[#F3BA2F] to-[#F59E0B] text-[#181432] rounded-xl text-xs font-black hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    {copiedText === binancePayId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#181432]" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy ID
                      </>
                    )}
                  </button>
                </div>

                {/* Step 3: Order ID / TxID Verification Input & Submit */}
                <form onSubmit={handleBinanceSubmit} className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-[#7E7998] block uppercase mb-1">
                      3. Enter Binance Order ID / TxID to Verify
                    </label>
                    <input
                      type="text"
                      value={binanceTxId}
                      onChange={(e) => setBinanceTxId(e.target.value)}
                      placeholder="e.g. 24891028491 (from Binance payment receipt)"
                      className="w-full bg-[#F8F7FD] border border-[#ECEEF8] rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-[#181432] placeholder-[#9490A8] focus:outline-none focus:border-[#F3BA2F]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifyingBinance || !binanceTxId.trim()}
                    className="w-full py-3 bg-[#F3BA2F] hover:bg-[#F59E0B] text-[#181432] rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-[#F3BA2F]/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isVerifyingBinance ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying Payment...
                      </>
                    ) : (
                      <>
                        <BinanceLogo className="w-4 h-4" />
                        <span>
                          {selectedCurrency === "LKR"
                            ? `Verify & Credit Rs. ${parseFloat(binanceAmount || "0").toLocaleString()} ($${binanceCalculatedUsd.toFixed(2)}) Balance`
                            : `Verify & Credit $${binanceAmount || "0"} Balance`}
                        </span>
                      </>
                    )}
                  </button>
                </form>

                {binanceSuccessMsg && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{binanceSuccessMsg}</span>
                  </div>
                )}

                {binanceErrorMsg && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-start gap-2 animate-in fade-in">
                    <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{binanceErrorMsg}</span>
                  </div>
                )}
              </div>

              {/* 2. CRYPTOMUS GATEWAY */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ECEEF8] relative overflow-hidden">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-[#1C1838] flex items-center justify-center shadow-sm">
                      <CryptomusLogo className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#181432]">Cryptomus Auto-Pay</h4>
                      <span className="text-[10px] font-bold text-[#7E7998]">USDT • TRC20 • BEP20 • TON • BTC</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold text-[#5B42F3] bg-[#EDE9FE] px-2.5 py-1 rounded-full border border-[#5B42F3]/20">
                    AUTO CREDIT
                  </span>
                </div>

                {/* Amount selection quick chips */}
                <div className="mb-3.5">
                  <label className="text-[10px] font-bold text-[#7E7998] block uppercase mb-1.5 flex items-center justify-between">
                    <span>Select Top-Up Amount ({selectedCurrency})</span>
                    {selectedCurrency === "LKR" ? (
                      <span className="text-purple-600 font-black text-[10px] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                        Pay: ${cryptomusCalculatedUsd.toFixed(2)} USD
                      </span>
                    ) : (
                      <span className="text-purple-600 font-black text-[10px]">
                        ≈ Rs. {Math.round(parseFloat(cryptomusAmount || "0") * lkrRate).toLocaleString()} LKR
                      </span>
                    )}
                  </label>
                  <div className={`grid ${selectedCurrency === "LKR" ? "grid-cols-4" : "grid-cols-5"} gap-1.5 mb-2`}>
                    {(selectedCurrency === "LKR" ? ["500", "1000", "5000", "20000"] : ["5", "10", "20", "50", "100"]).map((amt) => {
                      const isSelected = cryptomusAmount === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCryptomusAmount(amt)}
                          className={`py-2 rounded-xl text-xs font-black transition-all ${
                            isSelected
                              ? "bg-[#5B42F3] text-white shadow-md shadow-[#5B42F3]/30 scale-105"
                              : "bg-[#F8F7FD] border border-[#ECEEF8] text-[#181432] hover:bg-white"
                          }`}
                        >
                          {selectedCurrency === "LKR" ? `Rs. ${parseInt(amt) >= 1000 ? `${parseInt(amt) / 1000}k` : amt}` : `$${amt}`}
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#7E7998]">
                      {selectedCurrency === "LKR" ? "Rs." : "$"}
                    </span>
                    <input
                      type="number"
                      min="1"
                      step={selectedCurrency === "LKR" ? "100" : "1"}
                      value={cryptomusAmount}
                      onChange={(e) => setCryptomusAmount(e.target.value)}
                      placeholder={selectedCurrency === "LKR" ? "Custom Amount in LKR (e.g. 2500)" : "Custom Amount in USD (e.g. 15)"}
                      className="w-full bg-[#F8F7FD] border border-[#ECEEF8] rounded-xl pl-8 pr-3 py-2 text-xs font-black text-[#181432] focus:outline-none focus:border-[#5B42F3]"
                    />
                  </div>
                  {selectedCurrency === "LKR" && (
                    <div className="mt-1.5 px-3 py-1.5 bg-purple-50/80 border border-purple-100 rounded-xl text-[10.5px] font-bold text-purple-900 flex items-center justify-between">
                      <span>Gateway Invoice Amount: <b className="text-purple-700">${cryptomusCalculatedUsd.toFixed(2)} USD</b></span>
                      <span className="text-[9.5px] text-purple-600/80 font-normal">Rate: 1 USD ≈ Rs.{lkrRate.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCryptomusPay}
                  disabled={isCreatingCryptomus}
                  className="w-full py-3 bg-gradient-to-r from-[#FF5E62] via-[#D92078] to-[#5B42F3] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-[#5B42F3]/25 hover:opacity-95 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isCreatingCryptomus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Connecting to Gateway...
                    </>
                  ) : (
                    <>
                      <CryptomusLogo className="w-4 h-4" />
                      <span>
                        {selectedCurrency === "LKR"
                          ? `Pay Rs. ${parseFloat(cryptomusAmount || "0").toLocaleString()} (≈ $${cryptomusCalculatedUsd.toFixed(2)} USD) via Cryptomus`
                          : `Pay $${cryptomusAmount || "0"} via Cryptomus Gateway`}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Payment History - Only show for Telegram Users */}
            {isTelegramUser && (
              <>
                <h3 className="text-xs font-black text-[#181432] uppercase tracking-wider mt-4">Top-Up History</h3>
                {payments.length === 0 ? (
                  <div className="bg-white rounded-3xl p-5 text-center shadow-sm border border-[#ECEEF8]">
                    <p className="text-xs text-[#7E7998]">No payment transactions found.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#ECEEF8] flex items-center justify-between"
                      >
                        <div>
                          <span className="text-xs font-bold text-[#181432] block">{p.method.toUpperCase()} Top-Up</span>
                          <span className="text-[10px] text-[#7E7998]">
                            {p.createdAt ? format(new Date(p.createdAt), "MMM d, HH:mm") : "Recent"}
                          </span>
                        </div>
                        <span className="text-xs font-black text-[#5B42F3]">
                          +${(p.amount / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {!isCustomerLoggedIn ? (
              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-[#ECEEF8] relative overflow-hidden">
                {/* Decorative ambient glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#6C5CE7]/15 to-[#FF5E62]/15 blur-3xl rounded-full -translate-y-12 translate-x-12 pointer-events-none" />

                <div className="text-center mb-6 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6C5CE7] to-[#FF5E62] text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#6C5CE7]/25">
                    <UserIcon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-[#181432]">Sign in to youuhost</h3>
                  <p className="text-xs text-[#7E7998] mt-1 max-w-xs mx-auto">
                    Access your cloud server orders, manage balance, and top-up with instant verification.
                  </p>
                </div>

                {/* EMAIL + CODE AUTH FORM */}
                <div className="space-y-3 relative z-10">
                  {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-3">
                      <div>
                        <label className="text-[11px] font-bold text-[#6B658B] block mb-1.5 uppercase tracking-wider">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-[#9490A8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            required
                            placeholder="name@example.com"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-[#F8F9FD] border border-[#ECEEF8] rounded-2xl text-xs font-semibold text-[#181432] placeholder:text-[#A09CB8] focus:outline-none focus:border-[#6C5CE7] focus:ring-2 focus:ring-[#6C5CE7]/20 transition-all"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={isSendingOtp || !authEmail.trim()}
                        className="w-full py-3 h-12 bg-gradient-to-r from-[#6C5CE7] to-[#5B42F3] hover:from-[#5B42F3] hover:to-[#4A32D6] text-white font-black text-xs rounded-2xl shadow-md shadow-[#6C5CE7]/25 transition-all flex items-center justify-center gap-2"
                      >
                        {isSendingOtp ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Sending Verification Code...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" /> Send 6-Digit Code
                          </>
                        )}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                      <div className="bg-[#F8F7FD] border border-[#ECEEF8] p-3 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Mail className="w-4 h-4 text-[#6C5CE7] shrink-0" />
                          <span className="text-xs font-bold text-[#181432] truncate">{authEmail}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpSent(false);
                            setAuthOtp("");
                          }}
                          className="text-[10px] font-black text-[#6C5CE7] hover:underline shrink-0 ml-2"
                        >
                          Change
                        </button>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-[#6B658B] block mb-1.5 uppercase tracking-wider">
                          Enter 6-Digit Verification Code
                        </label>
                        <div className="relative">
                          <KeyRound className="w-4 h-4 text-[#9490A8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            maxLength={6}
                            required
                            autoFocus
                            placeholder="123456"
                            value={authOtp}
                            onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, ""))}
                            className="w-full pl-10 pr-4 py-3 bg-[#F8F9FD] border border-[#ECEEF8] rounded-2xl text-center text-lg font-black tracking-[0.3em] font-mono text-[#181432] placeholder:text-[#A09CB8] focus:outline-none focus:border-[#6C5CE7] focus:ring-2 focus:ring-[#6C5CE7]/20 transition-all"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={isVerifyingOtp || authOtp.length < 6}
                        className="w-full py-3 h-12 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                      >
                        {isVerifyingOtp ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Verifying Code...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Verify & Sign In
                          </>
                        )}
                      </Button>

                      <div className="text-center pt-1">
                        {resendTimer > 0 ? (
                          <span className="text-[11px] font-semibold text-[#9490A8] flex items-center justify-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#9490A8]" /> Resend code in {resendTimer}s
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendOtp()}
                            disabled={isSendingOtp}
                            className="text-[11px] font-black text-[#6C5CE7] hover:underline flex items-center justify-center gap-1.5 mx-auto"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Resend Verification Code
                          </button>
                        )}
                      </div>
                    </form>
                  )}

                  {/* DIVIDER */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#ECEEF8]" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-black text-[#9490A8]">
                      <span className="bg-white px-3 tracking-widest">or continue with</span>
                    </div>
                  </div>

                  {/* GOOGLE SIGN IN BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleGoogleSignIn()}
                    disabled={isGoogleLoading}
                    className="w-full py-3 px-4 h-12 bg-white hover:bg-[#F8F9FD] active:scale-[0.99] border border-[#ECEEF8] hover:border-[#D8DCF0] rounded-2xl text-xs font-black text-[#181432] shadow-sm flex items-center justify-center gap-3 transition-all"
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#4285F4]" />
                    ) : (
                      <GoogleIcon className="w-5 h-5" />
                    )}
                    <span>Continue with Google</span>
                  </button>

                  {/* SECURITY ASSURANCE */}
                  <div className="pt-3 flex items-center justify-center gap-2 text-[10px] text-[#9490A8] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Passwordless 2FA · End-to-End Encrypted</span>
                  </div>
                </div>
              </div>
            ) : (
              // LOGGED IN USER PROFILE
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-6 text-center shadow-sm border border-[#ECEEF8] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#6C5CE7]/10 to-[#5B42F3]/10 blur-2xl rounded-full pointer-events-none" />

                  {/* Avatar */}
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={displayName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-lg mx-auto mb-3"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#FF5E62] to-[#6C5CE7] text-white text-2xl font-black flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#6C5CE7]/30">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <h3 className="text-base font-black text-[#181432]">{displayName}</h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    {user?.authProvider === "google" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4285F4] bg-[#E8F0FE] px-2.5 py-0.5 rounded-full">
                        <GoogleIcon className="w-3 h-3" /> Google Account
                      </span>
                    ) : user?.authProvider === "email" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#059669] bg-emerald-50 px-2.5 py-0.5 rounded-full">
                        <Mail className="w-3 h-3 text-[#059669]" /> Email Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#24A1DE] bg-sky-50 px-2.5 py-0.5 rounded-full">
                        <FaTelegramPlane className="w-3 h-3" /> Telegram Account
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#7E7998] block mt-1">
                    {user?.email || (user?.username ? `@${user.username}` : `ID: ${user?.telegramId}`)}
                  </span>

                  {/* Balance Display */}
                  <div className="mt-4 pt-4 border-t border-[#F5F4FC] flex items-center justify-between bg-[#F8F7FD] p-3.5 rounded-2xl">
                    <div className="text-left">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9490A8] block">Wallet Balance</span>
                      <span className="text-lg font-black text-[#181432]">${((user?.balance || 0) / 100).toFixed(2)}</span>
                    </div>
                    <Button
                      onClick={() => setActiveTab("wallet")}
                      className="h-8 px-3.5 bg-gradient-to-r from-[#6C5CE7] to-[#5B42F3] hover:from-[#5B42F3] hover:to-[#4A32D6] text-white text-xs font-black rounded-xl shadow-sm"
                    >
                      Top Up
                    </Button>
                  </div>
                </div>

                {/* Profile navigation actions */}
                <div className="bg-white rounded-3xl p-2 shadow-sm border border-[#ECEEF8] divide-y divide-[#F5F4FC]">
                  <button
                    onClick={() => setActiveTab("orders")}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-[#181432] hover:bg-[#F8F7FD] rounded-2xl transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Package className="w-4 h-4 text-[#5B42F3]" /> My Cloud Orders
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#9490A8]" />
                  </button>

                  <button
                    onClick={() => setActiveTab("wallet")}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-[#181432] hover:bg-[#F8F7FD] rounded-2xl transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Wallet className="w-4 h-4 text-[#D92078]" /> Wallet & Top-ups
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#9490A8]" />
                  </button>

                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-[#181432] hover:bg-[#F8F7FD] rounded-2xl transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <MessageCircle className="w-4 h-4 text-[#FF5E62]" /> 24/7 AI Concierge
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#9490A8]" />
                  </button>

                  {/* Sign Out Button (for web sessions) */}
                  {!isTelegramUser && (
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-red-600 hover:bg-red-50/50 rounded-2xl transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <LogOut className="w-4 h-4 text-red-500" /> Sign Out
                      </span>
                      <ChevronRight className="w-4 h-4 text-red-300" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* PRODUCT DETAIL MODAL */}
      <Dialog open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <DialogContent className="max-w-md w-full bg-[#F8F9FD] border border-[#ECEEF8] rounded-[32px] p-6 shadow-2xl overflow-hidden">
          {detailProduct && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setDetailProduct(null)}
                  className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => toggleFavorite(detailProduct.id)}
                  className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#7E7998] hover:text-red-500 transition-colors"
                >
                  <Heart
                    className={`w-4 h-4 ${favorites.includes(detailProduct.id) ? "fill-red-500 text-red-500" : ""}`}
                  />
                </button>
              </div>

              {/* Centered Visual with Real Brand Icon & Sleek Organic Blob */}
              <div className="relative py-4 flex items-center justify-center mb-4">
                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#FFE4E8] to-[#EDE8FE] absolute blur-sm" />
                <div className="relative z-10 drop-shadow-sm">
                  <BrandIcon name={detailProduct.name} type={detailProduct.type} className="w-14 h-14" />
                </div>
              </div>

              {/* Title, Badge, Rating & Price */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-lg font-black text-[#181432] leading-tight">{detailProduct.name}</h3>
                  <span className="text-[11px] font-bold text-[#6B658B] block mt-0.5">
                    {detailProduct.type} Verified Account
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-[#181432]">
                    {formatProductPrice(detailProduct, quantity)}
                  </span>
                  <span className="text-[9px] text-[#7E7998] block">total price</span>
                </div>
              </div>

              {/* Rating & Reviews pill */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 text-[11px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 4.9
                </div>
                <span className="text-[11px] text-[#7E7998] font-medium">(120+ reviews)</span>
              </div>

              {/* Description */}
              <p className="text-xs text-[#6B658B] leading-relaxed mb-5">
                {detailProduct.description ||
                  "Fully automated verified cloud service with instant credential delivery, active quotas, and continuous uptime monitoring."}
              </p>

              {/* Quantity Stepper & Buy Now Button */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center bg-white rounded-full px-3 py-1.5 shadow-sm border border-[#ECEEF8] gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-6 h-6 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] font-bold"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-black text-[#181432] min-w-[14px] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-6 h-6 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] font-bold"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={handlePurchase}
                  disabled={isPurchasing}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#FF5E62] via-[#D92078] to-[#5B42F3] text-white rounded-full text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#5B42F3]/25 hover:opacity-95 active:scale-98 transition-all disabled:opacity-50"
                >
                  {isPurchasing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-pink-200" /> Buy Now
                    </>
                  )}
                </button>
              </div>

              {/* Instant Delivery Footer Badge */}
              <div className="bg-[#F3EFFE] rounded-2xl p-2.5 flex items-center justify-between border border-[#E9E4FC]">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#5B42F3]" />
                  <span className="text-[11px] font-bold text-[#5B42F3]">Automated 2FA Instant Delivery</span>
                </div>
                <span className="text-[10px] text-[#7E7998] font-semibold">0-2 Mins ⚡</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FLOATING BOTTOM NAVIGATION */}
      <nav className="fixed bottom-4 inset-x-0 max-w-md mx-auto px-5 z-40">
        <div className="bg-white/95 backdrop-blur-md rounded-full px-5 py-3 shadow-xl border border-[#ECEEF8] flex items-center justify-between">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-0.5 transition-all ${
              activeTab === "home" ? "text-[#5B42F3] scale-105" : "text-[#9490A8] hover:text-[#5B42F3]"
            }`}
          >
            <StoreIcon className="w-5 h-5" />
            <span className="text-[9px] font-bold">Home</span>
            {activeTab === "home" && <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7]" />}
          </button>

          <button
            onClick={() => setActiveTab("categories")}
            className={`flex flex-col items-center gap-0.5 transition-all ${
              activeTab === "categories" ? "text-[#5B42F3] scale-105" : "text-[#9490A8] hover:text-[#5B42F3]"
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-bold">Categories</span>
            {activeTab === "categories" && <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7]" />}
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className={`flex flex-col items-center gap-0.5 transition-all ${
              activeTab === "orders" ? "text-[#5B42F3] scale-105" : "text-[#9490A8] hover:text-[#5B42F3]"
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[9px] font-bold">Orders</span>
            {activeTab === "orders" && <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7]" />}
          </button>

          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex flex-col items-center gap-0.5 transition-all ${
              activeTab === "wallet" ? "text-[#5B42F3] scale-105" : "text-[#9490A8] hover:text-[#5B42F3]"
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[9px] font-bold">Wallet</span>
            {activeTab === "wallet" && <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7]" />}
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center gap-0.5 transition-all ${
              activeTab === "profile" ? "text-[#5B42F3] scale-105" : "text-[#9490A8] hover:text-[#5B42F3]"
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[9px] font-bold">Profile</span>
            {activeTab === "profile" && <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7]" />}
          </button>
        </div>
      </nav>

      {/* Floating AI Chat Concierge Button */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-24 right-5 w-12 h-12 rounded-full bg-gradient-to-tr from-[#FF5E62] via-[#D92078] to-[#5B42F3] text-white shadow-xl shadow-[#D92078]/35 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* AI Chat Concierge Drawer */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-md w-full bg-white border border-[#ECEEF8] rounded-[32px] p-5 shadow-2xl">
          <DialogHeader className="mb-3 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-black text-[#181432] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D92078]" /> 24/7 AI Cloud Concierge
            </DialogTitle>
          </DialogHeader>

          <div className="h-64 overflow-y-auto space-y-2.5 pr-1 text-xs">
            {chatHistory.map((m, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-2xl max-w-[85%] ${
                  m.role === "user"
                    ? "ml-auto bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7] text-white rounded-br-none shadow-sm"
                    : "bg-[#F5F4FC] text-[#181432] rounded-bl-none border border-[#ECEEF8]"
                }`}
              >
                {m.content}
              </div>
            ))}
            {isChatSending && (
              <div className="bg-[#F5F4FC] text-[#7E7998] p-2.5 rounded-2xl text-[11px] inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-[#5B42F3]" /> Thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#F5F4FC]">
            <input
              type="text"
              value={chatMsg}
              onChange={(e) => setChatMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="Ask anything about servers, stock, pricing..."
              className="flex-1 bg-[#F8F7FD] border border-[#ECEEF8] rounded-full px-4 py-2.5 text-xs text-[#181432] focus:outline-none focus:border-[#6C5CE7]"
            />
            <button
              onClick={handleSendChat}
              disabled={isChatSending || !chatMsg.trim()}
              className="w-9 h-9 rounded-full bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7] text-white flex items-center justify-center hover:opacity-95 disabled:opacity-40 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* GOOGLE SIGN IN MODAL */}
      <Dialog open={showGoogleModal} onOpenChange={setShowGoogleModal}>
        <DialogContent className="max-w-sm w-full bg-white border border-[#ECEEF8] rounded-[28px] p-6 shadow-2xl">
          <DialogHeader className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F0FE] flex items-center justify-center mx-auto mb-2">
              <GoogleIcon className="w-6 h-6" />
            </div>
            <DialogTitle className="text-base font-black text-[#181432]">Continue with Google</DialogTitle>
            <DialogDescription className="text-xs text-[#7E7998]">
              Sign in with your Google email to sync your cloud orders and wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-[11px] font-bold text-[#6B658B] block mb-1">Google Email Address</label>
              <input
                type="email"
                required
                placeholder="name@gmail.com"
                value={googleEmailInput}
                onChange={(e) => setGoogleEmailInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8F9FD] border border-[#ECEEF8] rounded-xl text-xs font-semibold text-[#181432] focus:outline-none focus:border-[#4285F4]"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#6B658B] block mb-1">Your Full Name (Optional)</label>
              <input
                type="text"
                placeholder="Alex Morgan"
                value={googleNameInput}
                onChange={(e) => setGoogleNameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8F9FD] border border-[#ECEEF8] rounded-xl text-xs font-semibold text-[#181432] focus:outline-none focus:border-[#4285F4]"
              />
            </div>

            <Button
              onClick={() => handleGoogleSignIn()}
              disabled={isGoogleLoading || !googleEmailInput.trim()}
              className="w-full py-2.5 h-11 bg-[#4285F4] hover:bg-[#3367D6] text-white font-black text-xs rounded-xl shadow-md shadow-[#4285F4]/20 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <GoogleIcon className="w-4 h-4" /> Sign In with Google
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
