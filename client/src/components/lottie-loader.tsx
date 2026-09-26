import { useEffect, useRef } from "react";
import lottie from "lottie-web/build/player/lottie_light";
import animationData from "@/assets/loading-animation.json";

interface LottieLoaderProps {
  size?: number | string;
  className?: string;
  text?: string;
}

export function LottieLoader({ size = 160, className = "", text }: LottieLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: animationData,
    });

    return () => {
      anim.destroy();
    };
  }, []);

  const sizeStyle = typeof size === "number" ? { width: `${size}px`, height: `${size}px` } : { width: size, height: size };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div ref={containerRef} style={sizeStyle} className="relative select-none pointer-events-none" />
      {text && (
        <p className="mt-2 text-xs font-bold text-[#7E7998] tracking-wide animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

export function PageLottieLoader({ text }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F8F7FD]/90 backdrop-blur-md">
      <div className="flex flex-col items-center justify-center p-8">
        <LottieLoader size={180} text={text} />
      </div>
    </div>
  );
}

export default LottieLoader;
