// app/music/page.tsx
"use client";

import DashboardStats from "@/components/DashboardStats";
import TrafficChart from "@/components/TrafficChart";
import AssetList from "@/components/AssetList";
import AgentCampaignToggle from "@/components/AgentCampaignToggle";

export default function MusicView() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Music Distribution</h1>
          <p className="text-gray-400 mt-1">Monitoring audio stem assets, TikTok routing, and Spotify conversions.</p>
        </div>
        <AgentCampaignToggle campaignType="music_promo" defaultText="Processing Stems" />
      </div>

      <DashboardStats campaignType="music_promo" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrafficChart campaignType="music_promo" />
        </div>
        <div className="lg:col-span-1">
          <AssetList campaignType="music_promo" assetType="audio_stem" />
        </div>
      </div>
    </div>
  );
}
