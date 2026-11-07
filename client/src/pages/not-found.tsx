import { Lottie404 } from "@/components/lottie-loader";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F8F9FD] p-4 text-center select-none overflow-hidden">
      <div className="max-w-md w-full flex flex-col items-center justify-center">
        <div className="w-full flex justify-center">
          <Lottie404 size={320} className="max-w-full max-h-[65vh]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#181432] tracking-tight mt-2">
          404 - Page Not Found
        </h1>
      </div>
    </div>
  );
}
