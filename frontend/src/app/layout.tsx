import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../lib/providers";
import ErrorBoundary from "../components/ErrorBoundary";

export const metadata: Metadata = {
  title: "La Carta - Reserve, Pre-order, Dine",
  description: "Skip lines, savor time, smile bigger. Reserve your table and pre-order your meal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
