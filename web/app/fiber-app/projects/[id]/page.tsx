import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { ProjectDetailContent } from "./content";

export const metadata = { title: "Project — FiberApp" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <FaPage>
      <Suspense fallback={null}>
        <ProjectDetailContent projectId={id} />
      </Suspense>
    </FaPage>
  );
}
