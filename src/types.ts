export type SlotStatus = 'FREE' | 'OCCUPIED' | 'ERROR';

export interface ParkingSlot {
  id: string; // e.g., 'A1', 'A2'
  status: SlotStatus;
  licensePlate?: string;
  errorDetails?: string; 
  nodeHealth: number; // 0-100%
  clockSpeed: number; // MHz
  parkedAt?: number; // timestamp ms when vehicle entered
}

export interface TelemetryDataPoint {
  time: string;
  powerDraw: number; // mW
  temperature: number; // C
  latency: number; // ms
}

export type EventType = 'Vehicle Entry' | 'Vehicle Exit' | 'Hardware Fault';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: EventType;
  nodeId: string;
  licensePlate?: string;
  hash: string;
}
