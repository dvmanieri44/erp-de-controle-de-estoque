import { LoginScreen } from "@/components/login/LoginScreen";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
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

  return <LoginScreen nextPath={resolveNextPath(params.next)} />;
}
