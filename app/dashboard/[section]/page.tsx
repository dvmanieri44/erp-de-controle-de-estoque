import { notFound } from "next/navigation";

import { SectionScreen } from "@/components/dashboard/SectionScreen";
import { DEFAULT_SECTION_ID, DASHBOARD_SECTIONS, getSectionById } from "@/lib/dashboard-sections";

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

export function generateStaticParams() {
  return DASHBOARD_SECTIONS.filter((section) => section.id !== DEFAULT_SECTION_ID).map((section) => ({
    section: section.id,
  }));
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  const selectedSection = getSectionById(section);

  if (!selectedSection || selectedSection.id === DEFAULT_SECTION_ID) {
    notFound();
  }

  return <SectionScreen section={selectedSection} />;
}
