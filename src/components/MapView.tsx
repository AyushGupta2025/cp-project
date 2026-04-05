import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ParkingSlot } from '../types';
import {
  Map, Edit3, RotateCcw, Navigation, Target,
  Car, AlertTriangle, CheckCircle, Info, Zap, Cpu
} from 'lucide-react';

interface MapViewProps {
  slots: ParkingSlot[];
}

// ─── Grid Types ──────────────────────────────────────────────────────────────
type CellType = 'ROAD' | 'WALL' | 'SLOT' | 'ENTRY';
type EditTool = CellType;

interface GridCell {
  type: CellType;
  slotId?: string;
}
type Grid = GridCell[][];

// ─── Default Layout ──────────────────────────────────────────────────────────
// 9 rows × 13 cols → slots at rows 1,3,5,7 at cols 1,3,5,7,9,11
const ROWS = 9;
const COLS = 13;
const ROW_LABELS = ['A', 'B', 'C', 'D'];
const SLOT_ROWS = [1, 3, 5, 7];
const SLOT_COLS = [1, 3, 5, 7, 9, 11];
const DEFAULT_ENTRY: [number, number] = [0, 0];

function createDefaultGrid(): Grid {
  const grid: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ type: 'ROAD' as CellType }))
  );
  SLOT_ROWS.forEach((r, rowIdx) => {
    for (let c = 0; c < COLS; c++) {
      const slotColIdx = SLOT_COLS.indexOf(c);
      if (slotColIdx !== -1) {
        grid[r][c] = { type: 'SLOT', slotId: `${ROW_LABELS[rowIdx]}${slotColIdx + 1}` };
      } else if (c > 0 && c < COLS - 1) {
        grid[r][c] = { type: 'WALL' };
      }
    }
  });
  grid[DEFAULT_ENTRY[0]][DEFAULT_ENTRY[1]] = { type: 'ENTRY' };
  return grid;
}

// ─── BFS Algorithm ───────────────────────────────────────────────────────────
interface PathResult {
  path: [number, number][];
  targetSlot: string;
  distance: number;
}

