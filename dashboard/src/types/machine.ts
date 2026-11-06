export type MachineStatus = 'printing' | 'idle' | 'needs_attention';
export type AnalysisStatus = 'normal' | 'warning' | 'failure' | 'unclear';
export type MachineType = '3d_printer' | 'laser_cutter' | 'cnc';
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedColor {
  name: string;
  hex: string;
  confidence: number;
  coverage: number;
}

export interface MachineAnalysisPayload {
  camera_id: string;
  machine_name?: string;
  machine_type?: MachineType;
  timestamp: string;
  machine_status: MachineStatus;
  machine_status_reason: string;
  status: AnalysisStatus;
  status_confidence: number;
  failure_type: string;
  failure_box: BoundingBox;
  confidence: number;
  severity: number;
  reason: string;
  evidence: string;
  probable_cause: string;
  next_step: string;
  snapshot?: string;
  detected_colors: DetectedColor[];
  confirmation_streak: number;
  confirmation_target: number;
  confirmed_failure: boolean;
  newly_confirmed: boolean;
  newly_recovered: boolean;
}

export interface MachineState {
  id: string;
  name: string;
  type: MachineType;
  status: MachineStatus;
  statusReason: string;
  analysisStatus: AnalysisStatus;
  failureType: string;
  severity: number;
  confidence: number;
  confirmationStreak: number;
  confirmationTarget: number;
  confirmedFailure: boolean;
  acknowledged: boolean;
  snapshot?: string;
  failureBox: BoundingBox;
  detectedColors: DetectedColor[];
  lastSeen: Date;
  reason: string;
  evidence: string;
  nextStep: string;
}

export interface FleetSummary {
  total: number;
  printing: number;
  idle: number;
  needsAttention: number;
  confirmed: number;
}
