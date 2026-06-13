// app/saas/page.tsx
"use client";

import DashboardStats from "@/components/DashboardStats";
import TrafficChart from "@/components/TrafficChart";
import RecentLeads from "@/components/RecentLeads";
import AgentCampaignToggle from "@/components/AgentCampaignToggle";

export default function SaaSView() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Software & SaaS</h1>
          <p className="text-gray-400 mt-1">Monitoring B2B outreach and software campaign metrics.</p>
        </div>
        <AgentCampaignToggle campaignType="b2b_outreach" defaultText="Active" />
      </div>

      <DashboardStats campaignType="b2b_outreach" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrafficChart campaignType="b2b_outreach" />
        </div>
        <div className="lg:col-span-1">
          <RecentLeads campaignType="b2b_outreach" />
        </div>
      </div>
    </div>
  );
}
