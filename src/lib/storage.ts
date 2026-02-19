import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Job, Photo, VoiceNote, Client } from '@/types';

interface FieldCaptureDB extends DBSchema {
  jobs: {
    key: string;
    value: Job;
    indexes: { 'by-client': string; 'by-synced': number };
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
const DB_VERSION = 1;

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
  return db.get('jobs', id);
}

export async function getAllJobs(): Promise<Job[]> {
  const db = await initDB();
  return db.getAll('jobs');
}

export async function getUnsyncedJobs(): Promise<Job[]> {
  const db = await initDB();
  return db.getAllFromIndex('jobs', 'by-synced', 0);
}

export async function markJobSynced(id: string): Promise<void> {
  const db = await initDB();
  const job = await db.get('jobs', id);
  if (job) {
    job.synced = 1;
    await db.put('jobs', job);
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