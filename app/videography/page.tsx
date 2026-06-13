// app/videography/page.tsx
"use client";

import DashboardStats from "@/components/DashboardStats";
import TrafficChart from "@/components/TrafficChart";
import AssetList from "@/components/AssetList";
import AgentCampaignToggle from "@/components/AgentCampaignToggle";

export default function VideographyView() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Videography</h1>
          <p className="text-gray-400 mt-1">Monitoring DJI drone clip assets, editing status, and engagement.</p>
        </div>
        <AgentCampaignToggle campaignType="drone_promo" defaultText="Generating Captions" />
      </div>

      <DashboardStats campaignType="drone_promo" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrafficChart campaignType="drone_promo" />
        </div>
        <div className="lg:col-span-1">
          <AssetList campaignType="drone_promo" assetType="drone_clip" />
        </div>
      </div>
    </div>
  );
}
