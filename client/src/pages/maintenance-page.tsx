import { LottieMaintenance } from "@/components/lottie-loader";

interface MaintenancePageProps {
  title?: string;
  message?: string;
  estimatedEnd?: string;
  onRefresh?: () => void;
}

export function MaintenancePage({ onRefresh }: MaintenancePageProps = {}) {
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      onClick={handleRefresh}
      className="min-h-screen w-full flex flex-col items-center justify-center bg-white p-4 text-center select-none overflow-hidden cursor-pointer"
      title="Click to refresh"
    >
      <div className="max-w-xl w-full flex flex-col items-center justify-center">
        <div className="w-full flex justify-center items-center">
          <LottieMaintenance size={380} className="max-w-full max-h-[80vh]" />
        </div>
      </div>
    </div>
  );
}

export default MaintenancePage;