function bfsFindNearest(
  grid: Grid,
  entryRow: number,
  entryCol: number,
  slotStatuses: Record<string, string>
): PathResult | null {
  const rows = grid.length;
  const cols = grid[0].length;
  const visited: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
  const parent: Record<string, string | null> = {};
  const queue: [number, number][] = [[entryRow, entryCol]];
  visited[entryRow][entryCol] = true;
  parent[`${entryRow},${entryCol}`] = null;

  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const cell = grid[r][c];

    if (cell.type === 'SLOT' && cell.slotId) {
      const status = slotStatuses[cell.slotId] ?? 'FREE';
      if (status === 'FREE') {
        const path: [number, number][] = [];
        let cur: string | null = `${r},${c}`;
        while (cur !== null) {
          const [pr, pc] = cur.split(',').map(Number);
          path.unshift([pr, pc]);
          const next: string | null | undefined = parent[cur];
          cur = next !== undefined ? next : null;
        }
        return { path, targetSlot: cell.slotId, distance: path.length - 1 };
      }
    }

    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (visited[nr][nc]) continue;
      const ncell = grid[nr][nc];
      if (ncell.type === 'WALL') continue;
      visited[nr][nc] = true;
      parent[`${nr},${nc}`] = `${r},${c}`;
      queue.push([nr, nc]);
    }
  }
  return null;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MapView({ slots }: MapViewProps) {
  const [grid, setGrid] = useState<Grid>(createDefaultGrid);
  const [editMode, setEditMode] = useState(false);
  const [activeTool, setActiveTool] = useState<EditTool>('ROAD');
  const [entryPos, setEntryPos] = useState<[number, number]>(DEFAULT_ENTRY);
  const [pathResult, setPathResult] = useState<PathResult | null | undefined>(undefined);
  const [animatedPath, setAnimatedPath] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const runBFS = useCallback(() => {
    if (!grid || grid.length === 0 || !grid[0]) return;
    const currentSlotStatuses: Record<string, string> = {};
    slotsRef.current.forEach(s => { currentSlotStatuses[s.id] = s.status; });
    const result = bfsFindNearest(grid, entryPos[0], entryPos[1], currentSlotStatuses);
    setPathResult(result);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAnimatedPath(new Set());
    if (result) {
      result.path.forEach(([r, c], i) => {
        const t = setTimeout(() => {
          setAnimatedPath(prev => new Set([...prev, `${r},${c}`]));
        }, i * 55);
        timers.current.push(t);
      });
    }
  }, [grid, entryPos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run BFS whenever slots change while not in edit mode
  useEffect(() => {
    if (!editMode) runBFS();
  }, [editMode, slots]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellClick = (r: number, c: number) => {
    if (!editMode) return;
    setGrid(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })));
      if (activeTool === 'ENTRY') {
        // Clear old entry
        for (let row = 0; row < next.length; row++)
          for (let col = 0; col < next[0].length; col++)
            if (next[row][col].type === 'ENTRY') next[row][col] = { type: 'ROAD' };
        setEntryPos([r, c]);
        next[r][c] = { type: 'ENTRY' };
      } else if (activeTool === 'SLOT') {
        next[r][c] = { type: 'SLOT', slotId: `X${r}${c}` };
      } else {
        next[r][c] = { type: activeTool };
      }
      return next;
    });
  };

  const resetGrid = () => {
    setGrid(createDefaultGrid());
    setEntryPos(DEFAULT_ENTRY);
    setPathResult(undefined);
    setAnimatedPath(new Set());
  };

  const tools: { id: EditTool; label: string; color: string }[] = [
    { id: 'ROAD', label: 'Road', color: 'bg-white/10 border border-white/20' },
    { id: 'WALL', label: 'Wall', color: 'bg-zinc-700' },
    { id: 'SLOT', label: 'Slot', color: 'bg-emerald-500/40 border border-emerald-500/50' },
    { id: 'ENTRY', label: 'Entry', color: 'bg-indigo-500' },
  ];

  const renderCell = (cell: GridCell, r: number, c: number) => {
    const key = `${r},${c}`;
    const inPath = animatedPath.has(key);
    const lastCell = pathResult ? pathResult.path[pathResult.path.length - 1] : undefined;
    const isTarget = !!(lastCell && lastCell[0] === r && lastCell[1] === c);
    
    // Find the slot to get its full details for error descriptions
    const slot = cell.type === 'SLOT' && cell.slotId ? slotsRef.current.find(s => s.id === cell.slotId) : undefined;
    const slotStatus = slot ? slot.status : undefined;

    let cls = '';
    let content: React.ReactNode = null;
    let faultInfo: { title: string, whatItTellsYou: string, whatItSimulates: string } | null = null;

    if (cell.type === 'WALL') {
      cls = 'bg-zinc-800/80';
    } else if (cell.type === 'ENTRY') {
      cls = 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.7)]';
      content = <Navigation className="w-2.5 h-2.5 text-white" />;
    } else if (cell.type === 'SLOT') {
      if (isTarget) {
        cls = 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.9)] animate-pulse';
        content = <span className="text-[7px] font-extrabold text-white leading-none">{cell.slotId}</span>;
      } else if (slotStatus === 'FREE') {
        cls = 'bg-emerald-500/15 border border-emerald-500/40 shadow-glow-emerald';
        content = <span className="text-[7px] font-bold text-emerald-400 leading-none">{cell.slotId}</span>;
      } else if (slotStatus === 'OCCUPIED') {
        cls = 'bg-rose-500/15 border border-rose-500/40';
        content = <Car className="w-2.5 h-2.5 text-rose-400" />;
      } else if (slotStatus === 'ERROR') {
        cls = 'bg-amber-500/15 border border-amber-500/40 cursor-help';
        content = <AlertTriangle className="w-2 h-2 text-amber-400" />;
        
        // Map errorDetails to the rich descriptions
        if (slot?.errorDetails === 'SRAM Bit-Flip detected') {
            faultInfo = {
                title: "SRAM Bit-Flip (SEU)",
                whatItTellsYou: "SEU stands for \"Single Event Upset.\" In real silicon chips, background radiation or electrical noise can occasionally flip a bit of memory from a 0 to a 1 (or vice versa).",
                whatItSimulates: "Clicking this would likely send corrupted data from a parking node to your server (e.g., a node might suddenly report it is \"Occupied\" when it is actually \"Free\" due to memory corruption). Your software should ideally catch this anomaly."
            };
        } else if (slot?.errorDetails === 'Thermal Throttling active') {
            faultInfo = {
                title: "Thermal Throttling",
                whatItTellsYou: "Chips get hot. When they get too hot, they automatically slow down their clock speeds to prevent melting.",
                whatItSimulates: "Clicking this forces the simulated chip to overheat. You would expect to see the \"processing latency\" metrics spike on your dashboard, and license plate recognition might take 5 seconds instead of 1 second."
            };
        } else if (slot?.errorDetails === 'Primary Power loss') {
            faultInfo = {
                title: "Drop Power Rail",
                whatItTellsYou: "Simulates a sudden power failure to the primary 3.3v power line feeding the chip.",
                whatItSimulates: "It forces the node to rely on \"backup caps\" (capacitors). The node will likely send a frantic \"Low Power Warning\" to your dashboard before going completely offline and greyed out on your live map."
            };
        }
      }
    } else {
      // ROAD
      cls = inPath
        ? 'bg-indigo-400/30 border border-indigo-400/50'
        : 'bg-white/[0.03] hover:bg-white/10';
    }

    return (
      <div key={key} className="relative group w-full aspect-square hover:z-50">
        <motion.div
          initial={false}
          animate={inPath && !isTarget && cell.type === 'ROAD' ? { scale: [1, 1.15, 1] } : {}}
          transition={{ duration: 0.2 }}
          onClick={() => handleCellClick(r, c)}
          className={`w-full h-full flex items-center justify-center rounded-[2px] transition-all duration-150 ${cls} ${editMode ? 'cursor-pointer' : ''}`}
          title={!faultInfo ? (cell.slotId ?? cell.type) : undefined}
        >
          {content}
        </motion.div>

        {/* Dynamic Rich Tooltip for Faults */}
        {faultInfo && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-4 bg-black/95 backdrop-blur-xl border border-amber-500/40 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
             <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black/95 border-b border-r border-amber-500/40 rotate-45" />
             <h4 className="text-white font-extrabold text-sm mb-2 flex items-center gap-1.5 border-b border-white/10 pb-2">
               <AlertTriangle className="w-4 h-4 text-amber-500" /> {faultInfo.title}
             </h4>
             <div className="space-y-3 mt-3 text-left">
               <div>
                  <div className="text-[10px] uppercase tracking-wider text-amber-500 font-bold mb-1">What it tells you:</div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium">{faultInfo.whatItTellsYou}</p>
               </div>
               <div>
                  <div className="text-[10px] uppercase tracking-wider text-amber-500 font-bold mb-1">What it simulates:</div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium">{faultInfo.whatItSimulates}</p>
               </div>
             </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-4 overflow-hidden">

      {/* ── Grid Panel ───────────────────────────────────────────── */}
      <div data-card className="flex-1 glass-panel p-5 flex flex-col min-h-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Smart Parking Navigator</h2>
          </div>
          <div className="flex gap-2">
            {editMode && (
              <button onClick={resetGrid}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 border border-white/10 hover:bg-white/10 transition-colors">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
            <button onClick={() => setEditMode(e => !e)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${editMode ? 'bg-indigo-500 text-white' : 'border border-white/10 text-zinc-400 hover:bg-white/10'}`}>
              <Edit3 className="w-3 h-3" /> {editMode ? 'Done Editing' : 'Edit Layout'}
            </button>
            {!editMode && (
              <button onClick={runBFS}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors">
                <Target className="w-3 h-3" /> Find Nearest
              </button>
            )}
          </div>
        </div>

        {/* Edit Tools */}
        {editMode && (
          <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
            <span className="text-xs text-zinc-500 font-medium">Draw:</span>
            {tools.map(t => (
              <button key={t.id} onClick={() => setActiveTool(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all
                  ${activeTool === t.id ? 'border-indigo-400 text-white' : 'border-white/10 text-zinc-400 hover:text-white'}`}>
                <span className={`w-3 h-3 rounded-sm shrink-0 ${t.color}`} />
                {t.label}
              </button>
            ))}
            <span className="text-xs text-zinc-600 ml-auto">Click cells on the grid →</span>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-auto flex items-center justify-center min-h-0 py-2">
          <div
            className="grid gap-[2px] w-full"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, maxWidth: 660 }}
          >
            {grid.map((row, r) => row.map((cell, c) => renderCell(cell, r, c)))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-2 shrink-0 text-[10px] text-zinc-600 flex-wrap">
          {[
            { color: 'bg-emerald-500/30 border border-emerald-500/40', label: 'Free' },
            { color: 'bg-rose-500/15 border border-rose-500/40', label: 'Occupied' },
            { color: 'bg-amber-500/15 border border-amber-500/40', label: 'Fault' },
            { color: 'bg-indigo-400/30 border border-indigo-400/50', label: 'BFS Path' },
            { color: 'bg-indigo-500', label: 'Entry/Target' },
            { color: 'bg-zinc-700', label: 'Wall' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm inline-block ${l.color}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Info Panel ───────────────────────────────────────────── */}
      <div className="lg:w-64 shrink-0 flex flex-col gap-3">

        {/* BFS Result */}
        <div data-card className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-white text-sm">BFS Result</h3>
          </div>
          {pathResult === undefined && (
            <p className="text-xs text-zinc-500">Click <span className="text-emerald-400 font-semibold">Find Nearest</span> to compute the shortest path.</p>
          )}
          {pathResult === null && (
            <div className="flex flex-col items-center py-4 gap-2 text-center">
              <Target className="w-8 h-8 text-zinc-600" />
              <p className="text-zinc-500 text-sm font-semibold">No free slots reachable</p>
              <p className="text-zinc-600 text-xs">All slots are occupied or blocked.</p>
            </div>
          )}
          {pathResult && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div>
                  <div className="text-[10px] text-zinc-500 mb-0.5 uppercase tracking-wider">Nearest Free Slot</div>
                  <div className="text-3xl font-extrabold text-emerald-400">{pathResult.targetSlot}</div>
                </div>
                <CheckCircle className="w-7 h-7 text-emerald-400 opacity-60" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Distance</div>
                  <div className="text-2xl font-extrabold text-indigo-300">{pathResult.distance}</div>
                  <div className="text-[9px] text-zinc-600">cells</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Steps</div>
                  <div className="text-2xl font-extrabold text-white">{pathResult.path.length}</div>
                  <div className="text-[9px] text-zinc-600">nodes</div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Algorithm</div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                  <span className="text-[11px] text-zinc-300 font-mono">Breadth-First Search</span>
                </div>
                <p className="text-[9px] text-zinc-600 mt-1 leading-relaxed">
                  Explores all cells level-by-level from the entry point. Guarantees the shortest unweighted path.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Slot Stats */}
        <div data-card className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-zinc-400" />
            <h3 className="font-bold text-white text-sm">Slot Summary</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Free', icon: Cpu, color: 'text-emerald-400', status: 'FREE' },
              { label: 'Occupied', icon: Car, color: 'text-rose-400', status: 'OCCUPIED' },
              { label: 'Fault', icon: AlertTriangle, color: 'text-amber-400', status: 'ERROR' },
            ].map(({ label, icon: Icon, color, status }) => {
              const count = slots.filter(s => s.status === status).length;
              return (
                <div key={status} className="flex items-center justify-between">
                  <span className={`flex items-center gap-2 text-xs font-medium ${color}`}>
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </span>
                  <span className="text-white font-bold text-sm">{count}</span>
                </div>
              );
            })}
            <div className="border-t border-white/10 pt-2 mt-1 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Total Slots</span>
              <span className="text-white font-bold">{slots.length}</span>
            </div>
            {/* Mini occupancy bar */}
            <div className="mt-1">
              <div className="flex justify-between text-[9px] text-zinc-600 mb-1">
                <span>Occupancy</span>
                <span>{Math.round((slots.filter(s => s.status === 'OCCUPIED').length / Math.max(slots.length, 1)) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((slots.filter(s => s.status === 'OCCUPIED').length / Math.max(slots.length, 1)) * 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full bg-rose-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Edit hint */}
        {editMode && (
          <div data-card className="glass-panel p-4">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Select a <span className="text-white">tool</span> and click any grid cell to draw.
              Set <span className="text-indigo-400">Entry</span> where vehicles enter, add/remove
              <span className="text-zinc-300"> Walls</span> for obstacles, and define
              <span className="text-emerald-400"> Slot</span> positions. BFS runs automatically when done.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
