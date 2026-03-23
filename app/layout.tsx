import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UK Entry-Level Sponsored Jobs Demo",
  description: "Demo app matching Reed jobs with local UK sponsor licence CSV"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
