import type { Metadata } from "next";
import Link from "next/link";
import { NavLinks } from "./NavLinks";
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
            <span className="logo-mark" aria-hidden>
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 5h18l-7 8v6l-4-2v-4z" />
              </svg>
            </span>
            Air Filter Fulfillment
          </Link>
          <NavLinks />
        </nav>
        {children}
      </body>
    </html>
  );
}
