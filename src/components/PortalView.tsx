import React, { useState, useRef } from 'react';
import { ParkingSlot, LogEntry } from '../types';
import { Car, CreditCard } from 'lucide-react';

interface PortalViewProps {
  slots: ParkingSlot[];
  setSlots: React.Dispatch<React.SetStateAction<ParkingSlot[]>>;
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  backendOnline: boolean;
  apiUrl: string;
}

export default function PortalView({ slots, setSlots, setLogs, backendOnline, apiUrl }: PortalViewProps) {
  const [activeTab, setActiveTab] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [plate, setPlate] = useState('');
  const [feedback, setFeedback] = useState<{msg: string, type: 'SUCCESS' | 'ERROR'} | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const hashString = (str: string) => Array.from(str).reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0).toString(16).substring(0, 8);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Spotlight
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
    
    // 3D Tilt
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    
    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
  };

  const handleAction = async () => {
    if (!plate) {
      setFeedback({ msg: 'Please enter a license plate.', type: 'ERROR' });
      return;
    }

    const upperPlate = plate.toUpperCase().trim();

    if (backendOnline) {
      // ── Online path: use REST API, Socket.io handles state sync ──
      try {
        const endpoint = activeTab === 'ENTRY' ? '/api/portal/entry' : '/api/portal/exit';
        const res = await fetch(`${apiUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licensePlate: upperPlate }),
        });

        const data = await res.json();

        if (!res.ok) {
          setFeedback({ msg: data.error || 'An error occurred.', type: 'ERROR' });
          return;
        }

        if (activeTab === 'ENTRY') {
          setFeedback({ msg: `✅ Slot ${data.slot.id} assigned to ${upperPlate}.`, type: 'SUCCESS' });
        } else {
          setFeedback({ msg: `✅ ${upperPlate} exited. Fee: $${data.fee?.toFixed(2) ?? '5.00'}. Slot ${data.slot.id} is now free.`, type: 'SUCCESS' });
        }
      } catch {
        setFeedback({ msg: 'Network error. Check backend connection.', type: 'ERROR' });
      }
    } else {
      // ── Offline fallback: update local state directly ──
      if (activeTab === 'ENTRY') {
        const freeSlotIndex = slots.findIndex(s => s.status === 'FREE');
        if (freeSlotIndex === -1) {
          setFeedback({ msg: 'Facility is full.', type: 'ERROR' });
          return;
        }
        const assignedSlot = slots[freeSlotIndex];
        const newSlots = [...slots];
        newSlots[freeSlotIndex] = { ...assignedSlot, status: 'OCCUPIED', licensePlate: upperPlate };
        setSlots(newSlots);
        setLogs(prev => [{
          id: crypto.randomUUID?.() || Math.random().toString(),
          timestamp: new Date().toISOString(),
          type: 'Vehicle Entry',
          nodeId: assignedSlot.id,
          licensePlate: upperPlate,
          hash: hashString(upperPlate + assignedSlot.id + Date.now())
        }, ...prev]);
        setFeedback({ msg: `Slot ${assignedSlot.id} assigned to ${upperPlate}.`, type: 'SUCCESS' });
      } else {
        const slotIndex = slots.findIndex(s => s.licensePlate === upperPlate);
        if (slotIndex === -1) {
          setFeedback({ msg: `Vehicle ${upperPlate} not found in facility.`, type: 'ERROR' });
          return;
        }
        const leavingSlot = slots[slotIndex];
        const newSlots = [...slots];
        newSlots[slotIndex] = { ...leavingSlot, status: 'FREE', licensePlate: undefined };
        setSlots(newSlots);
        setLogs(prev => [{
          id: crypto.randomUUID?.() || Math.random().toString(),
          timestamp: new Date().toISOString(),
          type: 'Vehicle Exit',
          nodeId: leavingSlot.id,
          licensePlate: upperPlate,
          hash: hashString(upperPlate + leavingSlot.id + Date.now())
        }, ...prev]);
        setFeedback({ msg: `Vehicle exited. Mock Fee: $${(Math.random() * 10 + 5).toFixed(2)}. Slot ${leavingSlot.id} is now free.`, type: 'SUCCESS' });
      }
    }

    setPlate('');
  };

  return (
    <div className="w-full min-h-[80vh] flex flex-col md:flex-row relative rounded-2xl overflow-hidden shadow-2xl">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=2560&auto=format&fit=crop')`, filter: 'brightness(0.95)' }}
      >
        {/* Overlay gradient to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/10"></div>
      </div>

      {/* Typography Column */}
      <div className="flex-1 z-10 flex flex-col justify-center p-8 md:p-16">
        <h1 className="text-4xl md:text-7xl font-bold text-white mb-2 tracking-tight">
          ParkGuard
        </h1>
        <h2 className="text-3xl md:text-6xl font-light text-white mb-6 uppercase tracking-widest">
          Secure Parking
        </h2>
        <div className="w-16 h-1 bg-white/50 mb-6 drop-shadow-lg"></div>
        <p className="text-xl md:text-2xl text-slate-100 font-medium max-w-lg drop-shadow-md">
          Where Your Vehicle's Safety Becomes Our Priority
        </p>
        <p className="mt-4 text-slate-300 max-w-lg leading-relaxed drop-shadow-md">
          Experience seamless automated entry and exit with state-of-the-art secure hardware verification.
        </p>
      </div>

      {/* Card Column */}
      <div style={{ perspective: '1000px' }} className="w-full md:w-[450px] z-10 p-4 md:p-8 flex items-center justify-center">
        <div 
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'transform 0.15s ease-out' }}
          className="relative group w-full backdrop-blur-2xl bg-white/10 border border-white/20 rounded-[2rem] p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] overflow-hidden will-change-transform"
        >
          {/* Spotlight Effect */}
          <div 
            className="pointer-events-none absolute -inset-px rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"
            style={{
              background: `radial-gradient(400px circle at var(--mouse-x, 0) var(--mouse-y, 0), rgba(168, 85, 247, 0.4), transparent 40%)`
            }}
          />

          <div className="relative z-10">
            {/* Tabs */}
            <div className="flex bg-black/20 rounded-full p-1 mb-8 shadow-inner">
              <button 
                onClick={() => { setActiveTab('ENTRY'); setPlate(''); }}
                className={`flex-1 py-3 text-sm font-bold rounded-full transition-all duration-300 ${activeTab === 'ENTRY' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-300 hover:text-white'}`}
              >
                Arrival
              </button>
              <button 
                onClick={() => { setActiveTab('EXIT'); setPlate(''); }}
                className={`flex-1 py-3 text-sm font-bold rounded-full transition-all duration-300 ${activeTab === 'EXIT' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-300 hover:text-white'}`}
              >
                Departure
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2 drop-shadow-sm">License Plate Number</label>
                <input 
                  value={plate} 
                  onChange={e => setPlate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-white/50 focus:bg-white/10 transition-all shadow-inner"
                  placeholder="e.g., ABC-1234"
                />
              </div>

              <button 
                onClick={handleAction}
                className={`w-full font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex justify-center items-center gap-2 mt-4
                  ${activeTab === 'ENTRY' 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-indigo-500/30' 
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white shadow-blue-500/30'}`}
              >
                {activeTab === 'ENTRY' ? (
                  <><Car className="w-5 h-5"/> Request Secure Entry</>
                ) : (
                  <><CreditCard className="w-5 h-5"/> Calculate Fee & Exit</>
                )}
              </button>
              
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`absolute top-6 right-6 max-w-sm backdrop-blur-xl border p-4 rounded-xl flex items-center gap-3 shadow-2xl animate-bounce z-50
          ${feedback.type === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-50 border-emerald-500/30' : 'bg-rose-500/20 text-rose-50 border-rose-500/30'}`}
        >
          <div className="flex-1 font-medium text-sm">{feedback.msg}</div>
          <button onClick={() => setFeedback(null)} className="text-white/60 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}
