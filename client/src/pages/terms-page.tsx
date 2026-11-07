import React from "react";
import { Link } from "wouter";
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  XCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { FaWhatsapp, FaTelegramPlane } from "react-icons/fa";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#121214] text-[#E4E4E7] font-sans selection:bg-[#5B42F3] selection:text-white pb-16">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#121214]/90 backdrop-blur-md border-b border-[#27272A] px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#5B42F3] to-[#38B6FF] p-0.5 shadow-lg shadow-[#5B42F3]/20 flex items-center justify-center">
              <img
                src="/assets/youuhost_logo.png"
                alt="YouuHost"
                className="w-full h-full object-contain rounded-[10px]"
                onError={(e) => {
                  (e.target as any).style.display = "none";
                }}
              />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white group-hover:text-[#38B6FF] transition-colors flex items-center gap-1.5">
                YOUUHOST <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#27272A] text-[#A1A1AA] font-bold">PLATFORM</span>
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] text-xs font-bold text-white transition-all active:scale-95 border border-[#3F3F46]"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Store
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12">
        {/* Title Section matching Reference Dark UI */}
        <div className="space-y-3 pb-8 border-b border-[#27272A]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Official Platform Agreement
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            YouuHost Platform Terms of Use & Digital Agreement
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-[#A1A1AA] pt-1">
            <span>LAST REVISED: MARCH 2026</span>
            <span>•</span>
            <span>VERSION 4.2</span>
            <span>•</span>
            <span className="text-emerald-400 font-black">LEGALLY BINDING</span>
          </div>
        </div>

        {/* Important Notice Callout: STRICT NO-REFUND POLICY */}
        <div className="my-8 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-red-950/40 via-[#1E1214] to-red-950/20 border border-red-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-red-300 tracking-tight flex items-center gap-2">
                CRITICAL NOTICE: STRICT NON-REFUNDABLE DIGITAL GOODS POLICY
              </h3>
              <p className="text-xs sm:text-sm text-red-200/80 leading-relaxed font-medium">
                Due to the intangible, instant-delivery, and non-returnable nature of digital items, cloud server allocations, account credentials, license keys, and API tokens sold on YouuHost, <b>ALL SALES ARE FINAL</b>. Once an order is processed, credentials issued, or server resources provisioned, <b>NO REFUNDS, CASH REVERSALS, OR ORDER CANCELLATIONS WILL BE ISSUED UNDER ANY CIRCUMSTANCES</b>.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Sections List */}
        <div className="space-y-10 text-sm leading-relaxed text-[#D4D4D8]">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#27272A] flex items-center justify-center text-xs font-black text-[#38B6FF]">1</span>
              Acceptance of Terms & Binding Legal Agreement
            </h2>
            <div className="space-y-3 text-[#A1A1AA] text-xs sm:text-[13.5px] leading-relaxed">
              <p>
                By accessing or using the <b>YouuHost Mini-App</b>, Telegram Bots, Web Portals (<a href="https://youuhost.com" className="text-[#38B6FF] underline">youuhost.com</a>), API endpoints, or by placing an order for any product or service, you (the <b>"Customer"</b>, <b>"User"</b>, or <b>"You"</b>) explicitly acknowledge, agree to, and are legally bound by these Terms of Service (the <b>"Terms"</b>).
              </p>
              <p>
                If you do not agree unconditionally to all provisions contained herein, you must immediately cease using the platform and refrain from placing any orders or funding your account wallet.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#27272A] flex items-center justify-center text-xs font-black text-[#38B6FF]">2</span>
              Digital Assets, Delivery & Strict No-Refund Policy
            </h2>
            <div className="space-y-3 text-[#A1A1AA] text-xs sm:text-[13.5px] leading-relaxed">
              <p>
                <b>2.1 Nature of Goods:</b> All products offered by YouuHost—including Cloud VPS/RDP instances, AI subscriptions (Gemini, ChatGPT, Claude), software licenses, Windows Activation Keys, Canva Pro accounts, Hotmail/Outlook emails, Adobe Express VIP packages, and Telegram/Spotify subscriptions—are intangible digital assets delivered electronically.
              </p>
              <p>
                <b>2.2 Automated Instant Fulfillment:</b> Digital credentials and license keys are delivered immediately (0-2 minutes) upon blockchain or payment gateway confirmation and are permanently tied to your customer order record.
              </p>
              <p>
                <b>2.3 All Sales Are Final:</b> Payment completion constitutes full consumption and fulfillment of the order. YouuHost strictly does not provide refunds, chargebacks, exchanges, or balance withdrawals once an order is created or funds are deposited into your platform wallet.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#27272A] flex items-center justify-center text-xs font-black text-[#38B6FF]">3</span>
              Warranty Coverage, Replacement Guarantee & Verification
            </h2>
            <div className="space-y-3 text-[#A1A1AA] text-xs sm:text-[13.5px] leading-relaxed">
              <p>
                <b>3.1 Initial Login Warranty:</b> All verified accounts and keys carry a standard <b>24-Hour to 48-Hour Initial Verification Guarantee</b> from the moment of purchase, unless a specific extended warranty is explicitly stated in the product description.
              </p>
              <p>
                <b>3.2 Replacement Eligibility:</b> If delivered credentials, keys, or invitations fail to function upon initial receipt, the customer must submit clear, unedited photo/video evidence to official support within the warranty window. Following technical verification, our team will provide a direct <b>1-to-1 replacement</b> or store credit equivalent.
              </p>
              <p>
                <b>3.3 Voiding of Warranty:</b> The warranty is instantly nullified and void under any of the following circumstances:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-red-300/90 font-medium">
                <li>Unauthorized modification of shared recovery emails, passwords, or primary security settings.</li>
                <li>Violation of third-party platform terms of service (e.g., triggering automated bans on AWS/Oracle/Google Cloud due to prohibited abusive traffic).</li>
                <li>Sharing, reselling, or public leaking of delivered private credentials.</li>
                <li>Attempting to claim false defects or fraudulent chargeback attempts.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#27272A] flex items-center justify-center text-xs font-black text-[#38B6FF]">4</span>
              Customer Responsibilities, 2FA & Security Management
            </h2>
            <div className="space-y-3 text-[#A1A1AA] text-xs sm:text-[13.5px] leading-relaxed">
              <p>
                <b>4.1 Credential Safekeeping:</b> You are solely responsible for securing, backing up, and safeguarding all delivered usernames, passwords, 2FA recovery keys, and API tokens. YouuHost is not responsible for lost access due to customer negligence or local device compromise.
              </p>
              <p>
                <b>4.2 Two-Factor Authentication (2FA):</b> For accounts with 2FA enabled, you must record and store the provided TOTP secret key or backup codes immediately.
              </p>
              <p>
                <b>4.3 Third-Party Terms Compliance:</b> When utilizing accounts or services associated with third-party providers (including Microsoft, Amazon Web Services, Google Cloud, Canva, Adobe, OpenAI, Spotify, Linode, Oracle), you agree to comply fully with their respective acceptable use policies.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#27272A] flex items-center justify-center text-xs font-black text-[#38B6FF]">5</span>
              Prohibited Activities, Fraud Prevention & Zero Tolerance
            </h2>
            <div className="space-y-3 text-[#A1A1AA] text-xs sm:text-[13.5px] leading-relaxed">
              <p>
                YouuHost enforces a strict zero-tolerance policy against malicious or fraudulent use. Prohibited activities include, but are not limited to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[#D4D4D8]">
                <li>Executing DDoS attacks, unauthorized port scanning, or vulnerability exploitation.</li>
                <li>Operating illegal botnets, high-volume spam campaigns, or phishing schemes.</li>
                <li>Unauthorized cryptocurrency mining on non-mining dedicated server tiers.</li>
                <li>Payment fraud, stolen card usage, or illicit automated bot abuses.</li>
              </ul>
              <p>
                <b>Consequences of Violation:</b> Any confirmed violation will result in the immediate termination of all active services, permanent forfeiture of remaining wallet balance, and permanent blacklisting without notice or right of appeal.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#27272A] flex items-center justify-center text-xs font-black text-[#38B6FF]">6</span>
              Modifications to Terms & Automatic Continued Consent
            </h2>
            <div className="space-y-3 text-[#A1A1AA] text-xs sm:text-[13.5px] leading-relaxed">
              <p>
                YouuHost reserves the exclusive and unrestricted right to modify, amend, update, or revise these Terms of Service, pricing schedules, warranty conditions, or platform features at any time without prior individual notice.
              </p>
              <p>
                Any updates will take effect immediately upon being published on this page. Your continued access to the platform or placement of future orders following any modifications constitutes your <b>irrevocable, automatic, and binding consent</b> to all updated terms and conditions.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 pb-8">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#27272A] flex items-center justify-center text-xs font-black text-[#38B6FF]">7</span>
              Official Support Channels & Dispute Handling
            </h2>
            <div className="space-y-3 text-[#A1A1AA] text-xs sm:text-[13.5px] leading-relaxed">
              <p>
                For legitimate technical support, warranty replacement claims, or billing inquiries, our official customer assistance channels are available 24/7:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a
                  href="https://wa.me/94770314260?text=Hello%20YouuHost%20Support%2C%20I%20have%20an%20inquiry%20regarding%20my%20order."
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-[#1E293B]/50 hover:bg-[#1E293B] border border-emerald-500/30 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <FaWhatsapp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block group-hover:text-emerald-400 transition-colors">Official WhatsApp Support</span>
                    <span className="text-[11px] text-[#A1A1AA] block">+94 77 031 4260</span>
                  </div>
                </a>

                <a
                  href="https://t.me/youuhost"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-[#1E293B]/50 hover:bg-[#1E293B] border border-sky-500/30 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    <FaTelegramPlane className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block group-hover:text-sky-400 transition-colors">Telegram VIP Concierge</span>
                    <span className="text-[11px] text-[#A1A1AA] block">@youuhost_support</span>
                  </div>
                </a>
              </div>
            </div>
          </section>

        </div>

        {/* Footer info banner */}
        <div className="pt-8 border-t border-[#27272A] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-[#71717A]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>© 2026 YouuHost Cloud Network. All Rights Reserved.</span>
          </div>
          <Link href="/" className="text-[#38B6FF] hover:underline">
            Return to Store & Mini-App
          </Link>
        </div>
      </main>
    </div>
  );
}
