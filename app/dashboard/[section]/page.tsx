import { notFound, redirect } from "next/navigation";

import { IndustrialDashboardScreen } from "@/components/dashboard/IndustrialDashboardScreen";
import { LocationsScreen } from "@/components/dashboard/LocationsScreen";
import { MovementsScreen } from "@/components/dashboard/MovementsScreen";
import { OperationsModuleScreen } from "@/components/dashboard/OperationsModuleScreen";
import { RoadmapScreen } from "@/components/dashboard/RoadmapScreen";
import { SettingsScreen } from "@/components/dashboard/SettingsScreen";
import { TraceabilityScreen } from "@/components/dashboard/TraceabilityScreen";
import { TransfersScreen } from "@/components/dashboard/TransfersScreen";
import { readServerSession } from "@/lib/server/auth-session";
import { getSectionById } from "@/lib/dashboard-sections";

type DashboardSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export default async function DashboardSectionPage({ params }: DashboardSectionPageProps) {
  const { section: sectionId } = await params;
  const session = await readServerSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/${sectionId}`)}`);
  }

  const section = getSectionById(sectionId);

  if (!section) {
    notFound();
  }

  if (section.id === "configuracoes") {
    return <SettingsScreen />;
  }

  if (section.id === "dashboard") {
    return <IndustrialDashboardScreen />;
  }

  if (section.id === "localizacoes") {
    return <LocationsScreen />;
  }

  if (section.id === "movimentacoes") {
    return <MovementsScreen />;
  }

  if (section.id === "rastreabilidade") {
    return <TraceabilityScreen section={section} />;
  }

  if (section.id === "transferencias") {
    return <TransfersScreen />;
  }

  if (section.id === "roadmap") {
    return <RoadmapScreen section={section} />;
  }

  return <OperationsModuleScreen section={section} />;
}
