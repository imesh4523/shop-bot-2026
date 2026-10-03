import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function ApiDocsPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    document.title = "youuhost · REST API Documentation";
  }, []);

  return (
    <div className="w-full h-screen bg-[#0b0b14] relative overflow-hidden flex flex-col">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0b0b14] text-white">
          <div className="flex items-center gap-3 text-purple-400 font-semibold text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading API Documentation & Interactive Client...</span>
          </div>
        </div>
      )}
      <iframe
        src="/docs"
        title="youuhost REST API Reference"
        className="w-full h-full border-0 flex-1 block"
        allow="clipboard-write; clipboard-read"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}


