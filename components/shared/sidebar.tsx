"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Truck,
  Settings2,
  Plug,
  LogOut,
  Search,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface SidebarProps {
  urgentCount?: number;
  productCount?: number;
  userEmail?: string;
}

export function Sidebar({ urgentCount = 0, productCount = 0, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const workspaceNav: NavItem[] = [
    { href: "/today", label: "Today", icon: LayoutDashboard, badge: urgentCount || undefined },
    { href: "/products", label: "Products", icon: Package, badge: productCount || undefined },
    { href: "/purchases", label: "Purchases", icon: ShoppingCart },
    { href: "/sales", label: "Sales", icon: TrendingUp },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/suppliers", label: "Suppliers", icon: Truck },
  ];

  const setupNav: NavItem[] = [
    { href: "/rules", label: "Rules", icon: Settings2 },
    { href: "/integrations", label: "Integrations", icon: Plug },
  ];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-[200px] shrink-0 flex flex-col h-screen bg-white border-r border-[#E5E5E2] sticky top-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-[#E5E5E2]">
        <span className="text-sm font-600 text-[#1A1A17] tracking-tight">StockFlow</span>
      </div>

      {/* Search hint (Cmd+K) */}
      <div className="px-3 py-3">
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#F7F7F5] border border-[#E5E5E2] text-xs text-[#6B6B66] hover:border-[#C8C8C4] transition-colors"
          onClick={() => {
            const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
            document.dispatchEvent(event);
          }}
        >
          <Search size={12} />
          <span>Search</span>
          <span className="ml-auto opacity-60">⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        <div>
          <p className="px-2 py-1 text-[10px] font-600 uppercase tracking-wider text-[#6B6B66]">Workspace</p>
          <ul className="space-y-0.5">
            {workspaceNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </ul>
        </div>

        <div>
          <p className="px-2 py-1 text-[10px] font-600 uppercase tracking-wider text-[#6B6B66]">Setup</p>
          <ul className="space-y-0.5">
            {setupNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </ul>
        </div>
      </nav>

      {/* User card */}
      <div className="px-3 py-3 border-t border-[#E5E5E2]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#1A1A17] flex items-center justify-center text-white text-[10px] font-600 shrink-0">
            {userEmail?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#1A1A17] truncate">{userEmail ?? "user@example.com"}</p>
          </div>
          <button
            onClick={signOut}
            className="p-1 rounded hover:bg-[#F0F0EE] text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
          isActive
            ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-[#1A1A17] font-500"
            : "text-[#6B6B66] hover:bg-[#F7F7F5] hover:text-[#1A1A17]"
        )}
      >
        <Icon size={14} className={isActive ? "text-[#1A1A17]" : "text-[#6B6B66]"} />
        <span className="flex-1">{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span className="w-4 h-4 rounded-full bg-[#C54632] text-white text-[10px] flex items-center justify-center font-600">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
