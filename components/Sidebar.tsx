import Link from "next/link";
import { LayoutDashboard, Music, Leaf, Video, Settings, Upload, MessageSquare, Users } from "lucide-react";

export default function Sidebar() {
  const navItems = [
    { name: "SaaS Dashboard", href: "/saas", icon: LayoutDashboard },
    { name: "Music Distribution", href: "/music", icon: Music },
    { name: "Local Landscaping", href: "/landscaping", icon: Leaf },
    { name: "Videography", href: "/videography", icon: Video },
    { name: "File Upload", href: "/upload", icon: Upload },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-border px-4 py-6">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
          <span className="text-white font-bold">V4</span>
        </div>
        <span className="text-foreground font-semibold text-xl tracking-tight">Visions4U</span>
      </div>

      <nav className="flex-1 space-y-2">
        <p className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Marketing Dashboards
        </p>
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-card transition-colors group"
          >
            <item.icon className="h-5 w-5 text-gray-400 group-hover:text-accent transition-colors" />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-border pt-4">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-card transition-colors group"
        >
          <Settings className="h-5 w-5 text-gray-400 group-hover:text-gray-300" />
          Settings
        </Link>
      </div>
    </div>
  );
}
