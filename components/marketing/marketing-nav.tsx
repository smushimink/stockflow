"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

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
      className="fixed top-0 inset-x-0 z-50 transition-colors"
      style={{
        background: "#F7F7F5",
        borderBottom: scrolled ? "1px solid #E5E5E2" : "1px solid transparent",
        height: "56px",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Stockflow home">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect width="22" height="22" rx="5" fill="#1A1A17" />
            <path d="M5 15l4-6 3 3 3-4 2 2" stroke="#F7F7F5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="7" r="1.5" fill="#4D7B3D" />
          </svg>
          <span className="text-[15px] font-600 text-[#1A1A17] tracking-tight">Stockflow</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-0.5" role="list">
          {[
            ["Product", "/#decisions"],
            ["Pricing", "/pricing"],
            ["Customers", "/#proof"],
            ["Resources", "/#faq"],
            ["About", "/about"],
          ].map(([label, href]) => (
            <li key={label}>
              <Link
                href={href}
                className="px-3 py-1.5 text-sm text-[#5C5C57] hover:text-[#1A1A17] transition-colors rounded-md hover:bg-black/5"
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
            className="hidden sm:block px-3 py-1.5 text-sm text-[#5C5C57] hover:text-[#1A1A17] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-3.5 py-1.5 text-sm font-500 rounded-lg text-white transition-colors"
            style={{ background: "#1A1A17" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2D2D29")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1A1A17")}
          >
            Start free
          </Link>
          {/* Mobile menu button */}
          <button
            className="md:hidden p-1.5 rounded-md text-[#5C5C57] hover:text-[#1A1A17] hover:bg-black/5"
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
          className="md:hidden border-t border-[#E5E5E2] bg-[#F7F7F5] px-5 py-4 space-y-1"
          role="menu"
        >
          {[
            ["Product", "/#decisions"],
            ["Pricing", "/pricing"],
            ["Customers", "/#proof"],
            ["Resources", "/#faq"],
            ["About", "/about"],
            ["Sign in", "/login"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-[#1A1A17] rounded-md hover:bg-black/5"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
