import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { FormsContent } from "./content";

export const metadata = { title: "Forms — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <FormsContent />
      </Suspense>
    </FaPage>
  );
}
