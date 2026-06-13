// components/AgentCampaignToggle.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

interface AgentCampaignToggleProps {
  campaignType: string;
  defaultText: string;
}

export default function AgentCampaignToggle({ campaignType, defaultText }: AgentCampaignToggleProps) {
  const [status, setStatus] = useState<string>("paused");
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const fetchCampaignStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, status")
        .eq("type", campaignType)
        .limit(1)
        .maybeSingle();

      if (data) {
        setStatus(data.status || "paused");
        setCampaignId(data.id);
      } else {
        // Create campaign if missing
        const campaignNames: Record<string, string> = {
          b2b_outreach: "Enterprise SaaS B2B Outreach",
          music_promo: "Summer Beats Distribution",
          local_seo: "Orlando Landscaping SEO Push",
          drone_promo: "DJI Drone Clip Promotion"
        };
        const { data: inserted, error: insertError } = await supabase
          .from("campaigns")
          .insert({
            name: campaignNames[campaignType] || "Automated Campaign",
            type: campaignType,
            status: "active"
          })
          .select()
          .single();

        if (inserted) {
          setStatus(inserted.status || "active");
          setCampaignId(inserted.id);
        }
      }
    } catch (e) {
      console.error("Error fetching campaign status:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignStatus();

    // Listen for changes
    const channel = supabase
      .channel(`campaign-toggle-${campaignType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns" },
        () => {
          fetchCampaignStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignType]);

  const toggleStatus = async () => {
    if (!campaignId) return;
    const nextStatus = status === "active" ? "paused" : "active";
    setLoading(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: nextStatus })
        .eq("id", campaignId);

      if (error) throw error;
      setStatus(nextStatus);
    } catch (err: any) {
      alert("Error toggling status: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !campaignId) {
    return (
      <div className="flex items-center gap-2 bg-sidebar border border-border px-4 py-2 rounded-full text-xs text-gray-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading...
      </div>
    );
  }

  const isActive = status === "active";

  return (
    <button
      onClick={toggleStatus}
      disabled={loading}
      className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border shadow-sm select-none cursor-pointer ${
        isActive
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
          : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse"></span>
      Agent Status: {isActive ? "Active" : "Paused"}
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-current" />
      ) : isActive ? (
        <ToggleRight className="h-4 w-4" />
      ) : (
        <ToggleLeft className="h-4 w-4" />
      )}
    </button>
  );
}
