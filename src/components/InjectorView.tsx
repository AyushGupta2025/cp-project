import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ParkingSlot, LogEntry } from '../types';
import {
  AlertCircle, Flame, ShieldAlert, XOctagon,
  Brain, Clock, AlertTriangle, CheckCircle,
  TrendingUp, Car, Cpu, Zap, BarChart3, RefreshCw
} from 'lucide-react';

interface InjectorViewProps {
  slots: ParkingSlot[];
  setSlots: React.Dispatch<React.SetStateAction<ParkingSlot[]>>;
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  backendOnline: boolean;
  apiUrl: string;
}

const hashString = (str: string) =>
  Array.from(str).reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0).toString(16).substring(0, 8);

function formatDuration(ms: number) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

// ─── AI Recommendations Engine ──────────────────────────────────────────────
function useAIRecommendations(slots: ParkingSlot[]) {
  return useMemo(() => {
    const now = Date.now();
    const occupied = slots.filter(s => s.status === 'OCCUPIED');
    const errors = slots.filter(s => s.status === 'ERROR');
    const free = slots.filter(s => s.status === 'FREE');

    const longParked = occupied
      .filter(s => s.parkedAt && (now - s.parkedAt) > 2 * 60 * 60 * 1000)
      .sort((a, b) => (a.parkedAt ?? 0) - (b.parkedAt ?? 0));

    const needsInspection = slots.filter(s => s.nodeHealth < 60);
    const criticalHealth = slots.filter(s => s.nodeHealth < 30);

    const occupancyPct = Math.round((occupied.length / slots.length) * 100);

    const recommendations = [];
    if (longParked.length > 0) {
      recommendations.push({
        id: 'long-park',
        priority: 'HIGH' as const,
        icon: Clock,
        title: `${longParked.length} Long-Parked Vehicle${longParked.length > 1 ? 's' : ''} Detected`,
        detail: `Slots ${longParked.slice(0, 3).map(s => s.id).join(', ')} have exceeded 2-hour threshold. Initiate inspection protocol.`,
        color: 'rose',
      });
    }
    if (criticalHealth.length > 0) {
      recommendations.push({
        id: 'critical-node',
        priority: 'CRITICAL' as const,
        icon: Zap,
        title: `${criticalHealth.length} Node${criticalHealth.length > 1 ? 's' : ''} in Critical State`,
        detail: `Node${criticalHealth.length > 1 ? 's' : ''} ${criticalHealth.map(s => s.id).join(', ')} below 30% health. Immediate hardware replacement advised.`,
        color: 'amber',
      });
    }
    if (occupancyPct > 80) {
      recommendations.push({
        id: 'capacity',
        priority: 'MEDIUM' as const,
        icon: TrendingUp,
        title: 'Approaching Full Capacity',
        detail: `Facility is ${occupancyPct}% occupied. Consider activating overflow zones or redirecting incoming traffic.`,
        color: 'indigo',
      });
    }
    if (needsInspection.length > 0 && criticalHealth.length === 0) {
      recommendations.push({
        id: 'maintenance',
        priority: 'LOW' as const,
        icon: AlertTriangle,
        title: `${needsInspection.length} Nodes Need Routine Maintenance`,
        detail: `Nodes below 60% health detected. Schedule maintenance during low-occupancy window.`,
        color: 'amber',
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'healthy',
        priority: 'OK' as const,
        icon: CheckCircle,
        title: 'All Systems Nominal',
        detail: 'No anomalies detected. AI monitoring active.',
        color: 'emerald',
      });
    }

    return { longParked, errors, free, occupied, needsInspection, occupancyPct, recommendations };
  }, [slots]);
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function InjectorView({ slots, setSlots, setLogs, backendOnline, apiUrl }: InjectorViewProps) {
  const [, setTick] = useState(0);
  const ai = useAIRecommendations(slots);

  // Re-run AI every 10s to update durations
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const injectFault = async (type: 'SRAM_FLIP' | 'THERMAL' | 'PWR_DROP', title: string) => {
    const healthySlots = slots.filter(s => s.status !== 'ERROR');
    if (healthySlots.length === 0) return;
    const target = healthySlots[Math.floor(Math.random() * healthySlots.length)];

    if (backendOnline) {
      try {
        await fetch(`${apiUrl}/api/slots/${target.id}/fault`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, title }),
        });
      } catch (err) {
        console.error('Fault inject API call failed:', err);
      }
    } else {
      const newSlots = [...slots];
      const idx = slots.findIndex(s => s.id === target.id);
      newSlots[idx] = {
        ...target, status: 'ERROR',
        errorDetails: title,
        nodeHealth: Math.floor(Math.random() * 40),
        clockSpeed: type === 'THERMAL' ? target.clockSpeed / 2 : target.clockSpeed,
      };
      setSlots(newSlots);
      setLogs(prev => [{
        id: crypto.randomUUID?.() || Math.random().toString(),
        timestamp: new Date().toISOString(),
        type: 'Hardware Fault',
        nodeId: target.id,
        hash: hashString('FAULT' + target.id + Date.now()),
      }, ...prev]);
    }
  };

  const resolveFaults = async () => {
    if (backendOnline) {
      try {
        await fetch(`${apiUrl}/api/slots/resolve`, { method: 'PATCH' });
      } catch (err) {
        console.error('Resolve faults API call failed:', err);
      }
    } else {
      setSlots(prev => prev.map(s =>
        s.status === 'ERROR'
          ? { ...s, status: s.licensePlate ? 'OCCUPIED' as const : 'FREE' as const, nodeHealth: 100, errorDetails: undefined }
          : s
      ));
    }
  };

  const errorCount = ai.errors.length;
  const now = Date.now();

  const colorMap: Record<string, string> = {
    rose: 'border-rose-500/30 bg-rose-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    indigo: 'border-indigo-500/30 bg-indigo-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    slate: 'border-white/10 bg-white/5',
  };
  const iconColorMap: Record<string, string> = {
    rose: 'text-rose-400', amber: 'text-amber-400',
    indigo: 'text-indigo-400', emerald: 'text-emerald-400', slate: 'text-slate-400',
  };
  const badgeMap: Record<string, string> = {
    CRITICAL: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    HIGH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    MEDIUM: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    LOW: 'bg-zinc-800 text-zinc-400 border-white/10',
    OK: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 lg:p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Admin Control Center</h2>
              <p className="text-zinc-500 text-sm">AI-Powered Facility Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold flex-wrap">
            <StatChip label="Occupancy" value={`${ai.occupancyPct}%`} color="indigo" />
            <StatChip label="Faults" value={`${errorCount}`} color={errorCount > 0 ? 'amber' : 'emerald'} />
            <StatChip label="Free Slots" value={`${ai.free.length}`} color="emerald" />
          </div>
        </div>

        {/* ── AI Recommendations ─────────────────────────── */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <Brain className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">AI Recommendations</h3>
            <span className="ml-auto text-xs text-zinc-600 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Updates every 10s
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {ai.recommendations.map(rec => {
              const Icon = rec.icon;
              return (
                <motion.div key={rec.id} layout
                  className={`flex items-start gap-4 p-4 rounded-xl border ${colorMap[rec.color]}`}>
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColorMap[rec.color]}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white text-sm">{rec.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeMap[rec.priority]}`}>{rec.priority}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{rec.detail}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Row: Long-Parked + Node Health ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Long-Parked Vehicles */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-5">
              <Clock className="w-5 h-5 text-rose-400" />
              <h3 className="text-lg font-bold text-white">Long-Parked Vehicles</h3>
              <span className="ml-auto text-xs text-zinc-600">Threshold: 2 hrs</span>
            </div>
            {ai.longParked.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-400 opacity-60" />
                <p className="text-zinc-500 text-sm">No vehicles exceeding time limit</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {ai.longParked.map(slot => {
                  const dur = slot.parkedAt ? now - slot.parkedAt : 0;
                  return (
                    <div key={slot.id} className="flex items-center justify-between p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                      <div className="flex items-center gap-3">
                        <Car className="w-4 h-4 text-rose-400" />
                        <div>
                          <span className="font-mono font-bold text-slate-200 text-sm">{slot.licensePlate || 'UNKNOWN'}</span>
                          <span className="text-xs text-zinc-500 ml-2">Slot {slot.id}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-rose-400 font-bold text-sm">{formatDuration(dur)}</div>
                        <div className="text-[10px] text-zinc-600">Parked</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Node Health Overview */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-5">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Node Health Matrix</h3>
              <span className="ml-auto text-xs text-zinc-600">{slots.length} nodes</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {slots.map(slot => {
                const h = slot.nodeHealth;
                const color = h >= 80 ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                  : h >= 60 ? 'bg-amber-400'
                  : h >= 30 ? 'bg-orange-500'
                  : 'bg-rose-500 animate-pulse';
                return (
                  <div key={slot.id} title={`${slot.id}: ${h}%`} className="flex flex-col items-center gap-1">
                    <div className={`w-full h-2 rounded-full ${color}`} />
                    <span className="text-[9px] text-zinc-600 font-mono">{slot.id}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> ≥80%</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 60–79%</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> 30–59%</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> &lt;30%</span>
            </div>
          </div>
        </div>

        {/* ── Occupancy & Slot Summary ─────────────────────── */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Slot Summary</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Available', value: ai.free.length, color: 'emerald', icon: CheckCircle },
              { label: 'Occupied', value: ai.occupied.length, color: 'rose', icon: Car },
              { label: 'Faulted', value: errorCount, color: 'amber', icon: AlertTriangle },
              { label: 'Needs Maintenance', value: ai.needsInspection.length, color: 'indigo', icon: Cpu },
            ].map(item => {
              const Icon = item.icon;
              const itemColorMap: Record<string, string> = {
                emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
                rose: 'border-rose-500/30 bg-rose-500/5 text-rose-400',
                amber: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
                indigo: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400',
              };
              return (
                <div key={item.label} className={`rounded-xl border p-4 flex flex-col gap-2 ${itemColorMap[item.color]}`}>
                  <Icon className="w-5 h-5 opacity-80" />
                  <div className="text-3xl font-extrabold text-white">{item.value}</div>
                  <div className="text-xs font-medium opacity-70">{item.label}</div>
                </div>
              );
            })}
          </div>

          {/* Occupancy Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-zinc-500 mb-2">
              <span>Occupancy Rate</span>
              <span className="font-bold text-white">{ai.occupancyPct}%</span>
            </div>
            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${ai.occupancyPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${ai.occupancyPct > 80 ? 'bg-rose-500' : ai.occupancyPct > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              />
            </div>
          </div>
        </div>

        {/* ── Fault Injector ─────────────────────────────── */}
        <div className="glass-panel p-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Hardware Fault Simulator</h2>
                <p className="text-zinc-500">Intentionally sabotage hardware nodes for DR testing.</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-zinc-500">Active Faults</div>
              <div className={`text-3xl font-bold ${errorCount > 0 ? 'text-amber-500 animate-pulse' : 'text-emerald-400'}`}>
                {errorCount}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <FaultCard title="SRAM Bit-Flip (SEU)" description="Simulates a single event upset in the local node memory."
              icon={<AlertCircle className="w-6 h-6" />} color="amber"
              onClick={() => injectFault('SRAM_FLIP', 'SRAM Bit-Flip detected')} />
            <FaultCard title="Thermal Throttling" description="Forces node temp to edge-limits, cutting clock speeds."
              icon={<Flame className="w-6 h-6" />} color="rose"
              onClick={() => injectFault('THERMAL', 'Thermal Throttling active')} />
            <FaultCard title="Drop Power Rail" description="Disconnects primary 3.3v rail, relying on backup caps."
              icon={<XOctagon className="w-6 h-6" />} color="purple"
              onClick={() => injectFault('PWR_DROP', 'Primary Power loss')} />
          </div>

          <div className="flex justify-end pt-6 border-t border-white/10">
            <button onClick={resolveFaults} disabled={errorCount === 0}
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              System Reboot (Clear Faults)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  const map: Record<string, string> = {
    indigo: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    rose: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
    slate: 'text-zinc-300 bg-white/5 border-white/10',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${map[color] || map.slate}`}>
      <span className="text-zinc-500 font-medium">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function FaultCard({ title, description, icon, color, onClick }: any) {
  const colorMap: Record<string, string> = {
    amber: 'hover:border-amber-500/50 hover:shadow-glow-amber text-amber-500',
    rose: 'hover:border-rose-500/50 hover:shadow-glow-rose text-rose-500',
    purple: 'hover:border-purple-500/50 text-purple-500',
  };
  return (
    <button onClick={onClick}
      className={`glass-panel p-6 flex flex-col items-start gap-4 text-left transition-all duration-300 transform hover:-translate-y-1 ${colorMap[color] || ''}`}>
      <div className="p-3 bg-white/10 rounded-lg">{icon}</div>
      <div>
        <h3 className="font-bold text-slate-200">{title}</h3>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}
