import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fluxy | Login",
  description: "Acesso ao painel do Fluxy",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
