import { redirect } from "next/navigation";

import { LoginScreen } from "@/components/login/LoginScreen";
import { readServerSession } from "@/lib/server/auth-session";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    resetToken?: string;
  }>;
};

function resolveNextPath(value?: string) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = resolveNextPath(params.next);
  const resetToken = typeof params.resetToken === "string" ? params.resetToken : null;
  const session = await readServerSession();

  if (session && !resetToken) {
    redirect(nextPath);
  }

  return <LoginScreen nextPath={nextPath} resetToken={resetToken} />;
}
