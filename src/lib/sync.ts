import { supabase, getCurrentUser } from './supabase';
import { Job, Client } from '@/types';
import { initDB, getAllJobs as getLocalJobs, getAllClients as getLocalClients, saveJobs, saveClients } from './storage';

const POLL_INTERVAL = 30000; // 30 seconds
const SYNC_DEBOUNCE = 5000; // 5 seconds between syncs

class SyncService {
  private pollTimer: number | null = null;
  private lastSyncAt: string = new Date(0).toISOString();
  private subscription: any = null;
  private syncInProgress: boolean = false;
  private pendingSync: boolean = false;
  private userId: string | null = null;

  async init(userId: string) {
    this.userId = userId;
    await initDB();
    
    // Set up real-time subscription
    this.setupRealtime();
    
    // Initial sync from server
    await this.syncFromServer();
    
    // Start polling fallback
    this.startPolling();
  }

  cleanup() {
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private setupRealtime() {
    // Subscribe to job changes
    this.subscription = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          console.log('[Sync] Real-time update:', payload);
          this.handleRealtimeUpdate(payload);
        }
      )
      .subscribe();
  }

  private async handleRealtimeUpdate(payload: any) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Get current local jobs
    const localJobs = await getLocalJobs();
    
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      // Convert Supabase record to local Job format
      const job = this.supabaseToLocalJob(newRecord);
      
      // Check if we have this job locally
      const existingIndex = localJobs.findIndex(j => j.id === job.id);
      
      if (existingIndex >= 0) {
        // Only update if server version is newer
        const localJob = localJobs[existingIndex];
        const serverUpdated = new Date(job.synced || 0).getTime();
        const localUpdated = localJob.synced || 0;
        
        if (serverUpdated > localUpdated) {
          localJobs[existingIndex] = job;
        }
      } else {
        localJobs.push(job);
      }
    } else if (eventType === 'DELETE') {
      const index = localJobs.findIndex(j => j.id === oldRecord.id);
      if (index >= 0) {
        localJobs.splice(index, 1);
      }
    }
    
    await saveJobs(localJobs);
    
    // Notify UI of update
    window.dispatchEvent(new CustomEvent('jobs-updated'));
  }

  private startPolling() {
    this.pollTimer = window.setInterval(() => {
      this.syncFromServer();
    }, POLL_INTERVAL);
  }

  async forceSync() {
    await this.syncToServer();
    await this.syncFromServer();
    
    // Broadcast to other clients
    if (this.userId) {
      await supabase.channel('sync-broadcast').send({
        type: 'broadcast',
        event: 'force-sync',
        payload: { userId: this.userId, timestamp: new Date().toISOString() },
      });
    }
  }

  private async syncFromServer() {
    if (this.syncInProgress) {
      this.pendingSync = true;
      return;
    }
    
    if (!this.userId) {
      console.error('[Sync] No user ID, skipping sync');
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      // Fetch jobs updated since last sync
      const { data: serverJobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', this.userId)
        .gt('updated_at', this.lastSyncAt)
        .order('updated_at', { ascending: true });

      if (error) {
        console.error('[Sync] Database error:', error);
        throw error;
      }

      if (serverJobs && serverJobs.length > 0) {
        const localJobs = await getLocalJobs();
        
        for (const serverJob of serverJobs as any[]) {
          const job = this.supabaseToLocalJob(serverJob);
          const existingIndex = localJobs.findIndex(j => j.id === job.id);
          
          if (existingIndex >= 0) {
            const localJob = localJobs[existingIndex];
            // Server wins on conflict (compare timestamps)
            if ((job.synced || 0) > (localJob.synced || 0)) {
              localJobs[existingIndex] = job;
            }
          } else {
            localJobs.push(job);
          }
          
          // Track latest sync time
          if (serverJob.updated_at > this.lastSyncAt) {
            this.lastSyncAt = serverJob.updated_at;
          }
        }
        
        await saveJobs(localJobs);
        window.dispatchEvent(new CustomEvent('jobs-updated'));
      }

      // Sync clients too
      await this.syncClientsFromServer();
      
    } catch (err: any) {
      console.error('[Sync] Error fetching from server:', err);
      window.dispatchEvent(new CustomEvent('sync-error', { detail: err.message || 'Unknown error' }));
    } finally {
      this.syncInProgress = false;
      
      if (this.pendingSync) {
        this.pendingSync = false;
        setTimeout(() => this.syncFromServer(), SYNC_DEBOUNCE);
      }
    }
  }

  private async syncClientsFromServer() {
    const { data: serverClients, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', this.userId);

    if (error) {
      console.error('[Sync] Error fetching clients:', error);
      return;
    }

    if (serverClients && serverClients.length > 0) {
      const localClients = await getLocalClients();
      
      for (const serverClient of serverClients as any[]) {
        const existingIndex = localClients.findIndex(c => c.ref === serverClient.ref);
        const client: Client = {
          id: serverClient.id,
          ref: serverClient.ref,
          name: serverClient.name,
          createdAt: new Date(serverClient.created_at).getTime(),
          lastUsedAt: Date.now(), // Will be updated when used
        };
        
        if (existingIndex >= 0) {
          localClients[existingIndex] = client;
        } else {
          localClients.push(client);
        }
      }
      
      await saveClients(localClients);
    }
  }

  public async syncToServer() {
    if (!this.userId) return;
    
    const localJobs = await getLocalJobs();
    const unsyncedJobs = localJobs.filter(job => job.synced === 0 || !job.synced);
    
    for (const job of unsyncedJobs) {
      try {
        const supabaseJob = this.localToSupabaseJob(job, this.userId);
        
        const { error } = await supabase
          .from('jobs')
          .upsert(supabaseJob, { onConflict: 'id' });
        
        if (error) {
          console.error('[Sync] Error upserting job:', error);
          continue;
        }
        
        // Mark as synced locally
        job.synced = Date.now();
        
      } catch (err) {
        console.error('[Sync] Error syncing job:', err);
      }
    }
    
    // Save updated sync timestamps
    await saveJobs(localJobs);
    
    // Sync clients
    await this.syncClientsToServer();
  }

  private async syncClientsToServer() {
    if (!this.userId) return;
    
    const localClients = await getLocalClients();
    
    for (const client of localClients) {
      try {
        const { error } = await supabase
          .from('clients')
          .upsert({
            id: client.id,
            ref: client.ref,
            name: client.name,
            user_id: this.userId,
          }, { onConflict: 'ref' });
        
        if (error) {
          console.error('[Sync] Error upserting client:', error);
        }
      } catch (err) {
        console.error('[Sync] Error syncing client:', err);
      }
    }
  }

  private supabaseToLocalJob(record: any): Job {
    return {
      id: record.id,
      clientRef: record.client_ref,
      clientName: record.client_name,
      createdAt: new Date(record.created_at).getTime(),
      sessions: [], // Sessions stored in notes for now, or extend schema later
      totalDurationMin: 0, // Calculate from sessions
      notes: record.notes,
      synced: record.synced_at ? new Date(record.synced_at).getTime() : 0,
      priority: record.priority as 1 | 2 | 3 | 4 | 5,
      completed: record.completed,
      completedAt: record.completed_at ? new Date(record.completed_at).getTime() : null,
      location: record.location as 'OnSite' | 'Remote',
    };
  }

  private localToSupabaseJob(job: Job, deviceId: string): any {
    return {
      id: job.id,
      user_id: deviceId,
      client_ref: job.clientRef,
      client_name: job.clientName,
      notes: job.notes,
      priority: job.priority,
      location: job.location,
      completed: job.completed,
      completed_at: job.completedAt ? new Date(job.completedAt).toISOString() : null,
      created_at: new Date(job.createdAt).toISOString(),
      synced_at: new Date().toISOString(),
    };
  }
}

export const syncService = new SyncService();