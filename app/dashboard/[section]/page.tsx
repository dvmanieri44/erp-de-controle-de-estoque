import { notFound } from "next/navigation";

import { IndustrialDashboardScreen } from "@/components/dashboard/IndustrialDashboardScreen";
import { LocationsScreen } from "@/components/dashboard/LocationsScreen";
import { MovementsScreen } from "@/components/dashboard/MovementsScreen";
import { OperationsModuleScreen } from "@/components/dashboard/OperationsModuleScreen";
import { SettingsScreen } from "@/components/dashboard/SettingsScreen";
import { TransfersScreen } from "@/components/dashboard/TransfersScreen";
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

  if (section.id === "dashboard") {
    return <IndustrialDashboardScreen />;
  }

  if (section.id === "localizacoes") {
    return <LocationsScreen />;
  }

  if (section.id === "movimentacoes") {
    return <MovementsScreen />;
  }

  if (section.id === "transferencias") {
    return <TransfersScreen />;
  }

  return <OperationsModuleScreen section={section} />;
}
