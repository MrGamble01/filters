"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Format a File" },
  { href: "/reports", label: "Reports" },
  { href: "/history", label: "Shipment History" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {LINKS.map((l) => {
        const active =
          l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`navlink${active ? " active" : ""}`}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
