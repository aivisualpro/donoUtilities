import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { MarkersContent } from "./content";

export const metadata = { title: "Markers & Lines — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <MarkersContent />
      </Suspense>
    </FaPage>
  );
}
