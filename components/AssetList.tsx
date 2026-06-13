// components/AssetList.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit2, Check, X, Loader2, Play, FileVideo, Music } from "lucide-react";

interface Asset {
  id: string;
  title: string;
  description: string | null;
  asset_type: string; // e.g., 'audio_stem', 'drone_clip'
  status: "raw" | "processing" | "ready" | "archived";
  platform_routing: string[] | null;
  url: string | null;
  metadata: any;
  campaign_id: string | null;
}

interface AssetListProps {
  campaignType: string;
  assetType: "audio_stem" | "drone_clip";
}

export default function AssetList({ campaignType, assetType }: AssetListProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"raw" | "processing" | "ready" | "archived">("raw");
  const [platformRouting, setPlatformRouting] = useState<string[]>([]);
  const [duration, setDuration] = useState("");
  const [resolution, setResolution] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchAssets = async () => {
    setLoading(true);
    try {
      // 1. Get campaign ID for this campaign type
      const { data: campaignData } = await supabase
        .from("campaigns")
        .select("id")
        .eq("type", campaignType)
        .limit(1)
        .maybeSingle();

      if (campaignData) {
        setCampaignId(campaignData.id);

        // 2. Fetch assets of assetType for this campaign
        const { data: assetsData, error: assetsError } = await supabase
          .from("assets")
          .select("*")
          .eq("campaign_id", campaignData.id)
          .eq("asset_type", assetType)
          .order("created_at", { ascending: false });

        if (assetsError) throw assetsError;
        setAssets(assetsData || []);
      } else {
        setAssets([]);
      }
    } catch (err: any) {
      console.error("Error fetching assets:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`assets-realtime-${campaignType}-${assetType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assets" },
        () => {
          fetchAssets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignType, assetType]);

  const openAddModal = () => {
    setEditingAsset(null);
    setTitle("");
    setDescription("");
    setStatus("raw");
    setPlatformRouting([]);
    setDuration("");
    setResolution("");
    setUrl("");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setTitle(asset.title);
    setDescription(asset.description || "");
    setStatus(asset.status);
    setPlatformRouting(asset.platform_routing || []);
    setDuration(asset.metadata?.duration?.toString() || "");
    setResolution(asset.metadata?.resolution || "");
    setUrl(asset.url || "");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleStatusChange = async (assetId: string, newStatus: any) => {
    try {
      const { error } = await supabase
        .from("assets")
        .update({ status: newStatus })
        .eq("id", assetId);

      if (error) throw error;

      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, status: newStatus } : a))
      );
    } catch (err: any) {
      alert("Error updating asset status: " + err.message);
    }
  };

  const togglePlatform = (platform: string) => {
    if (platformRouting.includes(platform)) {
      setPlatformRouting(platformRouting.filter((p) => p !== platform));
    } else {
      setPlatformRouting([...platformRouting, platform]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Asset Title is required");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      let targetCampaignId = campaignId;

      // Ensure campaign exists
      if (!targetCampaignId) {
        const campaignNames: Record<string, string> = {
          b2b_outreach: "Enterprise SaaS B2B Outreach",
          music_promo: "Summer Beats Distribution",
          local_seo: "Orlando Landscaping SEO Push",
          drone_promo: "DJI Drone Clip Promotion"
        };

        const { data: newCampaign, error: campError } = await supabase
          .from("campaigns")
          .insert({
            name: campaignNames[campaignType] || "Automated Campaign",
            type: campaignType,
            status: "active"
          })
          .select()
          .single();

        if (campError) throw campError;
        targetCampaignId = newCampaign.id;
        setCampaignId(newCampaign.id);
      }

      const assetData = {
        title,
        description: description || null,
        asset_type: assetType,
        status,
        platform_routing: platformRouting,
        url: url || null,
        metadata: {
          duration: duration ? parseInt(duration, 10) : undefined,
          resolution: resolution || undefined
        },
        campaign_id: targetCampaignId
      };

      if (editingAsset) {
        const { error } = await supabase
          .from("assets")
          .update(assetData)
          .eq("id", editingAsset.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("assets")
          .insert(assetData);

        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchAssets();
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAsset = async (assetId: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;
    try {
      const { error } = await supabase.from("assets").delete().eq("id", assetId);
      if (error) throw error;
      fetchAssets();
    } catch (err: any) {
      alert("Error deleting asset: " + err.message);
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">
          {assetType === "audio_stem" ? "Audio Assets & Stems" : "DJI Flight Media"}
        </h3>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all transform hover:scale-[1.02] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Asset
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
          <span className="text-sm">Loading assets...</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl p-6 flex-1">
          {assetType === "audio_stem" ? (
            <Music className="h-10 w-10 text-gray-500 mb-3" />
          ) : (
            <FileVideo className="h-10 w-10 text-gray-500 mb-3" />
          )}
          <h4 className="text-white font-medium mb-1">No assets found</h4>
          <p className="text-sm text-gray-400 mb-4 max-w-xs">
            {assetType === "audio_stem"
              ? "Track audio mixes and platform-routing stems. Add your first stem."
              : "Track video fly-through clips and post status. Add your first clip."}
          </p>
          <button
            onClick={openAddModal}
            className="text-accent border border-accent/25 hover:bg-accent/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Add first asset
          </button>
        </div>
      ) : (
        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-col gap-2 p-4 bg-sidebar/40 border border-border/50 rounded-xl hover:border-accent/30 transition-all group relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="h-10 w-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0">
                    {asset.asset_type === "audio_stem" ? (
                      <Music className="h-5 w-5" />
                    ) : (
                      <FileVideo className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white group-hover:text-accent transition-colors">
                      {asset.title}
                    </h4>
                    {asset.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{asset.description}</p>
                    )}
                    <div className="flex gap-2 items-center mt-1">
                      {asset.platform_routing && asset.platform_routing.length > 0 ? (
                        <div className="flex gap-1">
                          {asset.platform_routing.map((p) => (
                            <span
                              key={p}
                              className="text-[10px] uppercase font-semibold tracking-wide bg-card px-1.5 py-0.5 rounded text-gray-400 border border-border/40"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-500">No platforms</span>
                      )}
                      {asset.metadata?.duration && (
                        <span className="text-[10px] text-gray-500">
                          • {Math.floor(asset.metadata.duration / 60)}:
                          {(asset.metadata.duration % 60).toString().padStart(2, "0")}s
                        </span>
                      )}
                      {asset.metadata?.resolution && (
                        <span className="text-[10px] text-gray-500">• {asset.metadata.resolution}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-right">
                  <select
                    value={asset.status}
                    onChange={(e) => handleStatusChange(asset.id, e.target.value)}
                    className="bg-card border border-border text-[11px] rounded-md px-1.5 py-0.5 text-white focus:outline-none w-fit self-end"
                  >
                    <option value="raw">Raw</option>
                    <option value="processing">Processing</option>
                    <option value="ready">Ready</option>
                    <option value="archived">Archived</option>
                  </select>
                  <div className="flex gap-1 justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(asset)}
                      className="p-1 text-gray-400 hover:text-white rounded hover:bg-card transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteAsset(asset.id)}
                      className="p-1 text-red-500/70 hover:text-red-400 rounded hover:bg-card transition-colors"
                      title="Delete"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
              
              {asset.url && (
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-2 text-[11px] text-accent/80 hover:text-accent font-medium w-fit underline truncate"
                >
                  <Play className="h-2.5 w-2.5 fill-accent" />
                  View Asset URL
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-sidebar border border-border rounded-xl w-full max-w-md p-6 shadow-glow relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-semibold text-white mb-6">
              {editingAsset ? "Edit Asset" : "Add New Asset"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Asset Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Synth Hook Mix 3"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Vocal track with reverb applied"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="raw">Raw</option>
                    <option value="processing">Processing</option>
                    <option value="ready">Ready</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {assetType === "audio_stem" ? "Duration (secs)" : "Duration (secs)"}
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 45"
                    className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {assetType === "drone_clip" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Resolution
                  </label>
                  <input
                    type="text"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="e.g. 4K, 1080p"
                    className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Asset URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://supabase-bucket.co/..."
                  className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Social Platform Routing
                </label>
                <div className="flex gap-3">
                  {["tiktok", "instagram", "youtube"].map((p) => {
                    const isChecked = platformRouting.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePlatform(p)}
                        className={`flex-1 text-xs uppercase font-semibold py-2 rounded-lg border transition-all ${
                          isChecked
                            ? "bg-accent/15 border-accent text-accent"
                            : "bg-card border-border hover:bg-card/75 text-gray-400"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400 font-medium">{errorMsg}</p>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-card rounded-lg text-sm text-gray-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors min-w-[80px]"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingAsset ? (
                    "Save"
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
