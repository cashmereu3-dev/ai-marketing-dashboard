-- TubeOS: 36-Agent YouTube Growth OS Schema Migration
-- Compatible with Supabase PostgreSQL

-- 1. Enable pgvector if available for memory & script embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TubeOS Projects Table
CREATE TABLE IF NOT EXISTS public.tubeos_projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    niche TEXT NOT NULL,
    target_audience TEXT,
    status TEXT NOT NULL DEFAULT 'ideation',
    executive_plan TEXT,
    titles JSONB DEFAULT '[]'::jsonb,
    thumbnail_prompts JSONB DEFAULT '[]'::jsonb,
    script TEXT,
    shorts_hooks JSONB DEFAULT '[]'::jsonb,
    seo_tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TubeOS Agent Definitions Table
CREATE TABLE IF NOT EXISTS public.tubeos_agents (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    division TEXT NOT NULL,
    icon TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    tools JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'idle',
    last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. TubeOS Agent Executions & Audit Log
CREATE TABLE IF NOT EXISTS public.tubeos_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT REFERENCES public.tubeos_projects(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES public.tubeos_agents(id) ON DELETE CASCADE,
    input_payload JSONB DEFAULT '{}'::jsonb,
    output_payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'completed',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. TubeOS Vector Memory Store
CREATE TABLE IF NOT EXISTS public.tubeos_vector_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT,
    agent_id TEXT,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable Row-Level Security
ALTER TABLE public.tubeos_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tubeos_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tubeos_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tubeos_vector_memory ENABLE ROW LEVEL SECURITY;

-- 7. RLS on with NO policies: only the server (service-role key) can read/write.
