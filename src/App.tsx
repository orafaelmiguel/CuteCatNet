import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { DeviceScanView } from "@/components/app/device-scan-view";
import { PortScannerView } from "@/components/app/port-scanner-view";
import { NetworkStressView } from "@/components/app/network-stress-view";
import { ThemeToggle } from "@/components/app/theme-toggle";

function App() {
  const [activeView, setActiveView] = useState("device-scan");

  const renderView = () => {
    switch (activeView) {
      case "device-scan":
        return <DeviceScanView />;
      case "port-scanner":
        return <PortScannerView />;
      case "network-stress":
        return <NetworkStressView />;
      default:
        return <DeviceScanView />;
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
          </div>
          <ThemeToggle />
        </header>
        <div className="flex-1 p-6">
          {renderView()}
        </div>
      </main>
    </SidebarProvider>
  );
}

export default App;
