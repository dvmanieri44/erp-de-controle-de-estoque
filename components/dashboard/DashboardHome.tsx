import { SectionScreen } from "@/components/dashboard/SectionScreen";
import { DEFAULT_SECTION_ID, getSectionById } from "@/lib/dashboard-sections";

export function DashboardHome() {
  const defaultSection = getSectionById(DEFAULT_SECTION_ID);

  if (!defaultSection) {
    return null;
  }

  return <SectionScreen section={defaultSection} />;
}
