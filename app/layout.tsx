"use client";

import type { Metadata } from "next";
import { useEffect } from "react";
import "./globals.css";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}