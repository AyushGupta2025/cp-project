import React from 'react';
import { LogEntry } from '../types';
import { Database, Lock, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';

interface LedgerViewProps {
  logs: LogEntry[];
}

export default function LedgerView({ logs }: LedgerViewProps) {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20">
          <Database className="w-5 h-5" />
        </div>
        <h2 className="text-xl font-bold text-slate-200">Immutable Event Ledger</h2>
      </div>

      <div className="flex-1 glass-panel overflow-hidden flex flex-col">
        <div className="bg-white/5 px-6 py-4 border-b border-white/10 grid grid-cols-12 gap-4 font-semibold text-sm text-slate-400 uppercase tracking-wider">
          <div className="col-span-3">Timestamp</div>
          <div className="col-span-3">Event Type</div>
          <div className="col-span-2">Node ID</div>
          <div className="col-span-2">License Plate</div>
          <div className="col-span-2">Security Hash</div>
        </div>
        
        <div className="flex-1 overflow-auto p-2">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 font-medium">
              No events recorded yet.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {logs.map(log => (
                <div key={log.id} className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-white/10 rounded-lg transition-colors items-center text-sm border border-transparent hover:border-white/10">
                  <div className="col-span-3 text-slate-300 font-mono text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    {log.type === 'Vehicle Entry' && <ArrowRight className="w-4 h-4 text-blue-400" />}
                    {log.type === 'Vehicle Exit' && <ArrowLeft className="w-4 h-4 text-emerald-400" />}
                    {log.type === 'Hardware Fault' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    <span className={
                      log.type === 'Hardware Fault' ? 'text-amber-500 font-medium' : 
                      log.type === 'Vehicle Entry' ? 'text-blue-400' : 'text-emerald-400'
                    }>{log.type}</span>
                  </div>
                  <div className="col-span-2 font-mono text-slate-300">
                    {log.nodeId}
                  </div>
                  <div className="col-span-2 font-medium text-slate-200 border border-white/10 bg-white/5 px-2 py-0.5 rounded w-fit">
                    {log.licensePlate || '-'}
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded w-fit border border-indigo-500/20">
                    <Lock className="w-3 h-3" />
                    {log.hash}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
