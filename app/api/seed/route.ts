// app/api/seed/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yeoceamczddelhgligmq.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not defined in the environment." },
      { status: 500 }
    );
  }

  // Create admin client to bypass Row Level Security
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log("Seeding database...");

    // Seed Campaigns
    const campaignsData = [
      { name: "Enterprise SaaS B2B Outreach", type: "b2b_outreach", status: "active", description: "B2B outreach campaign targeting SaaS platforms." },
      { name: "Summer Beats Distribution", type: "music_promo", status: "active", description: "TikTok and Spotify distribution promo." },
      { name: "Orlando Landscaping SEO Push", type: "local_seo", status: "active", description: "Local SEO optimization and Google My Business scraping." },
      { name: "DJI Drone Clip Promotion", type: "drone_promo", status: "active", description: "Aerial cinematography promotion and caption generation." }
    ];

    const seededCampaigns = [];

    for (const c of campaignsData) {
      // Check if campaign already exists
      const { data: existing } = await supabaseAdmin
        .from("campaigns")
        .select("*")
        .eq("name", c.name)
        .maybeSingle();

      if (existing) {
        seededCampaigns.push(existing);
      } else {
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("campaigns")
          .insert(c)
          .select()
          .single();

        if (insertErr) {
          throw new Error(`Failed to insert campaign ${c.name}: ${insertErr.message}`);
        }
        seededCampaigns.push(inserted);
      }
    }

    // Map campaign types to campaign IDs
    const campaignMap = seededCampaigns.reduce((acc: any, c: any) => {
      acc[c.type] = c.id;
      return acc;
    }, {});

    // Seed Leads
    const leadsData = [
      // SaaS
      { company_name: "Acme Corp", contact_name: "John Doe", email: "john.doe@acmecorp.com", status: "booked", campaign_id: campaignMap["b2b_outreach"], source: "agent_scraper", notes: "Interested in automated CRM sync." },
      { company_name: "TechFlow Inc", contact_name: "Sarah Miller", email: "sarah@techflow.io", status: "contacted", campaign_id: campaignMap["b2b_outreach"], source: "agent_scraper", notes: "Sent follow-up demo link." },
      { company_name: "Global Systems", contact_name: "Robert Chen", email: "info@globalsys.net", status: "cold", campaign_id: campaignMap["b2b_outreach"], source: "agent_scraper", notes: "Scraped via LinkedIn." },
      
      // Landscaping
      { company_name: "Green Thumb Services", contact_name: "Gary Green", email: "contact@greenthumb.com", status: "booked", campaign_id: campaignMap["local_seo"], source: "agent_scraper", notes: "Wants GMB profile setup in Orlando." },
      { company_name: "Lawn Care Masters", contact_name: "Mark Lawn", email: "info@lawncaremasters.com", status: "contacted", campaign_id: campaignMap["local_seo"], source: "agent_scraper", notes: "Left voicemail for SEO consultation." },
      { company_name: "Sun State Landscaping", contact_name: "Sunny Hills", email: "sunstate@gmail.com", status: "cold", campaign_id: campaignMap["local_seo"], source: "agent_scraper", notes: "Requires review collection automation." },

      // Music
      { company_name: "Indie Pop Collective", contact_name: "Alex Song", email: "alex@indiepop.co", status: "contacted", campaign_id: campaignMap["music_promo"], source: "inbound", notes: "Wants pricing for 5 stem releases." },
      { company_name: "Vibe Records", contact_name: "DJ Vibe", email: "promo@viberecords.com", status: "cold", campaign_id: campaignMap["music_promo"], source: "agent_scraper", notes: "Subscribed to newsletter." }
    ];

    for (const lead of leadsData) {
      const { data: existing } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("email", lead.email)
        .eq("campaign_id", lead.campaign_id)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("leads").insert(lead);
      }
    }

    // Seed Assets
    const assetsData: any[] = [
      // Music Stems
      { title: "R&B Stem 01 - Vox", asset_type: "audio_stem", status: "ready", platform_routing: ["tiktok", "instagram"], campaign_id: campaignMap["music_promo"], url: "https://yeoceamczddelhgligmq.supabase.co/storage/v1/object/public/uploads/rb_vox.mp3", metadata: { duration: 32 } },
      { title: "Summer Beat Instrumental", asset_type: "audio_stem", status: "processing", platform_routing: ["youtube"], campaign_id: campaignMap["music_promo"], url: "https://yeoceamczddelhgligmq.supabase.co/storage/v1/object/public/uploads/summer_beat.mp3", metadata: { duration: 180 } },
      { title: "Acoustic Guitar Track", asset_type: "audio_stem", status: "raw", platform_routing: ["tiktok"], campaign_id: campaignMap["music_promo"], url: "https://yeoceamczddelhgligmq.supabase.co/storage/v1/object/public/uploads/acoustic.mp3", metadata: { duration: 45 } },

      // Videography Drone Clips
      { title: "Downtown Fly-through", asset_type: "drone_clip", status: "processing", platform_routing: ["youtube", "tiktok"], campaign_id: campaignMap["drone_promo"], url: "https://yeoceamczddelhgligmq.supabase.co/storage/v1/object/public/uploads/downtown.mp4", metadata: { duration: 45, resolution: "4k" } },
      { title: "Sunset Beach Glide", asset_type: "drone_clip", status: "ready", platform_routing: ["instagram"], campaign_id: campaignMap["drone_promo"], url: "https://yeoceamczddelhgligmq.supabase.co/storage/v1/object/public/uploads/sunset_beach.mp4", metadata: { duration: 15, resolution: "1080p" } },
      { title: "Mountain Ascent", asset_type: "drone_clip", status: "raw", platform_routing: ["youtube"], campaign_id: campaignMap["drone_promo"], url: "https://yeoceamczddelhgligmq.supabase.co/storage/v1/object/public/uploads/mountain.mp4", metadata: { duration: 60, resolution: "4k" } }
    ];

    for (const asset of assetsData) {
      const { data: existing } = await supabaseAdmin
        .from("assets")
        .select("*")
        .eq("title", asset.title)
        .eq("campaign_id", asset.campaign_id)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("assets").insert(asset);
      }
    }

    // Seed Daily Metrics
    const metricsData: any[] = [];
    const today = new Date();

    const campaignTypes = ["b2b_outreach", "music_promo", "local_seo", "drone_promo"];
    
    const seedMetrics: any = {
      b2b_outreach: [
        { traffic: 4000, conversions: 240 },
        { traffic: 3000, conversions: 139 },
        { traffic: 2000, conversions: 980 },
        { traffic: 2780, conversions: 390 },
        { traffic: 1890, conversions: 480 },
        { traffic: 2390, conversions: 380 },
        { traffic: 3490, conversions: 430 }
      ],
      music_promo: [
        { traffic: 12000, conversions: 840 },
        { traffic: 15000, conversions: 1100 },
        { traffic: 18000, conversions: 1490 },
        { traffic: 14000, conversions: 980 },
        { traffic: 16500, conversions: 1200 },
        { traffic: 21000, conversions: 1900 },
        { traffic: 25000, conversions: 2300 }
      ],
      local_seo: [
        { traffic: 450, conversions: 12 },
        { traffic: 520, conversions: 18 },
        { traffic: 610, conversions: 22 },
        { traffic: 480, conversions: 15 },
        { traffic: 580, conversions: 24 },
        { traffic: 710, conversions: 35 },
        { traffic: 680, conversions: 28 }
      ],
      drone_promo: [
        { traffic: 8000, conversions: 350 },
        { traffic: 9200, conversions: 410 },
        { traffic: 7800, conversions: 290 },
        { traffic: 10500, conversions: 520 },
        { traffic: 11000, conversions: 610 },
        { traffic: 13000, conversions: 780 },
        { traffic: 12500, conversions: 720 }
      ]
    };

    let dailyMetricsCreated = 0;
    try {
      for (const type of campaignTypes) {
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(today.getDate() - (6 - i));
          const dateStr = d.toISOString().split("T")[0];
          
          const metrics = seedMetrics[type][i];
          const record = {
            campaign_type: type,
            date: dateStr,
            traffic: metrics.traffic,
            conversions: metrics.conversions
          };

          // Upsert metric
          const { error: upsertError } = await supabaseAdmin
            .from("daily_metrics")
            .upsert(record, { onConflict: "campaign_type,date" });
          
          if (upsertError) {
            console.error("Error seeding daily metric:", upsertError.message);
          } else {
            dailyMetricsCreated++;
          }
        }
      }
    } catch (metricErr: any) {
      console.log("⚠️ Failed to seed daily_metrics table. It likely does not exist yet. Please run the SQL schema migration in Supabase.", metricErr.message);
    }

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully!",
      campaigns: seededCampaigns.length,
      metricsSeeded: dailyMetricsCreated > 0 ? "Yes" : "Failed (table missing)",
    }, { status: 200 });

  } catch (err: any) {
    console.error("Seeding failed with error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
