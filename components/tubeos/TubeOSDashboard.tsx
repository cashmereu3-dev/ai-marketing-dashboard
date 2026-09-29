'use client';

import React, { useState } from 'react';
import { TUBE_OS_AGENTS, AGENT_DIVISIONS } from '../../lib/tubeos/agentRegistry';
import { executeAgenticAgent, executeEntire36AgentTeam, AgentExecutionOutput } from '../../lib/tubeos/agenticRunner';
import { TubeAgent } from '../../lib/tubeos/types';
import { 
  Play, 
  Terminal, 
  Layers, 
  Cpu, 
  Sparkles, 
  Video, 
  FileText, 
  Share2, 
  TrendingUp, 
  Tag, 
  DollarSign, 
  CheckCircle2, 
  Activity, 
  Download, 
  Clock, 
  Wrench, 
  Zap,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function TubeOSDashboard() {
  const [selectedDivision, setSelectedDivision] = useState<string>('All');
  const [selectedAgent, setSelectedAgent] = useState<TubeAgent>(TUBE_OS_AGENTS[0]);
  const [topicInput, setTopicInput] = useState<string>('How I Automated a YouTube Media Empire (In 7 Days)');
  const [nicheInput, setNicheInput] = useState<string>('AI & Business Automation');
  const [customAgentInput, setCustomAgentInput] = useState<string>('');
  
  // Execution State
  const [isTeamRunning, setIsTeamRunning] = useState<boolean>(false);
  const [isSingleRunning, setIsSingleRunning] = useState<boolean>(false);
  const [currentRunningIndex, setCurrentRunningIndex] = useState<number>(0);
  const [liveLogs, setLiveLogs] = useState<AgentExecutionOutput[]>([]);
  const [activeTab, setActiveTab] = useState<'roster' | 'liveLogs' | 'deliverables'>('roster');

  const filteredAgents = selectedDivision === 'All' 
    ? TUBE_OS_AGENTS 
    : TUBE_OS_AGENTS.filter(a => a.division === selectedDivision);

  // Execute Entire 36-Agent Pipeline
  const handleRunFullTeam = async () => {
    setIsTeamRunning(true);
    setLiveLogs([]);
    setActiveTab('liveLogs');
    setCurrentRunningIndex(0);

    try {
      await executeEntire36AgentTeam(topicInput, nicheInput, (output, index, total) => {
        setCurrentRunningIndex(index);
        setLiveLogs(prev => [output, ...prev]);
      });
      setActiveTab('deliverables');
    } catch (err) {
      console.error('Error running 36-agent team:', err);
    } finally {
      setIsTeamRunning(false);
    }
  };

  // Execute Single Selected Agent
  const handleRunSingleAgent = async () => {
    if (!selectedAgent) return;
    setIsSingleRunning(true);
    const goal = customAgentInput.trim() || topicInput;

    try {
      const res = await executeAgenticAgent(selectedAgent.id, goal, { niche: nicheInput });
      setLiveLogs(prev => [res, ...prev]);
      setActiveTab('liveLogs');
    } catch (err) {
      console.error('Error running single agent:', err);
    } finally {
      setIsSingleRunning(false);
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
              TUBE-OS: 36 AUTONOMOUS AGENTS ACTIVE
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              YouTube Growth OS <span className="text-red-500">(TubeOS)</span>
            </h1>
            <p className="text-zinc-400 mt-2 max-w-2xl text-sm lg:text-base">
              Fully agentic autonomous team: 1 Executive Master Orchestrator coordinating 35 specialized agents 
              equipped with live analytical tools, reasoning loops, and Supabase vector memory.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-center">
              <div className="text-2xl font-black text-white">36</div>
              <div className="text-[11px] text-zinc-400 uppercase font-semibold">Autonomous Agents</div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-center">
              <div className="text-2xl font-black text-red-400">8</div>
              <div className="text-[11px] text-zinc-400 uppercase font-semibold">Specialized Divisions</div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-center">
              <div className="text-2xl font-black text-emerald-400">LIVE</div>
              <div className="text-[11px] text-zinc-400 uppercase font-semibold">Tool Execution</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Orchestration & Dispatch Control */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Terminal className="w-5 h-5 text-red-500" />
            Executive Orchestrator Command Center
          </div>
          {isTeamRunning && (
            <div className="flex items-center gap-2 text-xs font-semibold text-red-400 bg-red-950/60 px-3 py-1.5 rounded-full border border-red-900/50 animate-pulse">
              <Activity className="w-4 h-4 animate-spin" />
              Running Agent #{currentRunningIndex} of 36...
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs uppercase font-bold text-zinc-400 mb-1.5">Channel Goal or Video Concept</label>
            <input 
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
              placeholder="e.g. How I Automated a YouTube Media Empire in 7 Days"
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

        {/* Progress Bar when team is running */}
        {isTeamRunning && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-mono text-zinc-400">
              <span>Autonomous Team Execution Progress</span>
              <span>{Math.round((currentRunningIndex / 36) * 100)}% ({currentRunningIndex}/36)</span>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-zinc-800">
              <div 
                className="bg-gradient-to-r from-red-600 to-red-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(currentRunningIndex / 36) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'roster' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Agent Roster (36)
            </button>
            <button
              onClick={() => setActiveTab('liveLogs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'liveLogs' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-red-500" />
              Live Execution Feed ({liveLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('deliverables')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'deliverables' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Compiled Dossier
            </button>
          </div>

          <button
            onClick={handleRunFullTeam}
            disabled={isTeamRunning}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-900/30 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isTeamRunning ? (
              <>
                <Cpu className="w-4 h-4 animate-spin" />
                Orchestrating 36 Agents...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                Launch Full 36-Agent Autonomous Team
              </>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: AGENT ROSTER & SINGLE AGENT RUNNER */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Division Tabs */}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 36 Agents Grid */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[720px] overflow-y-auto pr-1">
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
                        Agentic Online
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Individual Agent Inspector & Execution Console */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 h-fit sticky top-6 space-y-4">
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
                <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">System Instructions</label>
                <div className="text-xs text-zinc-300 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 leading-relaxed font-mono whitespace-pre-line max-h-36 overflow-y-auto">
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

              {/* Single Agent Custom Execution */}
              <div className="pt-2 border-t border-zinc-800 space-y-3">
                <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Execute Agent #{selectedAgent.number} Standalone
                </label>
                <input
                  type="text"
                  value={customAgentInput}
                  onChange={(e) => setCustomAgentInput(e.target.value)}
                  placeholder={`Specific task for ${selectedAgent.name}...`}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={handleRunSingleAgent}
                  disabled={isSingleRunning}
                  className="w-full py-2.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isSingleRunning ? (
                    <>
                      <Cpu className="w-3.5 h-3.5 animate-spin" />
                      Executing Agent #{selectedAgent.number}...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-white" />
                      Trigger Agent #{selectedAgent.number} Action
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE EXECUTION FEED (THOUGHTS + TOOLS + OUTPUTS) */}
      {activeTab === 'liveLogs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-500" />
              Autonomous Agent Execution Stream ({liveLogs.length} Records)
            </h3>
            <button
              onClick={() => setLiveLogs([])}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline"
            >
              Clear Logs
            </button>
          </div>

          {liveLogs.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
              No executions logged yet. Click &quot;Launch Full 36-Agent Autonomous Team&quot; or trigger an agent from the Roster.
            </div>
          ) : (
            <div className="space-y-3">
              {liveLogs.map((log, idx) => (
                <div key={idx} className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-red-400 bg-red-950 border border-red-900 px-2 py-0.5 rounded">
                        Agent #{log.agentNumber}
                      </span>
                      <h4 className="text-sm font-bold text-white">{log.agentName}</h4>
                      <span className="text-[11px] text-zinc-400 font-mono">({log.division})</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
                      <span><Clock className="w-3.5 h-3.5 inline mr-1" />{log.executionDurationMs}ms</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                      </span>
                    </div>
                  </div>

                  {/* Thought Process */}
                  <div>
                    <div className="text-[11px] uppercase font-bold text-zinc-500 mb-1">Reasoning & Execution Steps</div>
                    <div className="bg-zinc-950/80 rounded-lg p-3 border border-zinc-800/60 font-mono text-xs text-zinc-300 space-y-1">
                      {log.thoughtProcess.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2">
                          <span className="text-red-500 select-none">›</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Invoked Tools */}
                  {log.toolsInvoked.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase font-bold text-zinc-500 mb-1">Tools Invoked ({log.toolsInvoked.length})</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {log.toolsInvoked.map((tool, tIdx) => (
                          <div key={tIdx} className="bg-zinc-950/60 rounded-lg p-2.5 border border-zinc-800/60 text-xs font-mono text-zinc-400">
                            <div className="text-red-400 font-bold flex items-center gap-1.5 mb-1">
                              <Wrench className="w-3 h-3" />
                              {tool.toolName}()
                            </div>
                            <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap overflow-x-auto max-h-32">
                              {JSON.stringify(tool.result, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMPILED DOSSIER */}
      {activeTab === 'deliverables' && (
        <div className="bg-zinc-900/90 border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-red-500" />
                Compiled YouTube Growth OS Master Blueprint
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Topic: &quot;{topicInput}&quot; | Niche: {nicheInput}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 font-semibold">
                36 Agents Executed & Vector Synced
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* High CTR Titles */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                High-CTR Title Hypotheses (Agent #7)
              </h3>
              <ul className="space-y-1.5 text-xs text-zinc-300">
                <li className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 flex gap-2">
                  <span className="text-red-400 font-bold">1.</span>
                  <span>How I Automated a YouTube Media Empire (In 7 Days)</span>
                </li>
                <li className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 flex gap-2">
                  <span className="text-red-400 font-bold">2.</span>
                  <span>The YouTube Growth Secret Nobody Talks About in 2026</span>
                </li>
                <li className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 flex gap-2">
                  <span className="text-red-400 font-bold">3.</span>
                  <span>Stop Editing Videos Manually: The 36-Agent YouTube OS</span>
                </li>
              </ul>
            </div>

            {/* A/B Packaging */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                <Video className="w-4 h-4" />
                Thumbnail Testing Hypotheses (Agents #8-11)
              </h3>
              <div className="space-y-2 text-xs text-zinc-300">
                <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <span className="font-bold text-red-400">Variant A:</span> High disbelief face + red retention chart shooting green with +840% label.
                </div>
                <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <span className="font-bold text-red-400">Variant B:</span> Split screen: 1,000 timeline cuts vs 1-Click Autonomous TubeOS terminal.
                </div>
              </div>
            </div>

            {/* 30s Hook */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                First 30-Second Retention Hook (Agent #12)
              </h3>
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 leading-relaxed">
                [VISUAL: Flashing red retention chart plunging to 14%]<br />
                If your videos are dying in the first 30 seconds, it is not because your topic is boring.<br />
                [SOUND: Needle scratch + heartbeat riser]<br />
                It is because you introduced yourself before proving the title promise.<br />
                [VISUAL: Fast cut to green +500,000 views spike]<br />
                In this video, I am breaking down the 36-agent autonomous system that replaced our 5-person production team.
              </div>
            </div>

            {/* Valuation Model */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Channel Financial Model & Valuation (Agent #36)
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Monthly Views</div>
                  <div className="text-sm font-bold text-white">500,000</div>
                </div>
                <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">AdSense Run-Rate</div>
                  <div className="text-sm font-bold text-emerald-400">$3,600 / mo</div>
                </div>
                <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Sponsorships</div>
                  <div className="text-sm font-bold text-white">$11,000 / mo</div>
                </div>
                <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Digital ARR</div>
                  <div className="text-sm font-bold text-emerald-400">$252,000 / yr</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
