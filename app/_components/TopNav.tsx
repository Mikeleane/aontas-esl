"use client";

import Link from "next/link";
import React from "react";

const BRAND = {
  ink: "#0f172a",
  muted: "#475569",
  line: "rgba(15,23,42,.14)",
  panel: "rgba(255,255,255,.78)",
  accent: "#2d7d4f",
};

const wrap: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  backdropFilter: "blur(10px)",
  background: BRAND.panel,
  borderBottom: `1px solid ${BRAND.line}`,
};

const inner: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const brand: React.CSSProperties = {
  fontWeight: 1000,
  color: BRAND.ink,
  letterSpacing: 0.2,
  display: "flex",
  alignItems: "center",
  gap: 10,
  whiteSpace: "nowrap",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 999,
  border: `1px solid ${BRAND.line}`,
  color: BRAND.ink,
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 12,
  background: "white",
};

const links: Array<{ href: string; label: string }> = [
  { href: "/pack", label: "Reading" },
  { href: "/exercises", label: "Exercises" },
  { href: "/wordiness", label: "Wordiness" },
  { href: "/social", label: "Social Thread" },
  { href: "/h5p", label: "H5P" },
];

export default function TopNav() {
  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={brand}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: BRAND.accent, display: "inline-block" }} />
          Aontas ESL
          <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted }}>• studio</span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={pill}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}