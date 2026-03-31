import { notFound } from "next/navigation";

import { LocationsScreen } from "@/components/dashboard/LocationsScreen";
import { SectionScreen } from "@/components/dashboard/SectionScreen";
import { SettingsScreen } from "@/components/dashboard/SettingsScreen";
import { getSectionById } from "@/lib/dashboard-sections";

type DashboardSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export default async function DashboardSectionPage({ params }: DashboardSectionPageProps) {
  const { section: sectionId } = await params;
  const section = getSectionById(sectionId);

  if (!section) {
    notFound();
  }

  if (section.id === "configuracoes") {
    return <SettingsScreen />;
  }

  if (section.id === "localizacoes") {
    return <LocationsScreen />;
  }

  return <SectionScreen section={section} />;
}
