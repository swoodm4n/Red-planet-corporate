import type { ReactNode } from "react";

export const metadata = {
  title: "Red Planet Corporate — API",
  description: "Backend API for Red Planet Corporate (Mars Colonial Initiative).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
