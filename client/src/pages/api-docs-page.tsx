import { useEffect } from "react";

export default function ApiDocsPage() {
  useEffect(() => {
    document.title = "youuhost · API Docs";
  }, []);

  return (
    <div className="w-full h-screen bg-[#0f0e17] overflow-hidden">
      <iframe
        src="/docs"
        title="youuhost REST API Reference"
        className="w-full h-full border-0 block"
      />
    </div>
  );
}
