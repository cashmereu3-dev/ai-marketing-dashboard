// lib/agency/supabaseAgency.ts
import { supabase } from '../supabaseClient';
import { AGENCY_AGENTS } from './agentRegistry';
import { AgencyAgent, AgencyExecution, AgencyVectorMemory } from './types';

/**
 * Syncs all agent definitions into Supabase public.tubeos_agents table.
 */
export async function syncAgencyAgentsToSupabase(): Promise<{ count: number; error?: string }> {
  try {
    const records = AGENCY_AGENTS.map(agent => ({
      id: agent.id,
      number: agent.number,
      name: agent.name,
      role: agent.role,
      division: agent.division,
      icon: agent.icon,
      system_prompt: agent.systemPrompt,
      tools: agent.tools,
      status: 'idle',
      last_active: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('tubeos_agents')
      .upsert(records, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase tubeos_agents sync warning:', error.message);
      return { count: 0, error: error.message };
    }

    return { count: records.length };
  } catch (err: any) {
    console.warn('Supabase sync exception:', err);
    return { count: 0, error: err.message };
  }
}

/**
 * Logs an individual agent execution event to Supabase.
 */
export async function logAgencyExecution(execution: Partial<AgencyExecution>): Promise<void> {
  try {
    await supabase.from('tubeos_executions').insert([{
      project_id: execution.projectId || 'tubeos-global',
      agent_id: execution.agentId,
      input_payload: execution.inputPayload || {},
      output_payload: execution.outputPayload || {},
      status: execution.status || 'completed',
      started_at: execution.startedAt || new Date().toISOString(),
      completed_at: execution.completedAt || new Date().toISOString()
    }]);
  } catch (err) {
    console.warn('Failed to log execution to Supabase:', err);
  }
}

/**
 * Writes vector memory record to Supabase.
 */
export async function writeAgencyVectorMemory(memory: Partial<AgencyVectorMemory>): Promise<void> {
  try {
    await supabase.from('tubeos_vector_memory').insert([{
      project_id: memory.projectId || 'tubeos-global',
      agent_id: memory.agentId,
      content: memory.content || '',
      metadata: memory.metadata || {},
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    console.warn('Failed to write vector memory to Supabase:', err);
  }
}
