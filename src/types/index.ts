export interface Job {
  id: string;
  clientRef: string;
  clientName: string;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  durationMin: number | null;
  notes: string;
  synced: number;
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