import { ScanLine, Network, ShieldCheck } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"

const items = [
  {
    title: "Device Scan",
    icon: ScanLine,
    id: "device-scan",
  },
  {
    title: "Port Scanner",
    icon: Network,
    id: "port-scanner",
  },
  {
    title: "Network Stress Tester",
    icon: ShieldCheck,
    id: "network-stress",
  },
]

interface AppSidebarProps {
  activeView: string
  onViewChange: (view: string) => void
}

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">CuteCatNet</h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Network Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.id)}
                    isActive={activeView === item.id}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          Exploring networks in a cute way
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}