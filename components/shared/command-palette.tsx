"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Truck,
  Settings2,
  Plug,
} from "lucide-react";

const pages = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/sales", label: "Sales", icon: TrendingUp },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/rules", label: "Rules", icon: Settings2 },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or navigate..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <CommandItem
                key={page.href}
                onSelect={() => navigate(page.href)}
                className="gap-2"
              >
                <Icon size={14} className="text-[#6B6B66]" />
                {page.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { setOpen(false); /* TODO: open new PO */ }} className="gap-2">
            <ShoppingCart size={14} className="text-[#6B6B66]" />
            Create purchase order
          </CommandItem>
          <CommandItem onSelect={() => { setOpen(false); /* TODO: open CSV import */ navigate("/integrations/csv"); }} className="gap-2">
            <Package size={14} className="text-[#6B6B66]" />
            Import products from CSV
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
