import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PromptProvider } from "@/components/ui/prompt";
import { AppShell } from "@/components/layout/AppShell";
import { SCRIPT_TEMA } from "@/lib/tema";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finanças 💰",
  description: "Suas finanças pessoais — fluxo de caixa, patrimônio e investimentos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica o tema salvo (ou o do sistema) ANTES da 1ª pintura: sem
            piscar branco no modo escuro. Ver docs: preventing-flash-before-hydration. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">
        <PromptProvider>
          <AppShell>{children}</AppShell>
        </PromptProvider>
      </body>
    </html>
  );
}
