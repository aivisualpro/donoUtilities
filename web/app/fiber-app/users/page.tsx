import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { CrewContent } from "./content";

export const metadata = { title: "Crew — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <CrewContent />
      </Suspense>
    </FaPage>
  );
}
