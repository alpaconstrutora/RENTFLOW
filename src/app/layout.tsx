import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentFlow | Clareza Financeira para Investidores",
  description: "A maioria dos investidores acha que lucra até ver os números reais. Descubra seu lucro real, retornos e inadimplência em segundos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
