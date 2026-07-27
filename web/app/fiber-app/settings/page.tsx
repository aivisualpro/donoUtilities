import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { SettingsContent } from "./content";

export const metadata = { title: "Settings — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <SettingsContent />
      </Suspense>
    </FaPage>
  );
}
