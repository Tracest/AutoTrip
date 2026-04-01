import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoTrip",
  description: "A single-user AI trip planning workspace with editable itineraries."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
