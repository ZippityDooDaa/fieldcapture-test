import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Job, Photo, VoiceNote, Client, TimeSession } from '@/types';

interface FieldCaptureDB extends DBSchema {
  jobs: {
    key: string;
    value: Job;
    indexes: { 'by-client': string; 'by-synced': number; 'by-completed': number };
  };
  photos: {
    key: string;
    value: Photo;
    indexes: { 'by-job': string };
  };
  voiceNotes: {
    key: string;
    value: VoiceNote;
    indexes: { 'by-job': string };
  };
  clients: {
    key: string;
    value: Client;
  };
  syncQueue: {
    key: string;
    value: { id: string; type: 'job'; timestamp: number };
  };
}

const DB_NAME = 'fieldcapture-db';
const DB_VERSION = 2;

let db: IDBPDatabase<FieldCaptureDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<FieldCaptureDB>> {
  if (db) return db;

  db = await openDB<FieldCaptureDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Jobs store
      if (!db.objectStoreNames.contains('jobs')) {
        const jobStore = db.createObjectStore('jobs', { keyPath: 'id' });
        jobStore.createIndex('by-client', 'clientRef');
        jobStore.createIndex('by-synced', 'synced');
        jobStore.createIndex('by-completed', 'completed');
      } else {
        // Migration: add new indexes if upgrading
        const jobStore = transaction.objectStore('jobs');
        if (!jobStore.indexNames.contains('by-completed')) {
          jobStore.createIndex('by-completed', 'completed');
        }
      }

      // Photos store
      if (!db.objectStoreNames.contains('photos')) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
        photoStore.createIndex('by-job', 'jobId');
      }

      // Voice notes store
      if (!db.objectStoreNames.contains('voiceNotes')) {
        const voiceStore = db.createObjectStore('voiceNotes', { keyPath: 'id' });
        voiceStore.createIndex('by-job', 'jobId');
      }

      // Clients store
      if (!db.objectStoreNames.contains('clients')) {
        db.createObjectStore('clients', { keyPath: 'ref' });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
    },
  });

  return db;
}

// Migration helper: Convert old job format to new format
export function migrateJob(oldJob: any): Job {
  if (oldJob.sessions) {
    // Already migrated
    return oldJob as Job;
  }

  // Convert old format to new format
  const sessions: TimeSession[] = [];
  if (oldJob.startedAt) {
    sessions.push({
      id: crypto.randomUUID(),
      startedAt: oldJob.startedAt,
      endedAt: oldJob.endedAt,
      durationMin: oldJob.durationMin,
    });
  }

  return {
    id: oldJob.id,
    clientRef: oldJob.clientRef,
    clientName: oldJob.clientName,
    createdAt: oldJob.createdAt,
    sessions,
    totalDurationMin: oldJob.durationMin || 0,
    notes: oldJob.notes || '',
    synced: oldJob.synced || 0,
    priority: oldJob.priority || 5,
    completed: oldJob.completed || false,
    completedAt: oldJob.completedAt || null,
  };
}

// Job operations
export async function createJob(job: Job): Promise<void> {
  const db = await initDB();
  await db.put('jobs', job);
  await addToSyncQueue(job.id);
}

export async function updateJob(job: Job): Promise<void> {
  const db = await initDB();
  await db.put('jobs', job);
  await addToSyncQueue(job.id);
}

export async function getJob(id: string): Promise<Job | undefined> {
  const db = await initDB();
  const job = await db.get('jobs', id);
  return job ? migrateJob(job) : undefined;
}

export async function getAllJobs(): Promise<Job[]> {
  const db = await initDB();
  const jobs = await db.getAll('jobs');
  return jobs.map(migrateJob);
}

export async function getUnsyncedJobs(): Promise<Job[]> {
  const db = await initDB();
  const jobs = await db.getAllFromIndex('jobs', 'by-synced', 0);
  return jobs.map(migrateJob);
}

export async function markJobSynced(id: string): Promise<void> {
  const db = await initDB();
  const job = await db.get('jobs', id);
  if (job) {
    const migrated = migrateJob(job);
    migrated.synced = 1;
    await db.put('jobs', migrated);
  }
}

export async function deleteJob(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('jobs', id);
  // Also delete associated photos and voice notes
  const photos = await getPhotosByJob(id);
  const voiceNotes = await getVoiceNotesByJob(id);
  await Promise.all(photos.map(p => deletePhoto(p.id)));
  await Promise.all(voiceNotes.map(v => deleteVoiceNote(v.id)));
}

// Session operations
export function createSession(): TimeSession {
  return {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    endedAt: null,
    durationMin: null,
  };
}

