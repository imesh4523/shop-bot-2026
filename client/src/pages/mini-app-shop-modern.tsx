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
  LayoutGrid
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

  // Queries
  const { data: user, isLoading: userLoading } = useQuery<TelegramUser>({
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

  // Dynamic Greeting based on client time
  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning,";
    if (hr < 17) return "Good Afternoon,";
    return "Good Evening,";
  }, []);

  const displayName = useMemo(() => {
    if (user?.firstName) return user.firstName;
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.first_name) return tgUser.first_name;
    return "Web Visitor";
  }, [user]);

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
    const userBalance = (user?.balance || 0) / 100;
    const totalPrice = (detailProduct.price * quantity) / 100;

    if (userBalance < totalPrice) {
      toast({
        title: "Insufficient Balance",
        description: `You need $${totalPrice.toFixed(2)}, but your balance is $${userBalance.toFixed(2)}. Please top up your wallet.`,
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

  const copyToClipboard = (text: string, title = "Copied to Clipboard") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title, description: "Content copied successfully.", duration: 2000 });
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white shadow-sm border border-[#ECEEF8] hover:border-[#6C5CE7] transition-all group"
            >
              <Wallet className="w-3.5 h-3.5 text-[#D92078] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-[#181432]">
                ${((user?.balance || 0) / 100).toFixed(2)}
              </span>
            </button>

            {/* Profile Avatar */}
            <button
              onClick={() => setActiveTab("profile")}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FFE4E6] to-[#EDE9FE] border-2 border-white shadow-sm flex items-center justify-center overflow-hidden hover:scale-105 transition-transform"
            >
              {user?.username ? (
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
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (!catMoved) {
                        setSelectedCategory(cat.id);
                      }
                    }}
                    className={`flex flex-col items-center justify-center min-w-[78px] h-[84px] px-3 rounded-2xl transition-all duration-200 shrink-0 ${
                      isActive
                        ? "bg-gradient-to-b from-[#FF5E62] to-[#6C5CE7] text-white shadow-lg shadow-[#6C5CE7]/30 scale-105"
                        : "bg-white text-[#4A4568] shadow-sm border border-[#ECEEF8] hover:bg-[#F5F4FC]"
                    }`}
                  >
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
                  const priceFormatted = `$${(prod.price / 100).toFixed(2)}`;

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
                      {products.filter((p) => getProviderConfig(p.name, p.type).category === cat.id || p.name.toLowerCase().includes(cat.id)).length} Items
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
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-[#181135] via-[#2F1D5E] to-[#5B42F3] rounded-3xl p-6 text-white shadow-xl shadow-[#5B42F3]/25 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-8 translate-x-8" />
              <span className="text-xs font-semibold text-pink-200/90 uppercase tracking-wider block mb-1">
                Total Available Balance
              </span>
              <h2 className="text-3xl font-black tracking-tight">
                ${((user?.balance || 0) / 100).toFixed(2)}
              </h2>
              <span className="text-[11px] text-purple-200/80 block mt-1">
                Telegram ID: {user?.telegramId || "Web Guest"}
              </span>
            </div>

            {/* Deposit Notice */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ECEEF8]">
              <h3 className="text-sm font-black text-[#181432] mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#D92078]" /> Instant Top-Up Options
              </h3>
              <p className="text-xs text-[#7E7998] leading-relaxed mb-4">
                To top up your wallet balance instantly with CryptoBot, Binance Pay, TRC20, or Bank Transfer, please open our Telegram Bot and tap <b>Deposit</b>.
              </p>
              <a
                href="https://t.me/youuhostbot"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-[#6C5CE7]/25 hover:opacity-95 transition-opacity"
              >
                Open Deposit in Telegram Bot <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Payment History */}
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
          </motion.div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="bg-white rounded-3xl p-6 text-center shadow-sm border border-[#ECEEF8]">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#FF5E62] to-[#6C5CE7] text-white text-2xl font-black flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#6C5CE7]/30">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-base font-black text-[#181432]">{displayName}</h3>
              <span className="text-xs text-[#7E7998] block mt-0.5">@{user?.username || "web_guest"}</span>
            </div>

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
            </div>
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
                    ${((detailProduct.price * quantity) / 100).toFixed(2)}
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
    </div>
  );
}
