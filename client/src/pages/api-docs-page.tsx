import { useEffect } from "react";

export default function ApiDocsPage() {
  useEffect(() => {
    document.title = "youuhost · REST API Documentation";
  }, []);

  return (
    <div className="w-full h-screen bg-[#0b0b14] overflow-hidden flex flex-col">
      <iframe
        src="/docs"
        title="youuhost REST API Reference"
        className="w-full h-full border-0 flex-1 block"
        allow="clipboard-write; clipboard-read"
      />
    </div>
  );
}