export function endSession(session: TimeSession): TimeSession {
  const endedAt = Date.now();
  const durationMin = Math.floor((endedAt - session.startedAt) / 1000 / 60);
  return {
    ...session,
    endedAt,
    durationMin: durationMin > 0 ? durationMin : 1,
  };
}

export function calculateTotalDuration(sessions: TimeSession[]): number {
  return sessions.reduce((total, session) => {
    return total + (session.durationMin || 0);
  }, 0);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatDurationLong(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
  if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  return `${hours}h ${mins}m`;
}

// Photo operations
export async function addPhoto(photo: Photo): Promise<void> {
  const db = await initDB();
  await db.put('photos', photo);
}

export async function getPhotosByJob(jobId: string): Promise<Photo[]> {
  const db = await initDB();
  return db.getAllFromIndex('photos', 'by-job', jobId);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('photos', id);
}

// Voice note operations
export async function addVoiceNote(voiceNote: VoiceNote): Promise<void> {
  const db = await initDB();
  await db.put('voiceNotes', voiceNote);
}

export async function updateVoiceNote(voiceNote: VoiceNote): Promise<void> {
  const db = await initDB();
  await db.put('voiceNotes', voiceNote);
}

export async function getVoiceNotesByJob(jobId: string): Promise<VoiceNote[]> {
  const db = await initDB();
  return db.getAllFromIndex('voiceNotes', 'by-job', jobId);
}

export async function deleteVoiceNote(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('voiceNotes', id);
}

// Client operations
export async function addClient(client: Client): Promise<void> {
  const db = await initDB();
  await db.put('clients', client);
}

export async function getAllClients(): Promise<Client[]> {
  const db = await initDB();
  return db.getAll('clients');
}

export async function updateClientLastUsed(ref: string): Promise<void> {
  const db = await initDB();
  const client = await db.get('clients', ref);
  if (client) {
    client.lastUsedAt = Date.now();
    await db.put('clients', client);
  }
}

// Seed default clients if none exist
export async function seedClients(): Promise<void> {
  const existing = await getAllClients();
  if (existing.length === 0) {
    const defaultClients: Client[] = [
      { ref: 'CLIENT001', name: 'ABC Plumbing', lastUsedAt: 0 },
      { ref: 'CLIENT002', name: 'Smith Electrical', lastUsedAt: 0 },
      { ref: 'CLIENT003', name: 'Jones Construction', lastUsedAt: 0 },
    ];
    const db = await initDB();
    await Promise.all(defaultClients.map(c => db.put('clients', c)));
  }
}

// Sync queue operations
async function addToSyncQueue(jobId: string): Promise<void> {
  const db = await initDB();
  await db.put('syncQueue', { id: jobId, type: 'job', timestamp: Date.now() });
}

export async function getSyncQueue(): Promise<{ id: string; type: string; timestamp: number }[]> {
  const db = await initDB();
  return db.getAll('syncQueue');
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('syncQueue', id);
}

// Get job with all media
export async function getJobWithMedia(jobId: string) {
  const job = await getJob(jobId);
  if (!job) return null;
  
  const photos = await getPhotosByJob(jobId);
  const voiceNotes = await getVoiceNotesByJob(jobId);
  
  return {
    job,
    photos,
    voiceNotes,
  };
}

// Hot text parsing helpers
export function parseHotText(text: string): { text: string; priority: number | null; date: Date | null } {
  let result = text;
  let priority: number | null = null;
  let date: Date | null = null;

  // Priority patterns
  const priorityMatch = text.match(/\bP([1-5])\b/i);
  if (priorityMatch) {
    priority = parseInt(priorityMatch[1], 10) as 1 | 2 | 3 | 4 | 5;
  }

  // Date patterns
  const lowerText = text.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lowerText.includes('tod')) {
    date = new Date(today);
  } else if (lowerText.includes('tom')) {
    date = new Date(today);
    date.setDate(date.getDate() + 1);
  } else if (lowerText.includes('next week')) {
    date = new Date(today);
    // Next Tuesday
    const dayOfWeek = date.getDay();
    const daysUntilTuesday = (2 - dayOfWeek + 7) % 7 || 7;
    date.setDate(date.getDate() + daysUntilTuesday);
  } else {
    // Check for "next Xday"
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const nextDayMatch = lowerText.match(/next\s+(sun|mon|tue|wed|thu|fri|sat)/);
    if (nextDayMatch) {
      const targetDay = days.indexOf(nextDayMatch[1]);
      if (targetDay !== -1) {
        date = new Date(today);
        const currentDay = date.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
        date.setDate(date.getDate() + daysUntilTarget);
      }
    }
  }

  return { text: result, priority, date };
}
