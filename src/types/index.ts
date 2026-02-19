export interface TimeSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  durationMin: number | null;
}

export interface Job {
  id: string;
  clientRef: string;
  clientName: string;
  createdAt: number;
  sessions: TimeSession[];
  totalDurationMin: number;
  notes: string;
  synced: number;
  priority: 1 | 2 | 3 | 4 | 5;
  completed: boolean;
  completedAt: number | null;
}

export interface Photo {
  id: string;
  jobId: string;
  dataUrl: string;
  caption: string;
  createdAt: number;
}

export interface VoiceNote {
  id: string;
  jobId: string;
  audioBlob: string;
  duration: number;
  createdAt: number;
  transcript?: string;
}

export interface Client {
  ref: string;
  name: string;
  lastUsedAt: number;
}

export interface JobWithMedia {
  job: Job;
  photos: Photo[];
  voiceNotes: VoiceNote[];
}

export interface SyncPayload {
  jobs: JobWithMedia[];
  timestamp: number;
}

// Priority colors from Nifty palette
export const PRIORITY_COLORS = {
  1: '#ff5f1f', // Destructive/Errors - red
  2: '#ff9500', // Orange
  3: '#a8d600', // Primary/Nifty Lime
  4: '#007AFF', // Blue
  5: '#8f95a3', // Muted Foreground - default
} as const;

export const PRIORITY_LABELS = {
  1: 'P1 - Critical',
  2: 'P2 - High',
  3: 'P3 - Medium',
  4: 'P4 - Normal',
  5: 'P5 - Low',
} as const;
