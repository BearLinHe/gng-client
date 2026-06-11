import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GNG Transport Client",
  description: "GNG Transport Inc customer client portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
