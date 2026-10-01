'use client';

import React, { useState } from 'react';
import { AGENCY_AGENTS, AGENT_DIVISIONS } from '../../lib/agency/agentRegistry';
import { runAgent, runEntireTeam, getTeamAgents } from '../../lib/agency/client';
import type { AgentExecutionOutput } from '../../lib/agency/types';
import DeliverablesPanel from './DeliverablesPanel';
import ApprovalQueuePanel from './ApprovalQueuePanel';
import { AgencyAgent } from '../../lib/agency/types';
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

export default function AgencyDashboard() {
  const [selectedDivision, setSelectedDivision] = useState<string>('All');
  const [selectedAgent, setSelectedAgent] = useState<AgencyAgent>(AGENCY_AGENTS[0]);
  const [topicInput, setTopicInput] = useState<string>('How I Automated a YouTube Media Empire (In 7 Days)');
  const [nicheInput, setNicheInput] = useState<string>('AI & Business Automation');
  const [customAgentInput, setCustomAgentInput] = useState<string>('');
  
  // Execution State
  const [isTeamRunning, setIsTeamRunning] = useState<boolean>(false);
  const [isSingleRunning, setIsSingleRunning] = useState<boolean>(false);
  const [currentRunningIndex, setCurrentRunningIndex] = useState<number>(0);
  const [liveLogs, setLiveLogs] = useState<AgentExecutionOutput[]>([]);
  const [activeTab, setActiveTab] = useState<'roster' | 'liveLogs' | 'deliverables' | 'approvals'>('roster');
  const [runError, setRunError] = useState<string | null>(null);

  const filteredAgents = selectedDivision === 'All' 
    ? AGENCY_AGENTS 
    : AGENCY_AGENTS.filter(a => a.division === selectedDivision);

  const teamSize = getTeamAgents(selectedDivision).length;
  const teamLabel = selectedDivision === 'All' ? `All ${AGENCY_AGENTS.length} Agents` : selectedDivision;

  // Execute the selected division (or the whole Agency) as a team
  const handleRunFullTeam = async () => {
    setIsTeamRunning(true);
    setRunError(null);
    setLiveLogs([]);
    setActiveTab('liveLogs');
    setCurrentRunningIndex(0);

    try {
      await runEntireTeam(topicInput, nicheInput, (output, index) => {
        setCurrentRunningIndex(index);
        setLiveLogs(prev => [output, ...prev]);
      }, undefined, selectedDivision);
      setActiveTab('deliverables');
    } catch (err) {
      console.error('Error running agent team:', err);
      setRunError(err instanceof Error ? err.message : 'Team run failed.');
    } finally {
      setIsTeamRunning(false);
    }
  };

  // Execute Single Selected Agent
  const handleRunSingleAgent = async () => {
    if (!selectedAgent) return;
    setIsSingleRunning(true);
    setRunError(null);
    const goal = customAgentInput.trim() || topicInput;

    try {
      const res = await runAgent(selectedAgent.id, goal, { niche: nicheInput });
      setLiveLogs(prev => [res, ...prev]);
      setActiveTab('liveLogs');
    } catch (err) {
      console.error('Error running single agent:', err);
      setRunError(err instanceof Error ? err.message : 'Agent run failed.');
    } finally {
      setIsSingleRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      {runError && (
        <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {runError}
        </div>
      )}
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-red-950 via-zinc-900 to-black p-8 border border-red-900/40 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold mb-3">
              <Cpu className="w-3.5 h-3.5 animate-pulse" />
              THE AGENCY: {AGENCY_AGENTS.length} AUTONOMOUS AGENTS ACTIVE
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              The <span className="text-red-500">Agency</span>
            </h1>
            <p className="text-zinc-400 mt-2 max-w-2xl text-sm lg:text-base">
              One Executive Orchestrator coordinating {AGENCY_AGENTS.length - 1} specialists across YouTube growth, Visions4U,
              Build Catalyst, and Silverfoxx2u, with reasoning loops, live tools, and Supabase vector memory.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-center">
              <div className="text-2xl font-black text-white">{AGENCY_AGENTS.length}</div>
              <div className="text-[11px] text-zinc-400 uppercase font-semibold">Autonomous Agents</div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-center">
              <div className="text-2xl font-black text-red-400">{AGENT_DIVISIONS.length}</div>
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
              Running Agent {currentRunningIndex} of {teamSize}...
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs uppercase font-bold text-zinc-400 mb-1.5">Goal, Topic or Client</label>
            <input 
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
              placeholder="e.g. How I Automated a YouTube Media Empire in 7 Days"
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-bold text-zinc-400 mb-1.5">Niche or Brand</label>
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
              <span>{Math.round((currentRunningIndex / teamSize) * 100)}% ({currentRunningIndex}/{teamSize})</span>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-zinc-800">
              <div 
                className="bg-gradient-to-r from-red-600 to-red-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(currentRunningIndex / teamSize) * 100}%` }}
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
              Agent Roster ({AGENCY_AGENTS.length})
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
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'approvals' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Approvals
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
                Orchestrating {teamSize} Agents...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                Launch {teamLabel} Team
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
              All {AGENCY_AGENTS.length} Agents
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
            {/* Agents Grid */}
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
              No executions logged yet. Click &quot;Launch Team&quot; or trigger an agent from the Roster.
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
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                          log.mode === 'live'
                            ? 'text-emerald-300 bg-emerald-950/60 border-emerald-900'
                            : 'text-amber-300 bg-amber-950/60 border-amber-900'
                        }`}
                        title={log.notice}
                      >
                        {log.mode}
                      </span>
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

      {/* TAB 3: REAL AGENT DELIVERABLES */}
      {activeTab === 'deliverables' && <DeliverablesPanel logs={liveLogs} topic={topicInput} niche={nicheInput} />}

      {/* TAB 4: APPROVAL QUEUE */}
      {activeTab === 'approvals' && <ApprovalQueuePanel />}
    </div>
  );
}
