import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MapPin, LogOut, Wifi, WifiOff } from 'lucide-react';
import { io as socketIO, Socket } from 'socket.io-client';
import { ParkingSlot, TelemetryDataPoint, LogEntry } from './types';
import MapView from './components/MapView';
import TelemetryView from './components/TelemetryView';
import PortalView from './components/PortalView';
import InjectorView from './components/InjectorView';
import LedgerView from './components/LedgerView';
import LoginPage from './components/LoginPage';

type ViewMode = 'MAP' | 'TELEMETRY' | 'PORTAL' | 'INJECTOR' | 'LEDGER';
type Role = 'admin' | 'driver' | null;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Local slot initializer (fallback when backend is offline) ─────────────────
function createLocalSlots(): ParkingSlot[] {
  return Array.from({ length: 24 }).map((_, i) => {
    const row = String.fromCharCode(65 + Math.floor(i / 6));
    const num = (i % 6) + 1;
    return {
      id: `${row}${num}`,
      status: 'FREE',
      nodeHealth: 100,
      clockSpeed: 1200 + Math.floor(Math.random() * 200),
    };
  });
}

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('MAP');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null); // null = checking

  // Global State
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [telemetry] = useState<TelemetryDataPoint[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const socketRef = useRef<Socket | null>(null);

  // ── Backend connectivity + initial data fetch ─────────────────────────────
  useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      try {
        const [slotsRes, logsRes] = await Promise.all([
          fetch(`${API_URL}/api/slots`),
          fetch(`${API_URL}/api/logs`),
        ]);

        if (!slotsRes.ok || !logsRes.ok) throw new Error('Non-200 response');

        const slotsData: ParkingSlot[] = await slotsRes.json();
        const logsData: LogEntry[] = await logsRes.json();

        if (!mounted) return;

        setSlots(slotsData.map(s => ({ ...s, parkedAt: undefined })));
        setLogs(logsData.map(l => ({
          id: l.id,
          timestamp: typeof l.timestamp === 'string' ? l.timestamp : new Date(l.timestamp as unknown as string).toISOString(),
          type: l.type as LogEntry['type'],
          nodeId: l.nodeId,
          licensePlate: l.licensePlate,
          hash: l.hash,
        })));
        setBackendOnline(true);
      } catch {
        if (!mounted) return;
        console.warn('Backend offline — using local state');
        setSlots(createLocalSlots());
        setBackendOnline(false);
      }
    };

    fetchInitialData();
    return () => { mounted = false; };
  }, []);

  // ── Socket.io — real-time event listener ──────────────────────────────────
  useEffect(() => {
    if (backendOnline === false) return;
    if (backendOnline === null) return;

    const socket = socketIO(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ Socket.io connected:', socket.id);
    });

    socket.on('slot:updated', ({ slot }: { slot: ParkingSlot }) => {
      setSlots(prev =>
        prev.map(s => s.id === slot.id ? { ...s, ...slot } : s)
      );
    });

    socket.on('log:created', ({ log }: { log: LogEntry }) => {
      setLogs(prev => [log, ...prev]);
    });

    socket.on('disconnect', () => {
      console.warn('Socket.io disconnected');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [backendOnline]);

  // ── Spotlight Effect ──────────────────────────────────────────────────────
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const el = spotlightRef.current;
      if (!el) return;
      const target = e.target as HTMLElement;
      const overCard = !!(
        target.closest('.glass-panel') ||
        target.closest('[data-card]')
      );
      el.style.opacity = overCard ? '0' : '1';
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    };
    const handleMouseLeave = () => {
      if (spotlightRef.current) spotlightRef.current.style.opacity = '0';
    };
    window.addEventListener('mousemove', handleMouseMove);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleLogin = (selectedRole: 'admin' | 'driver') => {
    setRole(selectedRole);
    setCurrentView(selectedRole === 'driver' ? 'PORTAL' : 'MAP');
  };

  const handleLogout = () => {
    setRole(null);
    setCurrentView('MAP');
  };

  if (role === null) {
    return (
      <div className="relative">
        <SpotlightRef ref={spotlightRef} />
        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }

  const isAdmin = role === 'admin';

  return (
    <div className="flex flex-col h-screen w-full bg-black overflow-hidden text-slate-200">
      <SpotlightRef ref={spotlightRef} />

      {/* Top Sticky Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur-xl border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center font-extrabold text-black shadow-inner">
            P
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight tracking-wide">ParkGuard</h1>
            <p className="text-slate-400 text-[10px] font-bold tracking-wider">
              {isAdmin ? 'ADMINISTRATOR' : 'DRIVER PORTAL'}
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          {isAdmin && <LocationDropdown />}

          {/* Backend status indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
            backendOnline === null ? 'border-zinc-700 text-zinc-600' :
            backendOnline ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' :
            'border-amber-500/30 text-amber-400 bg-amber-500/10'
          }`}>
            {backendOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{backendOnline === null ? 'Connecting...' : backendOnline ? 'Live' : 'Offline'}</span>
          </div>

          <nav className="flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/5 shadow-inner">
            {isAdmin && (
              <>
                <NavPill active={currentView === 'INJECTOR'} label="Admin" onClick={() => setCurrentView('INJECTOR')} />
                <NavPill active={currentView === 'LEDGER'} label="Auditor" onClick={() => setCurrentView('LEDGER')} />
                <NavPill active={currentView === 'TELEMETRY'} label="Sensor" onClick={() => setCurrentView('TELEMETRY')} />
                <NavPill active={currentView === 'MAP'} label="Map" onClick={() => setCurrentView('MAP')} />
              </>
            )}
            <NavPill active={currentView === 'PORTAL'} label="Driver" onClick={() => setCurrentView('PORTAL')} />
          </nav>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 h-full overflow-y-auto relative z-0">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          <div className="flex-1 min-h-0 relative">
            {currentView === 'MAP' && isAdmin && <MapView slots={slots} />}
            {currentView === 'TELEMETRY' && isAdmin && <TelemetryView slots={slots} data={telemetry} />}
            {currentView === 'PORTAL' && (
              <PortalView
                slots={slots}
                setSlots={setSlots}
                setLogs={setLogs}
                backendOnline={!!backendOnline}
                apiUrl={API_URL}
              />
            )}
            {currentView === 'INJECTOR' && isAdmin && (
              <InjectorView
                slots={slots}
                setSlots={setSlots}
                setLogs={setLogs}
                backendOnline={!!backendOnline}
                apiUrl={API_URL}
              />
            )}
            {currentView === 'LEDGER' && isAdmin && <LedgerView logs={logs} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavPill({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200
        ${active
          ? 'bg-white text-black'
          : 'text-zinc-500 hover:text-white hover:bg-white/10'}`}
    >
      {label}
    </button>
  );
}

const LOCATIONS = ['Site 1 - Alpha', 'Site 2 - Beta', 'Site 3 - Gamma'];

function LocationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(LOCATIONS[0]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-full px-4 py-1.5 border border-white/10 shadow-inner"
      >
        <MapPin className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400 text-xs font-semibold tracking-wide">LOCATION:</span>
        <span className="text-slate-200 text-sm font-medium">{selected}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 w-full min-w-[180px] right-0 z-50 glass-panel border border-white/10 overflow-hidden"
          >
            <div className="flex flex-col py-1">
              {LOCATIONS.map(loc => (
                <button
                  key={loc}
                  onClick={() => { setSelected(loc); setIsOpen(false); }}
                  className={`px-4 py-2 text-left text-sm transition-colors
                    ${selected === loc ? 'bg-indigo-500/20 text-indigo-300 font-semibold' : 'text-slate-300 hover:bg-white/5 hover:text-white'}
                  `}
                >
                  {loc}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Global Cursor Spotlight ──────────────────────────────────────────────────
const SpotlightRef = React.forwardRef<HTMLDivElement>((_, ref) => (
  <div
    ref={ref}
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: 600,
      height: 600,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.04) 40%, transparent 70%)',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 9999,
      opacity: 0,
      transition: 'opacity 0.3s ease',
    }}
  />
));
SpotlightRef.displayName = 'SpotlightRef';
