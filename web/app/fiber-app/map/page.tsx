import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { MapContent } from "./content";

export const metadata = { title: "Map View — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <MapContent />
      </Suspense>
    </FaPage>
  );
}
