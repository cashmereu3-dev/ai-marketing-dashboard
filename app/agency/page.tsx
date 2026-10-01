// app/agency/page.tsx
"use client";

import AgencyDashboard from "@/components/agency/AgencyDashboard";

export default function AgencyPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <AgencyDashboard />
    </div>
  );
}
