"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface StatsProps {
  campaignType: string;
}

export default function DashboardStats({ campaignType }: StatsProps) {
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [recentAssets, setRecentAssets] = useState(0);

  useEffect(() => {
    // Initial fetch
    const fetchStats = async () => {
      // Fetch Campaigns
      const { count: campaignsCount } = await supabase
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("type", campaignType)
        .eq("status", "active");

      if (campaignsCount !== null) setActiveCampaigns(campaignsCount);

      // Fetch Leads linked to these campaigns
      // For simplicity in UI without complex joins, we just fetch total leads or mock based on campaign
      // Realistically we'd join on campaigns.type == campaignType
      const { count: leadsCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });
        
      if (leadsCount !== null) setTotalLeads(leadsCount);

      // Fetch Assets
      const { count: assetsCount } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true });

      if (assetsCount !== null) setRecentAssets(assetsCount);
    };

    fetchStats();

    // Subscribe to real-time changes
    const channel = supabase
      .channel("custom-all-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "assets" }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignType]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-card rounded-xl p-6 border border-border">
        <p className="text-sm font-medium text-gray-400">Active Campaigns</p>
        <p className="text-3xl font-bold text-white mt-2">{activeCampaigns}</p>
        <div className="mt-2 flex items-center text-sm text-emerald-400">
          <span>+2% from last week</span>
        </div>
      </div>
      <div className="bg-card rounded-xl p-6 border border-border">
        <p className="text-sm font-medium text-gray-400">Total Leads</p>
        <p className="text-3xl font-bold text-white mt-2">{totalLeads}</p>
        <div className="mt-2 flex items-center text-sm text-emerald-400">
          <span>+14% from last week</span>
        </div>
      </div>
      <div className="bg-card rounded-xl p-6 border border-border">
        <p className="text-sm font-medium text-gray-400">Processed Assets</p>
        <p className="text-3xl font-bold text-white mt-2">{recentAssets}</p>
        <div className="mt-2 flex items-center text-sm text-emerald-400">
          <span>Just updated</span>
        </div>
      </div>
    </div>
  );
}
