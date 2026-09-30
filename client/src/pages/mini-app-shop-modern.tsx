import React, { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "wouter";
import { generateTOTP, getRemainingSeconds } from "@/lib/totp";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product, TelegramUser, Order, Payment, SpecialOffer } from "@shared/schema";
import { getTelegramInitData, expandTelegramWebApp } from "@/lib/telegram";
import { queryClient } from "@/lib/queryClient";
import { PaymentProcessingModal, LottiePayment } from "@/components/lottie-loader";
import { SlideToPurchase } from "@/components/slide-to-purchase";
import { DEFAULT_CATEGORIES, BADGE_COLOR_STYLES, renderCategoryBrandIcon, CustomCategoryItem } from "@/pages/categories-manager-page";
import {
  Loader2,
  ShoppingCart,
  User,
  User as UserIcon,
  Headphones,
  Package,
  Wallet,
  ChevronRight,
  ChevronLeft,
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
  TrendingUp,
  Key,
  Receipt,
  Eye,
  EyeOff,
  Trash2,
  Ban,
  ArrowDownLeft,
  ArrowUpRight,
  Code2,
  Terminal,
  Layers,
  XCircle,
  AlertTriangle,
  Lock,
  Tag,
  Download,
  FileText,
  CheckCircle,
  LifeBuoy,
  Ticket,
  HelpCircle,
  SendHorizontal,
  PackageCheck,
  Rocket,
  Camera,
  Image as ImageIcon,
  Paperclip
} from "lucide-react";
import { format } from "date-fns";
import { FaAws, FaSpotify, FaYoutube, FaInstagram, FaFacebook, FaTiktok, FaTelegramPlane, FaLinode, FaWhatsapp, FaWindows } from "react-icons/fa";
import { SiDigitalocean, SiGooglecloud, SiOpenai, SiDuolingo, SiGooglegemini, SiBinance, SiClaude, SiVisa, SiMastercard, SiCanva } from "react-icons/si";
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

// Clean Transparent Shopping Bag Icon (matching user uploaded handbag design without background)
function ShopBagIcon({ className = "w-4 h-4", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Curved Arch Loop Handle */}
      <path d="M34 42V26a16 16 0 0 1 32 0v16" />
      {/* Sleek Trapezoid Bag Body with Rounded Corners */}
      <path d="M24 42h52l9.5 38a8 8 0 0 1-7.8 10H22.3a8 8 0 0 1-7.8-10L24 42z" />
    </svg>
  );
}

// Official Telegram / Meta 8-point Dual-Tone Verified Badge (100% Transparent Background, Inline Vector)
function VerifiedBadgeIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={`${className} inline-block shrink-0 align-middle pointer-events-none select-none`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="verified-dual-split" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="50%" stopColor="#38B6FF" />
          <stop offset="50%" stopColor="#2979FF" />
        </linearGradient>
      </defs>

      {/* 8-Lobed Scalloped Star Badge Body (Two 45° Rotated Rounded Rectangles) */}
      <g fill="url(#verified-dual-split)">
        <rect x="64" y="64" width="384" height="384" rx="88" ry="88" />
        <rect x="64" y="64" width="384" height="384" rx="88" ry="88" transform="rotate(45 256 256)" />
      </g>

      {/* Clean Rounded Pure White Checkmark */}
      <path
        d="M165 265 L228 328 L350 190"
        stroke="#FFFFFF"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Canvas-based Image Compressor (reduces photo size before uploading)
const compressImageToDataUrl = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Please select a valid image file (PNG, JPG, JPEG, WEBP)"));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to process image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

// Helper for MiniApp API requests
const miniApiRequest = async (method: string, path: string, body?: any) => {
  const initData = getTelegramInitData();
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-telegram-init-data": initData,
  };

  try {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("yh_auth_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["x-customer-auth-token"] = token;
      }
      const savedUserStr = localStorage.getItem("yh_active_user");
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u?.id) headers["x-customer-user-id"] = String(u.id);
        if (u?.email) headers["x-customer-email"] = u.email;
      }
    }
  } catch {}

  const res = await fetch(path, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Request failed");
  }
  return res;
};

// 6-Digit Curved OTP Box Input Component (supports smooth typing, auto-focus, paste all 6 digits, and auto-submit)
function SixDigitOtpInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = useMemo(() => {
    const arr = value.split("").slice(0, 6);
    while (arr.length < 6) arr.push("");
    return arr;
  }, [value]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      const newDigits = [...digits];
      newDigits[index] = "";
      const newVal = newDigits.join("");
      onChange(newVal);
      return;
    }

    if (raw.length > 1) {
      // Multiple digits entered/pasted into single field
      const pasted = raw.slice(0, 6);
      onChange(pasted);
      const nextIdx = Math.min(pasted.length, 5);
      inputsRef.current[nextIdx]?.focus();
      if (pasted.length === 6 && onComplete) {
        onComplete(pasted);
      }
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = raw[raw.length - 1];
    const newVal = newDigits.join("");
    onChange(newVal);

    if (raw && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
    if (newVal.length === 6 && onComplete) {
      onComplete(newVal);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;
    onChange(pastedData);
    const targetIdx = Math.min(pastedData.length, 5);
    inputsRef.current[targetIdx]?.focus();
    if (pastedData.length === 6 && onComplete) {
      onComplete(pastedData);
    }
  };

  return (
    <div className="flex items-center justify-between gap-1.5 sm:gap-2">
      {[0, 1, 2, 3, 4, 5].map((idx) => {
        const isFilled = Boolean(digits[idx]);
        return (
          <input
            key={idx}
            ref={(el) => (inputsRef.current[idx] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            disabled={disabled}
            value={digits[idx] || ""}
            onChange={(e) => handleChange(idx, e)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`w-11 h-12 sm:w-12 sm:h-12 text-center text-lg font-black font-mono rounded-2xl border transition-all duration-200 outline-none ${
              isFilled
                ? "bg-white border-[#6C5CE7] text-[#181432] shadow-sm ring-2 ring-[#6C5CE7]/15 scale-[1.02]"
                : "bg-[#F8F9FD] border-[#ECEEF8] text-[#181432] focus:bg-white focus:border-[#6C5CE7] focus:ring-2 focus:ring-[#6C5CE7]/20"
            }`}
          />
        );
      })}
    </div>
  );
}

// Custom Crisp Vector & Brand Logos (Transparent Backgrounds)
const OracleLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16.54 4.5H7.46C3.34 4.5 0 7.84 0 11.96c0 4.12 3.34 7.46 7.46 7.46h9.08c4.12 0 7.46-3.34 7.46-7.46 0-4.12-3.34-7.46-7.46-7.46zm-9.08 11.72c-2.35 0-4.26-1.91-4.26-4.26 0-2.35 1.91-4.26 4.26-4.26h9.08c2.35 0 4.26 1.91 4.26 4.26 0 2.35-1.91 4.26-4.26 4.26H7.46z"
      fill="#F80000"
    />
  </svg>
);

const LinodeLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <span className={`inline-flex items-center justify-center rounded-2xl bg-[#00A95C] p-1.5 text-white shrink-0 ${className}`}>
    <FaLinode className="w-full h-full text-white" />
  </span>
);

const ClaudeLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <span className={`inline-flex items-center justify-center rounded-2xl bg-[#D97757] p-1.5 text-white shrink-0 ${className}`}>
    <SiClaude className="w-full h-full text-white" />
  </span>
);

const CAPCUT_TRANSPARENT_IMG = "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/capcut-icon.png";

const CapCutLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <img
    src={CAPCUT_TRANSPARENT_IMG}
    alt="CapCut"
    className={`${className} shrink-0 object-contain mix-blend-multiply dark:brightness-125`}
  />
);

const KamateraLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <img
    src="/assets/kamatera.png"
    alt="Kamatera"
    className={`${className} shrink-0 object-contain`}
  />
);

const API_TRANSACTION_IMG = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRA24Ajtr-PQkSbpxwfGmNvEW3OyYTz1i5p3FBnTgE3yQ&s=10";

const GoogleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

const BinanceLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <SiBinance className={`${className} text-[#F3BA2F]`} />
);

const CRYPTOMUS_IMG = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4Dc5F7WV38gVL95M4xZR5UFU87Ovr4UeR40nKbJg6Gg&s=10";
const TX_VISA_MASTER_IMG = "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse1.mm.bing.net%2Fth%2Fid%2FOIP.XLxva8A-P8lZLn8yuU-aYgHaGL%3Fr%3D0%26pid%3DApi&f=1&ipt=35062e222ce1c0d79eebcbb246f4653ebf70f185b2d048c79e4970ec07fa6de1&ipo=images";

const CryptomusLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <img
    src={CRYPTOMUS_IMG}
    alt="Cryptomus"
    className={`${className} shrink-0 object-contain rounded-lg`}
  />
);

const VisaMasterCardIcon = ({ className = "w-6 h-4.5" }: { className?: string }) => (
  <img
    src={TX_VISA_MASTER_IMG}
    alt="Visa Mastercard"
    className={`${className} shrink-0 object-contain`}
  />
);

const DualCardIcon = ({ className = "h-4" }: { className?: string }) => (
  <div className={`inline-flex items-center gap-1 shrink-0 ${className}`}>
    <img
      src={TX_VISA_MASTER_IMG}
      alt="Visa Mastercard"
      className="h-4 w-auto object-contain rounded-sm"
    />
  </div>
);

// High-Converting Auto-Swapping Hero Carousel Slides (3s Rotation)
const HERO_SLIDES = [
  {
    id: "capcut-pro",
    title: "CapCut Pro Video Editor",
    subtitle: "1 Month • 6 Months • 7 Days Pro",
    features: [
      "4K 60fps Ultra HD Export & No Watermark",
      "Pro VIP AI Effects, Transitions & Auto-Cut",
      "100GB Cloud Storage & Multi-Device Login"
    ],
    categoryTarget: "capcut",
    gradientBg: "from-[#FFF1F6] via-[#FCE7F3] to-[#F5E6FF]",
    borderColor: "border-pink-200/80",
    btnGradient: "from-[#FF007A] to-[#7928CA]",
    imageSrc: "https://img.icons8.com/color/144/capcut.png",
    imageAlt: "CapCut Pro",
    glowColor: "bg-pink-400/25"
  },
  {
    id: "gemini-ai",
    title: "Google Gemini 1.5 Pro AI",
    subtitle: "18 Months & 1 Year Full Pro Access",
    features: [
      "2M Token Context & Ultra Deep Reasoning",
      "Advanced Python Coding & Multimodal Input",
      "Private Dedicated Account & 100% Guaranteed"
    ],
    categoryTarget: "gemini",
    gradientBg: "from-[#F0F9FF] via-[#E0F2FE] to-[#EDE9FE]",
    borderColor: "border-cyan-200/80",
    btnGradient: "from-[#0080FF] to-[#6C5CE7]",
    imageSrc: "https://img.icons8.com/color/144/google-gemini.png",
    imageAlt: "Gemini AI Pro",
    glowColor: "bg-cyan-400/25"
  },
  {
    id: "cloud-vps",
    title: "High Performance Cloud VPS",
    subtitle: "AWS • DigitalOcean • Oracle • Kamatera",
    features: [
      "High CPU & RAM VPS with 100% Verified Quotas",
      "Tier-3 Datacenters & Dedicated Static IP",
      "Instant Root Access & 24/7 Automated Delivery"
    ],
    categoryTarget: "aws",
    gradientBg: "from-[#FFF0F5] via-[#F5EDFF] to-[#EDE9FE]",
    borderColor: "border-[#E4DCFA]",
    btnGradient: "from-[#FF5E62] to-[#6C5CE7]",
    imageSrc: "https://img.icons8.com/fluency/144/server.png",
    imageAlt: "Cloud Servers",
    glowColor: "bg-purple-400/25"
  },
  {
    id: "telegram-spotify",
    title: "Telegram Premium & Spotify",
    subtitle: "3, 6 & 12 Months Subscriptions",
    features: [
      "Star Profile Badge, 4GB Uploads & Fast Speed",
      "Ad-Free Spotify Hi-Fi Music & Offline Mode",
      "Instant Gift Links & Official Upgrades"
    ],
    categoryTarget: "telegram",
    gradientBg: "from-[#F0FDF4] via-[#E0F2FE] to-[#F3E8FF]",
    borderColor: "border-sky-200/80",
    btnGradient: "from-[#00C9FF] to-[#6C5CE7]",
    imageSrc: "https://img.icons8.com/color/144/telegram-app.png",
    imageAlt: "Telegram & Spotify",
    glowColor: "bg-sky-400/25"
  }
];

