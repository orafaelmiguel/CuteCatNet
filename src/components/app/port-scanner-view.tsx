import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network } from "lucide-react";

export function PortScannerView() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          <CardTitle>Port Scanner</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-10">
          <Network className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Port Scanner</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Coming soon - Scan open ports on network devices.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}