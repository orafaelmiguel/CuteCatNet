import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Device } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2, ScanLine, WifiOff } from "lucide-react";

export function DeviceScanView() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergeDevices = (prev: Device[], next: Device[]) => {
    const map = new Map(prev.map((d) => [d.mac_address, d] as const));
    for (const d of next) {
      const ex = map.get(d.mac_address);
      if (!ex) {
        map.set(d.mac_address, d);
      } else {
        const manufacturer = ex.manufacturer === "Unknown" && d.manufacturer !== "Unknown" ? d.manufacturer : ex.manufacturer;
        const ip_address = ex.ip_address === d.ip_address ? ex.ip_address : d.ip_address;
        const hostname = ex.hostname === "Unknown" && d.hostname !== "Unknown" ? d.hostname : ex.hostname;
        map.set(d.mac_address, { ...ex, ip_address, manufacturer, hostname });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ip_address.localeCompare(b.ip_address));
  };

  const handleScan = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Device[]>("scan_network");
      setDevices(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepeatScan = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Device[]>("scan_network");
      setDevices((prev) => mergeDevices(prev, result));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 p-2">
              <Skeleton className="h-4 w-full" />
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
          <h3 className="mt-4 text-lg font-medium">No devices found yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Scan Network" to discover connected devices.
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
            <TableHead>Hostname</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((device) => (
            <TableRow key={device.mac_address}>
              <TableCell className="font-mono">{device.ip_address}</TableCell>
              <TableCell className="font-mono">{device.mac_address}</TableCell>
              <TableCell>{device.manufacturer}</TableCell>
              <TableCell className="font-mono">{device.hostname}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1.5">
          <CardTitle>Network Device Scanner</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleScan} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Scanning..." : "Scan Network"}
          </Button>
          {devices.length > 0 && (
            <Button onClick={handleRepeatScan} disabled={isLoading} variant="secondary">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="mr-2 h-4 w-4" />
              )}
              {isLoading ? "Scanning..." : "Repeat Scan"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}