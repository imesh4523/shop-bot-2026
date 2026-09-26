import React, { useState, useRef, useEffect } from "react";
import { ChevronRight, Check, Loader2 } from "lucide-react";

interface SlideToPurchaseProps {
  onComplete: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  text?: string;
  completedText?: string;
  className?: string;
}

export function SlideToPurchase({
  onComplete,
  disabled = false,
  isLoading = false,
  text = "Slide to Confirm Purchase",
  completedText = "Processing Order...",
  className = "",
}: SlideToPurchaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPosition, setSliderPosition] = useState(0); // 0 to 1
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleStart = (clientX: number) => {
    if (disabled || isLoading || isCompleted) return;
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || disabled || isLoading || isCompleted || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const handleWidth = 48;
    const maxDrag = rect.width - handleWidth;
    if (maxDrag <= 0) return;

    const currentX = clientX - rect.left - handleWidth / 2;
    const clamped = Math.max(0, Math.min(currentX, maxDrag));
    const progress = clamped / maxDrag;
    setSliderPosition(progress);

    if (progress >= 0.88) {
      setIsDragging(false);
      setSliderPosition(1);
      setIsCompleted(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch (e) {}
      }
      onComplete();
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (sliderPosition < 0.88) {
      setSliderPosition(0);
    }
  };

  // Touch event listeners
  const onTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  // Mouse event listeners
  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };
    const onMouseUp = () => {
      handleEnd();
    };

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, sliderPosition]);

  // Reset completed state if loading completes or is reset
  useEffect(() => {
    if (!isLoading && !disabled) {
      setIsCompleted(false);
      setSliderPosition(0);
    }
  }, [isLoading, disabled]);

  const progressPercent = Math.round(sliderPosition * 100);

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      className={`relative w-full h-14 rounded-2xl select-none overflow-hidden transition-all p-1 flex items-center ${
        disabled
          ? "bg-gray-100 border border-gray-200 opacity-60 cursor-not-allowed"
          : "bg-gradient-to-r from-[#F4F1FD] via-[#ECE8FC] to-[#E9E4FA] border border-[#D5CDF7] shadow-md shadow-[#6C5CE7]/10 cursor-grab active:cursor-grabbing"
      } ${className}`}
    >
      {/* Dynamic Colored Progress Fill */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#FF5E62] via-[#D92078] to-[#6C5CE7] transition-all"
        style={{
          width: `${Math.max(sliderPosition * 100, isCompleted ? 100 : 0)}%`,
          transition: isDragging ? "none" : "width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      />

      {/* Center Label Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-12">
        <span
          className={`text-xs sm:text-sm font-black tracking-tight transition-all duration-200 flex items-center gap-1.5 ${
            progressPercent > 45 || isCompleted ? "text-white" : "text-[#5B42F3]"
          }`}
        >
          {isLoading || isCompleted ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{completedText}</span>
            </>
          ) : (
            <>
              <span>{text}</span>
              <span className="opacity-70 text-[10px] tracking-widest font-black">❯❯❯</span>
            </>
          )}
        </span>
      </div>

      {/* Drag Thumb Handle */}
      <div
        className={`relative z-10 w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg border border-white/60 transition-transform ${
          isDragging ? "scale-105 shadow-xl" : ""
        }`}
        style={{
          transform: `translateX(${sliderPosition * ((containerRef.current?.offsetWidth || 300) - 56)}px)`,
          transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {isLoading || isCompleted ? (
          <Check className="w-5 h-5 text-emerald-600 font-black animate-bounce" />
        ) : (
          <div className="flex items-center justify-center text-[#6C5CE7] font-black">
            <ChevronRight className="w-5 h-5 -mr-2 text-[#FF5E62]" />
            <ChevronRight className="w-5 h-5 text-[#6C5CE7]" />
          </div>
        )}
      </div>
    </div>
  );
}
