import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

const fontLinks = `
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
`;

export const metadata: Metadata = {
  title: "Agri-Gain | AI Decision Workspace for Agricultural Waste",
  description:
    "Agri-Gain investigates your agricultural waste — calculating value, searching live markets, weighing every pathway — and explains exactly why one option beats the rest.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-full">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#ffffff",
              border: "1px solid #e5e5df",
              color: "#1a2421",
              borderRadius: "2px",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
