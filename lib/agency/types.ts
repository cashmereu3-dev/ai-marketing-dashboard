export type AgentDivision = 
  | 'Executive'
  | 'Market Intelligence'
  | 'Packaging & Visuals'
  | 'Script & Retention'
  | 'Media & Production'
  | 'Shorts & Omnichannel'
  | 'SEO & Discovery'
  | 'Monetization & Scale'
  | 'Visions4U Operations'
  | 'Visions4U Development'
  | 'Visions4U Marketing'
  | 'Build Catalyst'
  | 'Silverfoxx2u Music';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

export interface AgencyAgent {
  id: string;
  number: number;
  name: string;
  role: string;
  division: AgentDivision;
  icon: string;
  systemPrompt: string;
  tools: string[];
  status: AgentStatus;
  lastActive?: string;
  outputSummary?: string;
}

export interface AgencyProject {
  id: string;
  title: string;
  niche: string;
  targetAudience: string;
  status: 'ideation' | 'scripting' | 'production' | 'review' | 'published';
  createdAt: string;
  updatedAt: string;
  executivePlan?: string;
  titles?: string[];
  thumbnailPrompts?: string[];
  script?: string;
  shortsHooks?: string[];
  seoTags?: string[];
}

export interface AgencyExecution {
  id: string;
  projectId: string;
  agentId: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  status: AgentStatus;
  startedAt: string;
  completedAt?: string;
}

export interface AgencyVectorMemory {
  id: string;
  projectId: string;
  agentId: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ToolInvocation {
  toolName: string;
  args?: Record<string, unknown>;
  result: Record<string, unknown>;
  durationMs?: number;
  error?: boolean;
}

export interface AgentExecutionOutput {
  agentId: string;
  agentName: string;
  agentNumber: number;
  division: string;
  /** Model reasoning text (live mode) or scripted steps (simulated mode). */
  thoughtProcess: string[];
  toolsInvoked: ToolInvocation[];
  deliverable: Record<string, unknown>;
  executionDurationMs: number;
  timestamp: string;
  /** 'live' = a real model ran the tool loop; 'simulated' = canned offline output. */
  mode: 'live' | 'simulated';
  model?: string;
  steps?: number;
  usage?: { inputTokens: number; outputTokens: number };
  notice?: string;
}
