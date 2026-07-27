import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { CustomersContent } from "./content";

export const metadata = { title: "Customers — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <CustomersContent />
      </Suspense>
    </FaPage>
  );
}
