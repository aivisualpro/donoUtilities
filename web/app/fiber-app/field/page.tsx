import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { FieldContent } from "./content";

export const metadata = { title: "Field Mode — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <FieldContent />
      </Suspense>
    </FaPage>
  );
}
