// lib/agency/liveTools.ts
// Tool definitions exposed to the model in live mode.
//
// Only tools that do REAL computation are exposed. The registry's tools that return
// canned sample data (scrape_youtube_channel, query_google_trends, generate_persona_card,
// extract_viral_clips, engineer_infinity_loop, generate_chapters, cluster_semantic_tags,
// generate_midjourney_prompt, build_ab_matrix, generate_shot_list) are intentionally NOT
// offered: the model produces that work itself, and research agents get live web search.
import type { LLMTool } from './llm';
import { DATA_TOOL_SCHEMAS } from './dataToolSchemas';

export const LIVE_TOOL_SCHEMAS: Record<string, LLMTool> = {
  ...DATA_TOOL_SCHEMAS,
  compute_view_velocity: {
    name: 'compute_view_velocity',
    description: 'Compute views-per-hour and a 30-day projection from real view counts.',
    input_schema: {
      type: 'object',
      properties: {
        views: { type: 'number', description: 'Total views so far' },
        hoursSincePublish: { type: 'number', description: 'Hours since the video was published' },
      },
      required: ['views', 'hoursSincePublish'],
    },
  },
  score_title_ctr: {
    name: 'score_title_ctr',
    description: 'Heuristic title check: length, mobile cutoff, curiosity/stakes signals. A rough rubric, not a real CTR prediction.',
    input_schema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
  },
  audit_first_30s: {
    name: 'audit_first_30s',
    description: 'Regex audit of a script opening: flags fluff intros and checks for visual/audio direction cues.',
    input_schema: {
      type: 'object',
      properties: { scriptText: { type: 'string', description: 'The first ~30 seconds of script' } },
      required: ['scriptText'],
    },
  },
  inject_pattern_interrupt: {
    name: 'inject_pattern_interrupt',
    description: 'Suggest a pattern-interrupt technique for a given minute marker in the video.',
    input_schema: {
      type: 'object',
      properties: { minuteMarker: { type: 'number' } },
      required: ['minuteMarker'],
    },
  },
  format_ssml_cadence: {
    name: 'format_ssml_cadence',
    description: 'Wrap voiceover text in SSML with sentence pauses for TTS.',
    input_schema: {
      type: 'object',
      properties: { voiceoverText: { type: 'string' } },
      required: ['voiceoverText'],
    },
  },
  model_channel_valuation: {
    name: 'model_channel_valuation',
    description: 'Revenue and valuation arithmetic from monthly views and RPM (uses fixed sponsor-CPM and funnel assumptions).',
    input_schema: {
      type: 'object',
      properties: {
        monthlyViews: { type: 'number' },
        rpm: { type: 'number', description: 'Revenue per 1000 views in USD' },
      },
      required: ['monthlyViews', 'rpm'],
    },
  },
};

export const LIVE_TOOL_NAMES = new Set(Object.keys(LIVE_TOOL_SCHEMAS));

/** Anthropic server-side web search (executed by the API, not by us). */
export const WEB_SEARCH_TOOL: LLMTool = { type: 'web_search_20250305', name: 'web_search', max_uses: 3 };

/** Divisions whose work depends on current, real-world data. */
export const WEB_SEARCH_DIVISIONS = new Set([
  'Executive',
  'Market Intelligence',
  'SEO & Discovery',
  'Monetization & Scale',
  'Visions4U Marketing',
  'Silverfoxx2u Music',
  'Build Catalyst',
]);

export const READ_MEMORY_TOOL: LLMTool = {
  name: 'read_memory',
  description: 'Search the shared team memory (past agent outputs) for a keyword or phrase. Returns up to 5 recent matches.',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Keyword or short phrase to search for' } },
    required: ['query'],
  },
};

export const WRITE_MEMORY_TOOL: LLMTool = {
  name: 'write_memory',
  description: 'Save a durable fact, decision, or finding to shared team memory so other agents and later runs can use it.',
  input_schema: {
    type: 'object',
    properties: { content: { type: 'string', description: 'What to remember (concise, self-contained)' } },
    required: ['content'],
  },
};

export const DELEGATE_TOOL: LLMTool = {
  name: 'delegate_to_subagent',
  description: 'Delegate a focused task to one specialist agent and receive their deliverable. Use sparingly (max 3 per run).',
  input_schema: {
    type: 'object',
    properties: {
      agent_id: { type: 'string', description: 'The specialist agent id from the roster' },
      task: { type: 'string', description: 'A specific, self-contained task for that agent' },
    },
    required: ['agent_id', 'task'],
  },
};

export const SUBMIT_TOOL: LLMTool = {
  name: 'submit_deliverable',
  description: 'Submit your finished work. Call exactly once when done.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Two or three sentence summary of what you produced' },
      deliverable: { type: 'object', description: 'The finished, directly usable work product as structured JSON', additionalProperties: true },
      recommendations: { type: 'array', items: { type: 'string' }, description: 'Concrete next steps' },
      handoff_notes: { type: 'string', description: 'What downstream agents should know' },
    },
    required: ['summary', 'deliverable'],
  },
};

/** Minimal runtime check of tool input against the declared schema. */
export function validateToolInput(schema: LLMTool, input: Record<string, unknown>): string | null {
  const s = schema.input_schema as { properties?: Record<string, { type?: string }>; required?: string[] } | undefined;
  if (!s) return null;
  for (const key of s.required ?? []) {
    if (input[key] === undefined || input[key] === null) return `Missing required argument "${key}".`;
  }
  for (const [key, def] of Object.entries(s.properties ?? {})) {
    const v = input[key];
    if (v === undefined) continue;
    if (def.type === 'number' && (typeof v !== 'number' || !Number.isFinite(v))) return `Argument "${key}" must be a number.`;
    if (def.type === 'string' && typeof v !== 'string') return `Argument "${key}" must be a string.`;
  }
  return null;
}
