import { redirect } from "next/navigation";

import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { readServerSession } from "@/lib/server/auth-session";

export default async function DashboardPage() {
  const session = await readServerSession();

  if (!session) {
    redirect("/login?next=/dashboard");
  }

  return <DashboardHome />;
}
