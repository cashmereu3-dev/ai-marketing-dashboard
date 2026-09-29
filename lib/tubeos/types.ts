export type AgentDivision = 
  | 'Executive'
  | 'Market Intelligence'
  | 'Packaging & Visuals'
  | 'Script & Retention'
  | 'Media & Production'
  | 'Shorts & Omnichannel'
  | 'SEO & Discovery'
  | 'Monetization & Scale';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

export interface TubeAgent {
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

export interface TubeOSProject {
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

export interface TubeOSExecution {
  id: string;
  projectId: string;
  agentId: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  status: AgentStatus;
  startedAt: string;
  completedAt?: string;
}

export interface TubeVectorMemory {
  id: string;
  projectId: string;
  agentId: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
