import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export function NetworkStressView() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <CardTitle>Network Stress Tester</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-10">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Network Stress Tester</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Coming soon - Test network performance and reliability.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}