'use client';

import { useState, useEffect, useCallback } from 'react';
import JobList from '@/components/JobList';
import JobForm from '@/components/JobForm';
import Timer from '@/components/Timer';
import CameraComponent from '@/components/Camera';
import VoiceRecorder from '@/components/VoiceRecorder';
import AuthScreen from '@/components/AuthScreen';
import SettingsScreen from '@/components/SettingsScreen';
import { Job, PRIORITY_COLORS } from '@/types';
import { getJob, updateJob, initDB, seedClients, getUnsyncedJobs, formatDuration } from '@/lib/storage';
import { syncService } from '@/lib/sync';
import { getCurrentUser, onAuthStateChange, signOut } from '@/lib/supabase';
import { ArrowLeft, Save, Cloud, CloudOff, Check, Flag, Clock, Calendar, LogOut } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form' | 'detail' | 'settings'>('list');
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dbReady, setDbReady] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'unsynced' | 'syncing'>('synced');

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    const subscription = onAuthStateChange((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      initDatabase();
    }
  }, [user]);

  useEffect(() => {
    if (dbReady) {
      countUnsynced();
      // Auto-sync on open
      handleAutoSync();
    }
  }, [dbReady]);

  // Periodic sync check
  useEffect(() => {
    if (!dbReady) return;
    
    const interval = setInterval(() => {
      countUnsynced();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [dbReady]);

  async function initDatabase() {
    await initDB();
    await seedClients();
    setDbReady(true);
  }

  async function countUnsynced() {
    const jobs = await getUnsyncedJobs();
    setUnsyncedCount(jobs.length);
    setSyncStatus(jobs.length > 0 ? 'unsynced' : 'synced');
  }

  async function loadJob(jobId: string) {
    try {
      const job = await getJob(jobId);
      setCurrentJob(job || null);
    } catch (err) {
      console.error('Error loading job:', err);
      setCurrentJob(null);
    }
  }

  function handleSelectJob(jobId: string) {
    setSelectedJobId(jobId);
    loadJob(jobId);
    setView('detail');
  }

  function handleCreateNew() {
    setSelectedJobId(undefined);
    setView('form');
  }

  function handleSaveJob() {
    setRefreshTrigger(prev => prev + 1);
    setView('list');
  }

  function handleCancel() {
    setView('list');
  }

  async function handleAutoSync() {
    const unsynced = await getUnsyncedJobs();
    if (unsynced.length > 0) {
      setSyncStatus('syncing');
      await performSync();
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncStatus('syncing');
    setSyncMessage('Syncing...');
    await performSync();
  }

  async function performSync() {
    try {
      await syncService.forceSync();
      await countUnsynced();
      setSyncMessage('Synced!');
      setSyncStatus('synced');
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Sync error:', err);
      setSyncMessage('Sync failed. Will retry later.');
      setSyncStatus('unsynced');
    }

    setTimeout(() => setSyncMessage(''), 3000);
    setSyncing(false);
  }

  function getSyncIcon() {
    switch (syncStatus) {
      case 'syncing':
        return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      case 'unsynced':
        return <CloudOff className="w-4 h-4 text-destructive" />;
      default:
        return <Cloud className="w-4 h-4 text-primary" />;
    }
  }

  function handleEditJob(jobId: string) {
    setSelectedJobId(jobId);
    setView('form');
  }

  function handleSettings() {
    setView('settings');
  }

  async function handleLogout() {
    await signOut();
    setUser(null);
    setView('list');
  }

  // Auth gate
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  // List View
  if (view === 'list') {
    return (
      <div className="h-screen flex flex-col max-w-md mx-auto bg-bg">
        <JobList
          onSelectJob={handleSelectJob}
          onEditJob={handleEditJob}
          onCreateNew={handleCreateNew}
          refreshTrigger={refreshTrigger}
          userId={user.id}
          onLogout={handleLogout}
          onSettings={handleSettings}
        />
        
        {/* Sync Bar */}
        <div className="bg-card border-t border-border px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getSyncIcon()}
            <span className="text-sm text-muted-fg">
              {syncStatus === 'syncing' ? 'Syncing...' : 
               unsyncedCount > 0 ? `${unsyncedCount} unsynced` : 'Synced'}
            </span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || unsyncedCount === 0}
            className="text-sm text-primary font-medium disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
        
        {syncMessage && (
          <div className="bg-primary/10 text-primary px-4 py-2 text-center text-sm border-t border-primary/20">
            {syncMessage}
          </div>
        )}
      </div>
    );
  }

  // Form View
  if (view === 'form') {
    return (
      <div className="h-screen flex flex-col max-w-md mx-auto bg-bg">
        <JobForm
          jobId={selectedJobId}
          onSave={handleSaveJob}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  // Settings View
  if (view === 'settings') {
    return (
      <div className="h-screen flex flex-col max-w-md mx-auto bg-bg">
        <SettingsScreen
          onBack={() => setView('list')}
        />
      </div>
    );
  }

  // Detail View
  return (
    <div className="h-screen flex flex-col max-w-md mx-auto bg-bg">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setView('list')}
          className="p-2 -ml-2 hover:bg-slate rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-fg" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: PRIORITY_COLORS[currentJob?.priority || 5] }}
            />
            <h1 className="text-lg font-semibold text-fg truncate">
              {currentJob?.clientName || 'Job Details'}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-fg">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {currentJob && new Date(currentJob.createdAt).toLocaleDateString()}
            </span>
            {currentJob && currentJob.totalDurationMin > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(currentJob.totalDurationMin)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentJob && (
          <>
            <Timer 
              job={currentJob} 
              onUpdate={() => loadJob(currentJob.id)} 
            />
            
            <CameraComponent 
              jobId={currentJob.id}
              onPhotosChange={() => setRefreshTrigger(prev => prev + 1)}
            />
            
            <VoiceRecorder 
              jobId={currentJob.id}
              onVoiceNotesChange={() => setRefreshTrigger(prev => prev + 1)}
            />

            {/* Editable Notes */}
            {currentJob && (
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-fg">Notes</h3>
                </div>
                <textarea
                  value={currentJob.notes}
                  onChange={async (e) => {
                    const updatedJob = { ...currentJob, notes: e.target.value, synced: 0 };
                    await updateJob(updatedJob);
                    setCurrentJob(updatedJob);
                  }}
                  rows={4}
                  className="w-full px-3 py-2 bg-slate text-fg border border-border rounded-lg resize-none focus:outline-none focus:border-primary text-sm"
                  placeholder="Add notes..."
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
