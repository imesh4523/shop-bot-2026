import { useEffect, useRef } from "react";
import lottie from "lottie-web/build/player/lottie_light";
import animation404Data from "@/assets/animation-404.json";
import animationPaymentData from "@/assets/animation-payment.json";

interface LottiePlayerProps {
  animationData: any;
  size?: number | string;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
}

export function LottiePlayer({
  animationData,
  size = 180,
  className = "",
  loop = true,
  autoplay = true,
}: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !animationData) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop,
      autoplay,
      animationData,
    });

    return () => {
      anim.destroy();
    };
  }, [animationData, loop, autoplay]);

  const sizeStyle =
    typeof size === "number"
      ? { width: `${size}px`, height: `${size}px` }
      : { width: size, height: size };

  return (
    <div
      ref={containerRef}
      style={sizeStyle}
      className={`relative select-none pointer-events-none ${className}`}
    />
  );
}

/** 404 Animation Component */
export function Lottie404({ size = 280, className = "" }: { size?: number | string; className?: string }) {
  return <LottiePlayer animationData={animation404Data} size={size} className={className} />;
}

/** Payment / Checkout Processing Animation Component */
export function LottiePayment({ size = 180, className = "" }: { size?: number | string; className?: string }) {
  return <LottiePlayer animationData={animationPaymentData} size={size} className={className} />;
}

/** Fullscreen Payment Processing Modal Overlay with ~3s animation */
export function PaymentProcessingModal({
  isOpen,
  title = "Processing Secure Payment...",
  subtitle = "Please wait while we connect to the gateway",
}: {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl border border-white/20 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
        <div className="my-2">
          <LottiePayment size={180} />
        </div>
        <h3 className="text-base font-black text-[#181432] tracking-tight mt-1">
          {title}
        </h3>
        <p className="text-xs font-semibold text-[#7E7998] mt-1.5 leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export default LottiePlayer;
