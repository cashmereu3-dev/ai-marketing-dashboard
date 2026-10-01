"use client";

import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => { await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined); window.location.assign('/login'); }}
      className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-card transition-colors group"
    >
      <LogOut className="h-5 w-5 text-gray-400 group-hover:text-gray-300" />
      Sign out
    </button>
  );
}
