// components/RecentLeads.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit2, Check, X, Loader2, Sparkles } from "lucide-react";

interface Lead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: "cold" | "contacted" | "booked" | "unqualified";
  notes: string | null;
  campaign_id: string | null;
}

interface RecentLeadsProps {
  campaignType: string;
}

export default function RecentLeads({ campaignType }: RecentLeadsProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  
  // Form State
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"cold" | "contacted" | "booked" | "unqualified">("cold");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchLeads = async () => {
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

        // 2. Fetch leads for this campaign ID
        const { data: leadsData, error: leadsError } = await supabase
          .from("leads")
          .select("*")
          .eq("campaign_id", campaignData.id)
          .order("created_at", { ascending: false });

        if (leadsError) throw leadsError;
        setLeads(leadsData || []);
      } else {
        setLeads([]);
      }
    } catch (err: any) {
      console.error("Error fetching leads:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`leads-realtime-${campaignType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignType]);

  const openAddModal = () => {
    setEditingLead(null);
    setCompanyName("");
    setContactName("");
    setEmail("");
    setStatus("cold");
    setNotes("");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setCompanyName(lead.company_name);
    setContactName(lead.contact_name || "");
    setEmail(lead.email || "");
    setStatus(lead.status);
    setNotes(lead.notes || "");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleStatusChange = async (leadId: string, newStatus: any) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);
      
      if (error) throw error;
      
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      );
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setErrorMsg("Company Name is required");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      let targetCampaignId = campaignId;

      // If no campaign exists, let's create a placeholder one for this campaignType so they can link
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

      const leadData = {
        company_name: companyName,
        contact_name: contactName || null,
        email: email || null,
        status,
        notes: notes || null,
        campaign_id: targetCampaignId,
        source: "manual"
      };

      if (editingLead) {
        // Edit Mode
        const { error } = await supabase
          .from("leads")
          .update(leadData)
          .eq("id", editingLead.id);
        
        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from("leads")
          .insert(leadData);
        
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchLeads();
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (error) throw error;
      fetchLeads();
    } catch (err: any) {
      alert("Error deleting lead: " + err.message);
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">Recent Leads</h3>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all transform hover:scale-[1.02] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Lead
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
          <span className="text-sm">Loading leads...</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl p-6 flex-1">
          <Sparkles className="h-10 w-10 text-gray-500 mb-3" />
          <h4 className="text-white font-medium mb-1">No leads yet</h4>
          <p className="text-sm text-gray-400 mb-4 max-w-xs">
            Start tracking leads for this service line by clicking the button below.
          </p>
          <button
            onClick={openAddModal}
            className="text-accent border border-accent/25 hover:bg-accent/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Add your first lead
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-sidebar text-gray-400 border-b border-border">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-sidebar/50 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-white max-w-[150px] truncate">
                    {lead.company_name}
                  </td>
                  <td className="px-4 py-3.5 text-gray-300">
                    {lead.contact_name || <span className="text-gray-500">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-gray-400 max-w-[150px] truncate">
                    {lead.email || <span className="text-gray-500">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className="bg-sidebar border border-border text-xs rounded-md px-2 py-1 text-white focus:outline-none focus:border-accent"
                    >
                      <option value="cold">Cold</option>
                      <option value="contacted">Contacted</option>
                      <option value="booked">Booked</option>
                      <option value="unqualified">Unqualified</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-right flex justify-end gap-2">
                    <button
                      onClick={() => openEditModal(lead)}
                      className="p-1 text-gray-400 hover:text-white rounded hover:bg-card transition-colors"
                      title="Edit Lead"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteLead(lead.id)}
                      className="p-1 text-red-500/70 hover:text-red-400 rounded hover:bg-card transition-colors"
                      title="Delete Lead"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              {editingLead ? "Edit Lead" : "Add New Lead"}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Stripe, Inc"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. john@stripe.com"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Lead Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                >
                  <option value="cold">Cold</option>
                  <option value="contacted">Contacted</option>
                  <option value="booked">Booked</option>
                  <option value="unqualified">Unqualified</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Scraped details or follow up times"
                  rows={3}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent resize-none"
                />
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
                  ) : editingLead ? (
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
