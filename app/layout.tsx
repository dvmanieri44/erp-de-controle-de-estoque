import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fluxy",
  description: "Fluxy ERP para estoque, operacoes internas e rastreabilidade",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = localStorage.getItem("theme-preference") || "claro";
                  var storedLanguage = localStorage.getItem("language-preference") || "pt-BR";
                  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  var resolvedTheme = storedTheme === "automatico" ? (prefersDark ? "escuro" : "claro") : storedTheme;
                  document.documentElement.dataset.theme = resolvedTheme === "escuro" ? "dark" : "light";
                  document.documentElement.lang = storedLanguage;
                } catch (error) {
                  document.documentElement.dataset.theme = "light";
                  document.documentElement.lang = "pt-BR";
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
