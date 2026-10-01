// lib/agency/dataToolSchemas.ts
// Schemas for the real data tools in dataTools.ts (no server-only imports, safe anywhere).
import type { LLMTool } from './llm';

export const BRANDS = ['visions4u', 'build_catalyst', 'silverfoxx2u'] as const;
export const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'email', 'sms', 'website', 'other'] as const;

export const DATA_TOOL_SCHEMAS: Record<string, LLMTool> = {
  content_list_files: {
    name: 'content_list_files',
    description:
      "List the files in Jevon's private content library (photos, videos, scripts, brand notes he uploaded on the Upload page). Use it to see what source material exists before drafting.",
    input_schema: {
      type: 'object',
      properties: { max_results: { type: 'number', description: '1 to 100 (default 50)' } },
    },
  },
  content_read_file: {
    name: 'content_read_file',
    description:
      'Read a file from the content library by its exact name from content_list_files. Text files (.txt .md .csv .json .html .srt) return their contents; photos and videos return a 7-day link instead.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact file name from content_list_files' },
        max_chars: { type: 'number', description: '500 to 60000 (default 20000)' },
      },
      required: ['name'],
    },
  },
  youtube_search_videos: {
    name: 'youtube_search_videos',
    description:
      'Search YouTube and return real public stats (views, likes, comments, publish date, channel) for the top results. Use it to find outlier videos, rising topics and what already ranks. Needs YOUTUBE_API_KEY.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search phrase' },
        order: { type: 'string', description: 'relevance, viewCount or date (default relevance)' },
        max_results: { type: 'number', description: '1 to 10 (default 8)' },
      },
      required: ['query'],
    },
  },
  youtube_channel_stats: {
    name: 'youtube_channel_stats',
    description:
      'Real stats for a YouTube channel: subscribers, total views, video count, and its last 10 uploads with views, plus the median views and which uploads beat 3x the median. Accepts a @handle, a channel id (UC...), a channel URL or a channel name. Needs YOUTUBE_API_KEY.',
    input_schema: {
      type: 'object',
      properties: { channel: { type: 'string', description: '@handle, UC... id, URL or name' } },
      required: ['channel'],
    },
  },
  facebook_page_insights: {
    name: 'facebook_page_insights',
    description:
      "Real data for the Visions4U Facebook Page: followers, the 10 most recent posts with reactions/comments/shares, and Page insight metrics when Facebook allows them. Needs FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN on the server.",
    input_schema: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Days of insight history, 1 to 90 (default 28)' } },
    },
  },
  spotify_artist_lookup: {
    name: 'spotify_artist_lookup',
    description:
      'Look up an artist on Spotify: followers, popularity score (0-100), genres, and top tracks. Use it for Silverfoxx2u or for comparable artists. Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Artist name, e.g. Silverfoxx2u' } },
      required: ['query'],
    },
  },
  itunes_search: {
    name: 'itunes_search',
    description:
      'Search the Apple Music / iTunes catalog (no key needed). Returns real artist, song or album listings with genre, release date and store links. Use it to audit how a release appears on Apple Music.',
    input_schema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'Artist, song or album name' },
        entity: { type: 'string', description: 'musicArtist, song or album (default song)' },
        country: { type: 'string', description: 'Two-letter storefront, default US' },
        limit: { type: 'number', description: '1 to 15 (default 8)' },
      },
      required: ['term'],
    },
  },
  agency_doctor: {
    name: 'agency_doctor',
    description:
      'Read-only health check. Reports which AI models, API keys, database tables and phone notifications are working, and which of YOUR data tools are ready. Run it first when a task depends on external data or when a tool errors. Takes no input.',
    input_schema: { type: 'object', properties: {} },
  },
  fetch_web_page: {
    name: 'fetch_web_page',
    description:
      "Fetch a public web page (https only) and return its title, meta description, headings, word count, link and image-alt counts, structured-data presence and a text excerpt. Use it to audit a prospect's or competitor's site, or your own pages. Cannot reach private or local addresses.",
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'Full https URL' } },
      required: ['url'],
    },
  },
  compute_engagement_rate: {
    name: 'compute_engagement_rate',
    description: 'Engagement rate as a percentage: engagements divided by reach (or views), from real numbers.',
    input_schema: {
      type: 'object',
      properties: {
        engagements: { type: 'number', description: 'Reactions + comments + shares + saves' },
        reach: { type: 'number', description: 'Reach, impressions or views' },
      },
      required: ['engagements', 'reach'],
    },
  },
  compute_growth_rate: {
    name: 'compute_growth_rate',
    description: 'Period-over-period growth: absolute change, percent change, and per-period compound rate.',
    input_schema: {
      type: 'object',
      properties: {
        previous: { type: 'number' },
        current: { type: 'number' },
        periods: { type: 'number', description: 'Number of periods between the two values (default 1)' },
      },
      required: ['previous', 'current'],
    },
  },
  summarize_series: {
    name: 'summarize_series',
    description: 'Summarize a numeric series in time order (oldest first): mean, median, min, max, latest, last-step change and trend slope.',
    input_schema: {
      type: 'object',
      properties: { values: { type: 'array', items: { type: 'number' }, description: 'Numbers, oldest first' } },
      required: ['values'],
    },
  },
  cloudinary_list_videos: {
    name: 'cloudinary_list_videos',
    description:
      "List videos in Jevon's Cloudinary library (public_id, length, size, dimensions, created date) so you can pick footage to edit. Optionally filter by folder prefix. Needs CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    input_schema: {
      type: 'object',
      properties: {
        prefix: { type: 'string', description: 'Folder or public_id prefix, e.g. agency/inbox/visions4u' },
        max_results: { type: 'number', description: '1 to 30 (default 15)' },
      },
    },
  },
  render_video_clip: {
    name: 'render_video_clip',
    description:
      'Cut and reframe a video that is already in Cloudinary and return a real, playable MP4 link: trim to start/end seconds, crop to 9:16, 1:1, 4:5 or 16:9 with automatic subject tracking, and optionally burn in a caption. Use it to turn your edit decisions into an actual clip. Needs CLOUDINARY_CLOUD_NAME.',
    input_schema: {
      type: 'object',
      properties: {
        public_id: { type: 'string', description: 'Cloudinary public_id of the source video (no extension)' },
        start_seconds: { type: 'number', description: 'Clip start in seconds' },
        end_seconds: { type: 'number', description: 'Clip end in seconds (max 90 seconds after start)' },
        aspect: { type: 'string', description: '9:16, 1:1, 4:5 or 16:9 (default 9:16)' },
        caption: { type: 'string', description: 'Optional on-screen caption, max 80 characters' },
      },
      required: ['public_id', 'start_seconds', 'end_seconds'],
    },
  },
  queue_for_approval: {
    name: 'queue_for_approval',
    description:
      "Put a finished draft (post, reply, email, pitch, proposal) into Jevon's approval queue. This is the ONLY way to hand something off for publishing. Nothing is sent or posted by calling it.",
    input_schema: {
      type: 'object',
      properties: {
        brand: { type: 'string', description: 'visions4u, build_catalyst or silverfoxx2u' },
        platform: { type: 'string', description: 'facebook, instagram, tiktok, youtube, linkedin, email, sms, website or other' },
        kind: { type: 'string', description: 'post, reply, dm, email, pitch, proposal, clip or other' },
        title: { type: 'string', description: 'Short label for the queue (max 120 chars)' },
        content: { type: 'string', description: 'The exact ready-to-use text' },
        media_url: { type: 'string', description: 'Link to the media this goes with, if any' },
        scheduled_for: { type: 'string', description: 'Suggested publish time, ISO 8601, if any' },
        rationale: { type: 'string', description: 'One or two sentences on why this should go out' },
      },
      required: ['brand', 'platform', 'title', 'content'],
    },
  },
};
