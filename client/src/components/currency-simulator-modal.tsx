import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  ArrowRightLeft, 
  TrendingUp, 
  DollarSign, 
  Coins, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Calculator,
  ShieldCheck
} from "lucide-react";

interface CurrencySimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lkrRate: number;
  currentCurrency: "USD" | "LKR";
  onSelectCurrency: (currency: "USD" | "LKR") => void;
  userBalanceCents?: number;
  userBalanceLkr?: number | null;
}

export function CurrencySimulatorModal({
  isOpen,
  onClose,
  lkrRate,
  currentCurrency,
  onSelectCurrency,
  userBalanceCents = 0,
  userBalanceLkr
}: CurrencySimulatorModalProps) {
  const [activeInput, setActiveInput] = useState<"USD" | "LKR">("USD");
  const [usdVal, setUsdVal] = useState<string>("10");
  const [lkrVal, setLkrVal] = useState<string>(() => {
    return Math.round(10 * (lkrRate || 305.50)).toString();
  });
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Sync inputs when lkrRate changes or activeInput changes
  const effectiveRate = useMemo(() => {
    return lkrRate > 0 ? lkrRate : 305.50;
  }, [lkrRate]);

  const handleUsdChange = (valStr: string) => {
    setActiveInput("USD");
    setUsdVal(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      setLkrVal(Math.round(num * effectiveRate).toString());
    } else if (valStr === "") {
      setLkrVal("");
    }
  };

  const handleLkrChange = (valStr: string) => {
    setActiveInput("LKR");
    setLkrVal(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      setUsdVal((num / effectiveRate).toFixed(2));
    } else if (valStr === "") {
      setUsdVal("");
    }
  };

  const setPresetUsd = (amount: number) => {
    setActiveInput("USD");
    setUsdVal(amount.toString());
    setLkrVal(Math.round(amount * effectiveRate).toString());
  };

  const setPresetLkr = (amount: number) => {
    setActiveInput("LKR");
    setLkrVal(amount.toString());
    setUsdVal((amount / effectiveRate).toFixed(2));
  };

  const swapInputs = () => {
    if (activeInput === "USD") {
      setActiveInput("LKR");
    } else {
      setActiveInput("USD");
    }
  };

  // Effective user balance
  const userUsd = (userBalanceCents / 100).toFixed(2);
  const userLkrFormatted = userBalanceLkr != null && userBalanceLkr >= 0
    ? Number(userBalanceLkr).toLocaleString("en-US")
    : Math.round((userBalanceCents / 100) * effectiveRate).toLocaleString("en-US");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full max-w-lg bg-gradient-to-b from-[#181135] via-[#120B2E] to-[#0D0722] rounded-3xl border border-purple-500/30 shadow-2xl shadow-purple-950/80 overflow-hidden text-white relative"
        >
          {/* Ambient Lighting Gradients */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -translate-y-20 translate-x-20" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none translate-y-20 -translate-x-20" />

          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6C5CE7] to-[#00C9FF] flex items-center justify-center text-white shadow-lg shadow-[#6C5CE7]/30">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Live Currency Simulator
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/30">
                    Real-Time
                  </span>
                </div>
                <p className="text-xs text-purple-200/70 font-medium">
                  Instant live rate simulation & clean currency conversion
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto relative z-10 custom-scrollbar">
            {/* Live Exchange Rate Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-purple-300/80 block">
                    Live Market Rate (Exchange API)
                  </span>
                  <div className="text-sm sm:text-base font-black text-white tracking-tight">
                    1 USD = <span className="text-cyan-300 font-mono">{effectiveRate.toFixed(2)} LKR</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-xl text-[10.5px] font-bold text-cyan-300">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Synchronized</span>
              </div>
            </div>

            {/* Interactive Dual-Converter Box */}
            <div className="space-y-3">
              {/* USD Input Box */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                activeInput === "USD" 
                  ? "bg-purple-900/30 border-purple-400/60 shadow-md shadow-purple-900/30 ring-1 ring-purple-400/30" 
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-purple-200/80 mb-1.5">
                  <span className="flex items-center gap-1.5 text-white">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    US Dollar (USD)
                  </span>
                  <span className="text-[10.5px] font-mono text-white/50">Primary Global</span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-lg font-black text-emerald-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={usdVal}
                    onChange={(e) => handleUsdChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-lg sm:text-xl font-mono font-black text-white placeholder-white/20 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                {/* Presets */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
                  {[5, 10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPresetUsd(amt)}
                      className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[10.5px] font-mono font-bold text-purple-200 transition-all shrink-0 active:scale-95"
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Swap Button Divider */}
              <div className="relative flex items-center justify-center my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <button
                  type="button"
                  onClick={swapInputs}
                  className="relative z-10 w-9 h-9 rounded-full bg-gradient-to-tr from-[#6C5CE7] to-[#00C9FF] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-90 transition-transform"
                  title="Swap Active Currency"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              </div>

              {/* LKR Input Box */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                activeInput === "LKR" 
                  ? "bg-purple-900/30 border-purple-400/60 shadow-md shadow-purple-900/30 ring-1 ring-purple-400/30" 
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-purple-200/80 mb-1.5">
                  <span className="flex items-center gap-1.5 text-white">
                    <Coins className="w-4 h-4 text-cyan-400" />
                    Sri Lankan Rupee (LKR)
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                    Clean Whole Rupee (No Cents)
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-black text-cyan-400">Rs.</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={lkrVal}
                    onChange={(e) => handleLkrChange(e.target.value)}
                    placeholder="0"
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-3 py-2 text-lg sm:text-xl font-mono font-black text-white placeholder-white/20 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                {/* Presets */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
                  {[1000, 2500, 5000, 10000, 25000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPresetLkr(amt)}
                      className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[10.5px] font-mono font-bold text-purple-200 transition-all shrink-0 active:scale-95"
                    >
                      Rs.{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Zero Fractional Cent Guarantee Info */}
            <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-indigo-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-purple-200/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-white block">Clean Precision Guarantee</span>
                <p className="text-[11px] leading-relaxed">
                  LKR values are rounded cleanly to whole rupees (no messy cents). USD is formatted cleanly with standard 2 decimal places.
                </p>
              </div>
            </div>

            {/* User Wallet Dual Balance Preview */}
            <div className="bg-black/30 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-bold text-purple-300/80 uppercase tracking-wider block">
                  Your Current Balance
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-base sm:text-lg font-black text-emerald-300 font-mono">
                    ${userUsd} USD
                  </span>
                  <span className="text-xs text-purple-300/60 font-bold">≈</span>
                  <span className="text-sm sm:text-base font-black text-cyan-300 font-mono">
                    Rs. {userLkrFormatted} LKR
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-white/50 block font-mono">Active Store Currency</span>
                <span className="text-xs font-black text-white px-2 py-0.5 rounded-lg bg-white/10">
                  {currentCurrency}
                </span>
              </div>
            </div>

            {/* Store Currency Switch Actions */}
            <div className="pt-2">
              <span className="text-xs font-black uppercase tracking-wider text-purple-200/80 block mb-2">
                Apply Currency To Entire Storefront:
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCurrency("USD");
                    onClose();
                  }}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 ${
                    currentCurrency === "USD"
                      ? "bg-gradient-to-r from-[#FF5E62] to-[#D92078] text-white border-white/20 shadow-lg shadow-pink-900/40 ring-2 ring-white/30"
                      : "bg-white/5 hover:bg-white/10 text-white/80 border-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1 text-sm font-black">
                    <DollarSign className="w-4 h-4" />
                    <span>Set USD ($)</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-medium">View Store in US Dollars</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectCurrency("LKR");
                    onClose();
                  }}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 ${
                    currentCurrency === "LKR"
                      ? "bg-gradient-to-r from-[#5B42F3] to-[#00C9FF] text-white border-white/20 shadow-lg shadow-indigo-900/40 ring-2 ring-white/30"
                      : "bg-white/5 hover:bg-white/10 text-white/80 border-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1 text-sm font-black">
                    <Coins className="w-4 h-4" />
                    <span>Set LKR (Rs)</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-medium">View Store in Sri Lankan Rupees</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:p-4 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-purple-300/80 relative z-10">
            <div className="flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Instant live calculations across all products</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all active:scale-95"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
