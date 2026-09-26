import { Link } from "wouter";
import { Lottie404 } from "@/components/lottie-loader";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F8F9FD] p-6 text-center select-none">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-[#ECEEF8] flex flex-col items-center">
        <div className="w-full flex justify-center -mt-4 mb-2">
          <Lottie404 size={280} />
        </div>

        <h1 className="text-2xl font-black text-[#181432] tracking-tight">
          404 - Page Not Found
        </h1>
        
        <p className="mt-2 text-xs font-semibold text-[#7E7998] max-w-xs leading-relaxed">
          The page or route you are looking for does not exist or has been moved.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-1/2 h-11 px-4 rounded-2xl bg-[#F8F7FD] hover:bg-[#ECEEF8] text-[#181432] text-xs font-bold flex items-center justify-center gap-2 border border-[#ECEEF8] transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>

          <Link href="/" className="w-full sm:w-1/2">
            <button className="w-full h-11 px-4 rounded-2xl bg-gradient-to-r from-[#FF5E62] via-[#D92078] to-[#6C5CE7] hover:opacity-90 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-[#6C5CE7]/20 transition-all active:scale-95">
              <Home className="w-4 h-4" /> Return Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
