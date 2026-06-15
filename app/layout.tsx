import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Air Filter Fulfillment Platform",
  description:
    "Ingest property-management tenant exports and produce ShipStation import CSVs and Update-Filter-Sizes dashboard files.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
