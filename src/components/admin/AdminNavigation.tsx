"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Ringkasan", number: "01" },
  { href: "/admin/missions", label: "Pengajuan Mission", number: "02" },
  { href: "/admin/results", label: "Hasil Mission", number: "03" },
  { href: "/admin/achievements", label: "Klaim Prestasi", number: "04" },
  { href: "/admin/guide", label: "Panduan Admin", number: "05" },
];

export default function AdminNavigation() {
  const pathname = usePathname();
  return <nav className="nexus-admin-nav" aria-label="Navigasi admin">
    {items.map(({ href, label, number }) => {
      const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}>
        <span aria-hidden="true">{number}</span>{label}
      </Link>;
    })}
  </nav>;
}
