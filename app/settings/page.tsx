// app/settings/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Settings, User, Key, Database, Check, Loader2, Play } from "lucide-react";

export default function SettingsPage() {
  // Profile state
  const [name, setName] = useState("Jevon Terelle Ashley");
  const [email, setEmail] = useState("jevon@visions4u.co");
  const [organization, setOrganization] = useState("Visions4U");
  
  // API Keys state
  const [openaiKey, setOpenaiKey] = useState("sk-proj-****************");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  
  // UI states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [seeding, setSeeding] = useState(false);
  
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [keysSuccess, setKeysSuccess] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [seedError, setSeedError] = useState("");

  useEffect(() => {
    // Load config from localStorage if present
    const storedName = localStorage.getItem("v4u_name");
    const storedEmail = localStorage.getItem("v4u_email");
    const storedOrg = localStorage.getItem("v4u_org");
    const storedOpenai = localStorage.getItem("v4u_openai_key");
    
    if (storedName) setName(storedName);
    if (storedEmail) setEmail(storedEmail);
    if (storedOrg) setOrganization(storedOrg);
    if (storedOpenai) setOpenaiKey(storedOpenai);
    
    setSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    setSupabaseKey("NEXT_PUBLIC_SUPABASE_ANON_KEY (configured in .env)");
  }, []);

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(false);
    
    setTimeout(() => {
      localStorage.setItem("v4u_name", name);
      localStorage.setItem("v4u_email", email);
      localStorage.setItem("v4u_org", organization);
      setSavingProfile(false);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    }, 800);
  };

  const saveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKeys(true);
    setKeysSuccess(false);
    
    setTimeout(() => {
      localStorage.setItem("v4u_openai_key", openaiKey);
      setSavingKeys(false);
      setKeysSuccess(true);
      setTimeout(() => setKeysSuccess(false), 3000);
    }, 800);
  };

  const runDatabaseSeed = async () => {
    setSeeding(true);
    setSeedSuccess(false);
    setSeedError("");
    
    try {
      const res = await fetch("/api/seed", {
        method: "POST"
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSeedSuccess(true);
        setTimeout(() => setSeedSuccess(false), 5000);
      } else {
        setSeedError(data.error || "Failed to seed database");
      }
    } catch (e: any) {
      setSeedError(e.message || "Network error occurred during seeding");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8 border-b border-border/60 pb-6">
        <div className="h-10 w-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Settings</h1>
          <p className="text-gray-400 mt-1">Configure profile details, API integrations, and demo data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Info */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-6 text-white font-semibold">
            <User className="h-5 w-5 text-accent" />
            <h3>Account Profile</h3>
          </div>
          
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-sidebar border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
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
                className="w-full bg-sidebar border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Organization
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full bg-sidebar border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              {profileSuccess && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Saved Profile
                </span>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto cursor-pointer"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Integration API Keys */}
        <div className="bg-card rounded-xl p-6 border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6 text-white font-semibold">
              <Key className="h-5 w-5 text-accent" />
              <h3>API Keys & Integrations</h3>
            </div>
            
            <form onSubmit={saveKeys} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full bg-sidebar border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Supabase URL
                </label>
                <input
                  type="text"
                  disabled
                  value={supabaseUrl}
                  className="w-full bg-sidebar/50 border border-border/60 rounded-lg px-3 py-2.5 text-gray-400 text-sm focus:outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Supabase Key
                </label>
                <input
                  type="text"
                  disabled
                  value={supabaseKey}
                  className="w-full bg-sidebar/50 border border-border/60 rounded-lg px-3 py-2.5 text-gray-400 text-sm focus:outline-none cursor-not-allowed"
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                {keysSuccess && (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Saved Keys
                  </span>
                )}
                <button
                  type="submit"
                  disabled={savingKeys}
                  className="bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto cursor-pointer"
                >
                  {savingKeys ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Keys"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Database Seeding Utility */}
      <div className="bg-card rounded-xl p-6 border border-border mt-6">
        <div className="flex items-center gap-2 mb-4 text-white font-semibold">
          <Database className="h-5 w-5 text-accent" />
          <h3>Database Administration</h3>
        </div>
        
        <p className="text-sm text-gray-400 mb-6 max-w-2xl">
          If your database is empty, seed it with sample records (campaigns, leads, media files, and traffic history metrics) to visualize the dashboard immediately.
        </p>

        <div className="bg-sidebar/50 border border-border/50 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <span className="text-xs uppercase font-semibold tracking-wider text-gray-400">
              Demo Seeder
            </span>
            <p className="text-xs text-gray-500 mt-1">
              Creates 4 campaign types, 8 sample leads, 6 platform routing stems, and last 7 days of daily metrics.
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            <button
              onClick={runDatabaseSeed}
              disabled={seeding}
              className="flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 px-5 py-2.5 rounded-lg text-sm font-medium transition-all w-full md:w-auto disabled:bg-emerald-500/5 cursor-pointer"
            >
              {seeding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-current" />
                  Seeding Database...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Seed Supabase Database
                </>
              )}
            </button>
            {seedSuccess && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 animate-pulse">
                <Check className="h-3.5 w-3.5" /> Database populated successfully!
              </span>
            )}
            {seedError && (
              <span className="text-xs text-red-400 font-medium max-w-xs text-right">
                ⚠️ {seedError}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
