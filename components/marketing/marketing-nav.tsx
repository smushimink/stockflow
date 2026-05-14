"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" };

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50"
      style={{
        background: "rgba(254,253,251,0.85)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        borderBottom: scrolled ? "1px solid #E0DDD5" : "1px solid transparent",
        transition: "border-color 0.2s",
        height: "60px",
      }}
    >
      <div
        className="mx-auto px-6 h-full flex items-center justify-between"
        style={{ maxWidth: "1100px" }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline" aria-label="ArachNet home">
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: 32, height: 32, background: "#18170F", borderRadius: 8 }}
          >
            <span style={{ ...serif, color: "#FEFDFB", fontSize: 18, lineHeight: 1 }}>S</span>
          </div>
          <span style={{ ...serif, fontSize: 18, color: "#18170F", letterSpacing: "-0.01em" }}>
            ArachNet
          </span>
        </Link>

        {/* Desktop nav links */}
        <ul className="hidden md:flex items-center gap-1 list-none m-0 p-0">
          {[
            ["Why", "/#problems"],
            ["How it works", "/#how"],
            ["Pricing", "/#pricing"],
          ].map(([label, href]) => (
            <li key={label}>
              <Link
                href={href}
                className="block px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{ color: "#6B6860", textDecoration: "none" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#18170F";
                  e.currentTarget.style.background = "rgba(0,0,0,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6B6860";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:block px-3 py-1.5 text-sm transition-colors"
            style={{ color: "#6B6860", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#18170F")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6B6860")}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-3.5 py-1.5 text-sm font-medium rounded-lg text-white transition-opacity"
            style={{ background: "#C7452B", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Start free
          </Link>
          {/* Mobile menu button */}
          <button
            className="md:hidden p-1.5 rounded-md transition-colors"
            style={{ color: "#6B6860" }}
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden px-6 py-4 space-y-1"
          role="menu"
          style={{
            background: "rgba(254,253,251,0.95)",
            borderTop: "1px solid #E0DDD5",
          }}
        >
          {[
            ["Why", "/#problems"],
            ["How it works", "/#how"],
            ["Pricing", "/#pricing"],
            ["Sign in", "/login"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm rounded-lg"
              style={{ color: "#18170F", textDecoration: "none" }}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
