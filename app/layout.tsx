import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "甲醛监测 Dashboard",
  description: "实时展示 Supabase 中的甲醛传感器数据",
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
