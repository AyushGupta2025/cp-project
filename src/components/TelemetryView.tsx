import React from 'react';
import { ParkingSlot, TelemetryDataPoint } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Cpu, Zap, Thermometer, Clock } from 'lucide-react';

interface TelemetryViewProps {
  slots: ParkingSlot[];
  data: TelemetryDataPoint[];
}

export default function TelemetryView({ slots, data }: TelemetryViewProps) {
  // Generate some static mock data if none is passed
  const mockData = data.length > 0 ? data : Array.from({ length: 15 }).map((_, i) => ({
    time: `10:${i.toString().padStart(2, '0')}`,
    powerDraw: 450 + Math.random() * 50,
    temperature: 42 + Math.random() * 5,
    latency: 12 + Math.random() * 8
  }));

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-6">
      {/* Charts Section */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
        <ChartCard 
          title="Network Power Draw (mW)" 
          data={mockData} 
          dataKey="powerDraw" 
          stroke="#f59e0b"
          icon={<Zap className="w-5 h-5 text-amber-500" />}
        />
        <ChartCard 
          title="Average Node Temperature (°C)" 
          data={mockData} 
          dataKey="temperature" 
          stroke="#ef4444" 
          icon={<Thermometer className="w-5 h-5 text-red-500" />}
        />
        <ChartCard 
          title="Processing Latency (ms)" 
          data={mockData} 
          dataKey="latency" 
          stroke="#3b82f6" 
          icon={<Clock className="w-5 h-5 text-blue-500" />}
        />
      </div>

      {/* Active Nodes List */}
      <div className="w-full lg:w-80 glass-panel p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
          <Cpu className="text-emerald-400" />
          <h3 className="font-semibold text-lg">Active Hardware Nodes</h3>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
          {slots.map(slot => (
            <div key={slot.id} className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-300">{slot.id} Edge AI</div>
                <div className="text-xs text-slate-500">{slot.clockSpeed} MHz</div>
              </div>
              <div className="flex flex-col items-end">
                <div className={`text-sm ${slot.status === 'ERROR' ? 'text-amber-500' : 'text-emerald-400'}`}>
                  {slot.status === 'ERROR' ? 'FAULT' : 'ONLINE'}
                </div>
                <div className="text-xs text-slate-500">Health: {slot.nodeHealth}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, data, dataKey, stroke, icon }: any) {
  return (
    <div className="glass-panel p-4 h-64 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-medium text-slate-200">{title}</h3>
      </div>
      <div className="flex-1 w-full relative -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="time" stroke="#475569" fontSize={12} tickMargin={10} />
            <YAxis stroke="#475569" fontSize={12} tickMargin={10} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.5rem' }}
              itemStyle={{ color: stroke }}
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={stroke} 
              strokeWidth={2} 
              dot={{ fill: stroke, strokeWidth: 2, r: 3 }} 
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
