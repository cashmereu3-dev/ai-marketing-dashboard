// lib/agency/toolGrants.ts
// WHO GETS WHICH REAL TOOL. This is the capability map for The Agency.
//
// Tool families (all real; see dataTools.ts):
//   YouTube intel    youtube_search_videos, youtube_channel_stats      (needs YOUTUBE_API_KEY)
//   Facebook         facebook_page_insights                            (needs FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN)
//   Music            spotify_artist_lookup (Spotify keys), itunes_search (no key)
//   Site audits      fetch_web_page                                    (no key)
//   Analytics math   compute_engagement_rate, compute_growth_rate, summarize_series
//   Video editing    cloudinary_list_videos, render_video_clip         (needs CLOUDINARY_CLOUD_NAME; listing also needs API key + secret)
//   Hand-off         queue_for_approval                                (needs agency_approval_queue table)
//
// Rule of thumb: analysts get data + math, drafters get the approval queue, and only agents
// that need a source of truth get a data tool. Everyone keeps web search where their division has it.

export const TOOL_GRANTS: Record<string, string[]> = {
  // ── Executive ────────────────────────────────────────────────
  tube_orchestrator: ['facebook_page_insights', 'summarize_series'],

  // ── YouTube: Market Intelligence ─────────────────────────────
  niche_outlier_scout: ['youtube_search_videos', 'youtube_channel_stats'],
  trend_velocity_analyst: ['youtube_search_videos', 'summarize_series', 'compute_growth_rate'],
  audience_persona_profiler: ['youtube_search_videos', 'fetch_web_page'],
  content_gap_identifier: ['youtube_search_videos', 'fetch_web_page'],
  viral_concept_synthesizer: ['youtube_search_videos'],

  // ── YouTube: Packaging, SEO, Shorts ──────────────────────────
  title_ctr_optimizer: ['youtube_search_videos'],
  tag_keyword_clusterer: ['youtube_search_videos'],
  playlist_endscreen_strategist: ['youtube_channel_stats'],
  community_engagement_catalyst: ['content_list_files', 'content_read_file', 'queue_for_approval'],
  multiplatform_syndicate: ['content_list_files', 'content_read_file', 'queue_for_approval'],
  shorts_hook_extractor: ['content_list_files', 'content_read_file', 'queue_for_approval'],
  vertical_reframing_director: ['cloudinary_list_videos', 'render_video_clip'],
  kinetic_captioner: ['render_video_clip'],
  loop_specialist: ['render_video_clip'],

  // ── YouTube: Monetization & Scale (the analytics desk) ───────
  lead_magnet_funnelist: ['fetch_web_page'],
  retention_ctr_auditor: ['youtube_channel_stats', 'compute_engagement_rate', 'summarize_series'],
  algorithm_iteration_strategist: ['youtube_channel_stats', 'compute_growth_rate'],
  channel_scale_director: ['youtube_channel_stats', 'compute_growth_rate', 'summarize_series'],

  // ── Visions4U ────────────────────────────────────────────────
  v4u_intake_routing: ['queue_for_approval'],
  v4u_scheduling: ['queue_for_approval'],
  v4u_deliverables_handoff: ['content_list_files', 'content_read_file', 'queue_for_approval'],
  v4u_architecture_review: ['fetch_web_page'],
  v4u_trend_strategy: ['content_list_files', 'content_read_file', 'youtube_search_videos', 'facebook_page_insights', 'fetch_web_page', 'summarize_series'],
  v4u_social_content: ['content_list_files', 'content_read_file', 'queue_for_approval', 'compute_engagement_rate'],
  v4u_campaign_executor: ['content_list_files', 'content_read_file', 'queue_for_approval', 'facebook_page_insights'],
  v4u_community_engagement: ['queue_for_approval', 'facebook_page_insights'],

  // ── Build Catalyst ───────────────────────────────────────────
  bc_ai_business_audit: ['content_list_files', 'content_read_file', 'fetch_web_page', 'queue_for_approval'],
  bc_insight_extraction: ['facebook_page_insights', 'youtube_channel_stats', 'spotify_artist_lookup', 'summarize_series', 'compute_growth_rate'],

  // ── Silverfoxx2u Music ───────────────────────────────────────
  sf_spotify_optimization: ['spotify_artist_lookup', 'music_api', 'queue_for_approval'],
  sf_apple_music: ['itunes_search', 'music_api', 'queue_for_approval'],
  sf_amplitude_analytics: [
    'spotify_artist_lookup',
    'itunes_search',
    'youtube_channel_stats',
    'facebook_page_insights',
    'compute_engagement_rate',
    'compute_growth_rate',
    'summarize_series',
  ],
  sf_social_viral: ['content_list_files', 'content_read_file', 'youtube_search_videos', 'music_api', 'queue_for_approval'],
  sf_content_clipping: ['content_list_files', 'content_read_file', 'cloudinary_list_videos', 'render_video_clip', 'queue_for_approval'],
  sf_platform_distribution: ['music_api', 'queue_for_approval'],
  sf_crm_fan_engagement: ['queue_for_approval'],
};
