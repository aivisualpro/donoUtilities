import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { SyncStatusContent } from "./content";

export const metadata = { title: "Sync Status — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <SyncStatusContent />
      </Suspense>
    </FaPage>
  );
}
