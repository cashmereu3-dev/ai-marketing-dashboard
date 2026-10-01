"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

/**
 * Gates the whole app behind a Supabase session.
 * Signed-out visitors are sent to /login; signed-in users never see /login.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!session && !onLogin) router.replace("/login");
    if (session && onLogin) router.replace("/agency");
  }, [loading, session, onLogin, router]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-gray-500">Loading…</div>;
  }

  if (!session) {
    // Render the login form; anything else is mid-redirect.
    return onLogin ? <main className="flex-1 overflow-y-auto">{children}</main> : null;
  }

  if (onLogin) return null; // redirecting to the dashboard

  return (
    <>
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        {/* Phone top bar: the sidebar is hidden on small screens */}
        <nav className="md:hidden flex items-center gap-4 px-4 py-3 border-b border-border bg-sidebar text-sm font-semibold">
          <span className="text-foreground">The Agency</span>
          <Link href="/approvals" className="text-red-400">Approvals</Link>
          <Link href="/agency" className="text-gray-300">Agents</Link>
        </nav>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
