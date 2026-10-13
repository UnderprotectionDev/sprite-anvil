import { RootProvider } from "fumadocs-ui/provider/next";

import "./global.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getMetadataBase } from "../lib/metadata-base";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(process.env.NEXT_PUBLIC_DOCS_URL),
};

const inter = Inter({
  subsets: ["latin"],
});

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html className={inter.className} lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
