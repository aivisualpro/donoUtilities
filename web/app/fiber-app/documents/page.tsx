import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { DocumentsContent } from "./content";

export const metadata = { title: "Documents — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <DocumentsContent />
      </Suspense>
    </FaPage>
  );
}
