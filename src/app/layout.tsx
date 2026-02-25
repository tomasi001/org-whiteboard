import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Org Whiteboard",
  description: "Interactive organisational whiteboarding tool for workflow mapping and process mapping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
