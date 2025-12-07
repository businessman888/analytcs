import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { BarChart3, Home, TrendingUp, User } from "lucide-react";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NBA Precision Analytics",
  description: "Trading esportivo com vantagem matemática. Análises de apostas baseadas em dados reais.",
};

const navItems = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/analysis", icon: TrendingUp, label: "Análise" },
  { href: "/profile", icon: User, label: "Perfil" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-slate-950 text-white min-h-screen`}
        suppressHydrationWarning
      >
        <Providers>
          <ToastProvider>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
              <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <h1 className="font-bold text-lg leading-tight">NBA Precision</h1>
                    <p className="text-xs text-gray-400">Analytics v2</p>
                  </div>
                </Link>

                <nav className="flex items-center gap-1">
                  {navItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <item.icon size={18} />
                      <span className="hidden md:inline">{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </header>

            {/* Main Content */}
            <main className="pt-20 pb-8 px-4 max-w-7xl mx-auto">
              {children}
            </main>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}

