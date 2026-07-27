import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { ProjectsContent } from "./content";

export const metadata = { title: "Projects — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <ProjectsContent />
      </Suspense>
    </FaPage>
  );
}
