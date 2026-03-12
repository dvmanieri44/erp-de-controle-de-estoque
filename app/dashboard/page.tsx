import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { getDashboardSummary } from "@/features/dashboard/services/dashboard.service";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return <DashboardScreen summary={summary} />;
}
