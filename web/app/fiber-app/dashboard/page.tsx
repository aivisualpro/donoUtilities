import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { DashboardContent } from "./content";

export const metadata = { title: "Dashboard — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <DashboardContent />
      </Suspense>
    </FaPage>
  );
}
