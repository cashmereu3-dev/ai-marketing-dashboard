'use client';

import React, { useState } from 'react';
import { TUBE_OS_AGENTS, AGENT_DIVISIONS } from '../../lib/tubeos/agentRegistry';
import { runTubeOSPipeline, PipelineExecutionResult } from '../../lib/tubeos/orchestrator';
import { TubeAgent, AgentDivision } from '../../lib/tubeos/types';
import { 
  Play, 
  CheckCircle, 
  Terminal, 
  Layers, 
  Cpu, 
  Database, 
  Sparkles,
  Search,
  Video,
  FileText,
  Share2,
  TrendingUp,
  Tag,
  DollarSign
} from 'lucide-react';

export default function TubeOSDashboard() {
  const [selectedDivision, setSelectedDivision] = useState<string>('All');
  const [selectedAgent, setSelectedAgent] = useState<TubeAgent | null>(TUBE_OS_AGENTS[0]);
  const [topicInput, setTopicInput] = useState<string>('Building an Autonomous YouTube Media Empire');
  const [nicheInput, setNicheInput] = useState<string>('AI & Business Automation');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineExecutionResult | null>(null);

  const filteredAgents = selectedDivision === 'All' 
    ? TUBE_OS_AGENTS 
    : TUBE_OS_AGENTS.filter(a => a.division === selectedDivision);

  const handleRunPipeline = async () => {
    setIsRunning(true);
    try {
      const result = await runTubeOSPipeline(topicInput, nicheInput);
      setPipelineResult(result);
    } catch (e) {
      console.error('Error running pipeline:', e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-red-950 via-zinc-900 to-black p-8 border border-red-900/40 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold mb-3">
              <Cpu className="w-3.5 h-3.5 animate-pulse" />
              TUBE-OS: 36-AGENT AUTONOMOUS ARCHITECTURE
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              YouTube Growth OS <span className="text-red-500">(TubeOS)</span>
            </h1>
            <p className="text-zinc-400 mt-2 max-w-2xl text-sm lg:text-base">
              1 Executive Master Orchestrator controlling 35 specialized autonomous agents across 
              Topic Ideation, Visual Packaging, Script Retention, Media Production, Shorts, SEO, and Monetization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-center">
              <div className="text-2xl font-black text-white">36</div>
              <div className="text-[11px] text-zinc-400 uppercase font-semibold">Total Agents</div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-center">
              <div className="text-2xl font-black text-red-400">8</div>
              <div className="text-[11px] text-zinc-400 uppercase font-semibold">Divisions</div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-center">
              <div className="text-2xl font-black text-emerald-400">SYNC</div>
              <div className="text-[11px] text-zinc-400 uppercase font-semibold">Supabase Vector</div>
            </div>
          </div>
        </div>
      </div>

      {/* Orchestrator Command Box */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white font-bold text-lg mb-4">
          <Terminal className="w-5 h-5 text-red-500" />
          Executive Orchestrator Dispatch Console
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-xs uppercase font-bold text-zinc-400 mb-1.5">Video Topic or Channel Goal</label>
            <input 
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
              placeholder="e.g. How I Automated a YouTube Empire with 36 AI Agents"
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-bold text-zinc-400 mb-1.5">Target Niche</label>
            <input 
              type="text"
              value={nicheInput}
              onChange={(e) => setNicheInput(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
              placeholder="e.g. AI & Business Automation"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleRunPipeline}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-900/30 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isRunning ? (
              <>
                <Cpu className="w-4 h-4 animate-spin" />
                Dispatching 36 Agents...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Launch 36-Agent Pipeline
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pipeline Output Results */}
      {pipelineResult && (
        <div className="bg-zinc-900/90 border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Sparkles className="w-5 h-5 text-red-500" />
              Pipeline Execution Output: {pipelineResult.topic}
            </div>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 font-semibold">
              36/36 Agents Coordinated
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* High CTR Titles */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" />
                Top 5 High-CTR Title Formulations (Agent #7)
              </h3>
              <ul className="space-y-2">
                {pipelineResult.titles.map((t, idx) => (
                  <li key={idx} className="text-xs text-zinc-300 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60 flex items-start gap-2">
                    <span className="text-red-400 font-bold">{idx + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Thumbnail Packaging Hypotheses */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2 mb-3">
                <Video className="w-4 h-4" />
                Native A/B Thumbnail Matrix (Agents #8-11)
              </h3>
              <ul className="space-y-2">
                {pipelineResult.thumbnailConcepts.map((tc, idx) => (
                  <li key={idx} className="text-xs text-zinc-300 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60">
                    {tc}
                  </li>
                ))}
              </ul>
            </div>

            {/* 30-Second Retention Hook */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4" />
                The 30-Second Retention Hook (Agent #12)
              </h3>
              <div className="text-xs text-zinc-300 whitespace-pre-line bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/60 leading-relaxed font-mono">
                {pipelineResult.hookOpening}
              </div>
            </div>

            {/* Omnichannel Shorts & SEO */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2 mb-2">
                  <Share2 className="w-4 h-4" />
                  Repurposed Shorts Hooks (Agents #23-27)
                </h3>
                <ul className="space-y-1.5">
                  {pipelineResult.shortsHooks.map((sh, idx) => (
                    <li key={idx} className="text-xs text-zinc-300 italic bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                      {sh}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4" />
                  Semantic Graph Tags (Agent #29)
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {pipelineResult.seoTags.map((tag, idx) => (
                    <span key={idx} className="text-[11px] bg-red-950/60 border border-red-900/40 text-red-300 px-2.5 py-0.5 rounded-md font-mono">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Division Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          onClick={() => setSelectedDivision('All')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            selectedDivision === 'All'
              ? 'bg-red-600 text-white shadow-md shadow-red-900/30'
              : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          All 36 Agents
        </button>
        {AGENT_DIVISIONS.map((div) => (
          <button
            key={div}
            onClick={() => setSelectedDivision(div)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedDivision === div
                ? 'bg-red-600 text-white shadow-md shadow-red-900/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {div}
          </button>
        ))}
      </div>

      {/* Agent Roster Grid & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[700px] overflow-y-auto pr-1">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgent?.id === agent.id;
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-zinc-900 border-red-500 ring-1 ring-red-500 shadow-lg shadow-red-950/40'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-red-500 bg-red-950/60 border border-red-900/50 w-6 h-6 rounded-lg flex items-center justify-center">
                      #{agent.number}
                    </span>
                    <h4 className="text-sm font-bold text-white leading-tight">{agent.name}</h4>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                    {agent.division}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2">{agent.role}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{agent.tools.length} Bound Tools</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Agent Inspector */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 h-fit sticky top-6">
          {selectedAgent ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-base font-black text-red-400 bg-red-950 border border-red-900 w-10 h-10 rounded-xl flex items-center justify-center">
                  #{selectedAgent.number}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedAgent.name}</h3>
                  <div className="text-xs text-red-400 font-semibold">{selectedAgent.division} Division</div>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Operational Role</label>
                <div className="text-xs text-zinc-300 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
                  {selectedAgent.role}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Autonomous System Instructions</label>
                <div className="text-xs text-zinc-300 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 leading-relaxed font-mono whitespace-pre-line max-h-48 overflow-y-auto">
                  {selectedAgent.systemPrompt}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Bound Pipeline Tools</label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgent.tools.map((t) => (
                    <span key={t} className="text-[11px] bg-zinc-950 border border-zinc-800 text-zinc-400 px-2 py-1 rounded-md font-mono">
                      {t}()
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Supabase Vector Sync:</span>
                  <span className="text-emerald-400 font-semibold">Active (`public.tubeos_agents`)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500 text-sm">
              Select an agent to inspect system instructions and tool bindings
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
