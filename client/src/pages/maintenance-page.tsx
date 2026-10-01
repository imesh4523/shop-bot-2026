import React, { useState } from "react";
import { LottieMaintenance } from "@/components/lottie-loader";
import { Shield, RefreshCw, KeyRound, ExternalLink, Clock, Sparkles, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface MaintenancePageProps {
  title?: string;
  message?: string;
  estimatedEnd?: string;
  onRefresh?: () => void;
}

export function MaintenancePage({
  title = "Scheduled Maintenance in Progress",
  message = "We are currently upgrading our cloud infrastructure, security shields, and payment gateways to ensure maximum speed and stability. We'll be back online shortly!",
  estimatedEnd,
  onRefresh,
}: MaintenancePageProps) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffOtp, setStaffOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    } else {
      window.location.reload();
    }
    setTimeout(() => setIsRefreshing(false), 1200);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail || !staffEmail.includes("@")) {
      toast({ title: "Invalid Email", description: "Please enter a valid whitelisted email address.", variant: "destructive" });
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/auth/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: staffEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send verification code");
      setOtpSent(true);
      toast({ title: "Code Dispatched! ✉️", description: `Verification code sent to ${staffEmail}.` });
    } catch (err: any) {
      toast({ title: "Verification Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffOtp || staffOtp.length < 6) {
      toast({ title: "Invalid Code", description: "Please enter the 6-digit verification code.", variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: staffEmail.trim(), code: staffOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid or expired code");

      toast({ title: "Whitelisted Access Granted! 🚀", description: "Bypassing maintenance mode..." });
      setIsStaffModalOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-amber-500/5 blur-[160px] pointer-events-none" />

      {/* Top Header / Branding */}
      <header className="relative z-10 max-w-5xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-[1px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-[#0d1424] rounded-[11px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-lg text-white">YouuHost</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 block -mt-1">Cloud Systems</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold backdrop-blur-md animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
            System Maintenance Mode
          </div>
        </div>
      </header>

      {/* Main Hero Card */}
      <main className="relative z-10 max-w-2xl mx-auto w-full px-6 py-8 flex flex-col items-center text-center my-auto">
        {/* Lottie Animation Display */}
        <div className="relative mb-2 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />
          <LottieMaintenance size={280} className="drop-shadow-[0_15px_35px_rgba(0,245,196,0.15)]" />
        </div>

        {/* Status Chip */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-inner">
          <Sparkles className="w-3.5 h-3.5" />
          Infrastructure Upgrade
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
          {title}
        </h1>

        {/* Explanatory Message */}
        <p className="text-sm sm:text-base text-slate-300/80 leading-relaxed max-w-lg mb-6">
          {message}
        </p>

        {/* Estimated Completion Timer if provided */}
        {estimatedEnd && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0f172a]/80 border border-slate-700/60 text-slate-300 text-xs font-medium mb-6">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Estimated Availability: <strong className="text-white">{estimatedEnd}</strong></span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1 min-w-[140px] bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold h-11 rounded-xl shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Checking Status..." : "Refresh Page"}
          </Button>

          <Button
            onClick={() => setIsStaffModalOpen(true)}
            variant="outline"
            className="bg-white/5 hover:bg-white/10 text-slate-200 border-white/10 font-semibold h-11 rounded-xl transition-all"
          >
            <KeyRound className="w-4 h-4 mr-2 text-cyan-400" />
            Whitelisted Sign In
          </Button>
        </div>

        {/* Real-time Safeguard Guarantee */}
        <div className="mt-8 pt-6 border-t border-white/5 w-full max-w-md flex items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Wallet Balances Safe
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Orders Preserved
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 border-t border-white/5">
        <div>
          © 2026 YouuHost Cloud Network. All automated systems safeguarded.
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://t.me/rochana_imesh"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            Telegram Support <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="/imeshadmindashbord"
            className="hover:text-cyan-400 transition-colors"
          >
            Admin Panel
          </a>
        </div>
      </footer>

      {/* Whitelisted Staff Login Dialog */}
      <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
        <DialogContent className="bg-[#0b1220] border border-white/10 text-white max-w-sm rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
              <KeyRound className="w-6 h-6 text-cyan-400" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">Whitelisted Access Portal</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              If your email or Telegram account is whitelisted by the administrator, sign in to bypass maintenance mode.
            </DialogDescription>
          </DialogHeader>

          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Whitelisted Email</label>
                <Input
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="e.g. admin@youuhost.com"
                  className="bg-black/40 border-white/10 text-white h-10 rounded-xl focus:border-cyan-500"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isSendingOtp}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold h-10 rounded-xl shadow-lg shadow-cyan-500/20"
              >
                {isSendingOtp ? "Dispatching Code..." : "Send Verification Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Enter 6-Digit Code</label>
                <Input
                  type="text"
                  maxLength={6}
                  value={staffOtp}
                  onChange={(e) => setStaffOtp(e.target.value)}
                  placeholder="123456"
                  className="bg-black/40 border-white/10 text-center tracking-[0.4em] font-mono text-lg text-white h-11 rounded-xl focus:border-cyan-500"
                  required
                />
                <p className="text-[11px] text-slate-400">Code delivered to {staffEmail}</p>
              </div>
              <Button
                type="submit"
                disabled={isVerifying}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold h-10 rounded-xl shadow-lg shadow-cyan-500/20"
              >
                {isVerifying ? "Verifying..." : "Verify & Enter"}
              </Button>
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="w-full text-xs text-slate-400 hover:text-white transition-colors text-center"
              >
                Use a different email
              </button>
            </form>
          )}

          <div className="mt-4 pt-3 border-t border-white/5 text-center">
            <a
              href="/imeshadmindashbord"
              className="text-xs text-cyan-400/80 hover:text-cyan-300 transition-colors"
            >
              Sign in with Administrator Password →
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MaintenancePage;
