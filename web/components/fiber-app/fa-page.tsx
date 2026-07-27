import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/** Standard FiberApp page chrome — matches the rest of Dono Utilities. */
export function FaPage({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