const TransactionBrandIcon = ({ tx, className = "w-10 h-10" }: { tx: any; className?: string }) => {
  const method = (tx?.method || "").toLowerCase();
  const type = (tx?.type || "").toLowerCase();
  const title = (tx?.title || "").toLowerCase();
  const category = (tx?.category || "").toLowerCase();
  const smmLink = (tx?.smmLink || "").toLowerCase();
  const smmCategory = (tx?.smmCategory || "").toLowerCase();

  // 1a. Admin Added or Deducted Funds (YouuHost Team) - Official YouuHost Logo
  if (
    method === "admin_topup" ||
    method === "admin_deduction" ||
    tx?.subType === "admin_deduction" ||
    tx?.subType === "admin_topup" ||
    category.includes("youuhost team") ||
    title.includes("youuhost team") ||
    (tx?.externalId && (tx.externalId.startsWith("ADMIN") || tx.externalId.startsWith("INIT")))
  ) {
    return (
      <div className={`${className} rounded-2xl bg-white border border-[#ECEEF8] flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1.5`}>
        <img
          src="/assets/youuhost_official_logo.png?v=4"
          alt="YouuHost Team"
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.currentTarget as any).src = "/logo.png";
          }}
        />
      </div>
    );
  }

  // 1b. SMM Boost Orders (Facebook, Instagram, YouTube, TikTok, Telegram, etc.)
  if (
    type === "smm" ||
    category.includes("smm") ||
    category.includes("social") ||
    smmCategory ||
    smmLink ||
    title.includes("facebook") ||
    title.includes("instagram") ||
    title.includes("youtube") ||
    title.includes("tiktok") ||
    title.includes("telegram")
  ) {
    const combinedStr = `${title} ${smmLink} ${smmCategory}`.toLowerCase();
    let smmIcon = <BrandIcon name={combinedStr} type={tx?.smmCategory || "Social"} className="w-5 h-5" />;
    if (combinedStr.includes("facebook") || combinedStr.includes("fb")) {
      smmIcon = <FaFacebook className="w-5 h-5 text-[#1877F2]" />;
    } else if (combinedStr.includes("instagram") || combinedStr.includes("ig")) {
      smmIcon = <FaInstagram className="w-5 h-5 text-[#E1306C]" />;
    } else if (combinedStr.includes("youtube") || combinedStr.includes("yt")) {
      smmIcon = <FaYoutube className="w-5 h-5 text-[#FF0000]" />;
    } else if (combinedStr.includes("tiktok")) {
      smmIcon = <FaTiktok className="w-5 h-5 text-[#000000]" />;
    } else if (combinedStr.includes("telegram") || combinedStr.includes("t.me")) {
      smmIcon = <FaTelegramPlane className="w-5 h-5 text-[#24A1DE]" />;
    } else if (combinedStr.includes("spotify")) {
      smmIcon = <FaSpotify className="w-5 h-5 text-[#1DB954]" />;
    }
    return (
      <div className={`${className} rounded-2xl bg-white border border-[#ECEEF8] flex items-center justify-center shrink-0 shadow-2xs p-1.5`}>
        {smmIcon}
      </div>
    );
  }

  // 2. Developer API Order / Transaction
  if (
    tx?.isApiOrder ||
    type === "api" ||
    method === "api_key" ||
    method === "api" ||
    title.includes("developer api") ||
    title.includes("api key") ||
    title.includes("api order") ||
    title.includes("api purchase") ||
    title.includes("api transaction") ||
    title.includes("(api)")
  ) {
    return (
      <div className={`${className} rounded-2xl bg-white border border-[#ECEEF8] flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1.5`}>
        <img
          src={API_TRANSACTION_IMG}
          alt="API Transaction"
          className="w-full h-full object-contain rounded-lg"
        />
      </div>
    );
  }

  // 3. Partner & Direct Cloud Purchases (Spotify, Gemini, AWS, Linode, Azure, DigitalOcean, etc.)
  if (type === "partner" || type === "purchase") {
    if (tx?.imageUrl) {
      return (
        <div className={`${className} rounded-2xl bg-[#F8F7FD] border border-[#ECEEF8] flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1`}>
          <img
            src={tx.imageUrl}
            alt={tx?.title || "Product"}
            className="w-full h-full object-contain rounded-xl"
            onError={(e) => {
              (e.currentTarget as any).style.display = "none";
            }}
          />
        </div>
      );
    }
    return (
      <div className={`${className} rounded-2xl bg-[#F8F7FD] border border-[#ECEEF8] flex items-center justify-center shrink-0 shadow-2xs p-1.5`}>
        <BrandIcon name={tx?.title} type={tx?.productType || tx?.category || "Cloud"} className="w-5 h-5" />
      </div>
    );
  }



  // 5a. FriMi Payment
  if (method.includes("frimi") || title.includes("frimi")) {
    return (
      <div className={`${className} rounded-2xl bg-white border border-purple-200/80 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1.5`}>
        <img
          src="/frimi.png"
          alt="FriMi"
          className="w-full h-full object-contain rounded-full shadow-2xs"
        />
      </div>
    );
  }

  // 5b. iPay Payment
  if (method.includes("ipay") || title.includes("ipay")) {
    return (
      <div className={`${className} rounded-2xl bg-white border border-red-200/80 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1.5`}>
        <img
          src="/ipay.png"
          alt="iPay"
          className="w-full h-full object-contain rounded-full shadow-2xs"
        />
      </div>
    );
  }

  // 5c. Q+ Payment
  if (method.includes("qplus") || method.includes("q+") || title.includes("q+")) {
    return (
      <div className={`${className} rounded-2xl bg-white border border-blue-200/80 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1.5`}>
        <img
          src="/qplus.png"
          alt="Q+ Payment"
          className="w-full h-full object-contain rounded-full shadow-2xs"
        />
      </div>
    );
  }

  // 5d. Google Pay
  if (method.includes("google") || method.includes("gpay") || title.includes("google")) {
    return (
      <div className={`${className} rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-2`}>
        <svg className="w-full h-full shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" fill="#4285F4"/>
          <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" fill="#34A853"/>
          <path d="M5.28 14.27a7.18 7.18 0 0 1 0-4.54V6.58H1.25a11.97 11.97 0 0 0 0 10.84l4.03-3.15Z" fill="#FBBC05"/>
          <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" fill="#EA4335"/>
        </svg>
      </div>
    );
  }

  // 5e. Mastercard
  if (method.includes("master") || title.includes("master")) {
    return (
      <div className={`${className} rounded-2xl bg-white border border-[#EB001B]/20 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-2`}>
        <svg className="w-full h-full shrink-0" viewBox="0 0 28 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9" cy="9" r="9" fill="#EB001B"/>
          <circle cx="19" cy="9" r="9" fill="#F79E1B"/>
          <path d="M14 2.82A8.96 8.96 0 0 0 9 0a8.96 8.96 0 0 0-5 1.58A8.97 8.97 0 0 1 14 9a8.97 8.97 0 0 1-10 7.42A8.96 8.96 0 0 0 9 18a8.96 8.96 0 0 0 5-2.82A8.96 8.96 0 0 0 19 18a8.96 8.96 0 0 0 5-1.58A8.97 8.97 0 0 1 14 9a8.97 8.97 0 0 1 10-7.42A8.96 8.96 0 0 0 19 0a8.96 8.96 0 0 0-5 2.82z" fill="#FF5F00"/>
        </svg>
      </div>
    );
  }

  // 5f. Visa
  if (method.includes("visa") || title.includes("visa")) {
    return (
      <div className={`${className} rounded-2xl bg-white border border-[#1A1F71]/20 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-2`}>
        <svg className="w-full h-full shrink-0" viewBox="0 0 52 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.16 0.5L12.55 15.5H8.22L5.01 3.5C4.82 2.76 4.63 2.48 4.02 2.14C3.04 1.62 1.43 1.13 0 0.82L0.1 0.5H7.02C7.91 0.5 8.7 1.09 8.88 2.11L10.58 11.16L14.77 0.5H19.16ZM35.98 10.5C36 6.51 30.45 6.29 30.49 4.49C30.5 3.94 31.02 3.36 32.18 3.2C32.76 3.13 34.33 3.07 36.03 3.86L36.72 0.65C35.77 0.31 34.56 0 33.05 0C28.98 0 26.11 2.16 26.09 5.25C26.05 7.54 28.1 8.82 29.66 9.58C31.27 10.36 31.81 10.86 31.8 11.56C31.79 12.63 30.51 13.1 29.33 13.12C27.28 13.15 26.08 12.57 25.13 12.13L24.41 15.48C25.37 15.92 27.15 16.3 28.99 16.32C33.32 16.32 36.17 14.18 35.98 10.5ZM46.54 15.5H50.36L47.01 0.5H43.46C42.66 0.5 42 0.96 41.7 1.68L35.6 15.5H39.95L40.82 13.1H46.12L46.54 15.5ZM41.97 9.98L44.18 3.92L45.45 9.98H41.97ZM25.04 0.5L21.64 15.5H17.47L20.87 0.5H25.04Z" fill="#1A1F71"/>
        </svg>
      </div>
    );
  }

  // 5g. Generic Card Payment
  if (method.includes("card") || method.includes("payhere") || title.includes("card")) {
    const isLarge = className.includes("w-16") || className.includes("w-12");
    return (
      <div className={`${className} rounded-2xl bg-white border border-[#ECEEF8] flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1.5`}>
        <img
          src={TX_VISA_MASTER_IMG}
          alt="Visa Mastercard"
          className={isLarge ? "w-10 h-8 object-contain" : "w-7 h-5 object-contain"}
        />
      </div>
    );
  }

  // 6. Binance Pay
  if (method.includes("binance") || title.includes("binance")) {
    return (
      <div className={`${className} rounded-2xl bg-[#F3BA2F]/15 border border-[#F3BA2F]/30 flex items-center justify-center shrink-0 shadow-2xs`}>
        <SiBinance className="w-5 h-5 text-[#E5A91E]" />
      </div>
    );
  }

  // 7. Cryptomus
  if (method.includes("cryptomus") || title.includes("cryptomus") || title.includes("usdt")) {
    return (
      <div className={`${className} rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0 shadow-2xs`}>
        <CryptomusLogo className="w-5 h-5" />
      </div>
    );
  }
  return (
    <div className={`${className} rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
      (tx?.amountCents || 0) > 0 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-purple-50 text-[#5B42F3] border border-purple-100"
    }`}>
      {(tx?.amountCents || 0) > 0 ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
    </div>
  );
};

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
  if (n.includes("kamatera") || n.includes("kamtera") || n.includes("kamater") || n.includes("kamat")) {
    return <KamateraLogo className={className} />;
  }
  if (n.includes("windows")) {
    return <FaWindows className={`${className} text-[#0078D7]`} />;
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

  // 3. Email & Productivity
  if (n.includes("hotmail") || n.includes("outlook") || n.includes("mail")) {
    return (
      <img 
        src="https://img.icons8.com/color/96/microsoft-outlook-2019.png" 
        alt="Hotmail / Outlook" 
        className={`${className} object-contain`} 
      />
    );
  }
  if (n.includes("canva")) {
    return <SiCanva className={`${className} text-[#00C4CC]`} />;
  }
  if (n.includes("adobe") || n.includes("photoshop") || n.includes("illustrator")) {
    return (
      <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
        <path d="M14.5 3h7.5v18l-7.5-18zM9.5 3H2v18l7.5-18zm2.5 9.2l3.8 8.8h-3l-1.3-3.4h-3.4l2.4-5.4h1.5z" fill="#FA0F00"/>
      </svg>
    );
  }

  // 4. AI & Tools
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

export function cleanSandromaniaText(text: string = ""): string {
  if (!text) return "";
  return text
    .replace(/\{ce:\d+:?(.*?)\}/g, "$1")
    .replace(/\{ce:\d+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Provider Metadata
const getProviderConfig = (name: string = "", type: string = "") => {
  const cleanName = cleanSandromaniaText(name);
  const cleanType = cleanSandromaniaText(type);
  const n = (cleanName + " " + cleanType).toLowerCase();
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
  if (n.includes("windows")) {
    return {
      tag: "Windows OS",
      accent: "#0078D7",
      bgBadge: "bg-[#E1F5FE] text-[#0277BD]",
      blobColor: "from-sky-100/70 to-blue-100/40",
      category: "windows",
    };
  }
  if (n.includes("hotmail") || n.includes("outlook") || n.includes("mail")) {
    return {
      tag: "Hotmail / Outlook",
      accent: "#0078D4",
      bgBadge: "bg-[#EBF3FC] text-[#0078D4]",
      blobColor: "from-blue-100/70 to-sky-100/40",
      category: "hotmail",
    };
  }
  if (n.includes("canva")) {
    return {
      tag: "Canva Pro",
      accent: "#00C4CC",
      bgBadge: "bg-[#E0F7FA] text-[#00838F]",
      blobColor: "from-teal-100/70 to-cyan-100/40",
      category: "canva",
    };
  }
  if (n.includes("adobe") || n.includes("photoshop")) {
    return {
      tag: "Adobe Suite",
      accent: "#FA0F00",
      bgBadge: "bg-[#FFEBEE] text-[#C62828]",
      blobColor: "from-red-100/70 to-orange-100/40",
      category: "adobe",
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
  if (n.includes("kamatera") || n.includes("kamtera") || n.includes("kamater") || n.includes("kamat")) {
    return {
      tag: "Kamatera",
      accent: "#FF5E00",
      bgBadge: "bg-[#FFF3E0] text-[#E65100]",
      blobColor: "from-amber-100/70 to-orange-100/40",
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

// SMM Platform Metadata Helper
const getSmmPlatformConfig = (category: string = "", name: string = "") => {
  const c = (category + " " + name).toLowerCase();
  if (c.includes("tiktok")) {
    return {
      platform: "TikTok",
      tag: "TikTok",
      accent: "#000000",
      bgBadge: "bg-black/10 text-black border border-black/20",
      blobColor: "from-slate-200/80 to-zinc-300/50",
      icon: <FaTiktok className="w-12 h-12 text-black" />,
      smallIcon: <FaTiktok className="w-4 h-4 text-black" />,
    };
  }
  if (c.includes("instagram") || c.includes("insta")) {
    return {
      platform: "Instagram",
      tag: "Instagram",
      accent: "#E1306C",
      bgBadge: "bg-[#FCE8F0] text-[#E1306C] border border-[#FCE8F0]",
      blobColor: "from-pink-100/80 to-rose-200/50",
      icon: <FaInstagram className="w-12 h-12 text-[#E1306C]" />,
      smallIcon: <FaInstagram className="w-4 h-4 text-[#E1306C]" />,
    };
  }
  if (c.includes("facebook") || c.includes("fb")) {
    return {
      platform: "Facebook",
      tag: "Facebook",
      accent: "#1877F2",
      bgBadge: "bg-[#EBF3FF] text-[#1877F2] border border-[#EBF3FF]",
      blobColor: "from-blue-100/80 to-sky-200/50",
      icon: <FaFacebook className="w-12 h-12 text-[#1877F2]" />,
      smallIcon: <FaFacebook className="w-4 h-4 text-[#1877F2]" />,
    };
  }
  if (c.includes("telegram") || c.includes("tg")) {
    return {
      platform: "Telegram",
      tag: "Telegram",
      accent: "#24A1DE",
      bgBadge: "bg-[#E6F5FC] text-[#24A1DE] border border-[#E6F5FC]",
      blobColor: "from-sky-100/80 to-blue-200/50",
      icon: <FaTelegramPlane className="w-12 h-12 text-[#24A1DE]" />,
      smallIcon: <FaTelegramPlane className="w-4 h-4 text-[#24A1DE]" />,
    };
  }
  return {
    platform: "Social",
    tag: "Social Boost",
    accent: "#6C5CE7",
    bgBadge: "bg-[#EDE9FE] text-[#6C5CE7] border border-[#EDE9FE]",
    blobColor: "from-purple-100/80 to-indigo-200/50",
    icon: <Sparkles className="w-12 h-12 text-[#6C5CE7]" />,
    smallIcon: <Sparkles className="w-4 h-4 text-[#6C5CE7]" />,
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

  // Telegram detection: Telegram Mini-App or WebApp environment
  const isTelegram = useMemo(() => {
    if (typeof window === "undefined") return false;
    const initData = getTelegramInitData();
    const hasTgParam = window.location.search.includes("tgWebAppPlatform") || window.location.search.includes("tg_webapp") || window.location.hash.includes("tgWebAppData");
    const hasTgObj = Boolean((window as any).Telegram?.WebApp?.initData);
    return Boolean(initData || hasTgParam || hasTgObj);
  }, []);

  // Currency State (USD / LKR) - Auto-detect Sri Lanka (LKR) vs Global (USD) on first visit. Telegram is strictly locked to USD.
  const [selectedCurrency, setSelectedCurrency] = useState<"USD" | "LKR">(() => {
    if (isTelegram) return "USD";
    const saved = localStorage.getItem("app_currency");
    if (saved === "LKR" || saved === "USD") return saved;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz.includes("Colombo") || tz.includes("Sri_Lanka") || tz.includes("Kolkata")) {
        return "LKR";
      }
    } catch {}
    return "USD";
  });

  const { data: currencyData } = useQuery<{ rates: Record<string, number>; defaultCurrency?: string; isSriLanka?: boolean }>({
    queryKey: ["/api/currency/rates"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/currency/rates");
        const data = await res.json();
        if (data?.rates?.LKR) {
          localStorage.setItem("cached_lkr_rate", String(data.rates.LKR));
        }
        return data;
      } catch {
        const cached = parseFloat(localStorage.getItem("cached_lkr_rate") || "") || 330.04;
        return { rates: { USD: 1.0, LKR: cached }, defaultCurrency: "USD", isSriLanka: false };
      }
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem("cached_lkr_rate");
        if (cached) {
          return { rates: { USD: 1.0, LKR: parseFloat(cached) }, defaultCurrency: "LKR", isSriLanka: true };
        }
      } catch {}
      return undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Auto-apply detected currency on first visit if user hasn't toggled yet (skipped in Telegram)
  useEffect(() => {
    if (currencyData) {
      if (currencyData.rates?.LKR) {
        localStorage.setItem("cached_lkr_rate", String(currencyData.rates.LKR));
      }
      if (!isTelegram && !localStorage.getItem("app_currency")) {
        const detected = currencyData.defaultCurrency === "LKR" || currencyData.isSriLanka ? "LKR" : "USD";
        setSelectedCurrency(detected);
      }
    }
  }, [currencyData, isTelegram]);

  const lkrRate = currencyData?.rates?.LKR || (parseFloat(typeof window !== "undefined" ? localStorage.getItem("cached_lkr_rate") || "" : "") || 330.04);

  // Selected Product Detail Modal
  const [detailProduct, setDetailProduct] = useState<(Product & { stockCount?: number }) | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Purchase Coupon Code State
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountCents: number;
    discountUsd: string;
    discountType: string;
    discountValue: number;
    finalPriceCents: number;
    finalPriceUsd: string;
    finalPriceLkr: number;
  } | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [isCouponSectionOpen, setIsCouponSectionOpen] = useState(false);

  // AI Support Chat Drawer
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "bot"; content: string }[]>([
    { role: "bot", content: "👋 Hi! Welcome to youuhost. How can I help you choose the best cloud server or account today?" },
  ]);
  const [isChatSending, setIsChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Terms & Conditions Modal State
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [termsModalProduct, setTermsModalProduct] = useState<string | null>(null);
  const [termsModalCustomText, setTermsModalCustomText] = useState<string | null>(null);

  // Dynamic Hero Banners Query (cached with graceful loading prevention)
  const { data: dynamicHeroBannersData, isLoading: isHeroBannersLoading } = useQuery<{ banners?: any[]; isConfigured?: boolean } | any[]>({
    queryKey: ["/api/mini/hero-banners"],
    staleTime: 60 * 1000,
  });

  const activeHeroSlides = useMemo(() => {
    if (!dynamicHeroBannersData) {
      if (isHeroBannersLoading) return [];
      return HERO_SLIDES;
    }

    if (Array.isArray(dynamicHeroBannersData)) {
      const filtered = dynamicHeroBannersData.filter((b: any) => b.isActive !== false);
      return filtered.length > 0 ? filtered : HERO_SLIDES;
    }

    if (dynamicHeroBannersData.isConfigured) {
      const filtered = Array.isArray(dynamicHeroBannersData.banners)
        ? dynamicHeroBannersData.banners.filter((b: any) => b.isActive !== false)
        : [];
      return filtered.length > 0 ? filtered : HERO_SLIDES;
    }

    if (Array.isArray(dynamicHeroBannersData.banners) && dynamicHeroBannersData.banners.length > 0) {
      const filtered = dynamicHeroBannersData.banners.filter((b: any) => b.isActive !== false);
      return filtered.length > 0 ? filtered : HERO_SLIDES;
    }

    return HERO_SLIDES;
  }, [dynamicHeroBannersData, isHeroBannersLoading]);

  // Hero Auto-Swap & Touch/Mouse Swipe Carousel State
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [heroSearchFocusKeyword, setHeroSearchFocusKeyword] = useState<string>("");
  const heroTouchStartX = useRef<number | null>(null);
  const heroTouchStartY = useRef<number | null>(null);
  const heroDragStartX = useRef<number | null>(null);

  const nextHeroSlide = () => {
    const count = activeHeroSlides.length || 1;
    setCurrentHeroSlide((prev) => (prev + 1) % count);
  };

  const prevHeroSlide = () => {
    const count = activeHeroSlides.length || 1;
    setCurrentHeroSlide((prev) => (prev - 1 + count) % count);
  };

  const handleHeroTouchStart = (e: React.TouchEvent) => {
    setIsHeroPaused(true);
    heroTouchStartX.current = e.touches[0].clientX;
    heroTouchStartY.current = e.touches[0].clientY;
  };

  const handleHeroTouchEnd = (e: React.TouchEvent) => {
    setIsHeroPaused(false);
    if (heroTouchStartX.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = heroTouchStartX.current - endX;
    const diffY = heroTouchStartY.current ? heroTouchStartY.current - endY : 0;

    // Detect horizontal swipe if delta > 30px and greater than vertical scroll
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
      if (diffX > 0) {
        nextHeroSlide();
      } else {
        prevHeroSlide();
      }
    }
    heroTouchStartX.current = null;
    heroTouchStartY.current = null;
  };

  const handleHeroMouseDown = (e: React.MouseEvent) => {
    setIsHeroPaused(true);
    heroDragStartX.current = e.clientX;
  };

  const handleHeroMouseUp = (e: React.MouseEvent) => {
    setIsHeroPaused(false);
    if (heroDragStartX.current === null) return;
    const diffX = heroDragStartX.current - e.clientX;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        nextHeroSlide();
      } else {
        prevHeroSlide();
      }
    }
    heroDragStartX.current = null;
  };

  useEffect(() => {
    if (isHeroPaused) return;
    const count = activeHeroSlides.length || 1;
    const interval = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % count);
    }, 3500);
    return () => clearInterval(interval);
  }, [isHeroPaused, activeHeroSlides.length]);

  // Category Horizontal Scroll & Drag Support for Mobile and Desktop
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [isCatDown, setIsCatDown] = useState(false);
  const [catStartX, setCatStartX] = useState(0);
  const [catScrollLeft, setCatScrollLeft] = useState(0);
  const [catMoved, setCatMoved] = useState(false);

  // Top-Up State
  const [cryptomusAmount, setCryptomusAmount] = useState("10");
  const [isCreatingCryptomus, setIsCreatingCryptomus] = useState(false);
  const [payhereAmount, setPayhereAmount] = useState(() => {
    return (localStorage.getItem("app_currency") === "LKR") ? "1000" : "5";
  });
  const [isCreatingPayHere, setIsCreatingPayHere] = useState(false);

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

    // Handle Google OAuth Callback params
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("auth_token");
    if (tokenFromUrl) {
      try { localStorage.setItem("yh_auth_token", tokenFromUrl); } catch {}
    }
    if (urlParams.get("auth_success") === "google") {
      toast({
        title: "Google Sign-In Successful! 🎉",
        description: "You are now logged in with your Google account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/payments"] });
      refetchUser();
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (urlParams.get("auth_error")) {
      toast({
        title: "Google Sign-In Failed",
        description: decodeURIComponent(urlParams.get("auth_error") || "Authentication failed"),
        variant: "destructive",
      });
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

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
      const data = await res.json();
      if (data && data.id && !data.isGuest) {
        try { localStorage.setItem("yh_active_user", JSON.stringify(data)); } catch {}
      }
      return data;
    },
    initialData: () => {
      try {
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem("yh_active_user");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && (parsed.id || parsed.email) && !parsed.isGuest) {
              return { ...parsed, isLoggedIn: true };
            }
          }
        }
      } catch {}
      return undefined;
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<(Product & { stockCount?: number })[]>({
    queryKey: ["/api/mini/products"],
    queryFn: async () => {
      const res = await miniApiRequest("GET", "/api/mini/products");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: offers = [] } = useQuery<SpecialOffer[]>({
    queryKey: ["/api/mini/offers"],
    queryFn: async () => {
      const res = await miniApiRequest("GET", "/api/mini/offers");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: orders = [], refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ["/api/mini/orders"],
    queryFn: async () => {
      const res = await miniApiRequest("GET", "/api/mini/orders");
      return res.json();
    },
    enabled: activeTab === "orders" || activeTab === "profile",
    refetchInterval: activeTab === "orders" ? 8000 : false,
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/mini/payments"],
    queryFn: async () => {
      const res = await miniApiRequest("GET", "/api/mini/payments");
      return res.json();
    },
    enabled: activeTab === "wallet" || activeTab === "profile",
  });

  const { data: bestSellersData } = useQuery<{ featured: any[]; enableLightingBorder?: boolean; allStats: Record<number, any> }>({
    queryKey: ["/api/mini/best-sellers"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/mini/best-sellers");
        if (!res.ok) return { featured: [], enableLightingBorder: true, allStats: {} };
        return res.json();
      } catch {
        return { featured: [], enableLightingBorder: true, allStats: {} };
      }
    },
    staleTime: 30 * 1000,
  });

  // SMM Services & Orders Queries
  const { data: smmServicesList = [] } = useQuery<any[]>({
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

  const { data: smmOrdersList = [], refetch: refetchSmmOrders } = useQuery<any[]>({
    queryKey: ["/api/mini/smm/orders"],
    queryFn: async () => {
      try {
        const res = await miniApiRequest("GET", "/api/mini/smm/orders");
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: activeTab === "orders",
    refetchInterval: activeTab === "orders" ? 8000 : false,
  });

  // SMM Modal & Ordering State
  const [detailSmmService, setDetailSmmService] = useState<any | null>(null);
  const [smmTargetLink, setSmmTargetLink] = useState("");
  const [smmOrderQty, setSmmOrderQty] = useState<number>(1000);
  const [isSmmPurchasing, setIsSmmPurchasing] = useState(false);

  // Sandromania Products & Orders Queries
  const { data: sandromaniaProductsList = [] } = useQuery<any[]>({
    queryKey: ["/api/mini/sandromania/products"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/mini/sandromania/products");
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    refetchInterval: 10000,
  });

  const { data: sandromaniaOrdersList = [], refetch: refetchSandromaniaOrders } = useQuery<any[]>({
    queryKey: ["/api/mini/sandromania/orders"],
    queryFn: async () => {
      try {
        const res = await miniApiRequest("GET", "/api/mini/sandromania/orders");
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: activeTab === "orders",
    refetchInterval: activeTab === "orders" ? 8000 : false,
  });

  // CSxStore Products & Orders Queries
  const { data: cssxProductsList = [] } = useQuery<any[]>({
    queryKey: ["/api/mini/cssx/products"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/mini/cssx/products");
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    refetchInterval: 10000,
  });

  const { data: cssxOrdersList = [], refetch: refetchCssxOrders } = useQuery<any[]>({
    queryKey: ["/api/mini/cssx/orders"],
    queryFn: async () => {
      try {
        const res = await miniApiRequest("GET", "/api/mini/cssx/orders");
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: activeTab === "orders",
    refetchInterval: activeTab === "orders" ? 8000 : false,
  });

  // Inline Tab Loading states for Orders and Profile
  const [isOrdersTabLoading, setIsOrdersTabLoading] = useState(false);
  const [isProfileTabLoading, setIsProfileTabLoading] = useState(false);

  // Auto-sync fresh data inline without modal popup when user navigates to Orders or Profile
  useEffect(() => {
    if (activeTab === "orders") {
      setIsOrdersTabLoading(true);
      const timerStart = Date.now();
      Promise.all([
        refetchOrders(),
        refetchSandromaniaOrders(),
        refetchCssxOrders(),
        refetchSmmOrders(),
      ]).finally(() => {
        const elapsed = Date.now() - timerStart;
        const delay = Math.max(0, 950 - elapsed);
        setTimeout(() => setIsOrdersTabLoading(false), delay);
      });
    } else if (activeTab === "profile") {
      setIsProfileTabLoading(true);
      const timerStart = Date.now();
      Promise.all([
        refetchUser(),
        queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] }),
      ]).finally(() => {
        const elapsed = Date.now() - timerStart;
        const delay = Math.max(0, 900 - elapsed);
        setTimeout(() => setIsProfileTabLoading(false), delay);
      });
    }
  }, [activeTab]);

  // Orders Tab Filter & Unified List State
  const [ordersFilter, setOrdersFilter] = useState<"all" | "account" | "smm" | "license">("all");
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);

  const handleSyncAllOrders = async () => {
    setIsSyncingOrders(true);
    try {
      await Promise.all([
        refetchOrders(),
        refetchSmmOrders(),
        refetchSandromaniaOrders(),
        refetchCssxOrders(),
      ]);
      toast({
        title: "Orders Synced! 🔄",
        description: "Your latest orders & status updates are refreshed.",
      });
    } catch {
      toast({
        title: "Sync complete",
        description: "Orders checked.",
      });
    } finally {
      setIsSyncingOrders(false);
    }
  };

  // Unified Chronological Order History (Sorted Newest First - Only Successful & Active Orders)
  const unifiedOrdersList = useMemo(() => {
    const list: any[] = [];

    // 1. Cloud & Account Orders (Exclude failed API / checkout errors)
    orders.forEach((ord: any) => {
      const isFailed = (ord.status || "").toLowerCase() === "failed";
      if (isFailed) return; // Customer order list only shows successful fulfilled purchases

      const prodName = ord.product?.name || "Cloud & Account Service";
      const prodType = ord.product?.type || "account";
      const conf = getProviderConfig(prodName, prodType);

      const priceCentsVal = ord.product?.price || 0;
      const orderPriceLkr = (ord as any).amountPaidLkr 
        ? Number((ord as any).amountPaidLkr)
        : (ord.product?.priceLkr ? Number(ord.product.priceLkr) : Math.round((priceCentsVal / 100) * lkrRate));

      list.push({
        id: `ord-${ord.id}`,
        rawId: ord.id,
        orderType: "account",
        orderNumber: `#ORD-${ord.id}`,
        title: prodName,
        categoryTag: conf.tag || "Cloud Service",
        badgeBg: conf.bgBadge || "bg-purple-50 text-[#5B42F3] border-purple-200",
        status: "Active / Completed",
        statusBadge: (
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            Active / Completed
          </span>
        ),
        priceCents: priceCentsVal,
        priceLkr: orderPriceLkr,
        quantity: 1,
        date: ord.createdAt ? new Date(ord.createdAt) : new Date(0),
        credentialData: ord.credential?.content || ord.credential?.data || ord.credentialData || ord.credentialContent || ord.content || (typeof ord.credential === "string" ? ord.credential : ""),
        twoFactorSecret: ord.credential?.twoFactorSecret || ord.twoFactorSecret,
      });
    });

    // 2. SMM Social Boost Orders
    smmOrdersList.forEach((smmOrd: any) => {
      const status = (smmOrd.status || "Pending").toLowerCase();
      if (status.includes("fail") || status.includes("cancel")) return;

      const smmService = smmOrd.smmService || smmServicesList.find((s) => s.id === smmOrd.smmServiceId);
      const conf = getSmmPlatformConfig(smmService?.category || smmOrd.serviceCategory || "", smmService?.name || smmOrd.serviceName || "");

      let statusBadge = (
        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
          Pending
        </span>
      );
      if (status.includes("complete") || status.includes("success")) {
        statusBadge = (
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            Completed
          </span>
        );
      } else if (status.includes("progress") || status.includes("processing")) {
        statusBadge = (
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
            In Progress
          </span>
        );
      } else if (status.includes("partial")) {
        statusBadge = (
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
            Partial
          </span>
        );
      }

      list.push({
        id: `smm-${smmOrd.id}`,
        rawId: smmOrd.id,
        orderType: "smm",
        orderNumber: `#YH-${smmOrd.id}`,
        title: smmOrd.serviceName || smmService?.name || `Social Boost Service #${smmOrd.id}`,
        categoryTag: conf.tag || "Social Boost",
        badgeBg: conf.bgBadge || "bg-pink-50 text-pink-600 border-pink-200",
        status: smmOrd.status || "Pending",
        statusBadge,
        priceCents: smmOrd.charge || smmOrd.amountPaid || 0,
        quantity: smmOrd.quantity || 1,
        date: smmOrd.createdAt ? new Date(smmOrd.createdAt) : new Date(0),
        smmLink: smmOrd.link,
        startCount: smmOrd.startCount,
        remains: smmOrd.remains,
      });
    });

    // 3. Sandromania CDK Orders
    sandromaniaOrdersList.forEach((sandroOrd: any) => {
      const status = (sandroOrd.status || "Completed").toLowerCase();
      if (status.includes("fail") || status.includes("cancel")) return;

      const conf = getProviderConfig(sandroOrd.product?.title || "", sandroOrd.product?.category || "");

      let statusBadge = (
        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
          Auto-Delivered
        </span>
      );
      if (status.includes("pend") || status.includes("process")) {
        statusBadge = (
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
            Processing
          </span>
        );
      }

      let deliveredData =
        sandroOrd.deliveryText ||
        sandroOrd.deliveredData ||
        (sandroOrd.responsePayload ? (typeof sandroOrd.responsePayload === "string" ? sandroOrd.responsePayload : JSON.stringify(sandroOrd.responsePayload)) : "");

      if (typeof deliveredData === "string") {
        deliveredData = deliveredData.trim();
        if (deliveredData.startsWith('"') && deliveredData.endsWith('"') && deliveredData.length > 2) {
          deliveredData = deliveredData.slice(1, -1);
        }
      }

      const prodTitle =
        sandroOrd.productTitle ||
        sandroOrd.product?.title ||
        (sandromaniaProductsList.find((p: any) => p.id === sandroOrd.sandromaniaProductId || p.externalProductId === sandroOrd.externalProductId)?.title) ||
        "Digital Product";

      const orderNum = `#YOUUHOST - ${sandroOrd.externalOrderId || (2000 + sandroOrd.id)}`;

      const matchedProd = sandromaniaProductsList.find((p: any) => 
        p.id === sandroOrd.sandromaniaProductId || 
        p.externalProductId === sandroOrd.externalProductId ||
        (p.title && sandroOrd.productTitle && p.title.trim().toLowerCase() === sandroOrd.productTitle.trim().toLowerCase())
      );
      const fixedLkr = sandroOrd.sellingPriceLkr || sandroOrd.product?.sellingPriceLkr || matchedProd?.sellingPriceLkr;
      const actualPaidLkr = sandroOrd.amountPaidLkr 
        ? Number(sandroOrd.amountPaidLkr) 
        : (sandroOrd.unitPriceLkr ? Number(sandroOrd.unitPriceLkr) * (sandroOrd.quantity || 1) : null);
      const displayPriceLkr = actualPaidLkr ?? (fixedLkr ? Number(fixedLkr) * (sandroOrd.quantity || 1) : null);

      list.push({
        id: `sandro-${sandroOrd.id}`,
        rawId: sandroOrd.id,
        orderType: "license",
        orderNumber: orderNum,
        title: prodTitle,
        categoryTag: conf.tag || "Digital License",
        badgeBg: conf.bgBadge || "bg-emerald-50 text-emerald-600 border-emerald-200",
        status: sandroOrd.status || "Completed",
        statusBadge,
        priceCents: sandroOrd.amountPaid || 0,
        priceLkr: displayPriceLkr,
        quantity: sandroOrd.quantity || 1,
        date: sandroOrd.createdAt ? new Date(sandroOrd.createdAt) : new Date(0),
        licenseKey: deliveredData,
      });
    });

    // 4. CSxStore CDK Orders
    cssxOrdersList.forEach((cssxOrd: any) => {
      const status = (cssxOrd.status || "Completed").toLowerCase();
      if (status.includes("fail") || status.includes("cancel")) return;

      const conf = getProviderConfig(cssxOrd.productTitle || "", cssxOrd.product?.category || "");

      let statusBadge = (
        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
          Auto-Delivered
        </span>
      );
      if (status.includes("pend") || status.includes("process")) {
        statusBadge = (
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
            Processing
          </span>
        );
      }

      let deliveredData =
        cssxOrd.deliveryText ||
        cssxOrd.deliveredData ||
        (cssxOrd.responsePayload ? (typeof cssxOrd.responsePayload === "string" ? cssxOrd.responsePayload : JSON.stringify(cssxOrd.responsePayload)) : "");

      if (typeof deliveredData === "string") {
        deliveredData = deliveredData.trim();
        if (deliveredData.startsWith('"') && deliveredData.endsWith('"') && deliveredData.length > 2) {
          deliveredData = deliveredData.slice(1, -1);
        }
      }

      const prodTitle =
        cssxOrd.productTitle ||
        cssxOrd.product?.title ||
        (cssxProductsList.find((p: any) => p.id === cssxOrd.cssxProductId || p.serviceId === cssxOrd.serviceId)?.title) ||
        "Digital Product";

      const cleanExtId = String(cssxOrd.externalOrderId || "").replace(/^API_/i, "");
      const orderNum = `#YOUUHOST - ${cleanExtId || (3000 + cssxOrd.id)}`;

      const matchedProd = cssxProductsList.find((p: any) => 
        p.id === cssxOrd.cssxProductId || 
        p.serviceId === cssxOrd.serviceId ||
        (p.name && cssxOrd.productTitle && p.name.trim().toLowerCase() === cssxOrd.productTitle.trim().toLowerCase())
      );
      const fixedLkr = cssxOrd.sellingPriceLkr || cssxOrd.product?.sellingPriceLkr || matchedProd?.sellingPriceLkr;
      const actualPaidLkr = cssxOrd.amountPaidLkr 
        ? Number(cssxOrd.amountPaidLkr) 
        : (cssxOrd.unitPriceLkr ? Number(cssxOrd.unitPriceLkr) * (cssxOrd.quantity || 1) : null);
      const displayPriceLkr = actualPaidLkr ?? (fixedLkr ? Number(fixedLkr) * (cssxOrd.quantity || 1) : null);

      list.push({
        id: `cssx-${cssxOrd.id}`,
        rawId: cssxOrd.id,
        orderType: "license",
        orderNumber: orderNum,
        title: prodTitle,
        categoryTag: conf.tag || "Digital License",
        badgeBg: conf.bgBadge || "bg-emerald-50 text-emerald-600 border-emerald-200",
        status: cssxOrd.status || "Completed",
        statusBadge,
        priceCents: cssxOrd.amountPaid || 0,
        priceLkr: displayPriceLkr,
        quantity: cssxOrd.quantity || 1,
        date: cssxOrd.createdAt ? new Date(cssxOrd.createdAt) : new Date(0),
        licenseKey: deliveredData,
      });
    });

    // Chronological Sort: Newest Order Always First
    list.sort((a, b) => b.date.getTime() - a.date.getTime());

    return list;
  }, [orders, smmOrdersList, sandromaniaOrdersList, cssxOrdersList, smmServicesList, cssxProductsList, lkrRate]);

  const filteredOrders = useMemo(() => {
    if (ordersFilter === "all") return unifiedOrdersList;
    return unifiedOrdersList.filter((item) => item.orderType === ordersFilter);
  }, [unifiedOrdersList, ordersFilter]);

  // Order Details Modal State & Txt Downloader
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  const downloadOrderTxt = (ord: any) => {
    if (!ord) return;
    const dateStr = ord.date && ord.date.getTime() > 0 ? format(ord.date, "yyyy-MM-dd HH:mm:ss") : "N/A";
    const priceUsd = (ord.priceCents / 100).toFixed(2);
    const priceLkr = Math.round((ord.priceCents / 100) * lkrRate).toLocaleString();

    let credSection = "";
    const rawDelivery = ord.credentialData || ord.licenseKey;
    if (rawDelivery) {
      const formatted = formatDeliveredCredentialsForCopy(rawDelivery, ord.quantity, ord.title);
      if (formatted !== rawDelivery) {
        credSection = `PARSED DETAILS / CREDENTIALS:\n----------------------------------------\n${formatted}\n\nRAW DATA:\n${rawDelivery}\n`;
      } else {
        credSection = `DELIVERED CREDENTIALS / ACCESS / CDK:\n----------------------------------------\n${rawDelivery}\n`;
      }
      if (ord.twoFactorSecret) {
        credSection += `\n2FA SECRET KEY: ${ord.twoFactorSecret}\n`;
      }
    } else if (ord.smmLink) {
      credSection = `SERVICE TARGET LINK:\n----------------------------------------\n${ord.smmLink}\nQuantity   : ${ord.quantity}\nStart Count: ${ord.startCount || 0}\nRemains    : ${ord.remains || 0}\n`;
    } else {
      credSection = `STATUS / DELIVERY:\n----------------------------------------\n${ord.status}\n`;
    }

    const content = `========================================
YOUUHOST DIGITAL RECEIPT & ACCESS
========================================
Order Number : ${ord.orderNumber}
Product      : ${ord.title}
Category     : ${ord.categoryTag}
Status       : ${ord.status}
Order Date   : ${dateStr}
Quantity     : ${ord.quantity || 1}
Amount Paid  : $${priceUsd} USD (Rs. ${priceLkr} LKR)
----------------------------------------
${credSection}----------------------------------------
Support: https://t.me/youuhost_support
========================================`;

    try {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanOrderNum = ord.orderNumber.replace(/[^a-zA-Z0-9-]/g, "");
      link.download = `YouuHost_${cleanOrderNum}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Receipt Downloaded! 📄",
        description: `${ord.orderNumber} saved as .txt file.`
      });
    } catch (err) {
      toast({
        title: "Download Failed",
        description: "Please copy credentials manually.",
        variant: "destructive"
      });
    }
  };

  // Sandromania Modal & Ordering State
  const [detailSandromaniaProduct, setDetailSandromaniaProduct] = useState<any | null>(null);
  const [sandromaniaOrderQty, setSandromaniaOrderQty] = useState<number>(1);
  const [isSandromaniaPurchasing, setIsSandromaniaPurchasing] = useState(false);

  // CSxStore Modal & Ordering State
  const [detailCssxProduct, setDetailCssxProduct] = useState<any | null>(null);
  const [cssxOrderQty, setCssxOrderQty] = useState<number>(1);
  const [isCssxPurchasing, setIsCssxPurchasing] = useState(false);

  // Instant Sold Counts delta tracking persisted in localStorage
  const [purchasedDeltas, setPurchasedDeltas] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("yh_purchased_sold_deltas");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const recordPurchasedDelta = (itemKey: string, qty: number) => {
    setPurchasedDeltas((prev) => {
      const next = { ...prev, [itemKey]: (prev[itemKey] || 0) + Math.max(1, qty) };
      try {
        localStorage.setItem("yh_purchased_sold_deltas", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Dynamic realistic sold counts: Gemini increases by 6-10 every hour (minute-by-minute), others by 5-15 every 24 hours
  const getItemStats = (item: any, type: "product" | "sandromania" | "smm") => {
    if (!item) return { sold: 320, rating: "4.9", reviewsCount: 145 };
    const idNum = typeof item.id === "number" ? item.id : (parseInt(String(item.id || 1).replace(/\D/g, ""), 10) || 1);
    const title = String(item.name || item.title || item.type || item.category || "").toLowerCase();
    const isGemini = title.includes("gemini");

    // Anchor time: 2026-09-29 11:00:00 UTC (Anchor matching current epoch)
    const BASE_ANCHOR = 1790679600000;
    const now = Date.now();
    const elapsedMs = Math.max(0, now - BASE_ANCHOR);

    let dynamicSoldAddition = 0;

    if (isGemini) {
      // 6 to 10 every hour, spaced minute by minute throughout each hour
      const elapsedHours = elapsedMs / 3600000;
      const fullHours = Math.floor(elapsedHours);
      let cumSum = 0;
      for (let h = 0; h < fullHours; h++) {
        cumSum += 6 + ((idNum * 17 + h * 13) % 5); // 6, 7, 8, 9, or 10
      }
      const currentHourRate = 6 + ((idNum * 17 + fullHours * 13) % 5);
      const hourFraction = (elapsedMs % 3600000) / 3600000;
      const intraHourSold = Math.floor(hourFraction * currentHourRate);
      dynamicSoldAddition = cumSum + intraHourSold;
    } else {
      // 5 to 15 every 24 hours, spaced throughout the day
      const elapsedDays = elapsedMs / 86400000;
      const fullDays = Math.floor(elapsedDays);
      let cumSum = 0;
      for (let d = 0; d < fullDays; d++) {
        cumSum += 5 + ((idNum * 19 + d * 11) % 11); // 5 to 15
      }
      const currentDayRate = 5 + ((idNum * 19 + fullDays * 11) % 11);
      const dayFraction = (elapsedMs % 86400000) / 86400000;
      const intraDaySold = Math.floor(dayFraction * currentDayRate);
      dynamicSoldAddition = cumSum + intraDaySold;
    }

    // Base sold anchor:
    // Gemini: 4002. All other products: random between 50 and 400
    const baseSold = isGemini 
      ? 4002
      : 50 + ((idNum * 67 + 31) % 351);

    // Reviews count & rating
    const reviewsCount = isGemini 
      ? 56 + (idNum % 5)
      : 10 + ((idNum * 29 + 17) % 231);
    const rating = isGemini ? "4.8" : (4.8 + ((idNum % 2) * 0.1)).toFixed(1);

    const key = `${type}_${item.id}`;
    const extraSold = purchasedDeltas[key] || 0;
    const sold = baseSold + dynamicSoldAddition + extraSold;

    return { sold, rating, reviewsCount };
  };

  const { data: supportUserSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/SUPPORT_USERNAME"],
  });

  const supportUser = supportUserSetting?.value || "@youuhost_support";

  const { data: depositMethods } = useQuery<{ binancePayId: string; cryptomusEnabled: boolean; payhereEnabled?: boolean; payhereGatewayUrl?: string; supportUsername: string }>({
    queryKey: ["/api/mini/deposit/methods"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/mini/deposit/methods");
        return res.json();
      } catch {
        return { binancePayId: "284910485", cryptomusEnabled: true, payhereEnabled: true, supportUsername: "@youuhost_support" };
      }
    },
  });

  const binancePayId = depositMethods?.binancePayId || "410975578";

  // --- Profile Sub-Tabs: Overview, Developer API, Transactions, Support Tickets ---
  const [profileSubTab, setProfileSubTab] = useState<"overview" | "api" | "transactions" | "tickets">("overview");
  const [showApiKeySecret, setShowApiKeySecret] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [selectedApiKeyOrders, setSelectedApiKeyOrders] = useState<any | null>(null);
  const [selectedTxDetail, setSelectedTxDetail] = useState<any | null>(null);
  const [txSearchQuery, setTxSearchQuery] = useState("");
  const [txFilterType, setTxFilterType] = useState<"all" | "deposit" | "purchase" | "smm">("all");

  // Support Ticket Form & Thread State
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportSelectedTicket, setSupportSelectedTicket] = useState<any | null>(null);
  const [ticketIssueType, setTicketIssueType] = useState("Order Delivery Issue");
  const [ticketDetails, setTicketDetails] = useState("");
  const [ticketOrderId, setTicketOrderId] = useState("");
  const [ticketPaymentId, setTicketPaymentId] = useState("");
  const [ticketSmmOrderId, setTicketSmmOrderId] = useState("");
  const [ticketAttachment, setTicketAttachment] = useState<string | null>(null);
  const [replyAttachment, setReplyAttachment] = useState<string | null>(null);
  const [ticketReplyMsg, setTicketReplyMsg] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [isReplyingTicket, setIsReplyingTicket] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [previewLightboxImage, setPreviewLightboxImage] = useState<string | null>(null);

  // Customer Support Tickets Query
  const { data: supportTicketsList = [], refetch: refetchSupportTickets } = useQuery<any[]>({
    queryKey: ["/api/mini/support/tickets"],
    queryFn: async () => {
      try {
        const res = await miniApiRequest("GET", "/api/mini/support/tickets");
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: activeTab === "profile" || isChatOpen || isSupportModalOpen,
    refetchInterval: (activeTab === "profile" || isSupportModalOpen || !!supportSelectedTicket) ? 6000 : false,
  });

  const handleCreateSupportTicket = async () => {
    if (!ticketDetails.trim()) {
      toast({
        title: "Message required",
        description: "Please explain your issue in detail.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmittingTicket(true);
    try {
      let finalSubject = ticketIssueType;
      let finalDetails = ticketDetails.trim();

      if (ticketIssueType === "Order Delivery Issue" && ticketOrderId) {
        finalSubject = `Order Issue (${ticketOrderId})`;
        finalDetails = `[Related Order: ${ticketOrderId}]\n${finalDetails}`;
      } else if (ticketIssueType === "Payment / Top-up" && ticketPaymentId) {
        finalSubject = `Payment Issue (${ticketPaymentId})`;
        finalDetails = `[Related Payment: ${ticketPaymentId}]\n${finalDetails}`;
      } else if (ticketIssueType === "SMM Boost Service" && ticketSmmOrderId) {
        finalSubject = `SMM Boost Issue (${ticketSmmOrderId})`;
        finalDetails = `[Related SMM Boost: ${ticketSmmOrderId}]\n${finalDetails}`;
      }

      const payload: any = {
        issueType: ticketIssueType,
        subject: finalSubject,
        details: finalDetails,
        attachmentUrl: ticketAttachment || undefined,
      };

      const res = await miniApiRequest("POST", "/api/mini/support/tickets", payload);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to open ticket");
      }

      const created = await res.json();
      await refetchSupportTickets();
      setIsSupportModalOpen(false);
      setTicketDetails("");
      setTicketOrderId("");
      setTicketPaymentId("");
      setTicketSmmOrderId("");
      setTicketAttachment(null);

      toast({
        title: "Support Ticket Opened",
        description: `Ticket #${created.id} submitted. Our team will review and reply shortly.`
      });

      // Navigate to tickets tab
      setActiveTab("profile");
      setProfileSubTab("tickets");
      setSupportSelectedTicket(created);
    } catch (err: any) {
      toast({
        title: "Ticket Submission Failed",
        description: err.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleSendTicketReply = async (ticketId: number) => {
    if (!ticketReplyMsg.trim() && !replyAttachment) return;
    setIsReplyingTicket(true);
    try {
      const res = await miniApiRequest("POST", `/api/mini/support/tickets/${ticketId}/message`, {
        message: ticketReplyMsg.trim(),
        attachmentUrl: replyAttachment || undefined,
      });
      if (!res.ok) throw new Error("Failed to send reply");
      const updated = await res.json();
      await refetchSupportTickets();
      setSupportSelectedTicket(updated);
      setTicketReplyMsg("");
      setReplyAttachment(null);
      toast({
        title: "Message Sent",
        description: `Your reply was sent to Ticket #${ticketId}.`
      });
    } catch (err: any) {
      toast({
        title: "Message Failed",
        description: err.message || "Failed to send reply",
        variant: "destructive"
      });
    } finally {
      setIsReplyingTicket(false);
    }
  };

  // User API Keys Query
  const { data: apiKeysData, refetch: refetchApiKeys } = useQuery<any>({
    queryKey: ["/api/mini/api-keys"],
    queryFn: async () => {
      try {
        const res = await miniApiRequest("GET", "/api/mini/api-keys");
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: activeTab === "profile",
  });

  // User Transactions Timeline Query
  const { data: transactionsList = [], isLoading: isLoadingTransactions, refetch: refetchTransactions } = useQuery<any[]>({
    queryKey: ["/api/mini/transactions"],
    queryFn: async () => {
      try {
        const res = await miniApiRequest("GET", "/api/mini/transactions");
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: activeTab === "profile",
  });

  // Specific Key Orders Query
  const { data: keyOrdersList = [], isLoading: isLoadingKeyOrders } = useQuery<any[]>({
    queryKey: [`/api/mini/api-keys/${selectedApiKeyOrders?.id}/orders`],
    queryFn: async () => {
      if (!selectedApiKeyOrders?.id) return [];
      const res = await miniApiRequest("GET", `/api/mini/api-keys/${selectedApiKeyOrders.id}/orders`);
      return res.json();
    },
    enabled: !!selectedApiKeyOrders?.id,
  });

  // API Key Mutations
  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      setPaymentModal({
        isOpen: true,
        title: "Generating Developer API Key...",
        subtitle: "Configuring API gateway endpoints & securing credentials",
      });
      await new Promise((resolve) => setTimeout(resolve, 2600));
      const res = await miniApiRequest("POST", "/api/mini/api-keys/generate");
      return res.json();
    },
    onSuccess: () => {
      setPaymentModal({ isOpen: false, title: "", subtitle: "" });
      toast({ title: "API Key Generated! 🔑", description: "Your Developer API key is now active." });
      refetchApiKeys();
      setShowApiKeySecret(true);
    },
    onError: (err: any) => {
      setPaymentModal({ isOpen: false, title: "", subtitle: "" });
      toast({ title: "Failed to generate key", description: err.message, variant: "destructive" });
    }
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await miniApiRequest("POST", `/api/mini/api-keys/${id}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "API Key Revoked 🚫" });
      refetchApiKeys();
    }
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await miniApiRequest("DELETE", `/api/mini/api-keys/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "API Key Deleted 🗑️" });
      refetchApiKeys();
    }
  });

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
      setPayhereAmount("1000");
    } else {
      setBinanceAmount("5");
      setCryptomusAmount("10");
      setPayhereAmount("5");
    }
  };

  // Smart shortfall context for pre-filling Top-up amounts when balance is insufficient
  const [shortfallContext, setShortfallContext] = useState<{
    productName: string;
    shortfallLkr: number;
    shortfallUsd: number;
    cardSuggestedLkr: number;
    neededLkr: number;
    neededUsd: number;
  } | null>(null);

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

  // Robust formatters for discounted coupon prices ensuring no 'undefined' in any currency
  const formatCouponPrice = (coupon: any) => {
    if (!coupon) return "";
    if (selectedCurrency === "LKR") {
      const lkrVal = coupon.finalPriceLkr != null 
        ? coupon.finalPriceLkr 
        : Math.round(Number(coupon.finalAmountUsd || coupon.finalPriceUsd || 0) * lkrRate);
      return `Rs. ${Number(lkrVal).toLocaleString()}`;
    }
    const usdVal = coupon.finalPriceUsd || coupon.finalAmountUsd || (Number(coupon.finalAmountCents || coupon.finalPriceCents || 0) / 100).toFixed(2);
    return `$${usdVal} USD`;
  };

  const formatCouponDiscount = (coupon: any) => {
    if (!coupon) return "";
    if (selectedCurrency === "LKR") {
      const lkrVal = coupon.discountLkr != null 
        ? coupon.discountLkr 
        : Math.round(Number(coupon.discountUsd || 0) * lkrRate);
      return `Rs. ${Number(lkrVal).toLocaleString()} saved`;
    }
    return `$${coupon.discountUsd || "0.00"} USD saved`;
  };

  const formatBalanceInCurrentCurrency = (balanceCents: number) => {
    if (selectedCurrency === "LKR") {
      if ((user as any)?.balanceLkr != null && (user as any).balanceLkr >= 0) {
        return `Rs. ${Number((user as any).balanceLkr).toLocaleString("en-US")}`;
      }
      if (!balanceCents || balanceCents <= 0) {
        return "Rs. 0";
      }
      const usd = balanceCents / 100;
      const rawLkr = usd * lkrRate;
      let rounded = Math.round(rawLkr);
      if (rounded <= 0) return "Rs. 0";
      for (const step of [10000, 5000, 2000, 1000, 500, 100, 50, 10]) {
        const rem = rounded % step;
        if (rem >= step - 25 && step <= rounded) {
          rounded += (step - rem);
          break;
        } else if (rem <= 25 && rem > 0 && rounded > step) {
          rounded -= rem;
          break;
        }
      }
      return `Rs. ${rounded.toLocaleString("en-US")}`;
    }
    const usd = (balanceCents || 0) / 100;
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

  const payhereEffectiveLkr = useMemo(() => {
    const rawAmt = parseFloat(payhereAmount || "50");
    if (isNaN(rawAmt) || rawAmt <= 0) return 50;
    return Math.max(50, Math.round(rawAmt / 50) * 50);
  }, [payhereAmount]);

  const payhereCalculatedUsd = useMemo(() => {
    const val = parseFloat(payhereAmount || "0");
    if (isNaN(val) || val <= 0) return 0;
    if (selectedCurrency === "LKR") {
      return parseFloat((payhereEffectiveLkr / lkrRate).toFixed(2));
    }
    return parseFloat(val.toFixed(2));
  }, [payhereAmount, payhereEffectiveLkr, selectedCurrency, lkrRate]);

  // Payment Processing Modal State (with aniamtion2.lottie)
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
  }>({
    isOpen: false,
    title: "",
    subtitle: "",
  });

  // 1. Handle Card / PayHere Checkout with 3s Lottie Animation
  const handlePayHerePay = async () => {
    if (!isCustomerLoggedIn) {
      toast({
        title: "Sign In Required",
        description: "Please sign in with Google or Email before initiating card deposit.",
      });
      setIsAuthModalOpen(true);
      return;
    }

    const rawAmt = parseFloat(payhereAmount || "50");
    if (isNaN(rawAmt) || rawAmt <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid deposit amount.", variant: "destructive" });
      return;
    }
    const finalAmount = selectedCurrency === "LKR" ? payhereEffectiveLkr : rawAmt;
    setIsCreatingPayHere(true);
    setPaymentModal({
      isOpen: true,
      title: "Connecting to Card Payment Gateway...",
      subtitle: `Preparing secure checkout for ${selectedCurrency === "LKR" ? `Rs. ${finalAmount.toLocaleString()}` : `$${finalAmount}`}...`,
    });

    const startTime = Date.now();
    try {
      const res = await miniApiRequest("POST", "/api/mini/deposit/payhere", {
        amount: finalAmount,
        currency: selectedCurrency,
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 3000 - elapsed);
        setTimeout(() => {
          setPaymentModal({ isOpen: false, title: "", subtitle: "" });
          window.location.href = data.checkoutUrl;
        }, delay);
      } else {
        throw new Error(data.message || "Failed to create card checkout session.");
      }
    } catch (err: any) {
      setTimeout(() => {
        setPaymentModal({ isOpen: false, title: "", subtitle: "" });
        setIsCreatingPayHere(false);
        toast({
          title: "Payment Error",
          description: err.message || "Failed to initiate card deposit.",
          variant: "destructive",
        });
      }, 1000);
    }
  };

  // 2. Handle Cryptomus Checkout with 3s Lottie Animation
  const handleCryptomusPay = async () => {
    if (!isCustomerLoggedIn) {
      toast({
        title: "Sign In Required",
        description: "Please sign in with Google or Email before generating crypto invoice.",
      });
      setIsAuthModalOpen(true);
      return;
    }

    const rawAmt = parseFloat(cryptomusAmount || "10");
    if (isNaN(rawAmt) || rawAmt <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    const effectiveUsd = cryptomusCalculatedUsd;
    if (effectiveUsd < 1) {
      toast({ title: "Invalid Amount", description: "Minimum Cryptomus top-up is $1.00 USD.", variant: "destructive" });
      return;
    }
    setIsCreatingCryptomus(true);
    setPaymentModal({
      isOpen: true,
      title: "Creating Cryptomus Invoice...",
      subtitle: `Generating encrypted crypto invoice for $${effectiveUsd.toFixed(2)} USD...`,
    });

    const startTime = Date.now();
    try {
      const res = await miniApiRequest("POST", "/api/mini/deposit/cryptomus", {
        amount: effectiveUsd,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 3000 - elapsed);
        setTimeout(() => {
          setPaymentModal({ isOpen: false, title: "", subtitle: "" });
          window.location.href = data.url;
        }, delay);
      } else {
        throw new Error(data.message || "Failed to create Cryptomus payment invoice.");
      }
    } catch (err: any) {
      setTimeout(() => {
        setPaymentModal({ isOpen: false, title: "", subtitle: "" });
        setIsCreatingCryptomus(false);
        toast({
          title: "Gateway Error",
          description: err.message || "Failed to initiate crypto deposit.",
          variant: "destructive",
        });
      }, 1000);
    }
  };

  // 3. Handle Binance Verification with 3s Lottie Animation
  const handleBinanceSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isCustomerLoggedIn) {
      toast({
        title: "Sign In Required",
        description: "Please sign in with Google or Email before verifying Binance payment.",
      });
      setIsAuthModalOpen(true);
      return;
    }

    const usdNum = binanceCalculatedUsd;
    if (usdNum < 0.1) {
      toast({
        title: "Invalid Amount",
        description: selectedCurrency === "LKR" ? "Minimum top-up is Rs. 35" : "Minimum top-up is $0.10",
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
    setPaymentModal({
      isOpen: true,
      title: "Verifying Binance Payment...",
      subtitle: `Checking Binance Pay Order ID ${binanceTxId.trim()}...`,
    });

    const startTime = Date.now();
    try {
      const res = await miniApiRequest("POST", "/api/mini/deposit/binance", {
        amount: usdNum,
        orderId: binanceTxId.trim(),
        txId: binanceTxId.trim(),
      });
      const data = await res.json();
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 3000 - elapsed);

      setTimeout(() => {
        setPaymentModal({ isOpen: false, title: "", subtitle: "" });
        setIsVerifyingBinance(false);

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
      }, delay);
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 3000 - elapsed);
      setTimeout(() => {
        setPaymentModal({ isOpen: false, title: "", subtitle: "" });
        setIsVerifyingBinance(false);
        const errorText = err.message || "Failed to submit Binance payment verification.";
        setBinanceErrorMsg(errorText);
        toast({
          title: "Verification Failed",
          description: errorText,
          variant: "destructive",
        });
      }, delay);
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
    if (user?.email && user?.id && user.id !== 0 && !user.isGuest) return true;
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
        credentials: "include",
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
        description: `We've sent a 6-digit verification code to ${authEmail}. Please check your inbox.`,
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

  // Handle Verify OTP (supports explicit code or form submit with satisfying 2.5s Lottie Animation)
  const handleVerifyOtp = async (eOrCode?: React.FormEvent | string) => {
    let codeToVerify = authOtp.trim();
    if (typeof eOrCode === "string") {
      codeToVerify = eOrCode.trim();
    } else if (eOrCode && "preventDefault" in eOrCode && typeof eOrCode.preventDefault === "function") {
      eOrCode.preventDefault();
    }

    if (!codeToVerify || codeToVerify.length < 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifyingOtp(true);
    setPaymentModal({
      isOpen: true,
      title: "Verifying Security Code...",
      subtitle: "Authenticating your YouuHost session...",
    });

    const startTime = Date.now();
    try {
      const res = await fetch("/api/auth/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: authEmail.trim(), code: codeToVerify }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Verification failed.");
      }

      if (data.token) {
        try { localStorage.setItem("yh_auth_token", data.token); } catch {}
      }
      if (data.user) {
        try { localStorage.setItem("yh_active_user", JSON.stringify(data.user)); } catch {}
        queryClient.setQueryData(["/api/mini/user"], { ...data.user, isLoggedIn: true });
      }

      // Satisfying 2.5s delay with custom Lottie animation
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 2500 - elapsed);
      await new Promise((resolve) => setTimeout(resolve, delay));

      setPaymentModal({ isOpen: false, title: "", subtitle: "" });
      toast({
        title: "🎉 Welcome!",
        description: `Successfully signed in as ${data.user?.email || data.user?.firstName}!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/payments"] });
      refetchUser();
      setAuthOtp("");
      setOtpSent(false);
    } catch (err: any) {
      setPaymentModal({ isOpen: false, title: "", subtitle: "" });
      toast({
        title: "Verification Failed",
        description: err.message || "Invalid or expired code.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOtp(false);
      setPaymentModal({ isOpen: false, title: "", subtitle: "" });
    }
  };

  const { data: googleConfig } = useQuery<{ clientId: string }>({
    queryKey: ["/api/auth/customer/google-client-id"],
  });

  // Handle Google Sign In
  const handleGoogleSignIn = () => {
    setIsGoogleLoading(true);
    setPaymentModal({
      isOpen: true,
      title: "Connecting to Google...",
      subtitle: "Redirecting to secure Google Sign-In...",
    });
    window.location.href = "/api/auth/customer/google/login";
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/customer/logout", { method: "POST", credentials: "include" });
      try { 
        localStorage.removeItem("yh_active_user"); 
        localStorage.removeItem("yh_auth_token");
      } catch {}
      queryClient.setQueryData(["/api/mini/user"], {
        id: 0,
        telegramId: "0",
        username: "Guest",
        firstName: "Web Visitor",
        lastName: "",
        balance: 0,
        isLoggedIn: false,
        isGuest: true
      });
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

  // Fetch Dynamic Categories Configuration
  const { data: categoryConfigData } = useQuery<{ categories: CustomCategoryItem[] | null }>({
    queryKey: ["/api/categories/config"],
    queryFn: async () => {
      const res = await fetch("/api/categories/config");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const categories: CustomCategoryItem[] = useMemo(() => {
    if (categoryConfigData && Array.isArray(categoryConfigData.categories) && categoryConfigData.categories.length > 0) {
      const savedCats = categoryConfigData.categories.filter((c) => c.enabled !== false);
      const savedIds = new Set(savedCats.map((c) => c.id.toLowerCase()));
      const missingDefaults = DEFAULT_CATEGORIES.filter((dc) => !savedIds.has(dc.id.toLowerCase()) && dc.enabled !== false);
      return [...savedCats, ...missingDefaults];
    }
    return DEFAULT_CATEGORIES.filter((c) => c.enabled !== false);
  }, [categoryConfigData]);

  // Terms & Conditions Agreement
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Helper to compute dynamic corner angle badge for any catalog product (local, sandromania, cssx, smm)
  const getProductBadge = (item: any, itemType: "product" | "sandromania" | "cssx" | "smm" = "product") => {
    const productBadges = (categoryConfigData as any)?.productBadges;
    const lookupKeys = [
      String(item.id),
      `${itemType}_${item.id}`,
      item.rawId ? String(item.rawId) : "",
      item.serviceId ? String(item.serviceId) : "",
      item.externalProductId ? String(item.externalProductId) : "",
    ].filter(Boolean);

    for (const k of lookupKeys) {
      const customBadge = productBadges?.[k];
      if (customBadge && customBadge.enabled !== false && customBadge.text) {
        const grad = BADGE_COLOR_STYLES[customBadge.color] || BADGE_COLOR_STYLES.red;
        return { text: customBadge.text, gradient: grad };
      }
    }

    if (item.badge) {
      return { text: item.badge, gradient: BADGE_COLOR_STYLES.red };
    }

    const isSpecialOffer = (offers || []).some((o) => o.productId === item.id && o.status === "active");
    if (isSpecialOffer) {
      return { text: "SPECIAL OFFER", gradient: BADGE_COLOR_STYLES.purple };
    }

    const typeLower = (item.type || item.category || "").toLowerCase();
    const nameLower = (item.name || item.title || "").toLowerCase();
    const catItem = categories.find((c) => c.id.toLowerCase() === typeLower || nameLower.includes(c.id.toLowerCase()));
    if (catItem && catItem.badgeEnabled && catItem.badgeText) {
      const grad = BADGE_COLOR_STYLES[catItem.badgeColor || "blue"] || BADGE_COLOR_STYLES.blue;
      return { text: catItem.badgeText, gradient: grad };
    }

    // Provider / Category Brand Palette Matching
    if (nameLower.includes("duolingo") || typeLower.includes("duolingo")) {
      return { text: "POPULAR", gradient: BADGE_COLOR_STYLES.emerald };
    }
    if (nameLower.includes("capcut") || typeLower.includes("capcut")) {
      return { text: "PRO", gradient: BADGE_COLOR_STYLES.pink };
    }
    if (nameLower.includes("hotmail") || nameLower.includes("outlook") || typeLower.includes("hotmail")) {
      return { text: "MAIL", gradient: BADGE_COLOR_STYLES.blue };
    }
    if (nameLower.includes("windows") || typeLower.includes("windows")) {
      return { text: "GENUINE", gradient: BADGE_COLOR_STYLES.blue };
    }
    if (nameLower.includes("gemini") || nameLower.includes("chatgpt") || nameLower.includes("claude") || typeLower.includes("ai")) {
      return { text: "AI PRO", gradient: BADGE_COLOR_STYLES.blue };
    }
    if (nameLower.includes("canva") || typeLower.includes("canva")) {
      return { text: "PRO", gradient: BADGE_COLOR_STYLES.pink };
    }
    if (nameLower.includes("adobe") || typeLower.includes("adobe")) {
      return { text: "VIP", gradient: BADGE_COLOR_STYLES.red };
    }
    if (nameLower.includes("facebook") || typeLower.includes("facebook")) {
      return { text: "BOOST", gradient: BADGE_COLOR_STYLES.blue };
    }
    if (nameLower.includes("instagram") || typeLower.includes("instagram")) {
      return { text: "TRENDING", gradient: BADGE_COLOR_STYLES.pink };
    }
    if (nameLower.includes("tiktok") || typeLower.includes("tiktok")) {
      return { text: "VIRAL", gradient: BADGE_COLOR_STYLES.pink };
    }
    if (nameLower.includes("telegram") || typeLower.includes("telegram")) {
      return { text: "FAST", gradient: BADGE_COLOR_STYLES.blue };
    }
    if (typeLower.includes("aws") || nameLower.includes("aws")) {
      return { text: "HOT CLOUD", gradient: BADGE_COLOR_STYLES.amber };
    }
    if (typeLower.includes("azure") || nameLower.includes("azure")) {
      return { text: "POPULAR", gradient: BADGE_COLOR_STYLES.purple };
    }
    if (typeLower.includes("digitalocean") || nameLower.includes("digitalocean") || nameLower.includes("drop")) {
      return { text: "PROMO", gradient: BADGE_COLOR_STYLES.blue };
    }
    if (typeLower.includes("oracle") || nameLower.includes("oracle")) {
      return { text: "PREMIUM", gradient: BADGE_COLOR_STYLES.red };
    }
    if (typeLower.includes("linode") || nameLower.includes("linode") || typeLower.includes("linod")) {
      return { text: "VERIFIED", gradient: BADGE_COLOR_STYLES.emerald };
    }
    if (typeLower.includes("spotify") || nameLower.includes("spotify")) {
      return { text: "MUSIC", gradient: BADGE_COLOR_STYLES.emerald };
    }
    if (typeLower.includes("youtube") || nameLower.includes("youtube")) {
      return { text: "PREMIUM", gradient: BADGE_COLOR_STYLES.red };
    }
    if (typeLower.includes("google") || nameLower.includes("google") || nameLower.includes("gcp")) {
      return { text: "PRO CLOUD", gradient: BADGE_COLOR_STYLES.blue };
    }
    if (typeLower.includes("kamatera") || nameLower.includes("kamatera")) {
      return { text: "FAST VPS", gradient: BADGE_COLOR_STYLES.pink };
    }

    if (itemType === "sandromania" || itemType === "cssx") {
      return { text: "AUTO KEY", gradient: "bg-gradient-to-r from-[#10A37F] to-[#00C9FF] text-white" };
    }
    if (itemType === "smm") {
      return { text: "BOOST", gradient: "bg-gradient-to-r from-[#FF5E62] to-[#D92078] text-white" };
    }

    return { text: "INSTANT", gradient: "bg-gradient-to-r from-[#5B42F3] to-[#00C9FF] text-white" };
  };

  // SMM Price Formatters
  const formatSmmRate = (rateCentsPer1000: number) => {
    const usd = rateCentsPer1000 / 100;
    if (selectedCurrency === "LKR") {
      const lkr = Math.round(usd * lkrRate);
      return `Rs. ${lkr.toLocaleString()} / 1k`;
    }
    return `$${usd.toFixed(2)} / 1k`;
  };

  const calculateSmmPriceFormatted = (rateCentsPer1000: number, qty: number) => {
    const totalCents = Math.round((rateCentsPer1000 / 1000) * (qty || 0));
    const usd = totalCents / 100;
    if (selectedCurrency === "LKR") {
      const lkr = Math.round(usd * lkrRate);
      return `Rs. ${lkr.toLocaleString()}`;
    }
    return `$${usd.toFixed(2)}`;
  };

  // Helper to compute available stock quantity for each category
  const getCategoryCount = useMemo(() => {
    return (categoryId: string) => {
      if (categoryId === "all") {
        const totalStock = products.reduce((acc, p) => acc + (p.stockCount || 0), 0);
        const activeSmmCount = smmServicesList.filter((s: any) => s.isActive !== false).length;
        const activeSandroCount = sandromaniaProductsList.filter((s: any) => s.isActive !== false).length;
        const activeCssxCount = cssxProductsList.filter((s: any) => s.isActive !== false).length;
        return (totalStock > 0 ? totalStock : products.length) + activeSmmCount + activeSandroCount + activeCssxCount;
      }
      const matching = products.filter((p) => {
        const conf = getProviderConfig(p.name, p.type);
        return (
          conf.category === categoryId ||
          p.type.toLowerCase().includes(categoryId) ||
          p.name.toLowerCase().includes(categoryId)
        );
      });
      const matchingSmm = smmServicesList.filter((s: any) => {
        if (s.isActive === false) return false;
        const cat = (s.category || "").toLowerCase();
        const name = (s.name || "").toLowerCase();
        return cat.includes(categoryId) || name.includes(categoryId);
      });
      const matchingSandro = sandromaniaProductsList.filter((s: any) => {
        if (s.isActive === false) return false;
        const title = cleanSandromaniaText(s.title || "").toLowerCase();
        const cat = cleanSandromaniaText(s.category || "").toLowerCase();
        const targetCat = categoryId.toLowerCase();
        return cat === targetCat || cat.includes(targetCat) || title.includes(targetCat);
      });
      const matchingCssx = cssxProductsList.filter((s: any) => {
        if (s.isActive === false) return false;
        const title = (s.title || "").toLowerCase();
        const cat = (s.category || "").toLowerCase();
        const targetCat = categoryId.toLowerCase();
        return cat === targetCat || cat.includes(targetCat) || title.includes(targetCat);
      });
      const totalStock = matching.reduce((acc, p) => acc + (p.stockCount || 0), 0);
      const sandroStock = matchingSandro.reduce((acc, s) => acc + (s.stock || s.stockCount || 1), 0);
      const cssxStock = matchingCssx.reduce((acc, s) => acc + (s.stock || s.stockCount || 1), 0);
      return (totalStock > 0 ? totalStock : matching.length) + matchingSmm.length + sandroStock + cssxStock;
    };
  }, [products, smmServicesList, sandromaniaProductsList, cssxProductsList]);

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

  // Filtered SMM Services (Facebook, TikTok, Instagram, Telegram, etc.)
  const filteredSmmServices = useMemo(() => {
    return smmServicesList.filter((s: any) => {
      if (s.isActive === false) return false;
      const cat = (s.category || "").toLowerCase();
      const name = (s.name || "").toLowerCase();

      const isSocialCategory = ["facebook", "tiktok", "instagram", "telegram"].includes(selectedCategory);
      const matchesCategory =
        selectedCategory === "all" ||
        (isSocialCategory && (cat.includes(selectedCategory) || name.includes(selectedCategory)));

      const matchesSearch =
        !searchQuery.trim() ||
        name.includes(searchQuery.toLowerCase()) ||
        cat.includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [smmServicesList, selectedCategory, searchQuery]);

  // Filtered Sandromania Partner Products
  const filteredSandromaniaProducts = useMemo(() => {
    return sandromaniaProductsList.filter((p: any) => {
      if (p.isActive === false) return false;
      // In Telegram mode, only show if showOnTelegram toggle is turned ON
      if (isTelegram && !p.showOnTelegram) return false;
      const title = cleanSandromaniaText(p.title || "").toLowerCase();
      const cat = cleanSandromaniaText(p.category || "").toLowerCase();
      const targetCat = selectedCategory.toLowerCase();

      const matchesCategory =
        targetCat === "all" ||
        cat === targetCat ||
        cat.includes(targetCat) ||
        title.includes(targetCat);

      const matchesSearch =
        !searchQuery.trim() ||
        title.includes(searchQuery.toLowerCase()) ||
        cat.includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [sandromaniaProductsList, selectedCategory, searchQuery, isTelegram]);

  // Filtered CSxStore Partner Products
  const filteredCssxProducts = useMemo(() => {
    return cssxProductsList.filter((p: any) => {
      if (p.isActive === false) return false;
      // In Telegram mode, only show if showOnTelegram toggle is turned ON
      if (isTelegram && !p.showOnTelegram) return false;
      const title = (p.title || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      const targetCat = selectedCategory.toLowerCase();

      const matchesCategory =
        targetCat === "all" ||
        cat === targetCat ||
        cat.includes(targetCat) ||
        title.includes(targetCat);

      const matchesSearch =
        !searchQuery.trim() ||
        title.includes(searchQuery.toLowerCase()) ||
        cat.includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [cssxProductsList, selectedCategory, searchQuery, isTelegram]);

  // Unified Catalog Items with In-Stock prioritized at the TOP and Out-of-Stock sorted to the BOTTOM
  const unifiedCatalogItems = useMemo(() => {
    const list: Array<{
      type: "smm" | "sandromania" | "cssx" | "product";
      data: any;
      isOutOfStock: boolean;
      orderScore: number;
    }> = [];

    // 1. SMM Services (Always active/in stock)
    filteredSmmServices.forEach((smm: any) => {
      const isOutOfStock = smm.isActive === false;
      list.push({
        type: "smm",
        data: smm,
        isOutOfStock,
        orderScore: isOutOfStock ? 1 : 0,
      });
    });

    // 2. Sandromania Partner Products
    filteredSandromaniaProducts.forEach((sandProd: any) => {
      const isOutOfStock = sandProd.isActive === false;
      list.push({
        type: "sandromania",
        data: sandProd,
        isOutOfStock,
        orderScore: isOutOfStock ? 1 : 0,
      });
    });

    // 3. CSxStore Partner Products
    filteredCssxProducts.forEach((cssxProd: any) => {
      const isOutOfStock = cssxProd.isActive === false || (cssxProd.stock !== undefined && cssxProd.stock <= 0 && cssxProd.available === false);
      list.push({
        type: "cssx",
        data: cssxProd,
        isOutOfStock,
        orderScore: isOutOfStock ? 1 : 0,
      });
    });

    // 4. Direct Cloud & Account Products (In stock if stockCount > 0 and isActive !== false)
    filteredProducts.forEach((prod: any) => {
      const availableStock = typeof prod.stockCount === "number" ? prod.stockCount : 0;
      const isOutOfStock = prod.isActive === false || availableStock <= 0;
      list.push({
        type: "product",
        data: prod,
        isOutOfStock,
        orderScore: isOutOfStock ? 1 : 0,
      });
    });

    // Sort: In-Stock items FIRST (orderScore: 0), Out-of-Stock items LAST (orderScore: 1)
    list.sort((a, b) => a.orderScore - b.orderScore);

    return list;
  }, [filteredSmmServices, filteredSandromaniaProducts, filteredCssxProducts, filteredProducts]);

  // Format Sandromania price helper
  const formatSandromaniaPrice = (sandProdOrPriceCents: any, qty: number = 1) => {
    if (typeof sandProdOrPriceCents === "object" && sandProdOrPriceCents !== null) {
      const prod = sandProdOrPriceCents;
      if (isTelegram) {
        const unitUsdCents = (prod.telegramPriceUsd && prod.telegramPriceUsd > 0) ? prod.telegramPriceUsd : (prod.sellingPriceUsd || 0);
        return `$${((unitUsdCents * qty) / 100).toFixed(2)}`;
      }
      if (selectedCurrency === "LKR" && prod.sellingPriceLkr && prod.sellingPriceLkr > 0) {
        return `Rs. ${(prod.sellingPriceLkr * qty).toLocaleString()}`;
      }
      const totalCents = (prod.sellingPriceUsd || 0) * qty;
      const usd = totalCents / 100;
      if (selectedCurrency === "LKR") {
        const lkr = Math.round(usd * lkrRate);
        return `Rs. ${lkr.toLocaleString()}`;
      }
      return `$${usd.toFixed(2)}`;
    }
    const priceCents = typeof sandProdOrPriceCents === "number" ? sandProdOrPriceCents : 0;
    const totalCents = priceCents * qty;
    const usd = totalCents / 100;
    if (isTelegram) {
      return `$${usd.toFixed(2)}`;
    }
    if (selectedCurrency === "LKR") {
      const lkr = Math.round(usd * lkrRate);
      return `Rs. ${lkr.toLocaleString()}`;
    }
    return `$${usd.toFixed(2)}`;
  };

  // Format CSxStore price helper
  const formatCssxPrice = (cssxProdOrPriceCents: any, qty: number = 1) => {
    if (typeof cssxProdOrPriceCents === "object" && cssxProdOrPriceCents !== null) {
      const prod = cssxProdOrPriceCents;
      if (isTelegram) {
        const unitUsdCents = (prod.telegramPriceUsd && prod.telegramPriceUsd > 0) ? prod.telegramPriceUsd : (prod.sellingPriceUsd || 0);
        return `$${((unitUsdCents * qty) / 100).toFixed(2)}`;
      }
      if (selectedCurrency === "LKR" && prod.sellingPriceLkr && prod.sellingPriceLkr > 0) {
        return `Rs. ${(prod.sellingPriceLkr * qty).toLocaleString()}`;
      }
      const totalCents = (prod.sellingPriceUsd || 0) * qty;
      const usd = totalCents / 100;
      if (selectedCurrency === "LKR") {
        const lkr = Math.round(usd * lkrRate);
        return `Rs. ${lkr.toLocaleString()}`;
      }
      return `$${usd.toFixed(2)}`;
    }
    const priceCents = typeof cssxProdOrPriceCents === "number" ? cssxProdOrPriceCents : 0;
    const totalCents = priceCents * qty;
    const usd = totalCents / 100;
    if (isTelegram) {
      return `$${usd.toFixed(2)}`;
    }
    if (selectedCurrency === "LKR") {
      const lkr = Math.round(usd * lkrRate);
      return `Rs. ${lkr.toLocaleString()}`;
    }
    return `$${usd.toFixed(2)}`;
  };

  // Handle Sandromania Instant Auto-Delivery Purchase
  const handleSandromaniaPurchase = async () => {
    if (!detailSandromaniaProduct) return;

    if (!isCustomerLoggedIn) {
      toast({
        title: "Sign In Required",
        description: "Please sign in with Google or Email to complete your purchase.",
      });
      setDetailSandromaniaProduct(null);
      setActiveTab("profile");
      return;
    }

    const effUsdCents = (isTelegram && detailSandromaniaProduct.telegramPriceUsd && detailSandromaniaProduct.telegramPriceUsd > 0)
      ? detailSandromaniaProduct.telegramPriceUsd
      : (detailSandromaniaProduct.sellingPriceUsd || 0);

    const itemLkr = isTelegram
      ? Math.round((effUsdCents / 100) * lkrRate)
      : (detailSandromaniaProduct.sellingPriceLkr
        ? Number(detailSandromaniaProduct.sellingPriceLkr)
        : Math.round(((detailSandromaniaProduct.sellingPriceUsd || 0) / 100) * lkrRate));
    const totalLkr = itemLkr * sandromaniaOrderQty;
    const totalCents = effUsdCents * sandromaniaOrderQty;
    const totalPriceUsd = totalCents / 100;
    const userBalCents = user?.balance || 0;
    const userBalanceUsd = userBalCents / 100;
    const userBalLkr = (user as any)?.balanceLkr != null && (user as any).balanceLkr >= 0
      ? Number((user as any).balanceLkr)
      : Math.round((userBalCents / 100) * lkrRate);

    const hasEnough = selectedCurrency === "LKR"
      ? (userBalLkr >= totalLkr || userBalCents >= totalCents)
      : (userBalCents >= totalCents || userBalLkr >= totalLkr);

    if (!hasEnough) {
      const shortfallLkr = Math.max(0, totalLkr - userBalLkr);
      const shortfallUsd = Math.max(0, parseFloat((totalPriceUsd - userBalanceUsd).toFixed(2)));
      const cardSuggestedLkr = Math.max(50, Math.ceil(shortfallLkr / 50) * 50);

      if (selectedCurrency === "LKR") {
        setPayhereAmount(cardSuggestedLkr.toString());
        setBinanceAmount(shortfallLkr.toString());
        setCryptomusAmount(shortfallLkr.toString());
      } else {
        setPayhereAmount(Math.max(1, Math.ceil(shortfallUsd)).toString());
        setBinanceAmount(shortfallUsd.toString());
        setCryptomusAmount(shortfallUsd.toString());
      }

      setShortfallContext({
        productName: detailSandromaniaProduct.title || detailSandromaniaProduct.name,
        shortfallLkr,
        shortfallUsd,
        cardSuggestedLkr,
        neededLkr: totalLkr,
        neededUsd: totalPriceUsd,
      });

      const neededDisplay = selectedCurrency === "LKR" ? `Rs. ${shortfallLkr.toLocaleString()}` : `$${shortfallUsd.toFixed(2)} USD`;
      toast({
        title: "⚡ Insufficient Balance - Auto Top-up Ready",
        description: `Shortfall of ${neededDisplay} pre-filled. Card: Rs. ${cardSuggestedLkr} • Binance/Crypto: Rs. ${shortfallLkr}`,
      });

      setDetailSandromaniaProduct(null);
      setActiveTab("wallet");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSandromaniaPurchasing(true);
    setPaymentModal({
      isOpen: true,
      title: "Generating Credentials...",
      subtitle: "Preparing your digital license keys...",
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 2400));
      const res = await miniApiRequest("POST", "/api/mini/sandromania/purchase", {
        productId: detailSandromaniaProduct.id,
        quantity: sandromaniaOrderQty,
        currency: isTelegram ? "USD" : selectedCurrency,
        platform: isTelegram ? "telegram" : "web",
      });
      await res.json();
      recordPurchasedDelta(`sandromania_${detailSandromaniaProduct.id}`, sandromaniaOrderQty);
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
      toast({
        title: "🎉 Purchase Successful!",
        description: "Your digital license keys and credentials have been delivered.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/sandromania/orders"] });
      refetchUser();
      refetchSandromaniaOrders();
      setDetailSandromaniaProduct(null);
      setActiveTab("orders");
    } catch (err: any) {
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
      toast({
        title: "Order Failed",
        description: err.message || "Failed to process partner purchase.",
        variant: "destructive",
      });
    } finally {
      setIsSandromaniaPurchasing(false);
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Handle CSxStore Instant Auto-Delivery Purchase
  const handleCssxPurchase = async () => {
    if (!detailCssxProduct) return;

    if (!isCustomerLoggedIn) {
      toast({
        title: "Sign In Required",
        description: "Please sign in with Google or Email to complete your purchase.",
      });
      setDetailCssxProduct(null);
      setActiveTab("profile");
      return;
    }

    const effUsdCents = (isTelegram && detailCssxProduct.telegramPriceUsd && detailCssxProduct.telegramPriceUsd > 0)
      ? detailCssxProduct.telegramPriceUsd
      : (detailCssxProduct.sellingPriceUsd || 0);

    const itemLkr = isTelegram
      ? Math.round((effUsdCents / 100) * lkrRate)
      : (detailCssxProduct.sellingPriceLkr
        ? Number(detailCssxProduct.sellingPriceLkr)
        : Math.round(((detailCssxProduct.sellingPriceUsd || 0) / 100) * lkrRate));
    const totalLkr = itemLkr * cssxOrderQty;
    const totalCents = effUsdCents * cssxOrderQty;
    const totalPriceUsd = totalCents / 100;
    const userBalCents = user?.balance || 0;
    const userBalanceUsd = userBalCents / 100;
    const userBalLkr = (user as any)?.balanceLkr != null && (user as any).balanceLkr >= 0
      ? Number((user as any).balanceLkr)
      : Math.round((userBalCents / 100) * lkrRate);

    const hasEnough = selectedCurrency === "LKR"
      ? (userBalLkr >= totalLkr || userBalCents >= totalCents)
      : (userBalCents >= totalCents || userBalLkr >= totalLkr);

    if (!hasEnough) {
      const shortfallLkr = Math.max(0, totalLkr - userBalLkr);
      const shortfallUsd = Math.max(0, parseFloat((totalPriceUsd - userBalanceUsd).toFixed(2)));
      const cardSuggestedLkr = Math.max(50, Math.ceil(shortfallLkr / 50) * 50);

      if (selectedCurrency === "LKR") {
        setPayhereAmount(cardSuggestedLkr.toString());
        setBinanceAmount(shortfallLkr.toString());
        setCryptomusAmount(shortfallLkr.toString());
      } else {
        setPayhereAmount(Math.max(1, Math.ceil(shortfallUsd)).toString());
        setBinanceAmount(shortfallUsd.toString());
        setCryptomusAmount(shortfallUsd.toString());
      }

      setShortfallContext({
        productName: detailCssxProduct.title,
        shortfallLkr,
        shortfallUsd,
        cardSuggestedLkr,
        neededLkr: totalLkr,
        neededUsd: totalPriceUsd,
      });

      const neededDisplay = selectedCurrency === "LKR" ? `Rs. ${shortfallLkr.toLocaleString()}` : `$${shortfallUsd.toFixed(2)} USD`;
      toast({
        title: "⚡ Insufficient Balance - Auto Top-up Ready",
        description: `Shortfall of ${neededDisplay} pre-filled. Card: Rs. ${cardSuggestedLkr} • Binance/Crypto: Rs. ${shortfallLkr}`,
      });

      setDetailCssxProduct(null);
      setActiveTab("wallet");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsCssxPurchasing(true);
    setPaymentModal({
      isOpen: true,
      title: "Generating Credentials...",
      subtitle: "Preparing your digital license keys...",
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 2400));
      const res = await miniApiRequest("POST", "/api/mini/cssx/purchase", {
        productId: detailCssxProduct.id,
        quantity: cssxOrderQty,
        currency: isTelegram ? "USD" : selectedCurrency,
        platform: isTelegram ? "telegram" : "web",
      });
      await res.json();
      recordPurchasedDelta(`cssx_${detailCssxProduct.id}`, cssxOrderQty);
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
      toast({
        title: "🎉 Purchase Successful!",
        description: "Your digital license keys and credentials have been delivered.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/cssx/orders"] });
      refetchUser();
      refetchCssxOrders();
      setDetailCssxProduct(null);
      setActiveTab("orders");
    } catch (err: any) {
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
      toast({
        title: "Order Failed",
        description: err.message || "Failed to process digital license purchase.",
        variant: "destructive",
      });
    } finally {
      setIsCssxPurchasing(false);
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Coupon Code Handlers
  const handleApplyCoupon = async () => {
    if (!detailProduct || !couponCodeInput.trim()) return;
    setIsValidatingCoupon(true);
    try {
      const totalPriceCents = detailProduct.price * quantity;
      const res = await miniApiRequest("POST", "/api/mini/validate-coupon", {
        code: couponCodeInput.trim(),
        amountCents: totalPriceCents,
        productId: detailProduct.id,
        productName: detailProduct.name
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || data.error || "Invalid coupon code");
      }
      setAppliedCoupon(data);
      toast({
        title: "🎉 Coupon Applied!",
        description: `You saved $${data.discountUsd} with coupon ${data.code}!`,
      });
    } catch (err: any) {
      setAppliedCoupon(null);
      toast({
        title: "Coupon Error",
        description: err.message || "Invalid or expired coupon code",
        variant: "destructive",
      });
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput("");
  };

  // Handle Quick Purchase (Enforce authentication)
  const handlePurchase = async () => {
    if (!detailProduct) return;

    // Strict Login Requirement Check
    if (!isCustomerLoggedIn) {
      toast({
        title: "Sign In Required",
        description: "Please sign in with Google or Email to complete your purchase.",
      });
      setDetailProduct(null);
      setActiveTab("profile");
      return;
    }

    // Strict Stock Limit Check
    const liveStockCount = typeof detailProduct.stockCount === 'number' 
      ? detailProduct.stockCount 
      : (products.find(p => p.id === detailProduct.id)?.stockCount ?? 0);

    if (liveStockCount <= 0) {
      toast({
        title: "Out of Stock",
        description: "This item is currently out of stock. Please check back later.",
        variant: "destructive"
      });
      return;
    }

    if (quantity > liveStockCount) {
      toast({
        title: "Stock Limit Exceeded",
        description: `Only ${liveStockCount} ${liveStockCount === 1 ? 'unit is' : 'units are'} currently available in stock.`,
        variant: "destructive"
      });
      setQuantity(Math.max(1, liveStockCount));
      return;
    }

    const userBalanceCents = user?.balance || 0;
    const userBalanceUsd = userBalanceCents / 100;
    const originalPriceCents = detailProduct.price * quantity;
    const finalPriceCents = appliedCoupon 
      ? appliedCoupon.finalPriceCents 
      : originalPriceCents;
    const finalPriceUsd = finalPriceCents / 100;

    let neededLkr = 0;
    if ((detailProduct as any).priceLkr && (detailProduct as any).priceLkr > 0) {
      const prodLkrTotal = (detailProduct as any).priceLkr * quantity;
      const discountLkr = appliedCoupon?.discountLkr || 0;
      neededLkr = Math.max(0, prodLkrTotal - discountLkr);
    } else {
      neededLkr = Math.round((finalPriceCents / 100) * lkrRate);
    }
    const userBalanceLkr = (user as any)?.balanceLkr != null && (user as any).balanceLkr >= 0
      ? Number((user as any).balanceLkr)
      : Math.floor((userBalanceCents / 100) * lkrRate);

    const hasEnough = selectedCurrency === "LKR"
      ? (userBalanceLkr >= neededLkr || userBalanceCents >= finalPriceCents)
      : (userBalanceCents >= finalPriceCents || userBalanceLkr >= neededLkr);

    if (!hasEnough) {
      // 1. Calculate shortfall in USD
      const shortfallCents = Math.max(0, finalPriceCents - userBalanceCents);
      const shortfallUsd = parseFloat((shortfallCents / 100).toFixed(2));
      const shortfallLkr = Math.max(0, neededLkr - userBalanceLkr);
      const cardSuggestedLkr = Math.max(50, Math.ceil(shortfallLkr / 50) * 50);
      const cardSuggestedUsd = Math.max(1, Math.ceil(shortfallUsd));

      if (selectedCurrency === "LKR") {
        setPayhereAmount(cardSuggestedLkr.toString());
        setBinanceAmount(shortfallLkr.toString());
        setCryptomusAmount(shortfallLkr.toString());
      } else {
        setPayhereAmount(cardSuggestedUsd.toString());
        setBinanceAmount(shortfallUsd.toString());
        setCryptomusAmount(shortfallUsd.toString());
      }

      setShortfallContext({
        productName: detailProduct.name,
        shortfallLkr,
        shortfallUsd,
        cardSuggestedLkr,
        neededLkr,
        neededUsd: finalPriceUsd,
      });

      const neededDisplay = selectedCurrency === "LKR" ? `Rs. ${shortfallLkr.toLocaleString()}` : `$${shortfallUsd.toFixed(2)} USD`;
      toast({
        title: "⚡ Insufficient Balance - Auto Top-up Ready",
        description: `Shortfall of ${neededDisplay} pre-filled. Card: Rs. ${cardSuggestedLkr} • Binance/Crypto: Rs. ${shortfallLkr}`,
      });

      setDetailProduct(null);
      setActiveTab("wallet");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsPurchasing(true);
    setPaymentModal({
      isOpen: true,
      title: "Generating Credentials...",
      subtitle: appliedCoupon 
        ? `Applying coupon ${appliedCoupon.code} & preparing access...` 
        : "Preparing your secure credentials...",
    });

    try {
      // 2.4s animation delay for smooth premium checkout experience
      await new Promise((resolve) => setTimeout(resolve, 2400));

      const res = await miniApiRequest("POST", "/api/mini/purchase", {
        productId: detailProduct.id,
        quantity,
        couponCode: appliedCoupon?.code || undefined,
        currency: selectedCurrency,
      });
      const data = await res.json();
      recordPurchasedDelta(`product_${detailProduct.id}`, quantity);
      
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
      
      toast({
        title: "🎉 Purchase Successful!",
        description: "Your cloud credentials are ready in your Orders tab.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/orders"] });
      setDetailProduct(null);
      setAppliedCoupon(null);
      setCouponCodeInput("");
      setActiveTab("orders");
    } catch (err: any) {
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
      toast({
        title: "Order Notice",
        description: err.message || "Please complete purchase via the Telegram Bot.",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Handle Dynamic SMM Service Purchase
  const handleSmmPurchase = async () => {
    if (!detailSmmService) return;

    if (!isCustomerLoggedIn) {
      toast({
        title: "Sign In Required",
        description: "Please sign in with Google or Email to place SMM orders.",
      });
      setDetailSmmService(null);
      setActiveTab("profile");
      return;
    }

    if (!smmTargetLink.trim()) {
      toast({
        title: "Link Required",
        description: "Please enter your target profile or post URL.",
        variant: "destructive",
      });
      return;
    }

    if (smmOrderQty < detailSmmService.min || smmOrderQty > detailSmmService.max) {
      toast({
        title: "Invalid Quantity",
        description: `Quantity must be between ${detailSmmService.min.toLocaleString()} and ${detailSmmService.max.toLocaleString()}.`,
        variant: "destructive",
      });
      return;
    }

    const totalCents = Math.round((detailSmmService.customRate / 1000) * smmOrderQty);
    const totalPriceUsd = totalCents / 100;
    const totalLkr = Math.round((totalCents / 100) * lkrRate);
    const userBalanceCents = user?.balance || 0;
    const userBalanceUsd = userBalanceCents / 100;
    const userBalanceLkr = (user as any)?.balanceLkr != null && (user as any).balanceLkr >= 0
      ? Number((user as any).balanceLkr)
      : Math.round((userBalanceCents / 100) * lkrRate);

    const hasEnough = selectedCurrency === "LKR"
      ? (userBalanceLkr >= totalLkr || userBalanceCents >= totalCents)
      : (userBalanceCents >= totalCents || userBalanceLkr >= totalLkr);

    if (!hasEnough) {
      const shortfallLkr = Math.max(0, totalLkr - userBalanceLkr);
      const shortfallUsd = Math.max(0, parseFloat((totalPriceUsd - userBalanceUsd).toFixed(2)));
      const cardSuggestedLkr = Math.max(50, Math.ceil(shortfallLkr / 50) * 50);

      if (selectedCurrency === "LKR") {
        setPayhereAmount(cardSuggestedLkr.toString());
        setBinanceAmount(shortfallLkr.toString());
        setCryptomusAmount(shortfallLkr.toString());
      } else {
        setPayhereAmount(Math.max(1, Math.ceil(shortfallUsd)).toString());
        setBinanceAmount(shortfallUsd.toString());
        setCryptomusAmount(shortfallUsd.toString());
      }

      setShortfallContext({
        productName: detailSmmService.name,
        shortfallLkr,
        shortfallUsd,
        cardSuggestedLkr,
        neededLkr: Math.round(totalPriceUsd * lkrRate),
        neededUsd: totalPriceUsd,
      });

      const neededDisplay = selectedCurrency === "LKR" ? `Rs. ${shortfallLkr.toLocaleString()}` : `$${shortfallUsd} USD`;
      toast({
        title: "⚡ Insufficient Balance - Auto Top-up Ready",
        description: `Shortfall of ${neededDisplay} pre-filled. Card: Rs. ${cardSuggestedLkr} • Binance/Crypto: Rs. ${shortfallLkr}`,
      });

      setDetailSmmService(null);
      setActiveTab("wallet");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSmmPurchasing(true);
    setPaymentModal({
      isOpen: true,
      title: "Placing Boost Order...",
      subtitle: "Dispatching order to automated high-speed servers...",
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 2400));
      const res = await miniApiRequest("POST", "/api/mini/smm/purchase", {
        smmServiceId: detailSmmService.id,
        link: smmTargetLink.trim(),
        quantity: smmOrderQty,
      });
      await res.json();
      recordPurchasedDelta(`smm_${detailSmmService.id}`, 1);
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
      toast({
        title: "🎉 Boost Order Placed!",
        description: `Your ${detailSmmService.name} order is now being processed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mini/smm/orders"] });
      refetchUser();
      refetchSmmOrders();
      setDetailSmmService(null);
      setSmmTargetLink("");
      setActiveTab("orders");
    } catch (err: any) {
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
      toast({
        title: "Order Notice",
        description: err.message || "Failed to submit order.",
        variant: "destructive",
      });
    } finally {
      setIsSmmPurchasing(false);
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));
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

  // Universal Smart Credential & Delivery Data Engine (Works for ANY product, format, or delimiter)
  interface ParsedField {
    label: string;
    value: string;
    isSecret?: boolean;
    isUrl?: boolean;
  }

  interface ParsedAccountEntry {
    index: number;
    type: "account" | "license" | "url" | "server" | "custom";
    raw: string;
    fields: ParsedField[];
  }

  const parseUniversalCredentials = (raw: string, title?: string): ParsedAccountEntry[] => {
    if (!raw) return [];
    const clean = raw.trim();

    // 1. JSON Array or Object check
    if ((clean.startsWith("{") && clean.endsWith("}")) || (clean.startsWith("[") && clean.endsWith("]"))) {
      try {
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) {
          return parsed.flatMap((item, idx) => {
            if (typeof item === "string") return [parseSingleCredentialLine(item, idx + 1)];
            if (typeof item === "object" && item !== null) return [parseObjectCredential(item, idx + 1)];
            return [];
          });
        } else if (typeof parsed === "object" && parsed !== null) {
          return [parseObjectCredential(parsed, 1)];
        }
      } catch {}
    }

    // 2. Multiline split
    const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      return lines.map((line, idx) => parseSingleCredentialLine(line, idx + 1));
    }

    return [];
  };

  const parseSingleCredentialLine = (line: string, index: number): ParsedAccountEntry => {
    const trimmed = line.trim();

    // Case A: Pure URL / Activation Link
    if (/^https?:\/\//i.test(trimmed)) {
      return {
        index,
        type: "url",
        raw: trimmed,
        fields: [{ label: "Access / Invite Link", value: trimmed, isUrl: true }]
      };
    }

    // Case B: Pipe-delimited (e.g. user|pass, user|pass|token, user|pass|cookie|guid)
    if (trimmed.includes("|")) {
      const parts = trimmed.split("|").map(p => p.trim());
      const fields: ParsedField[] = [];

      const uLabel = parts[0]?.includes("@") ? "Email / Username" : "Username";
      fields.push({ label: uLabel, value: parts[0] || "" });

      if (parts.length > 1) {
        fields.push({ label: "Password", value: parts[1] || "", isSecret: true });
      }

      if (parts.length > 2) {
        const p2 = parts[2];
        const isOtp = /^[A-Z0-9]{16,32}$/i.test(p2) || /^\d{6}$/.test(p2);
        fields.push({
          label: isOtp ? "2FA / Secret Key" : "Extra / Auth Token",
          value: p2
        });
      }

      if (parts.length > 3) {
        parts.slice(3).forEach((extraPart, eIdx) => {
          fields.push({
            label: parts.length === 4 ? "Security / GUID" : `Extra Part ${eIdx + 1}`,
            value: extraPart
          });
        });
      }

      return {
        index,
        type: "account",
        raw: trimmed,
        fields
      };
    }

    // Case C: Colon-delimited without protocol (e.g. user:pass or host:port:user:pass)
    if (trimmed.includes(":") && !trimmed.startsWith("http")) {
      const parts = trimmed.split(":").map(p => p.trim());
      if (parts.length === 4 && /^\d+$/.test(parts[1])) {
        return {
          index,
          type: "server",
          raw: trimmed,
          fields: [
            { label: "Host / IP", value: parts[0] },
            { label: "Port", value: parts[1] },
            { label: "Username", value: parts[2] },
            { label: "Password", value: parts[3], isSecret: true }
          ]
        };
      }
      if (parts.length >= 2) {
        const uLabel = parts[0]?.includes("@") ? "Email / Username" : "Username";
        const fields: ParsedField[] = [
          { label: uLabel, value: parts[0] },
          { label: "Password", value: parts[1], isSecret: true }
        ];
        if (parts.length > 2) {
          fields.push({ label: "2FA / PIN / Code", value: parts.slice(2).join(":") });
        }
        return {
          index,
          type: "account",
          raw: trimmed,
          fields
        };
      }
    }

    // Case D: License Key / Activation CDK / Code
    const isKey = /^[A-Z0-9]{4,5}(-[A-Z0-9]{4,5}){3,7}$/i.test(trimmed) || trimmed.length > 15;
    return {
      index,
      type: isKey ? "license" : "custom",
      raw: trimmed,
      fields: [{ label: isKey ? "License Key / Activation CDK" : "Digital Credential", value: trimmed }]
    };
  };

  const parseObjectCredential = (obj: any, index: number): ParsedAccountEntry => {
    const fields: ParsedField[] = [];
    const username = obj.username || obj.email || obj.user || obj.login;
    const password = obj.password || obj.pass;
    const token = obj.token || obj.auth || obj.cookie || obj.session;
    const key = obj.key || obj.license || obj.cdk || obj.code;
    const url = obj.url || obj.link || obj.invite;

    if (username) fields.push({ label: String(username).includes("@") ? "Email / Username" : "Username", value: String(username) });
    if (password) fields.push({ label: "Password", value: String(password), isSecret: true });
    if (token) fields.push({ label: "Auth Token / Cookie", value: typeof token === "object" ? JSON.stringify(token) : String(token) });
    if (key) fields.push({ label: "Activation Key / CDK", value: String(key) });
    if (url) fields.push({ label: "Access / Invite Link", value: String(url), isUrl: true });

    Object.keys(obj).forEach(k => {
      if (!["username", "email", "user", "login", "password", "pass", "token", "auth", "cookie", "session", "key", "license", "cdk", "code", "url", "link", "invite"].includes(k.toLowerCase())) {
        fields.push({ label: k.charAt(0).toUpperCase() + k.slice(1), value: typeof obj[k] === "object" ? JSON.stringify(obj[k]) : String(obj[k]) });
      }
    });

    return {
      index,
      type: username && password ? "account" : (key ? "license" : (url ? "url" : "custom")),
      raw: typeof obj === "string" ? obj : JSON.stringify(obj),
      fields
    };
  };

  const formatDeliveredCredentialsForCopy = (raw: string, qty: number = 1, title: string = "") => {
    if (!raw) return "";
    const clean = raw.trim();
    const accounts = parseUniversalCredentials(clean, title);
    if (accounts.length === 0) return clean;

    const hasStructured = accounts.some(a => a.fields.length > 1 || a.fields[0]?.isUrl);
    if (!hasStructured) {
      if (accounts.length > 1) {
        return accounts.map(a => `item ${String(a.index).padStart(2, "0")} - ${a.raw}`).join("\n\n");
      }
      return clean;
    }

    if (accounts.length === 1) {
      return accounts[0].fields.map(f => `${f.label}: ${f.value}`).join("\n");
    }

    return accounts.map(acc => {
      const num = String(acc.index).padStart(2, "0");
      const lines = acc.fields.map(f => `${f.label}: ${f.value}`).join("\n");
      return `[Account / Item ${num}]\n${lines}`;
    }).join("\n\n");
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
    toast({ title, description: `Copied to clipboard.`, duration: 2000 });
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
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as any).style.display = "none";
                  }}
                />
              ) : isCustomerLoggedIn ? (
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
            {/* Real Brand Icons Category Badges with Corner Angle Labels & No Top Clipping */}
            <div
              ref={catScrollRef}
              onMouseDown={handleCatMouseDown}
              onMouseMove={handleCatMouseMove}
              onMouseUp={handleCatMouseUp}
              onMouseLeave={handleCatMouseUp}
              className="flex items-center gap-3 overflow-x-auto pt-3 pb-3 mb-6 scrollbar-none overscroll-x-contain touch-pan-x cursor-grab active:cursor-grabbing -mx-5 px-5"
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
                const badgeStyle = BADGE_COLOR_STYLES[cat.badgeColor || "red"] || BADGE_COLOR_STYLES.red;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (!catMoved) {
                        setSelectedCategory(cat.id);
                      }
                    }}
                    className={`relative flex flex-col items-center justify-center min-w-[80px] h-[86px] px-3 rounded-2xl transition-all duration-200 shrink-0 ${
                      isActive
                        ? "bg-gradient-to-b from-[#FF5E62] to-[#6C5CE7] text-white shadow-lg shadow-[#6C5CE7]/30 scale-105 z-10"
                        : "bg-white text-[#4A4568] shadow-sm border border-[#ECEEF8] hover:bg-[#F5F4FC]"
                    }`}
                  >
                    {/* Top-Left Corner Angle Badge */}
                    {cat.badgeEnabled && cat.badgeText && (
                      <span
                        className={`absolute -top-1.5 -left-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shadow-md leading-none z-20 border border-white/60 ${badgeStyle}`}
                      >
                        {cat.badgeText}
                      </span>
                    )}

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
                      {renderCategoryBrandIcon(cat.iconType, cat.customIconUrl)}
                    </div>
                    <span className={`text-[11px] font-bold tracking-tight whitespace-nowrap text-center ${isActive ? "text-white" : "text-[#4A4568]"}`}>
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Auto-Swapping & Touch-Swiping Feature Hero Carousel */}
            {activeHeroSlides.length > 0 && (
              <div 
                className="relative group overflow-hidden rounded-3xl mb-7 h-[175px] sm:h-[195px] shadow-sm transition-all duration-500 select-none cursor-grab active:cursor-grabbing border border-[#ECEEF8]"
                onMouseEnter={() => setIsHeroPaused(true)}
                onMouseLeave={() => {
                  setIsHeroPaused(false);
                  heroDragStartX.current = null;
                }}
                onTouchStart={handleHeroTouchStart}
                onTouchEnd={handleHeroTouchEnd}
                onMouseDown={handleHeroMouseDown}
                onMouseUp={handleHeroMouseUp}
              >
                {activeHeroSlides.map((slide: any, idx: number) => {
                  const isActive = idx === currentHeroSlide;
                  const slideImage = slide.image || slide.imageSrc || "https://img.icons8.com/color/144/capcut.png";
                  const slideBg = slide.bgGradient || slide.gradientBg || "from-[#F0FDF4] via-[#E0F2FE] to-[#F3E8FF]";
                  const slideBtnBg = slide.btnGradient || "from-[#FF5E62] to-[#6C5CE7]";
                  const featuresList: string[] = Array.isArray(slide.features) ? slide.features : [];

                  const handleSlideClick = () => {
                    if (slide.actionType === "product" && slide.actionTarget) {
                      const foundProd = products.find((p) => p.id.toString() === slide.actionTarget.toString() || p.name.toLowerCase() === slide.actionTarget.toLowerCase());
                      if (foundProd) {
                        setDetailProduct(foundProd);
                        setQuantity(1);
                        return;
                      }
                    }

                    const targetCat = (slide.actionTarget || slide.categoryTarget || slide.title || "").trim();
                    if (targetCat && targetCat !== "ALL") {
                      setHeroSearchFocusKeyword(targetCat);
                      const matched = categories.find((c) => 
                        c.id.toLowerCase() === targetCat.toLowerCase() || 
                        targetCat.toLowerCase().includes(c.id.toLowerCase()) ||
                        c.label.toLowerCase().includes(targetCat.toLowerCase())
                      );
                      if (matched) {
                        setSelectedCategory(matched.id);
                      }
                    }

                    // Smoothly scroll to Best Sellers & Hot Deals section without notification
                    const el = document.getElementById("best-sellers-heading");
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  };

                  // Full Photo Banner Mode
                  if (slide.bannerType === "full_image") {
                    return (
                      <div
                        key={slide.id || idx}
                        onClick={handleSlideClick}
                        className={`absolute inset-0 w-full h-full transition-all duration-700 overflow-hidden cursor-pointer ${
                          isActive ? "opacity-100 pointer-events-auto scale-100 z-10" : "opacity-0 pointer-events-none scale-95 z-0"
                        }`}
                      >
                        <img
                          src={slideImage}
                          alt={slide.title || "Promo Banner"}
                          className="w-full h-full object-cover rounded-3xl"
                          onError={(e) => {
                            (e.target as any).style.display = "none";
                          }}
                        />
                      </div>
                    );
                  }

                  // Interactive 3D Card Mode
                  return (
                    <div
                      key={slide.id || idx}
                      onClick={handleSlideClick}
                      className={`absolute inset-0 w-full h-full p-5 rounded-3xl transition-all duration-700 flex flex-col justify-between cursor-pointer ${
                        isActive ? "opacity-100 pointer-events-auto scale-100 z-10" : "opacity-0 pointer-events-none scale-95 z-0"
                      } bg-gradient-to-r ${slideBg}`}
                    >
                      <div className="relative z-10 max-w-[62%]">
                        <h2 className="text-[17px] font-black text-[#181432] leading-tight mb-0.5">
                          {slide.title}
                        </h2>
                        <div className="text-[12px] font-black text-[#5B42F3] mb-2">
                          {slide.subtitle}
                        </div>

                        {/* Genuine Pro Features Bullet List */}
                        {featuresList.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {featuresList.slice(0, 2).map((feat, fIdx) => (
                              <div key={fIdx} className="flex items-center gap-1.5 text-[10px] font-bold text-[#3D3656]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="line-clamp-1">{feat}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r ${slideBtnBg} text-white rounded-full text-xs font-black shadow-md shadow-[#5B42F3]/20 hover:opacity-95 transition-all active:scale-95`}
                          >
                            {slide.ctaText || "Buy Now"} <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>

                      {/* High-res Transparent Product Visual */}
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-36 h-36 opacity-95 pointer-events-none flex items-center justify-center">
                        <div className={`w-28 h-28 rounded-full ${slide.glowColor || "bg-purple-400/20"} blur-xl absolute`} />
                        <img
                          src={slideImage}
                          alt={slide.title || "Banner"}
                          className="w-28 h-28 object-contain drop-shadow-xl transform hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as any).style.display = "none";
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Common Carousel Navigation Indicator Dots */}
                <div className="absolute bottom-3 right-4 flex items-center gap-1.5 z-30 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full pointer-events-auto">
                  {activeHeroSlides.map((_: any, dotIdx: number) => (
                    <button
                      key={dotIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentHeroSlide(dotIdx);
                      }}
                      className={`transition-all duration-300 rounded-full h-1.5 ${
                        dotIdx === currentHeroSlide ? "w-4 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                      }`}
                      aria-label={`Slide ${dotIdx + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Best Sellers & Trending Sub-Slider (Strictly Featured Items Only - No Fallback) */}
            {bestSellersData?.featured && bestSellersData.featured.length > 0 && (
              <div id="best-sellers-heading" className="mb-7 scroll-mt-4">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5E62] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF5E62]"></span>
                    </span>
                    <h3 className="text-base font-black text-[#181432] tracking-tight">Best Sellers & Hot Deals</h3>
                  </div>
                  <span className="text-[11px] font-black text-[#D92078] bg-pink-50 border border-pink-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <ShopBagIcon className="w-2.5 h-2.5 text-[#D92078]" /> Top Rated
                  </span>
                </div>

                <div
                  className="flex items-center gap-3.5 overflow-x-auto pt-2 pb-3.5 scrollbar-none overscroll-x-contain touch-pan-x -mx-5 px-5"
                  style={{
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  {(() => {
                    let featuredList = (bestSellersData?.featured && Array.isArray(bestSellersData.featured))
                      ? bestSellersData.featured.map((f: any) => {
                          if (f.productType === "sandromania") {
                            const real = sandromaniaProductsList.find((s: any) => s.id === f.rawId || s.id === (f.id - 100000));
                            return real ? { ...real, ...f } : f;
                          }
                          if (f.productType === "cssx") {
                            const real = cssxProductsList.find((c: any) => c.id === f.rawId || c.id === (f.id - 200000));
                            return real ? { ...real, ...f } : f;
                          }
                          const real = products.find((p) => p.id === f.id);
                          return real ? { ...real, ...f } : f;
                        })
                      : [];

                    if (featuredList.length === 0) return null;

                    if (heroSearchFocusKeyword) {
                      const kw = heroSearchFocusKeyword.toLowerCase();
                      featuredList = [...featuredList].sort((a, b) => {
                        const aMatch = (a.name || a.title || "").toLowerCase().includes(kw) || (a.category || "").toLowerCase().includes(kw) || (a.type || "").toLowerCase().includes(kw);
                        const bMatch = (b.name || b.title || "").toLowerCase().includes(kw) || (b.category || "").toLowerCase().includes(kw) || (b.type || "").toLowerCase().includes(kw);
                        if (aMatch && !bMatch) return -1;
                        if (!aMatch && bMatch) return 1;
                        return 0;
                      });
                    }

                    return featuredList.map((p: any, idx: number) => {
                      const priceFormatted = p.productType === "sandromania"
                        ? formatSandromaniaPrice(p, 1)
                        : p.productType === "cssx"
                        ? formatCssxPrice(p, 1)
                        : formatProductPrice(p);
                      const stats = getItemStats(p, p.productType === "sandromania" || p.productType === "cssx" ? "sandromania" : "product");
                      const totalSold = stats.sold;
                      const badgeLabel = p.badge || (idx % 2 === 0 ? "BEST SELLER" : "HOT DEAL");
                      const badgeGradient = idx % 2 === 0
                        ? "bg-gradient-to-r from-[#FF5E62] to-[#D92078] text-white"
                        : "bg-gradient-to-r from-[#8A2387] via-[#E94057] to-[#F27121] text-white";

                      const isLightingActive = bestSellersData?.enableLightingBorder !== false;

                      return (
                        <div
                          key={`bestseller-${p.id}`}
                          onClick={() => {
                            if (p.productType === "sandromania") {
                              const realProd = sandromaniaProductsList.find((s: any) => s.id === p.rawId || s.id === (p.id - 100000)) || p;
                              setDetailSandromaniaProduct(realProd);
                              setSandromaniaOrderQty(1);
                              return;
                            }
                            if (p.productType === "cssx") {
                              const realProd = cssxProductsList.find((c: any) => c.id === p.rawId || c.id === (p.id - 200000)) || p;
                              setDetailCssxProduct(realProd);
                              setCssxOrderQty(1);
                              return;
                            }
                            const realProd = products.find((pr) => pr.id === p.id) || p;
                            setDetailProduct(realProd);
                            setQuantity(1);
                          }}
                          className={`relative min-w-[205px] w-[205px] h-[220px] rounded-3xl p-4 shadow-sm hover:shadow-xl flex flex-col justify-between shrink-0 cursor-pointer transition-all duration-300 hover:-translate-y-1 group overflow-hidden ${
                            isLightingActive ? "bg-transparent" : "bg-white border border-[#ECEEF8]"
                          }`}
                        >
                          {/* Animated Glowing RGB / Neon Lighting Border Ring */}
                          {isLightingActive && (
                            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
                              <div className="absolute inset-[-150%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,#FF007A_0deg,#7928CA_90deg,#0070F3_180deg,#00DFD8_270deg,#FF007A_360deg)] opacity-95" />
                              <div className="absolute inset-[1.5px] rounded-[22px] bg-white pointer-events-none" />
                            </div>
                          )}

                          {/* Top-Right 45° Corner Angle Ribbon */}
                          <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none overflow-hidden z-20">
                            <div
                              className={`absolute transform rotate-45 text-center text-[7px] font-black uppercase tracking-wider py-1 shadow-sm w-36 -right-10 top-3.5 leading-none ${badgeGradient}`}
                              style={{ letterSpacing: '0.04em' }}
                            >
                              {badgeLabel}
                            </div>
                          </div>

                          {/* Center Brand Icon & Title */}
                          <div className="flex flex-col items-center text-center mt-5 relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-[#F8F7FD] border border-[#ECEEF8] flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
                              <BrandIcon name={p.name || p.title} type={p.type || p.category} className="w-7 h-7" />
                            </div>
                            <h4 className="text-xs font-black text-[#181432] line-clamp-1 w-full tracking-tight px-1">
                              {p.name || p.title}
                            </h4>
                            <span className="text-[10px] font-bold text-[#7E7998] mt-1 inline-flex items-center gap-1">
                              <span>{totalSold.toLocaleString()} sold</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-[#181432] font-black flex items-center gap-0.5">
                                Verified <VerifiedBadgeIcon className="w-3.5 h-3.5" />
                              </span>
                            </span>
                          </div>

                          {/* Bottom Price & Action */}
                          <div className="flex items-center justify-between pt-2 border-t border-[#F5F4FC] relative z-10">
                            <span className="text-xs font-black text-[#181432]">{priceFormatted}</span>
                            <span className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7] text-white text-[10px] font-black shadow-xs group-hover:opacity-90 transition-opacity">
                              Buy Now
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Products Section Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-[#181432] tracking-tight">All Catalog Products</h3>
              <button
                onClick={() => setSelectedCategory("all")}
                className="text-xs font-bold text-[#5B42F3] hover:text-[#D92078] transition-colors"
              >
                View all
              </button>
            </div>

            {/* Products, Sandromania & SMM Services Grid */}
            {productsLoading ? (
              <div className="flex flex-col items-center justify-center py-10 col-span-2">
                <LottiePayment size={140} />
              </div>
            ) : unifiedCatalogItems.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-[#ECEEF8]">
                <ShopBagIcon className="w-12 h-12 mx-auto text-[#8FA597]/75 mb-2.5" />
                <h4 className="text-sm font-bold text-[#1C3324]">No products found</h4>
                <p className="text-xs text-[#6B8574] mt-1">Try another category or search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {unifiedCatalogItems.map((item) => {
                  if (item.type === "smm") {
                    const smm = item.data;
                    const isOutOfStock = item.isOutOfStock;
                    const smmConf = getSmmPlatformConfig(smm.category, smm.name);
                    const rateFormatted = formatSmmRate(smm.customRate);
                    const stats = getItemStats(smm, "smm");

                    return (
                      <motion.div
                        key={`smm-${smm.id}`}
                        whileHover={isOutOfStock ? {} : { y: -3 }}
                        whileTap={isOutOfStock ? {} : { scale: 0.98 }}
                        onClick={() => {
                          if (isOutOfStock) {
                            toast({ title: "Out of Stock", description: "This service is currently unavailable.", variant: "destructive" });
                            return;
                          }
                          setDetailSmmService(smm);
                          setSmmOrderQty(smm.min || 1000);
                          setSmmTargetLink("");
                        }}
                        className={`bg-white rounded-3xl p-3.5 shadow-sm border border-[#ECEEF8] flex flex-col justify-between transition-all relative group overflow-hidden ${
                          isOutOfStock ? "cursor-not-allowed select-none" : "cursor-pointer hover:shadow-md"
                        }`}
                      >
                        {/* Top-Right 45° Corner Angle Ribbon Banner */}
                        {(() => {
                          const badge = getProductBadge(smm, "smm");
                          if (!badge || !badge.text || isOutOfStock) return null;
                          return (
                            <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none overflow-hidden z-20">
                              <div
                                className={`absolute transform rotate-45 text-center text-[7px] font-black uppercase tracking-wider py-1 shadow-sm w-36 -right-10 top-3.5 leading-none ${badge.gradient}`}
                                style={{ letterSpacing: '0.04em' }}
                              >
                                {badge.text}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Top Action: Platform Tag */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${smmConf.bgBadge}`}>
                            {smmConf.tag}
                          </span>
                        </div>

                        {/* Centered Image with Real Brand Icon, Organic Blob Background & Centered Out of Stock Badge */}
                        <div className="relative my-2 py-3 flex items-center justify-center">
                          <div
                            className={`w-20 h-20 rounded-full bg-gradient-to-br ${smmConf.blobColor} absolute blur-sm`}
                          />
                          <div className="relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-300">
                            {smmConf.icon}
                          </div>

                          {isOutOfStock && (
                            <div className="absolute inset-x-0 bottom-0.5 z-20 flex items-center justify-center pointer-events-none">
                              <div className="bg-slate-700/85 backdrop-blur-md text-slate-100 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-500/30 shadow-md flex items-center gap-1.5 whitespace-nowrap">
                                <Ban className="w-3 h-3 text-slate-300 shrink-0" />
                                <span>FULLY OUT OF STOCK</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Service Details */}
                        <div className="mt-1">
                          <h4 className="text-xs font-extrabold text-[#181432] line-clamp-2 group-hover:text-[#5B42F3] transition-colors leading-tight">
                            {smm.name}
                          </h4>
                          <div className="flex items-center justify-between mt-1 text-[9.5px]">
                            <span className="text-[#7E7998] font-bold flex items-center gap-0.5">
                              <span className="text-amber-500 font-black">★ {stats.rating}</span>
                              <span>({stats.sold.toLocaleString()} sold)</span>
                            </span>
                            <span className="text-[#7E7998] font-semibold">
                              ({stats.reviewsCount} reviews)
                            </span>
                          </div>
                        </div>

                        {/* Bottom Price & Add (+) Button */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F5F4FC]">
                          <div>
                            <span className="text-xs font-black text-[#181432]">{rateFormatted}</span>
                            <span className="text-[9px] text-[#7E7998] block">Social Boost</span>
                          </div>

                          <button
                            disabled={isOutOfStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isOutOfStock) return;
                              setDetailSmmService(smm);
                              setSmmOrderQty(smm.min || 1000);
                              setSmmTargetLink("");
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isOutOfStock
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                : "bg-gradient-to-tr from-[#5B42F3] to-[#00C9FF] text-white shadow-md shadow-[#5B42F3]/20 hover:opacity-95 active:scale-90"
                            }`}
                          >
                            {isOutOfStock ? <Ban className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </div>
                      </motion.div>
                    );
                  }

                  if (item.type === "sandromania") {
                    const sandProd = item.data;
                    const isOutOfStock = item.isOutOfStock;
                    const cleanTitle = cleanSandromaniaText(sandProd.title);
                    const cleanCat = cleanSandromaniaText(sandProd.category);
                    const conf = getProviderConfig(cleanTitle, cleanCat);
                    const priceFormatted = formatSandromaniaPrice(sandProd, 1);
                    const availableStock = sandProd.stock ?? sandProd.stockCount ?? 99;
                    const stats = getItemStats(sandProd, "sandromania");

                    return (
                      <motion.div
                        key={`sandro-prod-${sandProd.id}`}
                        whileHover={isOutOfStock ? {} : { y: -3 }}
                        whileTap={isOutOfStock ? {} : { scale: 0.98 }}
                        onClick={() => {
                          if (isOutOfStock) {
                            toast({ title: "Out of Stock", description: "This product is currently fully out of stock.", variant: "destructive" });
                            return;
                          }
                          setDetailSandromaniaProduct(sandProd);
                          setSandromaniaOrderQty(1);
                        }}
                        className={`bg-white rounded-3xl p-3.5 shadow-sm border border-[#ECEEF8] flex flex-col justify-between transition-all relative group overflow-hidden ${
                          isOutOfStock ? "cursor-not-allowed select-none" : "cursor-pointer hover:shadow-md"
                        }`}
                      >
                        {/* Top-Right 45° Corner Angle Ribbon Banner */}
                        {(() => {
                          const badge = getProductBadge(sandProd, "sandromania");
                          if (!badge || !badge.text || isOutOfStock) return null;
                          return (
                            <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none overflow-hidden z-20">
                              <div
                                className={`absolute transform rotate-45 text-center text-[7px] font-black uppercase tracking-wider py-1 shadow-sm w-36 -right-10 top-3.5 leading-none ${badge.gradient}`}
                                style={{ letterSpacing: '0.04em' }}
                              >
                                {badge.text}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Top Action: Provider Tag */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${conf.bgBadge}`}>
                            {conf.tag}
                          </span>
                        </div>

                        {/* Centered Image with Real Brand Icon, Organic Blob Background & Centered Out of Stock Badge */}
                        <div className="relative my-2 py-3 flex items-center justify-center">
                          <div
                            className={`w-20 h-20 rounded-full bg-gradient-to-br ${conf.blobColor} absolute blur-sm`}
                          />
                          <div className="relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-300">
                            <BrandIcon name={cleanTitle} type={cleanCat} className="w-12 h-12" />
                          </div>

                          {isOutOfStock && (
                            <div className="absolute inset-x-0 bottom-0.5 z-20 flex items-center justify-center pointer-events-none">
                              <div className="bg-slate-700/85 backdrop-blur-md text-slate-100 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-500/30 shadow-md flex items-center gap-1.5 whitespace-nowrap">
                                <Ban className="w-3 h-3 text-slate-300 shrink-0" />
                                <span>FULLY OUT OF STOCK</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="mt-1">
                          <h4 className="text-xs font-extrabold text-[#181432] line-clamp-1 group-hover:text-[#5B42F3] transition-colors">
                            {cleanTitle}
                          </h4>
                          <div className="flex items-center justify-between mt-1 text-[9.5px]">
                            <span className="text-[#7E7998] font-bold flex items-center gap-0.5">
                              <span className="text-amber-500 font-black">★ {stats.rating}</span>
                              <span>({stats.sold.toLocaleString()} sold)</span>
                            </span>
                            <span className={`text-[9px] font-bold shrink-0 ${!isOutOfStock ? "text-emerald-600" : "text-slate-400"}`}>
                              {!isOutOfStock ? (availableStock < 90 ? `${availableStock} in stock` : "In stock") : "Out of stock"}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Price & Add (+) Button */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F5F4FC]">
                          <div>
                            <span className="text-xs font-black text-[#181432]">{priceFormatted}</span>
                            <span className="text-[9px] text-[#7E7998] block">Instant Auto</span>
                          </div>

                          <button
                            disabled={isOutOfStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isOutOfStock) return;
                              setDetailSandromaniaProduct(sandProd);
                              setSandromaniaOrderQty(1);
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isOutOfStock
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                : "bg-gradient-to-tr from-[#10A37F] to-[#00C9FF] text-white shadow-md shadow-[#10A37F]/20 hover:opacity-95 active:scale-90"
                            }`}
                          >
                            {isOutOfStock ? <Ban className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </div>
                      </motion.div>
                    );
                  }

                  if (item.type === "cssx") {
                    const cssxProd = item.data;
                    const isOutOfStock = item.isOutOfStock;
                    const cleanTitle = cssxProd.title || "Digital Product";
                    const cleanCat = cssxProd.category || "General";
                    const conf = getProviderConfig(cleanTitle, cleanCat);
                    const priceFormatted = formatCssxPrice(cssxProd, 1);
                    const availableStock = cssxProd.stock ?? 99;
                    const stats = getItemStats(cssxProd, "sandromania");

                    return (
                      <motion.div
                        key={`cssx-prod-${cssxProd.id}`}
                        whileHover={isOutOfStock ? {} : { y: -3 }}
                        whileTap={isOutOfStock ? {} : { scale: 0.98 }}
                        onClick={() => {
                          if (isOutOfStock) {
                            toast({ title: "Out of Stock", description: "This product is currently fully out of stock.", variant: "destructive" });
                            return;
                          }
                          setDetailCssxProduct(cssxProd);
                          setCssxOrderQty(1);
                        }}
                        className={`bg-white rounded-3xl p-3.5 shadow-sm border border-[#ECEEF8] flex flex-col justify-between transition-all relative group overflow-hidden ${
                          isOutOfStock ? "cursor-not-allowed select-none" : "cursor-pointer hover:shadow-md"
                        }`}
                      >
                        {/* Top-Right 45° Corner Angle Ribbon Banner */}
                        {(() => {
                          const badge = getProductBadge(cssxProd, "cssx");
                          if (!badge || !badge.text || isOutOfStock) return null;
                          return (
                            <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none overflow-hidden z-20">
                              <div
                                className={`absolute transform rotate-45 text-center text-[7px] font-black uppercase tracking-wider py-1 shadow-sm w-36 -right-10 top-3.5 leading-none ${badge.gradient}`}
                                style={{ letterSpacing: '0.04em' }}
                              >
                                {badge.text}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Top Action: Provider Tag */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${conf.bgBadge}`}>
                            {conf.tag}
                          </span>
                        </div>

                        {/* Centered Image with Real Brand Icon, Organic Blob Background & Centered Out of Stock Badge */}
                        <div className="relative my-2 py-3 flex items-center justify-center">
                          <div
                            className={`w-20 h-20 rounded-full bg-gradient-to-br ${conf.blobColor} absolute blur-sm`}
                          />
                          <div className="relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-300">
                            <BrandIcon name={cleanTitle} type={cleanCat} className="w-12 h-12" />
                          </div>

                          {isOutOfStock && (
                            <div className="absolute inset-x-0 bottom-0.5 z-20 flex items-center justify-center pointer-events-none">
                              <div className="bg-slate-700/85 backdrop-blur-md text-slate-100 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-500/30 shadow-md flex items-center gap-1.5 whitespace-nowrap">
                                <Ban className="w-3 h-3 text-slate-300 shrink-0" />
                                <span>FULLY OUT OF STOCK</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="mt-1">
                          <h4 className="text-xs font-extrabold text-[#181432] line-clamp-1 group-hover:text-[#5B42F3] transition-colors">
                            {cleanTitle}
                          </h4>
                          <div className="flex items-center justify-between mt-1 text-[9.5px]">
                            <span className="text-[#7E7998] font-bold flex items-center gap-0.5">
                              <span className="text-amber-500 font-black">★ {stats.rating}</span>
                              <span>({stats.sold.toLocaleString()} sold)</span>
                            </span>
                            <span className={`text-[9px] font-bold shrink-0 ${!isOutOfStock ? "text-emerald-600" : "text-slate-400"}`}>
                              {!isOutOfStock ? (availableStock < 90 ? `${availableStock} in stock` : "In stock") : "Out of stock"}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Price & Add (+) Button */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F5F4FC]">
                          <div>
                            <span className="text-xs font-black text-[#181432]">{priceFormatted}</span>
                            <span className="text-[9px] text-[#7E7998] block">Instant Auto</span>
                          </div>

                          <button
                            disabled={isOutOfStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isOutOfStock) return;
                              setDetailCssxProduct(cssxProd);
                              setCssxOrderQty(1);
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isOutOfStock
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                : "bg-gradient-to-tr from-[#8E54E9] to-[#5B42F3] text-white shadow-md shadow-[#8E54E9]/20 hover:opacity-95 active:scale-90"
                            }`}
                          >
                            {isOutOfStock ? <Ban className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </div>
                      </motion.div>
                    );
                  }

                  // item.type === "product"
                  const prod = item.data;
                  const isOutOfStock = item.isOutOfStock;
                  const conf = getProviderConfig(prod.name, prod.type);
                  const priceFormatted = formatProductPrice(prod);
                  const availableStock = prod.stockCount ?? 0;
                  const stats = getItemStats(prod, "product");

                  return (
                    <motion.div
                      key={prod.id}
                      whileHover={isOutOfStock ? {} : { y: -3 }}
                      whileTap={isOutOfStock ? {} : { scale: 0.98 }}
                      onClick={() => {
                        if (isOutOfStock) {
                          toast({ title: "Out of Stock", description: "This account is currently fully out of stock.", variant: "destructive" });
                          return;
                        }
                        setDetailProduct(prod);
                        setQuantity(1);
                      }}
                      className={`bg-white rounded-3xl p-3.5 shadow-sm border border-[#ECEEF8] flex flex-col justify-between transition-all relative group overflow-hidden ${
                        isOutOfStock ? "cursor-not-allowed select-none" : "cursor-pointer hover:shadow-md"
                      }`}
                    >
                      {/* Top-Right 45° Corner Angle Ribbon Banner */}
                      {(() => {
                        const badge = getProductBadge(prod);
                        if (!badge || !badge.text || isOutOfStock) return null;
                        return (
                          <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none overflow-hidden z-20">
                            <div
                              className={`absolute transform rotate-45 text-center text-[7px] font-black uppercase tracking-wider py-1 shadow-sm w-36 -right-10 top-3.5 leading-none ${badge.gradient}`}
                              style={{ letterSpacing: '0.04em' }}
                            >
                              {badge.text}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Top Action: Provider Tag */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${conf.bgBadge}`}>
                          {conf.tag}
                        </span>
                      </div>

                      {/* Centered Image with Real Brand Icon, Organic Blob Background & Centered Out of Stock Badge */}
                      <div className="relative my-2 py-3 flex items-center justify-center">
                        <div
                          className={`w-20 h-20 rounded-full bg-gradient-to-br ${conf.blobColor} absolute blur-sm`}
                        />
                        <div className="relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-300">
                          <BrandIcon name={prod.name} type={prod.type} className="w-12 h-12" />
                        </div>

                        {isOutOfStock && (
                          <div className="absolute inset-x-0 bottom-0.5 z-20 flex items-center justify-center pointer-events-none">
                            <div className="bg-slate-700/85 backdrop-blur-md text-slate-100 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-500/30 shadow-md flex items-center gap-1.5 whitespace-nowrap">
                              <Ban className="w-3 h-3 text-slate-300 shrink-0" />
                              <span>FULLY OUT OF STOCK</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="mt-1">
                        <h4 className="text-xs font-extrabold text-[#181432] line-clamp-1 group-hover:text-[#5B42F3] transition-colors">
                          {prod.name}
                        </h4>
                        <p className="text-[10px] text-[#7E7998] line-clamp-1 mt-0.5">
                          {prod.description || `${prod.type} Verified Account`}
                        </p>
                        <div className="flex items-center justify-between mt-1 text-[9.5px]">
                          <span className="text-[#7E7998] font-bold flex items-center gap-0.5">
                            <span className="text-amber-500 font-black">★ {stats.rating}</span>
                            <span>({stats.sold.toLocaleString()} sold)</span>
                          </span>
                          <span className="text-[#2563EB] font-black flex items-center gap-1">
                            Verified <VerifiedBadgeIcon className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>

                      {/* Bottom Price & Add (+) Button */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F5F4FC]">
                        <div>
                          <span className="text-xs font-black text-[#181432]">{priceFormatted}</span>
                          <span className="text-[9px] text-[#7E7998] block">per unit</span>
                        </div>

                        <button
                          disabled={isOutOfStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isOutOfStock) return;
                            setDetailProduct(prod);
                            setQuantity(1);
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            isOutOfStock
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                              : "bg-gradient-to-tr from-[#FF5E62] to-[#6C5CE7] text-white shadow-md shadow-[#6C5CE7]/20 hover:opacity-95 active:scale-90"
                          }`}
                        >
                          {isOutOfStock ? <Ban className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
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
                .map((cat) => {
                  const count = getCategoryCount(cat.id);
                  const isOutOfStock = count <= 0;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        if (isOutOfStock) {
                          toast({
                            title: "Category Out of Stock",
                            description: `"${cat.label}" is currently fully out of stock.`,
                            variant: "destructive"
                          });
                          return;
                        }
                        setSelectedCategory(cat.id);
                        setActiveTab("home");
                      }}
                      className={`rounded-3xl p-4 shadow-sm flex flex-col items-center text-center transition-all group relative overflow-hidden ${
                        isOutOfStock
                          ? "bg-slate-50 border border-dashed border-slate-200 opacity-60 grayscale cursor-not-allowed select-none"
                          : "bg-white border border-[#ECEEF8] cursor-pointer hover:border-[#6C5CE7] hover:shadow-md"
                      }`}
                    >
                      <div className="mb-2 h-10 w-10 rounded-2xl bg-[#F8F7FD] border border-[#ECEEF8] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                        {renderCategoryBrandIcon(cat.iconType, cat.customIconUrl, "w-6 h-6")}
                      </div>
                      <h4 className="text-sm font-bold text-[#181432]">{cat.label}</h4>
                      <span className={`text-[10px] mt-0.5 ${isOutOfStock ? "text-slate-400 font-bold" : "text-[#7E7998]"}`}>
                        {isOutOfStock ? "Fully Out of Stock" : `${count} Available`}
                      </span>

                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none p-2">
                          <span className="bg-slate-900/85 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/20 shadow-md flex items-center gap-1">
                            <Ban className="w-2.5 h-2.5 text-red-400" />
                            Fully Out of Stock
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* ORDERS TAB - UNIFIED & HARMONIOUS CHRONOLOGICAL LAYOUT */}
        {activeTab === "orders" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between mb-0.5">
              <h2 className="text-lg font-black text-[#181432]">My Orders & Services</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#7E7998]">{unifiedOrdersList.length} Total</span>
                <button
                  onClick={handleSyncAllOrders}
                  disabled={isSyncingOrders || isOrdersTabLoading}
                  className="text-[11px] font-bold text-[#5B42F3] bg-[#F5F4FC] hover:bg-[#EDE9FE] px-2.5 py-1 rounded-full border border-purple-200/60 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingOrders || isOrdersTabLoading ? "animate-spin" : ""}`} />
                  Sync
                </button>
              </div>
            </div>

            {/* Signature Lottie Loading Animation like Home Page */}
            {(isOrdersTabLoading || isSyncingOrders) ? (
              <div className="flex flex-col items-center justify-center py-20 min-h-[320px]">
                <LottiePayment size={140} />
              </div>
            ) : (
              <>
                {/* CATEGORY FILTER TABS (Clean Scrollable Tabs without underline) */}
            <div 
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 pt-0.5 [&::-webkit-scrollbar]:hidden"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <button
                onClick={() => setOrdersFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  ordersFilter === "all"
                    ? "bg-[#5B42F3] text-white shadow-xs"
                    : "bg-white text-[#7E7998] border border-[#ECEEF8] hover:bg-[#F8F7FD]"
                }`}
              >
                All Orders ({unifiedOrdersList.length})
              </button>

              <button
                onClick={() => setOrdersFilter("account")}
                className={`px-3 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  ordersFilter === "account"
                    ? "bg-[#5B42F3] text-white shadow-xs"
                    : "bg-white text-[#7E7998] border border-[#ECEEF8] hover:bg-[#F8F7FD]"
                }`}
              >
                <ShopBagIcon className="w-3 h-3" /> Cloud & Accounts ({orders.filter((o: any) => (o.status || '').toLowerCase() !== 'failed').length})
              </button>

              <button
                onClick={() => setOrdersFilter("smm")}
                className={`px-3 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  ordersFilter === "smm"
                    ? "bg-[#5B42F3] text-white shadow-xs"
                    : "bg-white text-[#7E7998] border border-[#ECEEF8] hover:bg-[#F8F7FD]"
                }`}
              >
                <ShopBagIcon className="w-3 h-3" /> Social Boost ({smmOrdersList.filter((s: any) => !(s.status || '').toLowerCase().includes('fail') && !(s.status || '').toLowerCase().includes('cancel')).length})
              </button>

              {unifiedOrdersList.some((s: any) => s.orderType === "license") && (
                <button
                  onClick={() => setOrdersFilter("license")}
                  className={`px-3 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                    ordersFilter === "license"
                      ? "bg-[#5B42F3] text-white shadow-xs"
                      : "bg-white text-[#7E7998] border border-[#ECEEF8] hover:bg-[#F8F7FD]"
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" /> Digital Licenses ({unifiedOrdersList.filter((s: any) => s.orderType === "license").length})
                </button>
              )}
            </div>

            {/* UNIFIED CHRONOLOGICAL ORDER LIST */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-[#ECEEF8]">
                <ShopBagIcon className="w-12 h-12 mx-auto text-[#9490A8]/75 mb-2.5" />
                <h4 className="text-sm font-bold text-[#181432]">No orders found</h4>
                <p className="text-xs text-[#7E7998] mt-1">
                  {ordersFilter === "all"
                    ? "Explore our catalog and make your first purchase!"
                    : "No orders found in this category."}
                </p>
                <Button
                  onClick={() => setActiveTab("home")}
                  className="mt-4 bg-gradient-to-r from-[#FF5E62] to-[#6C5CE7] hover:opacity-95 text-white rounded-full text-xs font-bold px-6 shadow-md shadow-[#6C5CE7]/25"
                >
                  Start Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((ord: any) => {
                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderDetails(ord)}
                      className="bg-white rounded-3xl p-4 shadow-sm border border-[#ECEEF8] hover:border-[#6C5CE7] hover:shadow-md transition-all space-y-2.5 cursor-pointer active:scale-[0.99] group relative"
                    >
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${ord.badgeBg}`}>
                            {ord.categoryTag}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#5B42F3] bg-[#F5F4FC] px-2 py-0.5 rounded-md">
                            {ord.orderNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {ord.statusBadge}
                          <ChevronRight className="w-4 h-4 text-[#9490A8] group-hover:text-[#5B42F3] group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>

                      {/* Product Title */}
                      <h4 className="text-[13.5px] font-black text-[#181432] leading-snug group-hover:text-[#5B42F3] transition-colors">
                        {ord.title}
                      </h4>

                      {/* Target Link for SMM */}
                      {ord.smmLink && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="bg-[#F8F7FD] p-2.5 rounded-2xl border border-[#ECEEF8] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                            <ExternalLink className="w-3 h-3 text-[#5B42F3] shrink-0" />
                            <span className="text-[10px] font-mono text-[#5B42F3] truncate select-all">
                              {ord.smmLink}
                            </span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(ord.smmLink, "Link Copied")}
                            className="text-[10px] font-bold text-[#D92078] hover:underline shrink-0"
                          >
                            Copy
                          </button>
                        </div>
                      )}

                      {/* SMM 3-Box Metrics Grid */}
                      {ord.orderType === "smm" && (
                        <div className="grid grid-cols-3 gap-2 bg-[#F8F7FD] p-2.5 rounded-2xl border border-[#ECEEF8] text-center">
                          <div className="bg-white p-1.5 rounded-xl border border-[#ECEEF8]/80">
                            <span className="text-[9px] font-bold text-[#9490A8] uppercase block">Quantity</span>
                            <span className="font-black text-[#181432] text-xs">{ord.quantity?.toLocaleString()}</span>
                          </div>
                          <div className="bg-white p-1.5 rounded-xl border border-[#ECEEF8]/80">
                            <span className="text-[9px] font-bold text-sky-600 uppercase block">Start Count</span>
                            <span className="font-black text-sky-600 text-xs">{ord.startCount || "0"}</span>
                          </div>
                          <div className="bg-white p-1.5 rounded-xl border border-[#ECEEF8]/80">
                            <span className="text-[9px] font-bold text-amber-600 uppercase block">Remains</span>
                            <span className="font-black text-amber-600 text-xs">{ord.remains || "0"}</span>
                          </div>
                        </div>
                      )}

                      {/* 2FA Live TOTP for Account Orders */}
                      {ord.twoFactorSecret && (
                        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <LiveTOTP
                            secret={ord.twoFactorSecret}
                            onCopy={(c) => copyToClipboard(c, "2FA Code Copied")}
                          />
                        </div>
                      )}

                      {/* Unified Digital Credentials / CDK Box for Account & Partner Orders */}
                      {(ord.credentialData || ord.licenseKey) && (() => {
                        const rawCreds = ord.credentialData || ord.licenseKey;
                        const accounts = parseUniversalCredentials(rawCreds, ord.title);
                        const hasStructured = accounts.length > 0 && accounts.some(a => a.fields.length > 1 || a.fields[0]?.isUrl);

                        return (
                          <div className="bg-[#F0FDF4] p-2.5 rounded-2xl border border-emerald-200" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9.5px] font-black text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {hasStructured ? "Parsed Credentials / Access:" : "Digital Credentials / CDK:"}
                              </span>
                              <div className="flex items-center gap-1">
                                {hasStructured && (
                                  <button
                                    onClick={() => copyToClipboard(rawCreds, "Raw Data Copied! 📋")}
                                    className="text-[9.5px] font-bold text-[#7E7998] hover:text-[#181432] bg-white px-1.5 py-0.5 rounded-md border border-slate-200 shadow-2xs active:scale-95 transition-transform"
                                    title="Copy Original Raw Data"
                                  >
                                    Raw
                                  </button>
                                )}
                                <button
                                  onClick={() => copyToClipboard(formatDeliveredCredentialsForCopy(rawCreds, ord.quantity, ord.title), "Credentials Copied! 📋")}
                                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-emerald-300 shadow-2xs active:scale-95 transition-transform"
                                >
                                  <Copy className="w-2.5 h-2.5" /> Copy All
                                </button>
                              </div>
                            </div>

                            {hasStructured ? (
                              <div className="space-y-2">
                                {accounts.map((acc, aIdx) => (
                                  <div key={aIdx} className="bg-white/95 p-2.5 rounded-xl border border-emerald-100 shadow-2xs space-y-1.5 text-[11px]">
                                    {accounts.length > 1 && (
                                      <div className="text-[9.5px] font-black text-emerald-800 uppercase border-b border-emerald-50 pb-0.5">
                                        Account / Item #{acc.index}
                                      </div>
                                    )}
                                    {acc.fields.map((f, fIdx) => (
                                      <div key={fIdx} className={`flex items-center justify-between gap-1.5 py-0.5 ${fIdx < acc.fields.length - 1 ? "border-b border-slate-100" : ""}`}>
                                        <span className="text-[#7E7998] font-bold text-[10px] shrink-0">{f.label}:</span>
                                        <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
                                          {f.isUrl ? (
                                            <a
                                              href={f.value}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[10.5px] text-[#5B42F3] hover:underline font-mono truncate max-w-[170px]"
                                            >
                                              {f.value}
                                            </a>
                                          ) : (
                                            <span className={`font-mono text-[10.5px] truncate select-all ${f.isSecret ? "font-bold text-emerald-700" : "font-bold text-[#181432]"}`}>
                                              {f.value}
                                            </span>
                                          )}
                                          <button
                                            onClick={() => copyToClipboard(f.value, `${f.label} Copied`)}
                                            className="text-[#5B42F3] hover:text-[#4A32D6] p-0.5 hover:bg-purple-50 rounded shrink-0"
                                            title={`Copy ${f.label}`}
                                          >
                                            <Copy className="w-2.5 h-2.5" />
                                          </button>
                                          {f.isUrl && (
                                            <a
                                              href={f.value}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-emerald-600 hover:text-emerald-700 p-0.5 hover:bg-emerald-50 rounded shrink-0"
                                              title="Open Link"
                                            >
                                              <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="font-mono text-[10.5px] text-emerald-950 font-bold bg-white/90 p-2 rounded-xl border border-emerald-100 max-h-20 overflow-y-auto break-all select-all whitespace-pre-wrap leading-relaxed shadow-inner">
                                {rawCreds}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Footer: Qty, Paid Amount, Formatted Date & View Details Prompt */}
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#F5F4FC]">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-[#181432]">
                            Qty: <span className="font-black text-[#5B42F3]">{ord.quantity?.toLocaleString() || 1}</span>
                          </span>
                          <span className="font-bold text-[#7E7998]">
                            Paid: <span className="font-black font-mono text-[#181432]">
                              {selectedCurrency === "LKR"
                                ? `Rs. ${(ord.priceLkr ? Number(ord.priceLkr) : Math.round((ord.priceCents / 100) * lkrRate)).toLocaleString()}`
                                : `$${(ord.priceCents / 100).toFixed(2)}`}
                            </span>
                          </span>
                          {selectedCurrency === "LKR" ? (
                            <span className="text-[10px] text-[#9490A8] font-mono">
                              (${(ord.priceCents / 100).toFixed(2)})
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#9490A8] font-mono">
                              (Rs. {(ord.priceLkr ? Number(ord.priceLkr) : Math.round((ord.priceCents / 100) * lkrRate)).toLocaleString()})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[#7E7998]">
                            {ord.date && ord.date.getTime() > 0 ? format(ord.date, "MMM d, yyyy • HH:mm") : "Recent"}
                          </span>
                          <span className="text-[10px] font-bold text-[#5B42F3] bg-[#F5F4FC] px-2 py-0.5 rounded-full flex items-center gap-0.5 opacity-90 group-hover:opacity-100">
                            <FileText className="w-2.5 h-2.5" /> Details
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </>
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
                {isTelegram ? (
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-inner">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-black tracking-wide text-white">USD ($) Only</span>
                  </div>
                ) : (
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
                )}
              </div>

              {/* Big Balance Amount */}
              <div className="relative z-10 mb-2">
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-baseline gap-1.5">
                  {formatBalanceInCurrentCurrency(user?.balance || 0)}
                </h2>
                <span className="text-xs font-bold text-purple-200/75 block mt-0.5">
                  {isTelegram
                    ? `Telegram Wallet (USD)`
                    : selectedCurrency === "USD"
                    ? ((user as any)?.balanceLkr != null && (user as any).balanceLkr > 0
                        ? `≈ Rs. ${Number((user as any).balanceLkr).toLocaleString("en-US")} LKR`
                        : `≈ Rs. ${(((user?.balance || 0) / 100) * lkrRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR`)
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

            {/* Guest Sign-in Requirement Notice */}
            {!isCustomerLoggedIn && (
              <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-pink-500/10 border border-amber-200/90 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#181432]">Sign in required to top up balance</h4>
                    <p className="text-[10.5px] font-medium text-[#7E7998] mt-0.5">
                      Please log in with Google or Email to verify and credit payments directly to your account.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("profile");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#6C5CE7] to-[#FF5E62] text-white text-xs font-black shadow-sm hover:opacity-95 transition-all shrink-0 whitespace-nowrap active:scale-95"
                >
                  Sign In Now
                </button>
              </div>
            )}

            {/* Smart Shortfall Auto-Fill Banner */}
            {shortfallContext && (
              <div className="bg-gradient-to-r from-[#5B42F3]/10 via-[#00C9FF]/10 to-[#FF5E62]/10 border border-[#5B42F3]/30 rounded-3xl p-4 shadow-sm relative overflow-hidden animate-in fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5B42F3] to-[#00C9FF] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-[#181432]">
                          Quick Top-up for {shortfallContext.productName}
                        </span>
                        <span className="text-[10px] font-bold bg-[#5B42F3] text-white px-2 py-0.5 rounded-full font-mono">
                          Shortfall: {selectedCurrency === "LKR" ? `Rs. ${shortfallContext.shortfallLkr.toLocaleString()}` : `$${shortfallContext.shortfallUsd.toFixed(2)} USD`}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-[#7E7998] mt-1 leading-snug">
                        {selectedCurrency === "LKR" ? (
                          <>
                            Card payment auto-rounded to <strong className="text-[#0052CC]">Rs. {shortfallContext.cardSuggestedLkr}</strong> (multiples of 50). Binance & Cryptomus set to <strong className="text-[#F3BA2F]">Rs. {shortfallContext.shortfallLkr}</strong>.
                          </>
                        ) : (
                          <>
                            Required balance pre-filled across Card, Binance & Cryptomus gateways.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShortfallContext(null)}
                    className="p-1 text-[#9490A8] hover:text-[#181432] rounded-lg transition-colors shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* PAYMENT METHODS */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-[#181432] uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#D92078]" /> PAYMENT METHODS
              </h3>

              {/* 1. CARD PAYMENT (VISA / MASTERCARD) - AT THE TOP */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ECEEF8] relative overflow-hidden">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 px-3 rounded-2xl bg-[#0052CC]/10 flex items-center justify-center gap-2 shadow-sm border border-[#0052CC]/15">
                      {/* Crisp Visa & Mastercard vector logos with full unclipped viewBox */}
                      <svg className="h-3.5 w-auto" viewBox="0 0 52 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.16 0.5L12.55 15.5H8.22L5.01 3.5C4.82 2.76 4.63 2.48 4.02 2.14C3.04 1.62 1.43 1.13 0 0.82L0.1 0.5H7.02C7.91 0.5 8.7 1.09 8.88 2.11L10.58 11.16L14.77 0.5H19.16ZM35.98 10.5C36 6.51 30.45 6.29 30.49 4.49C30.5 3.94 31.02 3.36 32.18 3.2C32.76 3.13 34.33 3.07 36.03 3.86L36.72 0.65C35.77 0.31 34.56 0 33.05 0C28.98 0 26.11 2.16 26.09 5.25C26.05 7.54 28.1 8.82 29.66 9.58C31.27 10.36 31.81 10.86 31.8 11.56C31.79 12.63 30.51 13.1 29.33 13.12C27.28 13.15 26.08 12.57 25.13 12.13L24.41 15.48C25.37 15.92 27.15 16.3 28.99 16.32C33.32 16.32 36.17 14.18 35.98 10.5ZM46.54 15.5H50.36L47.01 0.5H43.46C42.66 0.5 42 0.96 41.7 1.68L35.6 15.5H39.95L40.82 13.1H46.12L46.54 15.5ZM41.97 9.98L44.18 3.92L45.45 9.98H41.97ZM25.04 0.5L21.64 15.5H17.47L20.87 0.5H25.04Z" fill="#1A1F71"/>
                      </svg>
                      <svg className="h-4 w-auto" viewBox="0 0 28 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="9" cy="9" r="9" fill="#EB001B"/>
                        <circle cx="19" cy="9" r="9" fill="#F79E1B"/>
                        <path d="M14 2.82A8.96 8.96 0 0 0 9 0a8.96 8.96 0 0 0-5 1.58A8.97 8.97 0 0 1 14 9a8.97 8.97 0 0 1-10 7.42A8.96 8.96 0 0 0 9 18a8.96 8.96 0 0 0 5-2.82A8.96 8.96 0 0 0 19 18a8.96 8.96 0 0 0 5-1.58A8.97 8.97 0 0 1 14 9a8.97 8.97 0 0 1 10-7.42A8.96 8.96 0 0 0 19 0a8.96 8.96 0 0 0-5 2.82z" fill="#FF5F00"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#181432]">Visa / Mastercard</h4>
                      <span className="text-[10px] font-bold text-[#7E7998]">Instant Credit & Debit Card Deposit</span>
                    </div>
                  </div>
                </div>

                {/* Amount selection quick chips */}
                <div className="mb-3.5">
                  <label className="text-[10px] font-bold text-[#7E7998] block uppercase mb-1.5 flex items-center justify-between">
                    <span>Select Card Deposit Amount ({selectedCurrency})</span>
                    {selectedCurrency === "LKR" ? (
                      <span className="text-blue-600 font-black text-[10px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        Credits: ≈ ${payhereCalculatedUsd.toFixed(2)} USD
                      </span>
                    ) : (
                      <span className="text-blue-600 font-black text-[10px]">
                        ≈ Rs. {Math.round(parseFloat(payhereAmount || "0") * lkrRate).toLocaleString()} LKR
                      </span>
                    )}
                  </label>
                  <div className={`grid ${selectedCurrency === "LKR" ? "grid-cols-6" : "grid-cols-5"} gap-1.5 mb-2`}>
                    {(selectedCurrency === "LKR" ? ["50", "100", "150", "250", "500", "1000"] : ["5", "10", "20", "50", "100"]).map((amt) => {
                      const isSelected = (selectedCurrency === "LKR" ? payhereEffectiveLkr.toString() : payhereAmount) === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setPayhereAmount(amt)}
                          className={`py-2 rounded-xl text-xs font-black transition-all ${
                            isSelected
                              ? "bg-[#0052CC] text-white shadow-md shadow-[#0052CC]/30 scale-105"
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
                      min={selectedCurrency === "LKR" ? "50" : "1"}
                      step={selectedCurrency === "LKR" ? "50" : "1"}
                      value={payhereAmount}
                      onChange={(e) => setPayhereAmount(e.target.value)}
                      onBlur={() => {
                        if (selectedCurrency === "LKR") {
                          setPayhereAmount(payhereEffectiveLkr.toString());
                        }
                      }}
                      placeholder={selectedCurrency === "LKR" ? "Amount in Rs. 50 multiples (e.g. 150)" : "Custom Amount in USD (e.g. 20)"}
                      className="w-full bg-[#F8F7FD] border border-[#ECEEF8] rounded-xl pl-8 pr-3 py-2 text-xs font-black text-[#181432] focus:outline-none focus:border-[#0052CC]"
                    />
                  </div>
                </div>

                {/* Accepted Cards & Wallets Badge row with Official Branded Logos */}
                <div className="flex items-center gap-1.5 mb-3.5 px-3 py-2 bg-[#F8F7FD] rounded-xl border border-[#ECEEF8] flex-wrap">
                  <span className="text-[10px] font-bold text-[#7E7998] mr-1">Accepted:</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-[#1A1F71]/20 shadow-xs">
                    <svg className="h-3 w-auto" viewBox="0 0 52 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19.16 0.5L12.55 15.5H8.22L5.01 3.5C4.82 2.76 4.63 2.48 4.02 2.14C3.04 1.62 1.43 1.13 0 0.82L0.1 0.5H7.02C7.91 0.5 8.7 1.09 8.88 2.11L10.58 11.16L14.77 0.5H19.16ZM35.98 10.5C36 6.51 30.45 6.29 30.49 4.49C30.5 3.94 31.02 3.36 32.18 3.2C32.76 3.13 34.33 3.07 36.03 3.86L36.72 0.65C35.77 0.31 34.56 0 33.05 0C28.98 0 26.11 2.16 26.09 5.25C26.05 7.54 28.1 8.82 29.66 9.58C31.27 10.36 31.81 10.86 31.8 11.56C31.79 12.63 30.51 13.1 29.33 13.12C27.28 13.15 26.08 12.57 25.13 12.13L24.41 15.48C25.37 15.92 27.15 16.3 28.99 16.32C33.32 16.32 36.17 14.18 35.98 10.5ZM46.54 15.5H50.36L47.01 0.5H43.46C42.66 0.5 42 0.96 41.7 1.68L35.6 15.5H39.95L40.82 13.1H46.12L46.54 15.5ZM41.97 9.98L44.18 3.92L45.45 9.98H41.97ZM25.04 0.5L21.64 15.5H17.47L20.87 0.5H25.04Z" fill="#1A1F71"/>
                    </svg>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#EB001B]/20 shadow-xs">
                    <svg className="h-3 w-auto" viewBox="0 0 28 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="9" cy="9" r="9" fill="#EB001B"/>
                      <circle cx="19" cy="9" r="9" fill="#F79E1B"/>
                      <path d="M14 2.82A8.96 8.96 0 0 0 9 0a8.96 8.96 0 0 0-5 1.58A8.97 8.97 0 0 1 14 9a8.97 8.97 0 0 1-10 7.42A8.96 8.96 0 0 0 9 18a8.96 8.96 0 0 0 5-2.82A8.96 8.96 0 0 0 19 18a8.96 8.96 0 0 0 5-1.58A8.97 8.97 0 0 1 14 9a8.97 8.97 0 0 1 10-7.42A8.96 8.96 0 0 0 19 0a8.96 8.96 0 0 0-5 2.82z" fill="#FF5F00"/>
                    </svg>
                    <span className="text-[9.5px] font-black text-[#181432]">Mastercard</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-purple-200/80 shadow-xs">
                    <img src="/frimi.png" alt="FriMi" className="h-3.5 w-3.5 object-contain rounded-full shadow-xs" />
                    <span className="text-[9.5px] font-black text-[#582C83]">FriMi</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-red-200/80 shadow-xs">
                    <img src="/ipay.png" alt="iPay" className="h-3.5 w-3.5 object-contain rounded-full shadow-xs" />
                    <span className="text-[9.5px] font-black text-[#E31B23]">iPay</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-blue-200/80 shadow-xs">
                    <img src="/qplus.png" alt="Q+ Payment" className="h-3.5 w-3.5 object-contain rounded-full shadow-xs" />
                    <span className="text-[9.5px] font-black text-[#0054A6]">Q+ Payment</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200/80 shadow-xs">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" fill="#4285F4"/>
                      <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" fill="#34A853"/>
                      <path d="M5.28 14.27a7.18 7.18 0 0 1 0-4.54V6.58H1.25a11.97 11.97 0 0 0 0 10.84l4.03-3.15Z" fill="#FBBC05"/>
                      <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" fill="#EA4335"/>
                    </svg>
                    <span className="text-[9.5px] font-black text-[#3C4043]">Google Pay</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handlePayHerePay}
                  disabled={isCreatingPayHere}
                  className="w-full h-11 px-4 bg-gradient-to-r from-[#0052CC] via-[#0065FF] to-[#00C7E6] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-[#0052CC]/25 hover:opacity-95 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isCreatingPayHere ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Preparing Secure Checkout...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {selectedCurrency === "LKR"
                          ? `Pay Rs. ${payhereEffectiveLkr.toLocaleString()} with Card`
                          : `Pay $${payhereAmount || "0"} with Card`}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* 2. BINANCE PAY REAL GATEWAY - IN THE MIDDLE */}
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
                  <div className={`grid ${selectedCurrency === "LKR" ? "grid-cols-5" : "grid-cols-5"} gap-1.5 mb-2`}>
                    {(selectedCurrency === "LKR" ? ["50", "100", "500", "1000", "5000"] : ["0.1", "1", "5", "10", "20"]).map((amt) => {
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
                      min="0.1"
                      step={selectedCurrency === "LKR" ? "10" : "0.1"}
                      value={binanceAmount}
                      onChange={(e) => setBinanceAmount(e.target.value)}
                      placeholder={selectedCurrency === "LKR" ? "Custom Amount in LKR (e.g. 500)" : "Custom Amount in USD (e.g. 0.1)"}
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
                    className="w-full h-11 px-4 bg-[#F3BA2F] hover:bg-[#F59E0B] text-[#181432] rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-[#F3BA2F]/20 active:scale-95 transition-all disabled:opacity-50"
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
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="break-words">{binanceSuccessMsg}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBinanceSuccessMsg(null)}
                      className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 hover:text-emerald-800 transition-colors shrink-0"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {binanceErrorMsg && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-start justify-between gap-2 animate-in fade-in">
                    <div className="flex items-start gap-2 min-w-0">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span className="leading-snug break-words">{binanceErrorMsg}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBinanceErrorMsg(null)}
                      className="p-1 hover:bg-red-100 rounded-lg text-red-500 hover:text-red-700 transition-colors shrink-0"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* 3. CRYPTOMUS GATEWAY - AT THE BOTTOM */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ECEEF8] relative overflow-hidden">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-[#1C1838] flex items-center justify-center shadow-sm">
                      <CryptomusLogo className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#181432]">Cryptomus</h4>
                      <span className="text-[10px] font-bold text-[#7E7998]">USDT • TRC20 • BEP20 • TON • BTC</span>
                    </div>
                  </div>
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
                  className="w-full h-11 px-4 bg-gradient-to-r from-[#FF5E62] via-[#D92078] to-[#5B42F3] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-[#5B42F3]/25 hover:opacity-95 transition-all active:scale-95 disabled:opacity-50"
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
            {/* Signature Lottie Loading Animation like Home Page */}
            {isProfileTabLoading ? (
              <div className="flex flex-col items-center justify-center py-20 min-h-[360px]">
                <LottiePayment size={140} />
              </div>
            ) : (
              <>
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
                        <label className="text-[11px] font-bold text-[#6B658B] block mb-2 uppercase tracking-wider">
                          Enter 6-Digit Verification Code
                        </label>
                        <SixDigitOtpInput
                          value={authOtp}
                          onChange={setAuthOtp}
                          onComplete={(code) => handleVerifyOtp(code)}
                          disabled={isVerifyingOtp}
                        />
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
                {/* User Identity Card */}
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
                    {user?.telegramId && !user.telegramId.startsWith("google:") && !user.telegramId.startsWith("email:") && user.telegramId !== "0" && user.telegramId !== "web_guest" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#24A1DE] bg-sky-50 px-2.5 py-0.5 rounded-full">
                        <FaTelegramPlane className="w-3 h-3" /> Telegram ID: {user.telegramId}
                      </span>
                    ) : user?.authProvider === "google" || user?.telegramId?.startsWith("google:") ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4285F4] bg-[#E8F0FE] px-2.5 py-0.5 rounded-full">
                        <GoogleIcon className="w-3 h-3" /> Google Account
                      </span>
                    ) : user?.authProvider === "email" || user?.telegramId?.startsWith("email:") ? (
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
                    {user?.telegramId && !user.telegramId.startsWith("google:") && !user.telegramId.startsWith("email:") && user.telegramId !== "0" && user.telegramId !== "web_guest" ? (
                      user?.username ? `@${user.username}` : `Telegram ID: ${user.telegramId}`
                    ) : (
                      user?.email || (user?.username ? `@${user.username}` : `ID: ${user?.telegramId}`)
                    )}
                  </span>

                  {/* Balance Display */}
                  <div className="mt-4 pt-4 border-t border-[#F5F4FC] flex items-center justify-between bg-[#F8F7FD] p-3.5 rounded-2xl">
                    <div className="text-left">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9490A8] block">Wallet Balance</span>
                      <span className="text-lg font-black text-[#181432]">
                        {formatBalanceInCurrentCurrency(user?.balance || 0)}
                      </span>
                    </div>
                    <Button
                      onClick={() => setActiveTab("wallet")}
                      className="h-8 px-3.5 bg-gradient-to-r from-[#6C5CE7] to-[#5B42F3] hover:from-[#5B42F3] hover:to-[#4A32D6] text-white text-xs font-black rounded-xl shadow-sm"
                    >
                      Top Up
                    </Button>
                  </div>
                </div>

                {/* Profile Sub-Tabs Navigation Pills (3 Tabs) */}
                <div className="bg-[#F8F7FD] p-1 rounded-2xl border border-[#ECEEF8] grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setProfileSubTab("overview")}
                    className={`py-2 px-1 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
                      profileSubTab === "overview" || profileSubTab === "api"
                        ? "bg-white text-[#5B42F3] shadow-sm"
                        : "text-[#7E7998] hover:text-[#181432]"
                    }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" /> Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileSubTab("tickets")}
                    className={`py-2 px-1 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
                      profileSubTab === "tickets"
                        ? "bg-white text-[#5B42F3] shadow-sm"
                        : "text-[#7E7998] hover:text-[#181432]"
                    }`}
                  >
                    <Ticket className="w-3.5 h-3.5 text-[#5B42F3]" /> Tickets
                    {supportTicketsList.length > 0 && (
                      <span className="text-[9.5px] bg-purple-100 text-[#5B42F3] px-1.5 py-0.2 rounded-full font-mono font-bold">
                        {supportTicketsList.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileSubTab("transactions")}
                    className={`py-2 px-1 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
                      profileSubTab === "transactions"
                        ? "bg-white text-[#5B42F3] shadow-sm"
                        : "text-[#7E7998] hover:text-[#181432]"
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" /> History
                    {transactionsList.length > 0 && (
                      <span className="text-[9.5px] bg-purple-100 text-[#5B42F3] px-1.5 py-0.2 rounded-full font-mono font-bold">
                        {transactionsList.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* SUBTAB 1: OVERVIEW */}
                {profileSubTab === "overview" && (
                  <div className="bg-white rounded-3xl p-2 shadow-sm border border-[#ECEEF8] divide-y divide-[#F5F4FC]">
                    <button
                      onClick={() => setActiveTab("orders")}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-[#181432] hover:bg-[#F8F7FD] rounded-2xl transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <ShopBagIcon className="w-4 h-4 text-[#5B42F3]" /> My Cloud Orders
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

                    {/* Developer API Yellow / Amber Card */}
                    <div className="p-1">
                      <button
                        type="button"
                        onClick={() => setProfileSubTab("api")}
                        className="w-full px-3.5 py-3 flex items-center justify-between text-xs font-black text-amber-950 bg-gradient-to-r from-amber-100/90 via-yellow-50 to-amber-100/80 hover:from-amber-200/90 hover:to-yellow-100 rounded-2xl transition-all border border-amber-300 shadow-xs"
                      >
                        <span className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center shadow-xs">
                            <Key className="w-4 h-4" />
                          </div>
                          <span className="text-left">
                            <span className="block font-black text-amber-950">Developer / Reseller API</span>
                            <span className="block text-[10px] font-semibold text-amber-800">Automate cloud & bot orders</span>
                          </span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {apiKeysData?.activeKey?.key ? (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-900 bg-white/80 border border-amber-300 px-2 py-0.5 rounded-full">
                              🔑 Create Key
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-amber-800" />
                        </div>
                      </button>
                    </div>

                    <button
                      onClick={() => setProfileSubTab("tickets")}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-[#181432] hover:bg-[#F8F7FD] rounded-2xl transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Ticket className="w-4 h-4 text-[#5B42F3]" /> View My Support Tickets
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{supportTicketsList.length} Tickets</span>
                        <ChevronRight className="w-4 h-4 text-[#9490A8]" />
                      </div>
                    </button>

                    <button
                      onClick={() => setProfileSubTab("transactions")}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-[#181432] hover:bg-[#F8F7FD] rounded-2xl transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Receipt className="w-4 h-4 text-emerald-600" /> Account Transactions Timeline
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{transactionsList.length} Events</span>
                        <ChevronRight className="w-4 h-4 text-[#9490A8]" />
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setTermsModalProduct(null);
                        setIsTermsModalOpen(true);
                      }}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-[#181432] hover:bg-[#F8F7FD] rounded-2xl transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Terms of Service & Warranty Policy
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#9490A8]" />
                    </button>

                    <button
                      onClick={() => setIsChatOpen(true)}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-[#181432] hover:bg-[#F8F7FD] rounded-2xl transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <MessageCircle className="w-4 h-4 text-[#FF5E62]" /> 24/7 Live AI Concierge
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
                )}

                {/* SUBTAB: SUPPORT TICKETS LIST */}
                {profileSubTab === "tickets" && (
                  <div className="space-y-3">
                    {/* Top Action Header */}
                    <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 p-4 rounded-3xl border border-purple-200 shadow-xs flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-black text-[#181432] flex items-center gap-1.5">
                          <Ticket className="w-4 h-4 text-[#5B42F3]" /> Support Tickets Center
                        </h4>
                        <p className="text-[10.5px] text-[#7E7998] mt-0.5">
                          Direct assistance with orders, top-ups & replacements.
                        </p>
                      </div>
                      <button
                        onClick={() => setIsSupportModalOpen(true)}
                        className="px-3.5 py-2 bg-gradient-to-r from-[#5B42F3] to-[#6C5CE7] hover:opacity-95 text-white rounded-2xl text-xs font-black shadow-md shadow-[#5B42F3]/25 flex items-center gap-1.5 shrink-0 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> Open Ticket
                      </button>
                    </div>

                    {/* Tickets List */}
                    {supportTicketsList.length === 0 ? (
                      <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-[#ECEEF8]">
                        <Ticket className="w-10 h-10 mx-auto text-[#9490A8] mb-2" />
                        <h4 className="text-sm font-bold text-[#181432]">No Support Tickets Yet</h4>
                        <p className="text-xs text-[#7E7998] mt-1 max-w-xs mx-auto">
                          Have a question about an order, payment, or replacement? Open a ticket for priority support.
                        </p>
                        <Button
                          onClick={() => setIsSupportModalOpen(true)}
                          className="mt-4 bg-gradient-to-r from-[#5B42F3] to-[#6C5CE7] hover:opacity-95 text-white rounded-full text-xs font-bold px-6 shadow-md shadow-[#5B42F3]/25"
                        >
                          Open Support Ticket (Recommended)
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {supportTicketsList.map((tick: any) => {
                          let statusBadge = (
                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-amber-500" /> Pending Review
                            </span>
                          );
                          if (tick.status === "in_progress" || tick.status === "admin_replied") {
                            statusBadge = (
                              <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                <Headphones className="w-2.5 h-2.5 text-[#5B42F3]" /> Staff Replied
                              </span>
                            );
                          } else if (tick.status === "resolved") {
                            statusBadge = (
                              <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Resolved
                              </span>
                            );
                          } else if (tick.status === "closed") {
                            statusBadge = (
                              <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                Closed
                              </span>
                            );
                          }

                          let lastMsg = tick.details || "";
                          if (tick.messages) {
                            try {
                              const parsed = JSON.parse(tick.messages);
                              if (Array.isArray(parsed) && parsed.length > 0) {
                                const last = parsed[parsed.length - 1];
                                lastMsg = (last.sender === "admin" ? "Admin: " : "You: ") + last.text;
                              }
                            } catch {}
                          }

                          return (
                            <div
                              key={tick.id}
                              onClick={() => setSupportSelectedTicket(tick)}
                              className="bg-white rounded-3xl p-4 shadow-sm border border-[#ECEEF8] hover:border-[#5B42F3] hover:shadow-md transition-all cursor-pointer space-y-2 group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-[#5B42F3] bg-[#F5F4FC] px-2 py-0.5 rounded-md border border-purple-200/60">
                                    #TICK-{tick.id < 2000 ? tick.id + 2000 : tick.id}
                                  </span>
                                  <span className="text-[9.5px] font-bold text-[#7E7998] bg-[#F8F7FD] px-2 py-0.5 rounded-full border border-[#ECEEF8]">
                                    {tick.issueType || "Support"}
                                  </span>
                                </div>
                                {statusBadge}
                              </div>

                              <h4 className="text-xs font-black text-[#181432] group-hover:text-[#5B42F3] transition-colors leading-snug">
                                {tick.subject || tick.issueType}
                              </h4>

                              <p className="text-[11px] text-[#6B658B] line-clamp-2 bg-[#F8F7FD] p-2 rounded-xl border border-[#ECEEF8]/70">
                                {lastMsg}
                              </p>

                              <div className="flex items-center justify-between text-[10px] text-[#9490A8] pt-1">
                                <span>{tick.createdAt ? format(new Date(tick.createdAt), "MMM d, yyyy • HH:mm") : "Recent"}</span>
                                <span className="text-[#5B42F3] font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                  View Thread →
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB 2: DEVELOPER API MANAGEMENT */}
                {profileSubTab === "api" && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ECEEF8] space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-[#F5F4FC]">
                        <div>
                          <h4 className="text-sm font-black text-[#181432] flex items-center gap-1.5">
                            <Key className="w-4 h-4 text-[#5B42F3]" /> Developer & Reseller API
                          </h4>
                          <p className="text-[11px] text-[#7E7998] mt-0.5">Automate cloud purchases and balance queries.</p>
                        </div>
                        <Link href="/api-docs">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[11px] font-black text-[#5B42F3] border-[#5B42F3]/20 hover:bg-[#5B42F3]/10 rounded-xl"
                          >
                            <Terminal className="w-3 h-3 mr-1" /> API Docs
                          </Button>
                        </Link>
                      </div>

                      {/* Active Key Box */}
                      {apiKeysData?.activeKey?.key ? (
                        <div className="p-4 rounded-2xl bg-[#F8F7FD] border border-[#ECEEF8] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              🟢 Active API Key
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setShowApiKeySecret(!showApiKeySecret)}
                                className="text-[11px] font-bold text-[#5B42F3] hover:underline flex items-center gap-1 px-1.5 py-0.5"
                              >
                                {showApiKeySecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {showApiKeySecret ? "Hide" : "Show"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const k = apiKeysData?.activeKey?.key;
                                  if (k) {
                                    navigator.clipboard.writeText(k);
                                    setCopiedApiKey(true);
                                    toast({ title: "API Key Copied! 📋" });
                                    setTimeout(() => setCopiedApiKey(false), 2000);
                                  }
                                }}
                                className="text-[11px] font-bold text-[#181432] bg-white border border-[#ECEEF8] hover:bg-[#EDE9FE] px-2 py-1 rounded-lg flex items-center gap-1 shadow-2xs"
                              >
                                {copiedApiKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                {copiedApiKey ? "Copied" : "Copy"}
                              </button>
                            </div>
                          </div>

                          <div className="relative">
                            <input
                              readOnly
                              type={showApiKeySecret ? "text" : "password"}
                              value={apiKeysData?.activeKey?.key || ""}
                              className="w-full px-3 py-2.5 bg-white border border-[#ECEEF8] rounded-xl text-xs font-mono font-bold text-[#181432]"
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <span className="text-[#7E7998]">Header: <code className="text-[#5B42F3] font-bold">X-API-Key</code></span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => apiKeysData?.activeKey?.id && revokeKeyMutation.mutate(apiKeysData.activeKey.id)}
                                disabled={revokeKeyMutation.isPending}
                                className="text-red-500 hover:underline font-bold"
                              >
                                Revoke
                              </button>
                              <button
                                type="button"
                                onClick={() => apiKeysData?.activeKey?.id && deleteKeyMutation.mutate(apiKeysData.activeKey.id)}
                                disabled={deleteKeyMutation.isPending}
                                className="text-neutral-400 hover:text-red-500 font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 rounded-2xl bg-[#F8F7FD] border border-dashed border-[#D8DCF0] text-center space-y-2">
                          <Key className="w-8 h-8 text-[#5B42F3]/40 mx-auto" />
                          <div className="text-xs font-bold text-[#181432]">No Active API Key</div>
                          <p className="text-[11px] text-[#7E7998] max-w-xs mx-auto">
                            Generate your Developer Key to integrate automated cloud ordering with your bot or system.
                          </p>
                          <Button
                            onClick={() => generateKeyMutation.mutate()}
                            disabled={generateKeyMutation.isPending}
                            className="h-9 px-4 bg-gradient-to-r from-[#6C5CE7] to-[#5B42F3] text-white text-xs font-black rounded-xl shadow-sm mt-1"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Generate API Key
                          </Button>
                        </div>
                      )}

                      {/* API Stats Metrics */}
                      {apiKeysData?.activeKey?.key && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="p-3 rounded-2xl bg-[#F8F7FD] border border-[#ECEEF8] text-center">
                            <span className="text-[10px] font-bold uppercase text-[#9490A8] block">API Orders</span>
                            <span className="text-base font-black text-[#181432]">{apiKeysData?.activeKey?.totalOrders || 0}</span>
                          </div>
                          <div className="p-3 rounded-2xl bg-[#F8F7FD] border border-[#ECEEF8] text-center">
                            <span className="text-[10px] font-bold uppercase text-emerald-600 block">Success</span>
                            <span className="text-base font-black text-emerald-600">{apiKeysData?.activeKey?.successOrders || 0}</span>
                          </div>
                          <div className="p-3 rounded-2xl bg-[#F8F7FD] border border-[#ECEEF8] text-center">
                            <span className="text-[10px] font-bold uppercase text-purple-600 block">API Spend</span>
                            <span className="text-base font-black text-purple-600">${(((apiKeysData?.activeKey?.revenue || 0)) / 100).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {/* Action to create new key if already has one */}
                      {apiKeysData?.activeKey?.key && (
                        <Button
                          onClick={() => generateKeyMutation.mutate()}
                          disabled={generateKeyMutation.isPending}
                          className="w-full h-10 bg-white hover:bg-[#F8F7FD] border border-[#ECEEF8] text-[#5B42F3] text-xs font-black rounded-2xl shadow-2xs flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Regenerate New API Key
                        </Button>
                      )}

                      {/* Quick cURL Code */}
                      <div className="p-3.5 rounded-2xl bg-[#181432] text-white font-mono text-[11px] space-y-1.5">
                        <div className="text-[10px] text-white/50 font-sans uppercase font-bold flex items-center gap-1.5">
                          <Terminal className="w-3 h-3 text-purple-400" /> Quick cURL Test
                        </div>
                        <pre className="text-purple-300 overflow-x-auto text-[10.5px]">
{`curl -H "X-API-Key: ${apiKeysData?.activeKey?.key || "YOUR_KEY"}" \\
  https://api.youuhost.com/api/v1/products`}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUBTAB 3: TRANSACTIONS TIMELINE */}
                {profileSubTab === "transactions" && (
                  <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ECEEF8] space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F5F4FC]">
                      <div>
                        <h4 className="text-sm font-black text-[#181432] flex items-center gap-1.5">
                          <Receipt className="w-4 h-4 text-emerald-600" /> Account Transactions
                        </h4>
                        <p className="text-[11px] text-[#7E7998] mt-0.5">Click any record to inspect receipt & details.</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          refetchTransactions();
                          toast({ title: "Transactions Refreshed 🔄" });
                        }}
                        className="h-8 text-xs font-bold text-[#5B42F3]"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        onClick={() => setTxFilterType("all")}
                        className={`px-3 py-1 text-[11px] font-black rounded-xl transition-all whitespace-nowrap ${
                          txFilterType === "all"
                            ? "bg-[#5B42F3] text-white"
                            : "bg-[#F8F7FD] text-[#7E7998] hover:bg-[#EDE9FE]"
                        }`}
                      >
                        All ({transactionsList.length})
                      </button>
                      <button
                        onClick={() => setTxFilterType("deposit")}
                        className={`px-3 py-1 text-[11px] font-black rounded-xl transition-all whitespace-nowrap ${
                          txFilterType === "deposit"
                            ? "bg-emerald-600 text-white"
                            : "bg-[#F8F7FD] text-[#7E7998] hover:bg-emerald-50"
                        }`}
                      >
                        Deposits ({transactionsList.filter(t => t.type === "deposit").length})
                      </button>
                      <button
                        onClick={() => setTxFilterType("purchase")}
                        className={`px-3 py-1 text-[11px] font-black rounded-xl transition-all whitespace-nowrap ${
                          txFilterType === "purchase"
                            ? "bg-blue-600 text-white"
                            : "bg-[#F8F7FD] text-[#7E7998] hover:bg-blue-50"
                        }`}
                      >
                        Purchases ({transactionsList.filter(t => (t.type === "purchase" || t.type === "partner" || t.type === "smm") && !t.isApiOrder).length})
                      </button>
                      <button
                        onClick={() => setTxFilterType("api")}
                        className={`px-3 py-1 text-[11px] font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
                          txFilterType === "api"
                            ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs"
                            : "bg-[#F8F7FD] text-[#7E7998] hover:bg-violet-50"
                        }`}
                      >
                        <Key className="w-2.5 h-2.5" /> API ({transactionsList.filter(t => t.isApiOrder || t.type === "api").length})
                      </button>
                    </div>

                    {/* Transactions List */}
                    {isLoadingTransactions ? (
                      <div className="p-8 text-center flex flex-col items-center justify-center">
                        <LottiePayment size={100} />
                      </div>
                    ) : transactionsList.length === 0 ? (
                      <div className="p-8 text-center space-y-1 bg-[#F8F7FD] rounded-2xl border border-dashed border-[#ECEEF8]">
                        <Receipt className="w-8 h-8 text-[#9490A8]/40 mx-auto" />
                        <div className="text-xs font-bold text-[#181432]">No Transactions Yet</div>
                        <p className="text-[11px] text-[#7E7998]">Top up your wallet or purchase a service to see records here.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#F5F4FC] max-h-96 overflow-y-auto">
                        {transactionsList
                          .filter((t) => {
                            if (txFilterType === "all") return true;
                            if (txFilterType === "deposit") return t.type === "deposit";
                            if (txFilterType === "api") return t.isApiOrder || t.type === "api";
                            if (txFilterType === "purchase") return (t.type === "purchase" || t.type === "partner" || t.type === "smm") && !t.isApiOrder;
                            return true;
                          })
                          .map((tx) => {
                            const isDeposit = tx.type === "deposit";
                            const isDeduction = tx.method === "admin_deduction" || tx.subType === "admin_deduction" || (tx.status || "").toLowerCase() === "deducted";
                            const statusLower = (tx.status || "").toLowerCase();
                            const isSuccess = statusLower === "completed" || statusLower === "success" || statusLower === "approved";
                            const isPending = statusLower === "pending" || statusLower === "processing";
                            const isRefunded = statusLower === "refunded";

                            return (
                              <div
                                key={tx.id}
                                onClick={() => setSelectedTxDetail(tx)}
                                className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-[#F8F7FD] cursor-pointer rounded-2xl transition-all active:scale-[0.99]"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <TransactionBrandIcon tx={tx} />
                                  <div className="min-w-0">
                                    <div className="text-xs font-black text-[#181432] truncate flex items-center gap-1.5">
                                      <span className="truncate">{tx.title}</span>
                                      {Boolean(tx.isApiOrder || tx.type === "api") && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8.5px] font-black shadow-xs shrink-0">
                                          <Key className="w-2.5 h-2.5" /> API Key
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-[#7E7998] flex items-center gap-1 font-mono mt-0.5">
                                      <span>{new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                                      <span>•</span>
                                      <span className="truncate text-[#5B42F3] font-semibold">{tx.reference}</span>
                                      {tx.smmCategory && (
                                        <>
                                          <span>•</span>
                                          <span className="truncate text-[#7E7998] font-sans">{tx.smmCategory}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className={`text-xs font-black font-mono ${isDeposit ? "text-emerald-600" : isDeduction ? "text-rose-600" : "text-[#181432]"}`}>
                                    {tx.amountFormatted || (tx.currency === "LKR"
                                      ? (isDeposit ? `+Rs. ${tx.amountLkr}` : `-Rs. ${tx.amountLkr}`)
                                      : (isDeposit ? `+$${tx.amountUsd}` : `-$${tx.amountUsd}`))}
                                  </div>
                                  <span className={`text-[9.5px] font-black uppercase px-1.5 py-0.2 rounded-full inline-block mt-0.5 ${
                                    isDeduction
                                      ? "bg-rose-50 text-rose-600 border border-rose-200"
                                      : isSuccess
                                      ? "bg-emerald-50 text-emerald-600"
                                      : isPending
                                      ? "bg-amber-50 text-amber-600"
                                      : isRefunded
                                      ? "bg-sky-50 text-sky-600"
                                      : "bg-red-50 text-red-600"
                                  }`}>
                                    {isDeduction ? "Deducted" : tx.status}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* TRANSACTION DETAILS POPUP MODAL */}
      <Dialog open={!!selectedTxDetail} onOpenChange={(open) => !open && setSelectedTxDetail(null)}>
        <DialogContent className="max-w-[360px] sm:max-w-md w-[92vw] bg-[#F8F9FD] border border-[#ECEEF8] rounded-[28px] p-4 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto overscroll-contain pb-6">
          {selectedTxDetail && (() => {
            const isDeposit = selectedTxDetail.type === "deposit";
            const statusLower = (selectedTxDetail.status || "").toLowerCase();
            const isSuccess = statusLower === "completed" || statusLower === "success" || statusLower === "approved";
            const isPending = statusLower === "pending" || statusLower === "processing";
            const isRefunded = statusLower === "refunded";

            return (
              <div className="space-y-3.5">
                <DialogHeader className="sr-only">
                  <DialogTitle>Transaction Details</DialogTitle>
                  <DialogDescription>Overview and receipt of transaction</DialogDescription>
                </DialogHeader>

                {/* Top Action Header */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedTxDetail(null)}
                    className="w-8 h-8 rounded-full bg-white shadow-xs flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] transition-colors border border-[#ECEEF8] active:scale-95"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5 border shadow-2xs ${
                    isSuccess
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : isPending
                      ? "bg-amber-50 text-amber-600 border-amber-200"
                      : isRefunded
                      ? "bg-sky-50 text-sky-600 border-sky-200"
                      : "bg-red-50 text-red-600 border-red-200"
                  }`}>
                    {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : isPending ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {selectedTxDetail.status}
                  </span>
                </div>

                {/* Center Brand Visual & Amount */}
                <div className="text-center py-1">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-[#ECEEF8] shadow-sm mx-auto mb-2 flex items-center justify-center p-2">
                    <TransactionBrandIcon tx={selectedTxDetail} className="w-10 h-10" />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-[#181432] line-clamp-1">
                    {selectedTxDetail.title}
                  </h3>
                  <div className="text-[10.5px] font-bold text-[#7E7998] mt-0.5">
                    {selectedTxDetail.category || (isDeposit ? "Wallet Deposit" : "Purchase Order")}
                  </div>

                  {/* Currency Amount Card - Single Clean Currency Only */}
                  <div className={`mt-2.5 p-3 rounded-2xl border text-center ${
                    isDeposit
                      ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-800"
                      : "bg-[#F8F7FD] border-[#ECEEF8] text-[#181432]"
                  }`}>
                    <div className={`text-xl sm:text-2xl font-black font-mono ${isDeposit ? "text-emerald-700" : "text-[#181432]"}`}>
                      {selectedTxDetail.amountFormatted || (selectedTxDetail.currency === "LKR"
                        ? (isDeposit ? `+Rs. ${selectedTxDetail.amountLkr}` : `-Rs. ${selectedTxDetail.amountLkr}`)
                        : (isDeposit ? `+$${selectedTxDetail.amountUsd}` : `-$${selectedTxDetail.amountUsd}`))}
                    </div>
                  </div>
                </div>

                {/* Metadata Details List */}
                <div className="bg-white p-3.5 rounded-2xl border border-[#ECEEF8] space-y-2.5 text-[11.5px] shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F5F4FC]">
                    <span className="text-[#9490A8] font-bold">Reference ID:</span>
                    <button
                      onClick={() => {
                        const refText = selectedTxDetail.reference || `#YOUUHOST-${selectedTxDetail.rawId || selectedTxDetail.id}`;
                        copyToClipboard(refText, "Reference ID Copied! 📋");
                      }}
                      className="font-mono font-black text-[#5B42F3] hover:underline flex items-center gap-1 bg-[#F8F7FD] px-2 py-0.5 rounded-lg border border-[#ECEEF8] active:scale-95"
                    >
                      <span className="max-w-[170px] truncate">{selectedTxDetail.reference || `#YOUUHOST-${selectedTxDetail.rawId || selectedTxDetail.id}`}</span>
                      <Copy className="w-3 h-3 text-[#9490A8] shrink-0" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-[#F5F4FC]">
                    <span className="text-[#9490A8] font-bold">Date & Time:</span>
                    <span className="font-semibold text-[#181432]">
                      {new Date(selectedTxDetail.createdAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-[#F5F4FC]">
                    <span className="text-[#9490A8] font-bold">Payment Method:</span>
                    <span className="font-bold text-[#181432] flex items-center gap-1.5">
                      {selectedTxDetail.method === "frimi" || (selectedTxDetail.title || "").toLowerCase().includes("frimi") ? (
                        <span className="text-[#582C83] flex items-center gap-1.5 font-bold">
                          <img src="/frimi.png" alt="FriMi" className="w-4 h-4 object-contain rounded-full shadow-2xs" />
                          <span>FriMi</span>
                        </span>
                      ) : selectedTxDetail.method === "ipay" || (selectedTxDetail.title || "").toLowerCase().includes("ipay") ? (
                        <span className="text-[#E31B23] flex items-center gap-1.5 font-bold">
                          <img src="/ipay.png" alt="iPay" className="w-4 h-4 object-contain rounded-full shadow-2xs" />
                          <span>iPay</span>
                        </span>
                      ) : selectedTxDetail.method === "qplus" || (selectedTxDetail.title || "").toLowerCase().includes("q+") ? (
                        <span className="text-[#0054A6] flex items-center gap-1.5 font-bold">
                          <img src="/qplus.png" alt="Q+ Payment" className="w-4 h-4 object-contain rounded-full shadow-2xs" />
                          <span>Q+ Payment</span>
                        </span>
                      ) : selectedTxDetail.method === "google_pay" || (selectedTxDetail.title || "").toLowerCase().includes("google") ? (
                        <span className="text-slate-700 flex items-center gap-1.5 font-bold">
                          <GoogleIcon className="w-4 h-4 shrink-0" />
                          <span>Google Pay</span>
                        </span>
                      ) : selectedTxDetail.method === "mastercard" || (selectedTxDetail.title || "").toLowerCase().includes("master") ? (
                        <span className="text-[#181432] flex items-center gap-1.5 font-bold">
                          <svg className="h-3.5 w-auto shrink-0" viewBox="0 0 28 18" fill="none">
                            <circle cx="9" cy="9" r="9" fill="#EB001B"/>
                            <circle cx="19" cy="9" r="9" fill="#F79E1B"/>
                            <path d="M14 2.82A8.96 8.96 0 0 0 9 0a8.96 8.96 0 0 0-5 1.58A8.97 8.97 0 0 1 14 9a8.97 8.97 0 0 1-10 7.42A8.96 8.96 0 0 0 9 18a8.96 8.96 0 0 0 5-2.82A8.96 8.96 0 0 0 19 18a8.96 8.96 0 0 0 5-1.58A8.97 8.97 0 0 1 14 9a8.97 8.97 0 0 1 10-7.42A8.96 8.96 0 0 0 19 0a8.96 8.96 0 0 0-5 2.82z" fill="#FF5F00"/>
                          </svg>
                          <span>Mastercard</span>
                        </span>
                      ) : selectedTxDetail.method === "visa" || (selectedTxDetail.title || "").toLowerCase().includes("visa") ? (
                        <span className="text-[#1A1F71] flex items-center gap-1.5 font-bold">
                          <svg className="h-3 w-auto shrink-0" viewBox="0 0 52 17" fill="none">
                            <path d="M19.16 0.5L12.55 15.5H8.22L5.01 3.5C4.82 2.76 4.63 2.48 4.02 2.14C3.04 1.62 1.43 1.13 0 0.82L0.1 0.5H7.02C7.91 0.5 8.7 1.09 8.88 2.11L10.58 11.16L14.77 0.5H19.16ZM35.98 10.5C36 6.51 30.45 6.29 30.49 4.49C30.5 3.94 31.02 3.36 32.18 3.2C32.76 3.13 34.33 3.07 36.03 3.86L36.72 0.65C35.77 0.31 34.56 0 33.05 0C28.98 0 26.11 2.16 26.09 5.25C26.05 7.54 28.1 8.82 29.66 9.58C31.27 10.36 31.81 10.86 31.8 11.56C31.79 12.63 30.51 13.1 29.33 13.12C27.28 13.15 26.08 12.57 25.13 12.13L24.41 15.48C25.37 15.92 27.15 16.3 28.99 16.32C33.32 16.32 36.17 14.18 35.98 10.5ZM46.54 15.5H50.36L47.01 0.5H43.46C42.66 0.5 42 0.96 41.7 1.68L35.6 15.5H39.95L40.82 13.1H46.12L46.54 15.5ZM41.97 9.98L44.18 3.92L45.45 9.98H41.97ZM25.04 0.5L21.64 15.5H17.47L20.87 0.5H25.04Z" fill="#1A1F71"/>
                          </svg>
                          <span>Visa</span>
                        </span>
                      ) : selectedTxDetail.method === "card_payment" || selectedTxDetail.method === "payhere" || selectedTxDetail.method === "card" ? (
                        <span className="text-blue-600 flex items-center gap-1.5 font-bold">
                          <DualCardIcon />
                          <span>Card Payment</span>
                        </span>
                      ) : selectedTxDetail.method === "binance_pay" || selectedTxDetail.method === "binance" ? (
                        <span className="text-amber-600 flex items-center gap-1.5 font-bold">
                          <SiBinance className="w-3.5 h-3.5 text-[#E5A91E]" />
                          <span>Binance Pay</span>
                        </span>
                      ) : selectedTxDetail.method === "cryptomus" || selectedTxDetail.method === "crypto" ? (
                        <span className="text-purple-600 flex items-center gap-1.5 font-bold">
                          <CryptomusLogo className="w-3.5 h-3.5" />
                          <span>Cryptomus</span>
                        </span>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1.5 font-bold">
                          <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Wallet Balance</span>
                        </span>
                      )}
                    </span>
                  </div>

                  {selectedTxDetail.details && (
                    <div className="pt-0.5">
                      <span className="text-[#9490A8] font-bold block mb-1">Details:</span>
                      <p className="text-[#181432] bg-[#F8F7FD] p-2 rounded-xl border border-[#ECEEF8] leading-relaxed text-[11px] break-words">
                        {selectedTxDetail.details}
                      </p>
                    </div>
                  )}

                  {/* SMM Target Link, Start Count, Remains & Quantity */}
                  {selectedTxDetail.type === "smm" && (
                    <div className="pt-0.5 space-y-1.5">
                      <span className="text-[#9490A8] font-bold block">Boost Order Details:</span>
                      <div className="bg-[#F8F7FD] p-2.5 rounded-2xl border border-[#ECEEF8] space-y-2 text-[11px]">
                        {selectedTxDetail.smmLink && (
                          <div>
                            <div className="text-[9.5px] text-[#9490A8] font-bold uppercase">Target Link</div>
                            <div className="font-mono text-[#5B42F3] break-all select-all font-semibold mt-0.5 text-[10.5px]">
                              {selectedTxDetail.smmLink}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[#ECEEF8]">
                          <div className="bg-white p-1.5 rounded-xl border border-[#ECEEF8] text-center">
                            <span className="text-[9px] font-bold text-[#9490A8] block uppercase">Quantity</span>
                            <span className="font-black text-[#181432] text-xs">{selectedTxDetail.smmQuantity || 0}</span>
                          </div>
                          <div className="bg-white p-1.5 rounded-xl border border-[#ECEEF8] text-center">
                            <span className="text-[9px] font-bold text-sky-600 block uppercase">Start Count</span>
                            <span className="font-black text-sky-600 text-xs">{selectedTxDetail.startCount || "0"}</span>
                          </div>
                          <div className="bg-white p-1.5 rounded-xl border border-[#ECEEF8] text-center">
                            <span className="text-[9px] font-bold text-amber-600 block uppercase">Remains</span>
                            <span className="font-black text-amber-600 text-xs">{selectedTxDetail.remains || "0"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Delivered Credentials / License Key Box */}
                  {selectedTxDetail.deliveredContent && (
                    <div className="pt-0.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-emerald-700 font-extrabold flex items-center gap-1 text-[11px]">
                          <ShopBagIcon className="w-3.5 h-3.5 text-emerald-600" /> Delivered Account / License:
                        </span>
                        <button
                          onClick={() => {
                            copyToClipboard(formatDeliveredCredentialsForCopy(selectedTxDetail.deliveredContent, 1, selectedTxDetail.description || ""), "Account Info Copied! 📋");
                          }}
                          className="text-[10px] font-bold text-[#5B42F3] hover:underline flex items-center gap-1 bg-[#F8F7FD] px-2 py-0.5 rounded-lg border border-[#ECEEF8] active:scale-95"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                      <pre className="p-2.5 bg-[#181432] text-emerald-400 font-mono text-[10px] rounded-xl max-h-28 overflow-y-auto whitespace-pre-wrap select-all leading-relaxed break-all w-full max-w-full">
                        {selectedTxDetail.deliveredContent}
                      </pre>
                    </div>
                  )}

                  {/* Refund Notice */}
                  {isRefunded && (
                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>This order was refunded to your wallet balance.</span>
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <Button
                  onClick={() => setSelectedTxDetail(null)}
                  className="w-full h-10 bg-white hover:bg-[#F8F7FD] border border-[#ECEEF8] text-[#181432] text-xs font-black rounded-2xl shadow-2xs transition-all active:scale-95"
                >
                  Close Receipt
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* PRODUCT DETAIL MODAL */}
      <Dialog open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <DialogContent hideClose={true} className="max-w-md w-full bg-[#F8F9FD] border border-[#ECEEF8] rounded-[32px] p-6 shadow-2xl overflow-hidden">
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

              {(() => {
                const liveStockCount = typeof detailProduct.stockCount === 'number' 
                  ? detailProduct.stockCount 
                  : (products.find(p => p.id === detailProduct.id)?.stockCount ?? 0);

                return (
                  <>
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
                          {formatProductPrice(detailProduct, liveStockCount <= 0 ? 1 : quantity)}
                        </span>
                        <span className="text-[9px] text-[#7E7998] block">total price</span>
                      </div>
                    </div>

                    {/* Stock Status & Rating pill */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {liveStockCount > 0 ? (
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>In Stock: {liveStockCount} available</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-full shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>⚠️ Out of Stock</span>
                        </div>
                      )}

                      {(() => {
                        const prodStats = getItemStats(detailProduct, "product");
                        return (
                          <>
                            <div className="flex items-center gap-1 text-[11px] font-black text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {prodStats.rating}
                            </div>
                            <span className="text-[11px] text-[#7E7998] font-medium">
                              ({prodStats.sold.toLocaleString()} sold • {prodStats.reviewsCount} reviews)
                            </span>
                          </>
                        );
                      })()}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-[#6B658B] leading-relaxed mb-5">
                      {detailProduct.description ||
                        "Fully automated verified cloud service with instant credential delivery, active quotas, and continuous uptime monitoring."}
                    </p>

                    {/* Quantity Stepper & Price Summary */}
                    <div className="flex items-center justify-between bg-[#F8F7FD] rounded-2xl p-3 border border-[#ECEEF8] mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#181432]">Quantity</span>
                        <div className="flex items-center bg-white rounded-full px-2.5 py-1 shadow-xs border border-[#ECEEF8] gap-2.5">
                          <button
                            onClick={() => {
                              setQuantity((q) => Math.max(1, q - 1));
                              setAppliedCoupon(null);
                            }}
                            disabled={quantity <= 1 || liveStockCount <= 0}
                            className="w-5 h-5 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] disabled:opacity-30 disabled:cursor-not-allowed font-bold transition-all"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black text-[#181432] min-w-[14px] text-center">
                            {liveStockCount <= 0 ? 0 : quantity}
                          </span>
                          <button
                            onClick={() => {
                              if (liveStockCount <= 0) {
                                toast({
                                  title: "Out of Stock",
                                  description: "This product is currently out of stock.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              if (quantity >= liveStockCount) {
                                toast({
                                  title: "Max Stock Reached",
                                  description: `Only ${liveStockCount} ${liveStockCount === 1 ? 'unit is' : 'units are'} currently available in stock.`,
                                });
                                return;
                              }
                              setQuantity((q) => q + 1);
                              setAppliedCoupon(null);
                            }}
                            disabled={quantity >= liveStockCount || liveStockCount <= 0}
                            className="w-5 h-5 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] disabled:opacity-30 disabled:cursor-not-allowed font-bold transition-all"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-[#7E7998] mr-1.5">Total:</span>
                        {appliedCoupon ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="text-[11px] line-through text-slate-400 font-semibold">
                              {formatProductPrice(detailProduct, quantity)}
                            </span>
                            <span className="text-sm font-black text-emerald-600">
                              {formatCouponPrice(appliedCoupon)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-black text-[#181432]">
                            {formatProductPrice(detailProduct, liveStockCount <= 0 ? 1 : quantity)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Promo / Coupon Code Section */}
                    <div className="bg-[#FAF9FE] rounded-2xl p-2.5 border border-[#ECEEF8] mb-3">
                      {!appliedCoupon ? (
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Tag className="w-3.5 h-3.5 text-[#6C5CE7] absolute left-2.5 top-2.5" />
                            <input
                              type="text"
                              placeholder="Add Coupon Code..."
                              value={couponCodeInput}
                              onChange={(e) => setCouponCodeInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleApplyCoupon();
                                }
                              }}
                              className="w-full bg-white border border-[#ECEEF8] rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono uppercase text-[#181432] placeholder:text-slate-400 placeholder:normal-case focus:outline-none focus:border-[#6C5CE7]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            disabled={isValidatingCoupon || !couponCodeInput.trim() || liveStockCount <= 0}
                            className="px-3 py-1.5 bg-[#6C5CE7] hover:bg-[#5B42F3] text-white rounded-xl text-xs font-bold shrink-0 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            {isValidatingCoupon ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Apply"
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <span className="font-mono font-bold text-emerald-800">{appliedCoupon.code}</span>
                              <span className="text-emerald-700 font-semibold ml-1.5">
                                (-{formatCouponDiscount(appliedCoupon)})
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            className="text-xs font-bold text-emerald-700 hover:text-red-600 underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Terms & Conditions Agreement Rule */}
                    <div className="flex items-center gap-2 mb-3.5 px-1">
                      <input
                        type="checkbox"
                        id="agreeTermsModal"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="w-4 h-4 rounded text-[#6C5CE7] focus:ring-[#6C5CE7] border-[#ECEEF8] cursor-pointer"
                      />
                      <label htmlFor="agreeTermsModal" className="text-[11px] font-semibold text-[#7E7998] cursor-pointer select-none">
                        I agree to the{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setTermsModalProduct(detailProduct?.name || "Cloud Account");
                            setTermsModalCustomText((detailProduct as any)?.termsAndConditions || null);
                            setIsTermsModalOpen(true);
                          }}
                          className="text-[#6C5CE7] font-bold underline hover:text-[#5B42F3] cursor-pointer"
                        >
                          Terms of Service
                        </button>{" "}
                        & Instant Delivery
                      </label>
                    </div>

                    {/* Purchase Now / Sign In Button */}
                    <div className="mb-4">
                      {!isCustomerLoggedIn ? (
                        <button
                          onClick={() => setIsAuthModalOpen(true)}
                          className="w-full py-3.5 bg-gradient-to-r from-[#FF5E62] via-[#D92078] to-[#5B42F3] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-[#5B42F3]/25 hover:opacity-95 active:scale-98 transition-all"
                        >
                          <UserIcon className="w-4 h-4 text-pink-200" /> Sign In to Purchase
                        </button>
                      ) : (
                        <button
                          onClick={handlePurchase}
                          disabled={!agreedToTerms || isPurchasing || liveStockCount <= 0}
                          className="w-full py-3.5 bg-gradient-to-r from-[#FF5E62] via-[#D92078] to-[#6C5CE7] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-[#6C5CE7]/30 hover:opacity-95 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
                        >
                          {liveStockCount <= 0 ? (
                            <span>⚠️ Out of Stock</span>
                          ) : isPurchasing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Processing Order...</span>
                            </>
                          ) : (
                            <>
                              <ShopBagIcon className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                              <span>
                                Purchase Now • {appliedCoupon ? formatCouponPrice(appliedCoupon) : formatProductPrice(detailProduct, quantity)}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Instant Delivery Footer Badge */}
                    <div className="bg-[#F3EFFE] rounded-2xl p-2.5 flex items-center justify-between border border-[#E9E4FC]">
                      <div className="flex items-center gap-2">
                        <ShopBagIcon className="w-4 h-4 text-[#5B42F3]" />
                        <span className="text-[11px] font-bold text-[#5B42F3]">Instant Delivery</span>
                      </div>
                      <span className="text-[10px] text-[#7E7998] font-semibold inline-flex items-center gap-1">
                        0-2 Mins <ShopBagIcon className="w-2.5 h-2.5 text-emerald-600" />
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DYNAMIC SMM SERVICE ORDERING DIALOG */}
      <Dialog
        open={!!detailSmmService}
        onOpenChange={(open) => {
          if (!open) setDetailSmmService(null);
        }}
      >
        <DialogContent className="max-w-md w-full bg-white border border-[#ECEEF8] rounded-[32px] p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          {detailSmmService && (
            <div>
              {/* Header: Platform & Close Button */}
              <div className="flex items-center justify-between mb-3">
                {(() => {
                  const conf = getSmmPlatformConfig(detailSmmService.category, detailSmmService.name);
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full ${conf.bgBadge}`}>
                        {conf.tag}
                      </span>
                      <span className="text-[10px] font-bold text-[#5B42F3] bg-[#F5F4FC] px-2.5 py-0.5 rounded-full font-mono">
                        #YH-{detailSmmService.id}
                      </span>
                    </div>
                  );
                })()}
                <button
                  onClick={() => setDetailSmmService(null)}
                  className="w-8 h-8 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#7E7998] hover:bg-[#EDE9FE] hover:text-[#5B42F3] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Centered Organic Brand Blob */}
              {(() => {
                const conf = getSmmPlatformConfig(detailSmmService.category, detailSmmService.name);
                return (
                  <div className="relative my-2 py-2 flex items-center justify-center">
                    <div
                      className={`w-24 h-24 rounded-full bg-gradient-to-br ${conf.blobColor} absolute blur-md`}
                    />
                    <div className="relative z-10 drop-shadow-md">
                      {conf.icon}
                    </div>
                  </div>
                );
              })()}

              {/* Title & Limits */}
              <div className="text-center mb-4">
                <h3 className="text-base font-black text-[#181432] leading-snug">
                  {detailSmmService.name}
                </h3>
                <div className="flex items-center justify-center gap-3 text-[11px] text-[#7E7998] mt-1 font-semibold">
                  <span>Min: {detailSmmService.min?.toLocaleString()}</span>
                  <span>•</span>
                  <span>Max: {detailSmmService.max?.toLocaleString()}</span>
                  <span>•</span>
                  <span className="text-[#5B42F3] font-bold">
                    {formatSmmRate(detailSmmService.customRate)}
                  </span>
                </div>
              </div>

              {/* Step 1: Target Link Input */}
              <div className="space-y-1.5 mb-4">
                <label className="text-[11px] font-black text-[#181432] uppercase tracking-wider flex items-center justify-between">
                  <span>1. Target Link / Username / Post</span>
                  <span className="text-[9px] text-red-500 font-bold">*Required</span>
                </label>
                <div className="relative">
                  <ExternalLink className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E7998]" />
                  <input
                    type="url"
                    value={smmTargetLink}
                    onChange={(e) => setSmmTargetLink(e.target.value)}
                    placeholder={
                      (detailSmmService.category || "").toLowerCase().includes("tiktok")
                        ? "https://www.tiktok.com/@username/video/..."
                        : (detailSmmService.category || "").toLowerCase().includes("instagram")
                        ? "https://www.instagram.com/p/... or @profile"
                        : (detailSmmService.category || "").toLowerCase().includes("telegram")
                        ? "https://t.me/your_channel_or_group"
                        : "https://facebook.com/..."
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#F8F7FD] border border-[#ECEEF8] rounded-2xl text-xs font-semibold text-[#181432] focus:outline-none focus:border-[#5B42F3] focus:bg-white transition-all placeholder:text-[#9490A8]"
                  />
                </div>
              </div>

              {/* Step 2: Quantity Stepper & Quick Preset Pills */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-[#181432] uppercase tracking-wider">
                    2. Quantity ({smmOrderQty.toLocaleString()} units)
                  </label>
                  <span className="text-[10px] text-[#7E7998]">
                    Min: {detailSmmService.min?.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSmmOrderQty((q) =>
                        Math.max(detailSmmService.min || 100, q - 500)
                      )
                    }
                    className="w-10 h-10 rounded-2xl bg-[#F5F4FC] hover:bg-[#EDE9FE] text-[#5B42F3] flex items-center justify-center font-bold text-lg active:scale-95 transition-all"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={detailSmmService.min || 100}
                    max={detailSmmService.max || 100000}
                    step={100}
                    value={smmOrderQty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setSmmOrderQty(val);
                    }}
                    className="flex-1 py-2.5 px-3 text-center bg-[#F8F7FD] border border-[#ECEEF8] rounded-2xl text-sm font-black text-[#181432] focus:outline-none focus:border-[#5B42F3]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSmmOrderQty((q) =>
                        Math.min(detailSmmService.max || 100000, q + 500)
                      )
                    }
                    className="w-10 h-10 rounded-2xl bg-[#F5F4FC] hover:bg-[#EDE9FE] text-[#5B42F3] flex items-center justify-center font-bold text-lg active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>

                {/* Quick Selection Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: "Min", val: detailSmmService.min || 100 },
                    { label: "+500", val: smmOrderQty + 500 },
                    { label: "+1k", val: smmOrderQty + 1000 },
                    { label: "+5k", val: smmOrderQty + 5000 },
                    { label: "+10k", val: smmOrderQty + 10000 },
                    { label: "Max", val: detailSmmService.max || 10000 },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const targetVal = Math.min(
                          detailSmmService.max || 100000,
                          Math.max(detailSmmService.min || 100, preset.val)
                        );
                        setSmmOrderQty(targetVal);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-[#F5F4FC] hover:bg-[#EDE9FE] text-[10px] font-bold text-[#5B42F3] transition-colors border border-[#ECEEF8]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Real-Time Dynamic Price Calculator */}
              {(() => {
                const totalCents = Math.round(
                  (detailSmmService.customRate / 1000) * (smmOrderQty || 0)
                );
                const userBalCents = user?.balance || 0;
                const hasSufficientBal = userBalCents >= totalCents;

                return (
                  <div className="bg-gradient-to-br from-[#120B2E] to-[#2E1A68] rounded-3xl p-4 text-white mb-4 relative overflow-hidden shadow-lg shadow-[#2E1A68]/20">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-purple-200/80 font-semibold">Total Order Cost:</span>
                      <span className="text-[10px] text-cyan-300 font-mono">
                        Rate: {formatSmmRate(detailSmmService.customRate)}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-2xl font-black text-white">
                        {calculateSmmPriceFormatted(detailSmmService.customRate, smmOrderQty)}
                      </span>
                      <span className="text-xs font-bold text-purple-200/90">
                        {selectedCurrency === "LKR"
                          ? `≈ $${(totalCents / 100).toFixed(2)} USD`
                          : `≈ Rs. ${Math.round((totalCents / 100) * lkrRate).toLocaleString()} LKR`}
                      </span>
                    </div>

                    {/* Balance Status Bar */}
                    <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-purple-300" />
                        <span className="text-purple-200">
                          Balance: {formatBalanceInCurrentCurrency(userBalCents)}
                        </span>
                      </div>

                      {hasSufficientBal ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Sufficient
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          ⚠️ Top-up needed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Step 4: Buy / Sign In Button */}
              <button
                onClick={handleSmmPurchase}
                disabled={isSmmPurchasing}
                className="w-full py-3.5 bg-gradient-to-r from-[#5B42F3] via-[#8E54E9] to-[#00C9FF] text-white rounded-full text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-[#5B42F3]/30 hover:opacity-95 active:scale-98 transition-all disabled:opacity-50"
              >
                {isSmmPurchasing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !isCustomerLoggedIn ? (
                  <>
                    <UserIcon className="w-4 h-4" /> Sign In to Order Boost
                  </>
                ) : (
                  <>
                    <ShopBagIcon className="w-4 h-4" /> Place Order Now 🚀
                  </>
                )}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SANDROMANIA PARTNER PRODUCT PURCHASE DIALOG (MATCHED TO MODERN PRODUCT UI) */}
      <Dialog
        open={!!detailSandromaniaProduct}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSandromaniaProduct(null);
            setAppliedCoupon(null);
          }
        }}
      >
        <DialogContent hideClose={true} className="max-w-md w-full bg-[#F8F9FD] border border-[#ECEEF8] rounded-[32px] p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto z-50">
          {detailSandromaniaProduct && (() => {
            const cleanTitle = cleanSandromaniaText(detailSandromaniaProduct.title);
            const cleanCat = cleanSandromaniaText(detailSandromaniaProduct.category);
            const availableStock = detailSandromaniaProduct.stock || detailSandromaniaProduct.stockCount || 99;
            const itemLkr = detailSandromaniaProduct.sellingPriceLkr ? Number(detailSandromaniaProduct.sellingPriceLkr) : Math.round(((detailSandromaniaProduct.sellingPriceUsd || 0) / 100) * lkrRate);
            const totalLkr = itemLkr * sandromaniaOrderQty;
            const totalCents = (detailSandromaniaProduct.sellingPriceUsd || 0) * sandromaniaOrderQty;
            const userBalCents = user?.balance || 0;
            const userBalLkr = (user as any)?.balanceLkr != null && (user as any).balanceLkr >= 0
              ? Number((user as any).balanceLkr)
              : Math.round((userBalCents / 100) * lkrRate);
            const hasEnough = selectedCurrency === "LKR"
              ? (userBalLkr >= totalLkr || userBalCents >= totalCents)
              : (userBalCents >= totalCents || userBalLkr >= totalLkr);
            const isFav = favorites.includes(detailSandromaniaProduct.id);

            return (
              <div>
                {/* Top Action Header: Back Arrow & Favorite Heart */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => {
                      setDetailSandromaniaProduct(null);
                      setAppliedCoupon(null);
                    }}
                    className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] transition-colors border border-[#ECEEF8]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => toggleFavorite(detailSandromaniaProduct.id)}
                    className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#7E7998] hover:text-red-500 transition-colors border border-[#ECEEF8]"
                  >
                    <Heart
                      className={`w-4 h-4 ${isFav ? "fill-red-500 text-red-500" : ""}`}
                    />
                  </button>
                </div>

                {/* Centered Visual with Brand Icon & Sleek Organic Blob */}
                <div className="relative py-4 flex items-center justify-center mb-4">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#FFE4E8] to-[#EDE8FE] absolute blur-sm" />
                  <div className="relative z-10 drop-shadow-sm">
                    <BrandIcon name={cleanTitle} type={cleanCat} className="w-14 h-14" />
                  </div>
                </div>

                {/* Title, Badge, Rating & Price */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-lg font-black text-[#181432] leading-tight">{cleanTitle}</h3>
                    <span className="text-[11px] font-bold text-[#6B658B] block mt-0.5">
                      {cleanCat || "Digital Goods"} · Instant Auto-Delivery
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#181432]">
                      {formatSandromaniaPrice(detailSandromaniaProduct, sandromaniaOrderQty)}
                    </span>
                    <span className="text-[9px] text-[#7E7998] block">total price</span>
                  </div>
                </div>

                {/* Stock Status & Rating Pill */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>In Stock: {availableStock > 0 ? `${availableStock} available` : "Instant Keys Ready"}</span>
                  </div>

                  {(() => {
                    const sandroStats = getItemStats(detailSandromaniaProduct, "sandromania");
                    return (
                      <>
                        <div className="flex items-center gap-1 text-[11px] font-black text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {sandroStats.rating}
                        </div>
                        <span className="text-[11px] text-[#7E7998] font-medium">
                          ({sandroStats.sold.toLocaleString()} sold • {sandroStats.reviewsCount} reviews)
                        </span>
                      </>
                    );
                  })()}
                </div>

                {/* Description */}
                <p className="text-xs text-[#6B658B] leading-relaxed mb-5">
                  {detailSandromaniaProduct.description ||
                    "Instant CDK license key generated automatically upon purchase. 100% genuine digital product with full activation guarantee."}
                </p>

                {/* Quantity Stepper & Price Summary */}
                <div className="flex items-center justify-between bg-[#F8F7FD] rounded-2xl p-3 border border-[#ECEEF8] mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#181432]">Quantity</span>
                    <div className="flex items-center bg-white rounded-full px-2.5 py-1 shadow-xs border border-[#ECEEF8] gap-2.5">
                      <button
                        onClick={() => {
                          setSandromaniaOrderQty((q) => Math.max(1, q - 1));
                          setAppliedCoupon(null);
                        }}
                        disabled={sandromaniaOrderQty <= 1}
                        className="w-5 h-5 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] disabled:opacity-30 disabled:cursor-not-allowed font-bold transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black text-[#181432] min-w-[14px] text-center">
                        {sandromaniaOrderQty}
                      </span>
                      <button
                        onClick={() => {
                          setSandromaniaOrderQty((q) => q + 1);
                          setAppliedCoupon(null);
                        }}
                        className="w-5 h-5 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] disabled:opacity-30 disabled:cursor-not-allowed font-bold transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-[#7E7998] mr-1.5">Total:</span>
                    <span className="text-sm font-black text-[#181432]">
                      {formatSandromaniaPrice(detailSandromaniaProduct, sandromaniaOrderQty)}
                    </span>
                  </div>
                </div>

                {/* Instant Auto-Delivery Note */}
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 mb-4 flex items-start gap-2.5 shadow-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-emerald-950">
                    <span className="font-extrabold block">Instant Auto-Fulfillment</span>
                    Your license key / digital CDK will be generated immediately and stored in your <b>Orders</b> tab with 1-click copy.
                  </div>
                </div>

                {/* Balance Check Notice */}
                {!hasEnough && isCustomerLoggedIn && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold block">⚠️ Insufficient Wallet Balance</span>
                      <span className="text-[11px] text-amber-800">
                        Balance: {formatBalanceInCurrentCurrency(userBalCents)} · Needed: {formatSandromaniaPrice(detailSandromaniaProduct, sandromaniaOrderQty)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailSandromaniaProduct(null);
                        setActiveTab("wallet");
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[11px] shadow-sm transition-all"
                    >
                      Top Up
                    </button>
                  </div>
                )}

                {/* Purchase Button */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSandromaniaPurchase}
                    disabled={isSandromaniaPurchasing}
                    className="flex-1 py-3.5 bg-gradient-to-r from-[#6C5CE7] to-[#FF5E62] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-[#6C5CE7]/20 hover:opacity-95 active:scale-98 transition-all disabled:opacity-50"
                  >
                    {isSandromaniaPurchasing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : !isCustomerLoggedIn ? (
                      <>
                        <UserIcon className="w-4 h-4" /> Sign In to Buy
                      </>
                    ) : (
                      <>
                        <ShopBagIcon className="w-4 h-4" /> Buy Now (Auto Delivery) 🚀
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* CSxStore Product Details & Purchase Dialog */}
      <Dialog
        open={!!detailCssxProduct}
        onOpenChange={(open) => {
          if (!open) {
            setDetailCssxProduct(null);
            setAppliedCoupon(null);
          }
        }}
      >
        <DialogContent hideClose={true} className="max-w-md w-full bg-[#F8F9FD] border border-[#ECEEF8] rounded-[32px] p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto z-50">
          {detailCssxProduct && (() => {
            const cleanTitle = detailCssxProduct.title || "Digital Product";
            const cleanCat = detailCssxProduct.category || "General";
            const availableStock = detailCssxProduct.stock ?? 99;
            const itemLkr = detailCssxProduct.sellingPriceLkr ? Number(detailCssxProduct.sellingPriceLkr) : Math.round(((detailCssxProduct.sellingPriceUsd || 0) / 100) * lkrRate);
            const totalLkr = itemLkr * cssxOrderQty;
            const totalCents = (detailCssxProduct.sellingPriceUsd || 0) * cssxOrderQty;
            const userBalCents = user?.balance || 0;
            const userBalLkr = (user as any)?.balanceLkr != null && (user as any).balanceLkr >= 0
              ? Number((user as any).balanceLkr)
              : Math.round((userBalCents / 100) * lkrRate);
            const hasEnough = selectedCurrency === "LKR"
              ? (userBalLkr >= totalLkr || userBalCents >= totalCents)
              : (userBalCents >= totalCents || userBalLkr >= totalLkr);
            const isFav = favorites.includes(`cssx_${detailCssxProduct.id}`);

            return (
              <div>
                {/* Top Action Header: Back Arrow & Favorite Heart */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => {
                      setDetailCssxProduct(null);
                      setAppliedCoupon(null);
                    }}
                    className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] transition-colors border border-[#ECEEF8]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => toggleFavorite(`cssx_${detailCssxProduct.id}`)}
                    className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#7E7998] hover:text-red-500 transition-colors border border-[#ECEEF8]"
                  >
                    <Heart
                      className={`w-4 h-4 ${isFav ? "fill-red-500 text-red-500" : ""}`}
                    />
                  </button>
                </div>

                {/* Centered Visual with Brand Icon & Sleek Organic Blob */}
                <div className="relative py-4 flex items-center justify-center mb-4">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#E9D5FF] to-[#DBEAFE] absolute blur-sm" />
                  <div className="relative z-10 drop-shadow-sm">
                    <BrandIcon name={cleanTitle} type={cleanCat} className="w-14 h-14" />
                  </div>
                </div>

                {/* Title, Badge, Rating & Price */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-lg font-black text-[#181432] leading-tight">{cleanTitle}</h3>
                    <span className="text-[11px] font-bold text-[#6B658B] block mt-0.5">
                      {cleanCat || "Digital Goods"} · Instant CDK Auto-Delivery
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#181432]">
                      {formatCssxPrice(detailCssxProduct, cssxOrderQty)}
                    </span>
                    <span className="text-[9px] text-[#7E7998] block">total price</span>
                  </div>
                </div>

                {/* Stock Status & Rating Pill */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>In Stock: {availableStock > 0 ? `${availableStock} available` : "Instant Keys Ready"}</span>
                  </div>

                  {(() => {
                    const stats = getItemStats(detailCssxProduct, "sandromania");
                    return (
                      <>
                        <div className="flex items-center gap-1 text-[11px] font-black text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {stats.rating}
                        </div>
                        <span className="text-[11px] text-[#7E7998] font-medium">
                          ({stats.sold.toLocaleString()} sold • {stats.reviewsCount} reviews)
                        </span>
                      </>
                    );
                  })()}
                </div>

                {/* Description */}
                <p className="text-xs text-[#6B658B] leading-relaxed mb-5">
                  {detailCssxProduct.description ||
                    "Instant CDK license key / account generated automatically upon purchase. 100% genuine digital product with full activation guarantee."}
                </p>

                {/* Quantity Stepper & Price Summary */}
                <div className="flex items-center justify-between bg-[#F8F7FD] rounded-2xl p-3 border border-[#ECEEF8] mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#181432]">Quantity</span>
                    <div className="flex items-center bg-white rounded-full px-2.5 py-1 shadow-xs border border-[#ECEEF8] gap-2.5">
                      <button
                        onClick={() => {
                          setCssxOrderQty((q) => Math.max(1, q - 1));
                          setAppliedCoupon(null);
                        }}
                        disabled={cssxOrderQty <= 1}
                        className="w-5 h-5 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] disabled:opacity-30 disabled:cursor-not-allowed font-bold transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black text-[#181432] min-w-[14px] text-center">
                        {cssxOrderQty}
                      </span>
                      <button
                        onClick={() => {
                          setCssxOrderQty((q) => q + 1);
                          setAppliedCoupon(null);
                        }}
                        className="w-5 h-5 rounded-full bg-[#F5F4FC] flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] disabled:opacity-30 disabled:cursor-not-allowed font-bold transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-[#7E7998] mr-1.5">Total:</span>
                    <span className="text-sm font-black text-[#181432]">
                      {formatCssxPrice(detailCssxProduct, cssxOrderQty)}
                    </span>
                  </div>
                </div>

                {/* Instant Auto-Delivery Note */}
                <div className="bg-purple-50/80 border border-purple-200/80 rounded-2xl p-3 mb-4 flex items-start gap-2.5 shadow-xs">
                  <CheckCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-purple-950">
                    <span className="font-extrabold block">Instant Auto-Fulfillment</span>
                    Your license key / digital CDK will be generated immediately and stored in your <b>Orders</b> tab with 1-click copy.
                  </div>
                </div>

                {/* Balance Check Notice */}
                {!hasEnough && isCustomerLoggedIn && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold block">⚠️ Insufficient Wallet Balance</span>
                      <span className="text-[11px] text-amber-800">
                        Balance: {formatBalanceInCurrentCurrency(userBalCents)} · Needed: {formatCssxPrice(detailCssxProduct, cssxOrderQty)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailCssxProduct(null);
                        setActiveTab("wallet");
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[11px] shadow-sm transition-all"
                    >
                      Top Up
                    </button>
                  </div>
                )}

                {/* Purchase Button */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCssxPurchase}
                    disabled={isCssxPurchasing}
                    className="flex-1 py-3.5 bg-gradient-to-r from-[#8E54E9] via-[#5B42F3] to-[#00C9FF] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-[#5B42F3]/20 hover:opacity-95 active:scale-98 transition-all disabled:opacity-50"
                  >
                    {isCssxPurchasing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : !isCustomerLoggedIn ? (
                      <>
                        <UserIcon className="w-4 h-4" /> Sign In to Buy
                      </>
                    ) : (
                      <>
                        <ShopBagIcon className="w-4 h-4" /> Buy Now (Auto Delivery) 🚀
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}
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
            {/* Custom Modern Solid Rounded House Home Icon */}
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M12 2.3c-.62 0-1.22.25-1.66.7L3.6 9.74C2.58 10.76 2 12.14 2 13.58V19c0 1.66 1.34 3 3 3h4c.55 0 1-.45 1-1v-4c0-.83.67-1.5 1.5-1.5h1c.83 0 1.5.67 1.5 1.5v4c0 .55.45 1 1 1h4c1.66 0 3-1.34 3-3v-5.42c0-1.44-.58-2.82-1.6-3.84L13.66 3C13.22 2.55 12.62 2.3 12 2.3z" />
            </svg>
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
            {/* Custom Orders Document + Box + Sync Icon */}
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H19C20.1 3 21 3.9 21 5V19C21 20.1 20.1 21 19 21H8C6.9 21 6 20.1 6 19" />
              <path d="M14 6.2A2.3 2.3 0 0 1 16.5 8.5" />
              <path d="M16 6.2L17.5 7.7l-1.5 1.3" strokeWidth="1.4" />
              <path d="M15 10.8A2.3 2.3 0 0 1 12.5 8.5" />
              <path d="M13 10.8L11.5 9.3l1.5-1.3" strokeWidth="1.4" />
              <line x1="13.5" y1="13" x2="17.5" y2="13" strokeWidth="1.6" />
              <line x1="11" y1="16" x2="17.5" y2="16" strokeWidth="1.6" />
              <line x1="11" y1="18.5" x2="17.5" y2="18.5" strokeWidth="1.6" />
              <path d="M2 9.5L5.5 7.5L9 9.5L5.5 11.5Z" fill="currentColor" fillOpacity="0.2" strokeWidth="1.6" />
              <path d="M2 9.5V13.5L5.5 15.5V11.5" strokeWidth="1.6" />
              <path d="M9 9.5V13.5L5.5 15.5" strokeWidth="1.6" />
            </svg>
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

          {/* Support Ticket Quick Redirect Banner inside AI Concierge */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 p-3 rounded-2xl border border-[#5B42F3]/20 flex items-center justify-between gap-2 shadow-2xs mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Ticket className="w-4 h-4 text-[#5B42F3] shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-black text-[#181432] truncate">Official Admin Support</p>
                <p className="text-[9.5px] text-[#7E7998] truncate">Open direct ticket for orders & issues</p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsChatOpen(false);
                setIsSupportModalOpen(true);
              }}
              className="px-2.5 py-1.5 bg-gradient-to-r from-[#5B42F3] to-[#8E54E9] hover:opacity-95 text-white rounded-xl text-[10px] font-black shrink-0 shadow-xs flex items-center gap-1 transition-all active:scale-95"
            >
              Open Ticket
            </button>
          </div>

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

      {/* TERMS OF SERVICE & WARRANTY POLICY POPUP DIALOG */}
      <Dialog open={isTermsModalOpen} onOpenChange={setIsTermsModalOpen}>
        <DialogContent className="max-w-lg w-full bg-[#121214] border border-[#27272A] rounded-[32px] p-6 shadow-2xl overflow-hidden max-h-[88vh] overflow-y-auto z-50 text-[#E4E4E7]">
          {/* Header with YouuHost Brand Logo */}
          <div className="flex items-center justify-between pb-4 border-b border-[#27272A]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5B42F3] to-[#38B6FF] p-0.5 shadow-lg shadow-[#5B42F3]/25 flex items-center justify-center">
                <img
                  src="/assets/youuhost_logo.png"
                  alt="YouuHost"
                  className="w-full h-full object-contain rounded-[14px]"
                  onError={(e) => {
                    (e.target as any).style.display = "none";
                  }}
                />
              </div>
              <div>
                <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                  YOUUHOST PLATFORM
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                    OFFICIAL
                  </span>
                </h3>
                <span className="text-[10px] text-[#A1A1AA] font-bold">TERMS OF USE & DIGITAL AGREEMENT</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-xs text-[#D4D4D8] pt-3">
            {/* Custom Product Terms & Warranty (if defined by Admin) */}
            {termsModalCustomText && (
              <div className="bg-gradient-to-br from-purple-950/40 via-[#1E1B4B] to-purple-950/20 rounded-2xl p-4 border border-purple-500/30 shadow-xs space-y-1.5 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-purple-300 font-black text-xs">
                  <ShieldCheck className="w-4 h-4 text-purple-400" /> Specific Product Warranty & Guarantee
                </div>
                <p className="text-[11.5px] text-[#E4E4E7] font-semibold leading-relaxed whitespace-pre-wrap">
                  {termsModalCustomText}
                </p>
              </div>
            )}

            {/* Critical Callout: STRICT NO-REFUND POLICY */}
            <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-red-400 font-black text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>CRITICAL: STRICT NON-REFUNDABLE POLICY (ALL SALES FINAL)</span>
              </div>
              <p className="text-[11px] text-red-200/90 leading-relaxed font-medium">
                All cloud resources, digital accounts, software keys, and subscriptions sold on YouuHost are <b>intangible digital assets</b> delivered electronically. <b>NO REFUNDS, CASH REVERSALS, OR ORDER CANCELLATIONS WILL BE ISSUED UNDER ANY CIRCUMSTANCES ONCE AN ORDER IS PROCESSED OR CREDENTIALS ARE DELIVERED.</b>
              </p>
            </div>

            {/* Policy 1: Acceptance & Binding Agreement */}
            <div className="bg-[#18181B] rounded-2xl p-3.5 border border-[#27272A] space-y-1">
              <div className="flex items-center gap-2 text-white font-black text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#38B6FF]" /> 1. Acceptance of Terms & Binding Agreement
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                Accessing YouuHost, depositing wallet balance, or placing an order constitutes your unconditional legal acceptance of all platform terms and policies.
              </p>
            </div>

            {/* Policy 2: 24h-48h Replacement Guarantee */}
            <div className="bg-[#18181B] rounded-2xl p-3.5 border border-[#27272A] space-y-1">
              <div className="flex items-center gap-2 text-white font-black text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> 2. 24h-48h Initial Replacement Warranty
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                If credentials or activation keys fail to work upon initial receipt, submit unedited photo/video evidence to official support within the warranty period for an instant <b>1-to-1 replacement</b> or equivalent store credit.
              </p>
            </div>

            {/* Policy 3: Customer Responsibilities & Security */}
            <div className="bg-[#18181B] rounded-2xl p-3.5 border border-[#27272A] space-y-1">
              <div className="flex items-center gap-2 text-white font-black text-xs">
                <Lock className="w-4 h-4 text-amber-400" /> 3. Credential Security & 2FA Responsibilities
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                Customers are solely responsible for securing delivered credentials and backing up 2FA secret keys. Any unauthorized account sharing, password leaks, or third-party acceptable use violations instantly void warranty coverage.
              </p>
            </div>

            {/* Policy 4: Prohibited Activities */}
            <div className="bg-[#18181B] rounded-2xl p-3.5 border border-[#27272A] space-y-1">
              <div className="flex items-center gap-2 text-white font-black text-xs">
                <XCircle className="w-4 h-4 text-rose-400" /> 4. Prohibited Misuse & Instant Termination
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                DDoS attacks, illegal botnets, spamming, phishing, or payment fraud will result in immediate service termination, wallet balance forfeiture, and permanent blacklist.
              </p>
            </div>

            {/* Policy 5: Automatic Agreement to Future Changes */}
            <div className="bg-[#18181B] rounded-2xl p-3.5 border border-[#27272A] space-y-1">
              <div className="flex items-center gap-2 text-white font-black text-xs">
                <RefreshCw className="w-4 h-4 text-purple-400" /> 5. Policy Updates & Continued Consent
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                YouuHost reserves the right to modify these terms at any time. Continued use of the platform after any modification constitutes full and automatic agreement to the updated terms.
              </p>
            </div>

            {/* Official Support Assistance Box */}
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-300 font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaWhatsapp className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>24/7 Official Support: +94 77 031 4260</span>
              </div>
              <a
                href="https://wa.me/94770314260?text=Hello%20YouuHost%20Support%2C%20I%20have%20an%20inquiry%20regarding%20my%20order."
                target="_blank"
                rel="noreferrer"
                className="text-[#38B6FF] hover:underline font-bold"
              >
                Chat Now
              </a>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#27272A] flex flex-col gap-2">
            <Button
              onClick={() => setIsTermsModalOpen(false)}
              className="w-full bg-gradient-to-r from-[#5B42F3] to-[#38B6FF] hover:opacity-95 text-white font-black text-xs rounded-2xl h-11 shadow-lg shadow-[#5B42F3]/25"
            >
              I Acknowledge & Agree to All Terms
            </Button>
            <Link
              href="/terms"
              target="_blank"
              className="text-center text-[11px] text-[#A1A1AA] hover:text-white py-1 transition-colors"
            >
              Open Full-Page Document ↗
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* ORDER DETAILS & CREDENTIALS DOWNLOAD MODAL DIALOG */}
      <Dialog
        open={!!selectedOrderDetails}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderDetails(null);
        }}
      >
        <DialogContent hideClose={true} className="!w-[calc(100vw-24px)] !max-w-[440px] bg-[#F8F9FD] border border-[#ECEEF8] rounded-[28px] sm:rounded-[32px] p-3.5 sm:p-5 shadow-2xl overflow-x-hidden max-h-[88vh] overflow-y-auto z-50">
          {selectedOrderDetails && (() => {
            const ord = selectedOrderDetails;
            const finalPriceLkrNum = ord.priceLkr != null && Number(ord.priceLkr) > 0
              ? Number(ord.priceLkr)
              : Math.round(((ord.priceCents || 0) / 100) * lkrRate);
            const priceLkr = finalPriceLkrNum.toLocaleString();
            const priceUsd = (ord.priceCents ? (ord.priceCents / 100) : (finalPriceLkrNum / lkrRate)).toFixed(2);
            const dateStr = ord.date && ord.date.getTime() > 0 ? format(ord.date, "MMM d, yyyy • HH:mm:ss") : "Recent";

            return (
              <div className="space-y-3 w-full overflow-hidden">
                <DialogHeader className="sr-only">
                  <DialogTitle>{ord.title} Details</DialogTitle>
                  <DialogDescription>Order credentials and receipts</DialogDescription>
                </DialogHeader>

                {/* Top Header: Close Button & Status Badge */}
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-[#ECEEF8]/80 w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => setSelectedOrderDetails(null)}
                      className="w-8 h-8 rounded-full bg-white shadow-xs flex items-center justify-center text-[#5B42F3] hover:bg-[#EDE9FE] transition-colors border border-[#ECEEF8] shrink-0 active:scale-95"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-mono font-bold text-[#5B42F3] bg-[#F5F4FC] px-2.5 py-1 rounded-full border border-purple-200/60 truncate max-w-[130px]">
                      {ord.orderNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {ord.statusBadge}
                    <button
                      onClick={() => setSelectedOrderDetails(null)}
                      className="w-7 h-7 rounded-full bg-white text-[#9490A8] hover:text-[#181432] border border-[#ECEEF8] flex items-center justify-center text-xs active:scale-95 shadow-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Product Title & Category */}
                <div className="bg-white rounded-3xl p-3 sm:p-4 border border-[#ECEEF8] shadow-xs w-full overflow-hidden">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border ${ord.badgeBg}`}>
                      {ord.categoryTag}
                    </span>
                    <span className="text-[9.5px] text-[#7E7998] font-semibold">
                      {dateStr}
                    </span>
                  </div>
                  <h3 className="text-[13.5px] sm:text-[15px] font-black text-[#181432] leading-snug break-words">
                    {ord.title}
                  </h3>

                  {/* Pricing and Quantity Pill Box */}
                  <div className="grid grid-cols-3 gap-1 sm:gap-2 mt-3 pt-3 border-t border-[#F5F4FC] text-center w-full">
                    <div className="bg-[#F8F7FD] py-2 px-1 rounded-xl border border-[#ECEEF8]/80 min-w-0 flex flex-col items-center justify-center">
                      <span className="text-[8px] sm:text-[9px] font-bold text-[#9490A8] uppercase block tracking-tight truncate w-full">Quantity</span>
                      <span className="font-black text-[#181432] text-[10.5px] sm:text-xs truncate w-full">{ord.quantity?.toLocaleString() || 1}</span>
                    </div>
                    <div className="bg-[#F8F7FD] py-2 px-1 rounded-xl border border-[#ECEEF8]/80 min-w-0 flex flex-col items-center justify-center">
                      <span className="text-[8px] sm:text-[9px] font-bold text-[#5B42F3] uppercase block tracking-tight truncate w-full">USD Price</span>
                      <span className="font-black font-mono text-[#5B42F3] text-[10.5px] sm:text-xs truncate w-full">${priceUsd}</span>
                    </div>
                    <div className="bg-[#F8F7FD] py-2 px-1 rounded-xl border border-[#ECEEF8]/80 min-w-0 flex flex-col items-center justify-center">
                      <span className="text-[8px] sm:text-[9px] font-bold text-[#D92078] uppercase block tracking-tight truncate w-full">LKR Total</span>
                      <span className="font-black font-mono text-[#D92078] text-[10px] sm:text-xs truncate w-full">Rs. {priceLkr}</span>
                    </div>
                  </div>
                </div>

                {/* Delivered Credentials Box (Cloud / Accounts) */}
                {ord.credentialData && (
                  <div className="bg-white rounded-3xl p-3 sm:p-4 border border-purple-200/80 shadow-xs space-y-2 w-full overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-[#5B42F3]">
                        <KeyRound className="w-4 h-4 text-[#5B42F3]" />
                        Delivered Credentials / Access
                      </div>
                      <button
                        onClick={() => copyToClipboard(ord.credentialData, "Credentials Copied")}
                        className="text-[10px] font-bold text-[#5B42F3] hover:text-[#4A32D6] bg-[#F5F4FC] px-2 py-0.5 rounded-xl border border-purple-200 flex items-center gap-1 shadow-2xs active:scale-95"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>

                    <div className="bg-[#181432] text-emerald-400 font-mono text-[10.5px] sm:text-[11px] p-2.5 sm:p-3 rounded-2xl border border-[#2B2353] break-all select-all whitespace-pre-wrap leading-relaxed shadow-inner">
                      {ord.credentialData}
                    </div>

                    {/* Live TOTP Generator if 2FA secret is included */}
                    {ord.twoFactorSecret && (
                      <div className="pt-2 border-t border-[#F5F4FC]">
                        <div className="text-[10px] font-bold text-[#7E7998] mb-1.5 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Live 2FA One-Time Passcode (TOTP):
                        </div>
                        <LiveTOTP
                          secret={ord.twoFactorSecret}
                          onCopy={(c) => copyToClipboard(c, "2FA Code Copied")}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Delivered Digital License / CDK / Accounts (Universal Smart Display) */}
                {ord.licenseKey && (() => {
                  const rawCreds = ord.licenseKey;
                  const accounts = parseUniversalCredentials(rawCreds, ord.title);
                  const hasStructured = accounts.length > 0 && accounts.some(a => a.fields.length > 1 || a.fields[0]?.isUrl);

                  return (
                    <div className="bg-[#F0FDF4] rounded-3xl p-3 sm:p-4 border border-emerald-200 shadow-xs space-y-2 w-full overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {hasStructured ? "Parsed Credentials / Access:" : "Digital License / Activation CDK"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {hasStructured && (
                            <button
                              onClick={() => copyToClipboard(rawCreds, "Raw Data Copied! 📋")}
                              className="text-[10px] font-bold text-[#7E7998] hover:text-[#181432] bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs active:scale-95 transition-transform"
                              title="Copy Original Raw Data"
                            >
                              Raw
                            </button>
                          )}
                          <button
                            onClick={() => copyToClipboard(formatDeliveredCredentialsForCopy(rawCreds, ord.quantity, ord.title), "Credentials Copied! 📋")}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-white px-2.5 py-1 rounded-xl border border-emerald-300 flex items-center gap-1 shadow-2xs active:scale-95 transition-transform"
                          >
                            <Copy className="w-3 h-3" /> Copy All
                          </button>
                        </div>
                      </div>

                      {hasStructured ? (
                        <div className="space-y-2.5">
                          {accounts.map((acc, aIdx) => (
                            <div key={aIdx} className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs space-y-2 text-[11px]">
                              {accounts.length > 1 && (
                                <div className="text-[10px] font-black text-emerald-800 uppercase border-b border-emerald-50 pb-1">
                                  Account / Item #{acc.index}
                                </div>
                              )}
                              {acc.fields.map((f, fIdx) => (
                                <div key={fIdx} className={`flex items-center justify-between gap-2 py-1 ${fIdx < acc.fields.length - 1 ? "border-b border-slate-100" : ""}`}>
                                  <span className="text-[#7E7998] font-bold text-xs shrink-0">{f.label}:</span>
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                                    {f.isUrl ? (
                                      <a
                                        href={f.value}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-[#5B42F3] hover:underline font-mono truncate max-w-[220px]"
                                      >
                                        {f.value}
                                      </a>
                                    ) : (
                                      <span className={`font-mono text-xs truncate select-all ${f.isSecret ? "font-bold text-emerald-700" : "font-bold text-[#181432]"}`}>
                                        {f.value}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => copyToClipboard(f.value, `${f.label} Copied`)}
                                      className="text-[#5B42F3] hover:text-[#4A32D6] p-1 hover:bg-purple-50 rounded shrink-0"
                                      title={`Copy ${f.label}`}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                    {f.isUrl && (
                                      <a
                                        href={f.value}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded shrink-0"
                                        title="Open Link"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white text-emerald-950 font-mono text-[10.5px] sm:text-[11px] p-2.5 sm:p-3 rounded-2xl border border-emerald-100 max-h-36 overflow-y-auto break-all select-all whitespace-pre-wrap leading-relaxed shadow-inner font-bold">
                          {rawCreds}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* SMM Social Boost Details */}
                {ord.orderType === "smm" && (
                  <div className="bg-white rounded-3xl p-3 sm:p-4 border border-[#ECEEF8] shadow-xs space-y-2.5 overflow-hidden w-full">
                    <div className="flex items-center justify-between text-xs font-black text-[#D92078]">
                      <div className="flex items-center gap-1.5">
                        <ShopBagIcon className="w-4 h-4 text-[#D92078]" />
                        Social Boost Target & Stats
                      </div>
                    </div>

                    {ord.smmLink && (
                      <div className="bg-[#F8F7FD] p-2.5 rounded-2xl border border-[#ECEEF8] flex items-center justify-between gap-2 overflow-hidden w-full">
                        <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                          <ExternalLink className="w-3.5 h-3.5 text-[#5B42F3] shrink-0" />
                          <span className="text-[10px] font-mono text-[#5B42F3] truncate select-all">
                            {ord.smmLink}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(ord.smmLink, "Link Copied")}
                          className="text-[10px] font-bold text-[#D92078] hover:underline shrink-0 px-1"
                        >
                          Copy
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-1 sm:gap-2 text-center w-full">
                      <div className="bg-[#F8F7FD] py-2 px-1 rounded-xl border border-[#ECEEF8]/80 min-w-0 flex flex-col items-center justify-center">
                        <span className="text-[8px] sm:text-[9px] font-bold text-[#9490A8] uppercase block tracking-tight truncate w-full">Quantity</span>
                        <span className="font-black text-[#181432] text-[10.5px] sm:text-xs truncate w-full">{ord.quantity?.toLocaleString()}</span>
                      </div>
                      <div className="bg-[#F8F7FD] py-2 px-1 rounded-xl border border-[#ECEEF8]/80 min-w-0 flex flex-col items-center justify-center">
                        <span className="text-[8px] sm:text-[9px] font-bold text-sky-600 uppercase block tracking-tight truncate w-full">Start Count</span>
                        <span className="font-black text-sky-600 text-[10.5px] sm:text-xs truncate w-full">{ord.startCount || "0"}</span>
                      </div>
                      <div className="bg-[#F8F7FD] py-2 px-1 rounded-xl border border-[#ECEEF8]/80 min-w-0 flex flex-col items-center justify-center">
                        <span className="text-[8px] sm:text-[9px] font-bold text-amber-600 uppercase block tracking-tight truncate w-full">Remains</span>
                        <span className="font-black text-amber-600 text-[10.5px] sm:text-xs truncate w-full">{ord.remains || "0"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Action Buttons: Download .txt File & Copy */}
                <div className="space-y-2 pt-1 w-full">
                  <button
                    onClick={() => downloadOrderTxt(ord)}
                    className="w-full py-3 bg-gradient-to-r from-[#5B42F3] via-[#8E54E9] to-[#00C9FF] hover:opacity-95 text-white rounded-2xl text-xs font-black shadow-lg shadow-[#5B42F3]/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> {ord.orderType === "smm" ? "Download .txt Receipt (Boost Summary)" : "Download .txt File (Credentials)"}
                  </button>

                  <div className="grid grid-cols-2 gap-2 w-full">
                    <button
                      onClick={() => {
                        const credsOnly = ord.credentialData || ord.licenseKey || ord.smmLink || ord.deliveredData || ord.status;
                        copyToClipboard(credsOnly, "Credentials Copied to Clipboard! 🔑");
                      }}
                      className="py-2.5 bg-white hover:bg-[#F5F4FC] text-[#181432] border border-[#ECEEF8] rounded-2xl text-[10.5px] sm:text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#5B42F3]" /> Copy Details
                    </button>

                    <a
                      href={`https://wa.me/94770314260?text=${encodeURIComponent(`Hello YouuHost Support, I need help regarding my Order ${ord.orderNumber} (${ord.title})`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10.5px] sm:text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <FaWhatsapp className="w-4 h-4 text-white" /> Need Help?
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* OPEN SUPPORT TICKET MODAL */}
      {/* OPEN SUPPORT TICKET MODAL */}
      <Dialog open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
        <DialogContent className="max-w-md w-full bg-[#F8F9FD] border border-[#ECEEF8] rounded-[32px] p-5 sm:p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto z-50">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-base font-black text-[#181432] flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-[#5B42F3]" />
              Open Support Ticket
            </DialogTitle>
            <DialogDescription className="text-xs text-[#7E7998]">
              Direct communication with store administration. We typically reply within minutes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-2">
            {/* 1. Category Selection */}
            <div>
              <label className="text-[11px] font-bold text-[#6B658B] uppercase tracking-wider block mb-1.5">
                Issue Category
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "Order Delivery Issue", label: "Order & Credentials", icon: PackageCheck },
                  { id: "Payment / Top-up", label: "Payment & Top-up", icon: CreditCard },
                  { id: "2FA / Credentials Problem", label: "2FA & Auth Issue", icon: ShieldCheck },
                  { id: "SMM Boost Service", label: "Social Boost Issue", icon: Rocket },
                  { id: "API Key / Developer", label: "Developer API", icon: Code2 },
                  { id: "Other / Inquiry", label: "Other Inquiries", icon: HelpCircle },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = ticketIssueType === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setTicketIssueType(cat.id);
                        setTicketOrderId("");
                        setTicketPaymentId("");
                        setTicketSmmOrderId("");
                      }}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#5B42F3] text-white border-[#5B42F3] shadow-sm shadow-[#5B42F3]/25 font-bold"
                          : "bg-white hover:bg-[#F5F4FC] text-[#3D3656] border-[#ECEEF8]"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : "text-[#5B42F3]"}`} />
                      <span className="text-[11px] truncate leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Dynamic Related Selector based on selected Category */}
            {ticketIssueType === "Order Delivery Issue" && orders.length > 0 && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <label className="text-[11px] font-bold text-[#6B658B] uppercase tracking-wider block mb-1.5">
                  Related Order (Optional)
                </label>
                <select
                  value={ticketOrderId}
                  onChange={(e) => setTicketOrderId(e.target.value)}
                  className="w-full bg-white border border-[#ECEEF8] rounded-2xl p-2.5 text-xs text-[#181432] focus:outline-none focus:border-[#5B42F3]"
                >
                  <option value="">-- Select related order --</option>
                  {orders.map((o: any) => {
                    const prodName = o.product?.name || (o.productId ? `Product #${o.productId}` : "Cloud/Account Order");
                    const price = ((o.product?.price || o.priceCents || o.price || 0) / 100).toFixed(2);
                    return (
                      <option key={o.id} value={`#ORD-${o.id} - ${prodName}`}>
                        #ORD-{o.id} • {prodName} (${price})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {ticketIssueType === "Payment / Top-up" && payments.length > 0 && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <label className="text-[11px] font-bold text-[#6B658B] uppercase tracking-wider block mb-1.5">
                  Related Payment / Top-up (Optional)
                </label>
                <select
                  value={ticketPaymentId}
                  onChange={(e) => setTicketPaymentId(e.target.value)}
                  className="w-full bg-white border border-[#ECEEF8] rounded-2xl p-2.5 text-xs text-[#181432] focus:outline-none focus:border-[#5B42F3]"
                >
                  <option value="">-- Select related payment / deposit --</option>
                  {payments.map((p: any) => {
                    const isLkr = (p.currency || "").toUpperCase() === "LKR" || 
                                  (p.paymentMethod || "").toLowerCase().includes("payhere") || 
                                  (p.gateway || "").toLowerCase().includes("payhere") ||
                                  (p.method || "").toLowerCase().includes("payhere") ||
                                  (p.paymentMethod || "").toLowerCase().includes("card");

                    let amountLabel = "";
                    let valueLabel = "";

                    if (isLkr) {
                      const rawAmt = p.amountCents || p.amount || 0;
                      const lkrVal = rawAmt >= 10000 ? Math.round(rawAmt / 100) : rawAmt;
                      const usdEst = (lkrVal / (lkrRate || 330)).toFixed(2);
                      amountLabel = `Rs. ${lkrVal.toLocaleString()} LKR (≈ $${usdEst})`;
                      valueLabel = `Rs. ${lkrVal.toLocaleString()} LKR`;
                    } else {
                      const usdVal = ((p.amountCents || p.amount || 0) / 100).toFixed(2);
                      const lkrEst = Math.round(parseFloat(usdVal) * (lkrRate || 330)).toLocaleString();
                      amountLabel = `$${usdVal} USD (≈ Rs. ${lkrEst})`;
                      valueLabel = `$${usdVal} USD`;
                    }

                    const method = p.gateway || p.paymentMethod || p.method || p.provider || (isLkr ? "PayHere Online Card" : "Top-up");
                    const dateStr = p.createdAt ? format(new Date(p.createdAt), "yyyy-MM-dd") : "";

                    return (
                      <option key={p.id} value={`Deposit #${p.id} (${valueLabel} via ${method})`}>
                        Deposit #{p.id} • {amountLabel} • {method} • {p.status || "Completed"} {dateStr ? `• ${dateStr}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {ticketIssueType === "SMM Boost Service" && smmOrdersList.length > 0 && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <label className="text-[11px] font-bold text-[#6B658B] uppercase tracking-wider block mb-1.5">
                  Related Social Boost Order (Optional)
                </label>
                <select
                  value={ticketSmmOrderId}
                  onChange={(e) => setTicketSmmOrderId(e.target.value)}
                  className="w-full bg-white border border-[#ECEEF8] rounded-2xl p-2.5 text-xs text-[#181432] focus:outline-none focus:border-[#5B42F3]"
                >
                  <option value="">-- Select related boost order --</option>
                  {smmOrdersList.map((s: any) => {
                    const title = s.serviceName || (s.smmService?.name) || `Boost Service #${s.smmServiceId || s.serviceId}`;
                    const qty = s.quantity || 1000;
                    return (
                      <option key={s.id} value={`Order #${s.id} - ${title} (Qty: ${qty})`}>
                        Boost #{s.id} • {title} • Qty: {qty} ({s.status || "Pending"})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* 3. Detailed Message Area */}
            <div>
              <label className="text-[11px] font-bold text-[#6B658B] uppercase tracking-wider block mb-1.5">
                Detailed Message <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                placeholder="Please describe your issue with all necessary details..."
                value={ticketDetails}
                onChange={(e) => setTicketDetails(e.target.value)}
                className="w-full bg-white border border-[#ECEEF8] rounded-2xl p-3 text-xs text-[#181432] focus:outline-none focus:border-[#5B42F3] resize-none"
              />
            </div>

            {/* 4. Canvas-Compressed Photo / Screenshot Upload */}
            <div>
              <label className="text-[11px] font-bold text-[#6B658B] uppercase tracking-wider block mb-1.5">
                Attach Screenshot / Photo (Optional)
              </label>
              {ticketAttachment ? (
                <div className="relative inline-block rounded-2xl border border-[#ECEEF8] bg-white p-2 shadow-2xs">
                  <img
                    src={ticketAttachment}
                    alt="Ticket attachment"
                    onClick={() => setPreviewLightboxImage(ticketAttachment)}
                    className="w-24 h-24 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                  />
                  <button
                    type="button"
                    onClick={() => setTicketAttachment(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:bg-rose-600 transition-colors"
                  >
                    ✕
                  </button>
                  <div className="text-[9px] text-[#7E7998] text-center mt-1 font-semibold">
                    Tap to view
                  </div>
                </div>
              ) : (
                <div>
                  <label className="cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed border-[#D6D3E6] hover:border-[#5B42F3] bg-white rounded-2xl p-3 text-xs text-[#5B42F3] font-bold transition-colors">
                    {isProcessingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#5B42F3]" />
                        <span>Compressing image...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-[#5B42F3]" />
                        <span>Upload Screenshot / Photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isProcessingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsProcessingImage(true);
                        try {
                          const compressed = await compressImageToDataUrl(file, 1200, 1200, 0.75);
                          setTicketAttachment(compressed);
                        } catch (err) {
                          toast({
                            title: "Image Upload Failed",
                            description: "Could not compress image. Please choose another.",
                            variant: "destructive"
                          });
                        } finally {
                          setIsProcessingImage(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                  <p className="text-[10px] text-[#9490A8] mt-1">
                    PNG, JPG (auto-compressed with Canvas for fast delivery)
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCreateSupportTicket}
                disabled={isSubmittingTicket || !ticketDetails.trim() || isProcessingImage}
                className="w-full py-3.5 bg-gradient-to-r from-[#5B42F3] via-[#8E54E9] to-[#00C9FF] text-white rounded-2xl font-black text-xs shadow-lg shadow-[#5B42F3]/25 flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
              >
                {isSubmittingTicket ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting Ticket...
                  </>
                ) : (
                  <>
                    <SendHorizontal className="w-4 h-4" /> Submit Support Ticket
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TICKET CONVERSATION THREAD & REPLY DIALOG */}
      <Dialog open={!!supportSelectedTicket} onOpenChange={(open) => !open && setSupportSelectedTicket(null)}>
        <DialogContent className="max-w-md w-full bg-[#F8F9FD] border border-[#ECEEF8] rounded-[32px] p-5 sm:p-6 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col z-50">
          {supportSelectedTicket && (
            <>
              <DialogHeader className="mb-2 shrink-0 border-b border-[#ECEEF8] pb-3">
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-sm font-black text-[#181432] flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-[#5B42F3]" />
                    Ticket #{supportSelectedTicket.id}
                  </DialogTitle>
                  {(() => {
                    const st = (supportSelectedTicket.status || "").toLowerCase();
                    if (st === "resolved" || st === "closed") {
                      return (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Resolved
                        </span>
                      );
                    }
                    if (st === "in_progress" || st === "admin_replied") {
                      return (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-200 flex items-center gap-1.5">
                          <Headphones className="w-3 h-3 text-[#5B42F3]" /> Staff Replied
                        </span>
                      );
                    }
                    return (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-500" /> In Review
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs font-bold text-[#3D3656] text-left mt-1">
                  {supportSelectedTicket.subject || supportSelectedTicket.issueType}
                </p>
                <p className="text-[10px] text-[#9490A8] text-left">
                  Opened on {supportSelectedTicket.createdAt ? format(new Date(supportSelectedTicket.createdAt), "yyyy-MM-dd HH:mm") : "N/A"}
                </p>
              </DialogHeader>

              {/* Message Thread History */}
              <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[160px] max-h-[300px]">
                {/* Initial Ticket Details Bubble */}
                <div className="p-3.5 bg-white border border-[#E9EAF5] rounded-2xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-[#5B42F3] flex items-center gap-1.5">
                      <LifeBuoy className="w-3.5 h-3.5" /> Initial Issue Details
                    </span>
                    <span className="text-[9.5px] font-bold text-[#7E7998] bg-[#F5F4FC] px-2 py-0.5 rounded-md border border-[#ECEEF8]">
                      {supportSelectedTicket.issueType}
                    </span>
                  </div>
                  <p className="text-xs text-[#181432] whitespace-pre-wrap leading-relaxed font-medium">
                    {supportSelectedTicket.details}
                  </p>
                  {(supportSelectedTicket.attachmentUrl || supportSelectedTicket.attachment_url) && (
                    <div className="pt-1">
                      <img
                        src={supportSelectedTicket.attachmentUrl || supportSelectedTicket.attachment_url}
                        alt="Initial Attachment"
                        onClick={() => setPreviewLightboxImage(supportSelectedTicket.attachmentUrl || supportSelectedTicket.attachment_url)}
                        className="max-h-36 max-w-full rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity border border-[#ECEEF8]"
                      />
                    </div>
                  )}
                </div>

                {/* Parsed JSON Message Array */}
                {(() => {
                  let thread: any[] = [];
                  if (supportSelectedTicket.messages) {
                    try {
                      thread = typeof supportSelectedTicket.messages === "string" 
                        ? JSON.parse(supportSelectedTicket.messages) 
                        : supportSelectedTicket.messages;
                    } catch {
                      thread = [];
                    }
                  }
                  // Skip the first message if identical to details
                  const displayThread = thread.filter((m: any, idx: number) => {
                    if (idx === 0 && m.text === supportSelectedTicket.details) return false;
                    return true;
                  });

                  return displayThread.map((msg: any, i: number) => {
                    const isAdmin = msg.sender === "admin" || msg.sender === "staff" || msg.role === "admin";
                    const attach = msg.attachmentUrl || msg.attachment_url || msg.image;
                    return (
                      <div
                        key={i}
                        className={`p-3.5 rounded-2xl max-w-[88%] shadow-2xs space-y-1.5 transition-all ${
                          isAdmin
                            ? "mr-auto ml-0 bg-white border border-[#E5E7F2] text-[#181432] rounded-tl-xs shadow-xs"
                            : "ml-auto mr-0 bg-gradient-to-r from-[#5B42F3] via-[#7042F3] to-[#8E54E9] text-white rounded-tr-xs shadow-md shadow-purple-500/15"
                        }`}
                      >
                        {/* Message Header with Real Logo & Verified Badges */}
                        <div className="flex items-center justify-between gap-2">
                          {isAdmin ? (
                            <div className="flex items-center gap-1.5">
                              <img
                                src={youuHostLogo}
                                alt="YouuHost"
                                className="w-4 h-4 rounded-full object-contain border border-purple-200/60 shadow-2xs"
                              />
                              <span className="text-[11px] font-black text-[#5B42F3] tracking-tight">
                                YouuHost Support
                              </span>
                              <span className="px-1.5 py-0.5 bg-purple-100/80 text-[#5B42F3] text-[8.5px] font-black rounded-md uppercase tracking-wider">
                                Customer Care
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-white">
                                <User className="w-2.5 h-2.5" />
                              </div>
                              <span className="text-[11px] font-black text-white">
                                You
                              </span>
                            </div>
                          )}
                          {msg.timestamp && (
                            <span className={`text-[9px] font-medium ${isAdmin ? "text-[#9490A8]" : "text-white/70"}`}>
                              {format(new Date(msg.timestamp), "HH:mm")}
                            </span>
                          )}
                        </div>

                        {/* Message Body */}
                        {msg.text && (
                          <p className={`text-xs whitespace-pre-wrap leading-relaxed font-medium ${isAdmin ? "text-[#181432]" : "text-white"}`}>
                            {msg.text || msg.content}
                          </p>
                        )}

                        {/* Photo Attachment Thumbnail */}
                        {attach && (
                          <div className="pt-1">
                            <img
                              src={attach}
                              alt="Attachment"
                              onClick={() => setPreviewLightboxImage(attach)}
                              className={`max-h-36 max-w-full rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity border ${
                                isAdmin ? "border-[#ECEEF8]" : "border-white/20"
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Reply Input Bar */}
              <div className="pt-2 border-t border-[#ECEEF8] shrink-0 space-y-2">
                {replyAttachment && (
                  <div className="relative inline-block rounded-xl border border-[#ECEEF8] bg-white p-1 shadow-2xs">
                    <img
                      src={replyAttachment}
                      alt="Reply attachment"
                      onClick={() => setPreviewLightboxImage(replyAttachment)}
                      className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-90"
                    />
                    <button
                      type="button"
                      onClick={() => setReplyAttachment(null)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="w-10 h-10 rounded-full bg-white border border-[#ECEEF8] hover:bg-[#F5F4FC] text-[#5B42F3] flex items-center justify-center cursor-pointer shrink-0 shadow-2xs">
                    {isProcessingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#5B42F3]" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isProcessingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsProcessingImage(true);
                        try {
                          const compressed = await compressImageToDataUrl(file, 1200, 1200, 0.75);
                          setReplyAttachment(compressed);
                        } catch (err) {
                          toast({
                            title: "Image Upload Failed",
                            description: "Could not compress image.",
                            variant: "destructive"
                          });
                        } finally {
                          setIsProcessingImage(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    value={ticketReplyMsg}
                    onChange={(e) => setTicketReplyMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendTicketReply(supportSelectedTicket.id)}
                    placeholder="Type a follow-up reply..."
                    className="flex-1 bg-white border border-[#ECEEF8] rounded-full px-4 py-2.5 text-xs text-[#181432] focus:outline-none focus:border-[#5B42F3]"
                  />
                  <button
                    onClick={() => handleSendTicketReply(supportSelectedTicket.id)}
                    disabled={isReplyingTicket || (!ticketReplyMsg.trim() && !replyAttachment)}
                    className="w-10 h-10 rounded-full bg-gradient-to-r from-[#5B42F3] to-[#8E54E9] text-white flex items-center justify-center hover:opacity-95 disabled:opacity-40 shadow-sm shrink-0 active:scale-95 cursor-pointer"
                  >
                    {isReplyingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* PHOTO LIGHTBOX PREVIEW MODAL */}
      <Dialog open={!!previewLightboxImage} onOpenChange={() => setPreviewLightboxImage(null)}>
        <DialogContent className="max-w-2xl w-[95vw] bg-[#111019]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center justify-center z-[100]">
          {previewLightboxImage && (
            <div className="relative w-full flex flex-col items-center">
              <img
                src={previewLightboxImage}
                alt="Full preview"
                className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl"
              />
              <div className="mt-4 flex items-center gap-3">
                <a
                  href={previewLightboxImage}
                  download="support-attachment.jpg"
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold transition-all"
                >
                  Download Photo
                </a>
                <button
                  onClick={() => setPreviewLightboxImage(null)}
                  className="px-5 py-2 bg-white text-[#181432] rounded-full text-xs font-black shadow-md hover:bg-white/90 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Processing Lottie Animation Modal Overlay (~3s) */}
      <PaymentProcessingModal
        isOpen={paymentModal.isOpen}
        title={paymentModal.title}
        subtitle={paymentModal.subtitle}
      />
    </div>
  );
}
