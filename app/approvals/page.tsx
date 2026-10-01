// app/approvals/page.tsx
// Phone-first approvals screen: the page the notification opens.
"use client";

import ApprovalQueuePanel from "@/components/agency/ApprovalQueuePanel";
import EnableNotifications from "@/components/agency/EnableNotifications";

export default function ApprovalsPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Approvals</h1>
        <p className="text-sm text-zinc-400 mt-1">Review what your agents drafted. Nothing goes out until you approve it.</p>
      </div>
      <EnableNotifications />
      <ApprovalQueuePanel />
    </div>
  );
}
