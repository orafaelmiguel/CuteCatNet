import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Device } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { AlertCircle, Loader2, ScanLine, WifiOff } from "lucide-react";

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Device[]>("scan_network");
      setDevices(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setDevices([]); // Clear list on error
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-3 gap-4 p-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Scan Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    if (devices.length === 0) {
      return (
        <div className="text-center py-10">
          <WifiOff className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No kittens on the network yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Scan Network" to find connected devices.
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>IP Address</TableHead>
            <TableHead>MAC Address</TableHead>
            <TableHead>Manufacturer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((device) => (
            <TableRow key={device.mac_address}>
              <TableCell className="font-mono">{device.ip_address}</TableCell>
              <TableCell className="font-mono">{device.mac_address}</TableCell>
              <TableCell>{device.manufacturer}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col min-h-screen">
      <header className="flex justify-between items-center pb-4 border-b mb-6">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="CuteCatNet Logo" className="h-8 w-8" />
          <h1 className="text-2xl font-bold tracking-tight">CuteCatNet</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-grow">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle>Devices on Network</CardTitle>
            </div>
            <Button onClick={handleScan} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="mr-2 h-4 w-4" />
              )}
              {isLoading ? "Scanning..." : "Scan Network"}
            </Button>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>
      </main>

      <footer className="text-center text-sm text-muted-foreground pt-6">
        Made with 🐾 and Rust.
      </footer>
    </div>
  );
}

export default App;
