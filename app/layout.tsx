import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanban",
  description:
    "An open-source, self-hostable Kanban board for personal and team projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
