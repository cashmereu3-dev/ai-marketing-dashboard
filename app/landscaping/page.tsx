// app/landscaping/page.tsx
"use client";

import DashboardStats from "@/components/DashboardStats";
import TrafficChart from "@/components/TrafficChart";
import RecentLeads from "@/components/RecentLeads";
import AgentCampaignToggle from "@/components/AgentCampaignToggle";

export default function LandscapingView() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Local Landscaping</h1>
          <p className="text-gray-400 mt-1">Monitoring local SEO pushes and Google My Business leads.</p>
        </div>
        <AgentCampaignToggle campaignType="local_seo" defaultText="Scraping Local Maps" />
      </div>

      <DashboardStats campaignType="local_seo" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrafficChart campaignType="local_seo" />
        </div>
        <div className="lg:col-span-1">
          <RecentLeads campaignType="local_seo" />
        </div>
      </div>
    </div>
  );
}
