import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Air Filter Fulfillment",
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
      <body>
        <nav className="top">
          <Link href="/" className="brand">
            Air Filter Fulfillment
          </Link>
          <Link href="/">Jobs</Link>
          <Link href="/new">New Job</Link>
          <Link href="/history">History</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
