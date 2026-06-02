import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { QueryProvider } from "@/lib/query-client";
import { ShellWrapper } from "@/components/layout/shell-wrapper";

export const metadata: Metadata = {
  title: "推しスケ",
  description: "ライブ遠征管理アプリ"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <ShellWrapper>{children}</ShellWrapper>
        </QueryProvider>
      </body>
    </html>
  );
}
