'use client';

import { useState, useEffect } from 'react';
import JobList from '@/components/JobList';
import JobForm from '@/components/JobForm';
import Timer from '@/components/Timer';
import CameraComponent from '@/components/Camera';
import VoiceRecorder from '@/components/VoiceRecorder';
import { Job } from '@/types';
import { getJob, getJobWithMedia, updateJob, initDB, seedClients, getUnsyncedJobs } from '@/lib/storage';
import { ArrowLeft, Save, Cloud, CloudOff, Check } from 'lucide-react';

export default function Home() {
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dbReady, setDbReady] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    initDatabase();
  }, []);

  useEffect(() => {
    if (dbReady) {
      countUnsynced();
    }
  }, [dbReady, refreshTrigger]);

  async function initDatabase() {
    await initDB();
    await seedClients();
    setDbReady(true);
  }

  async function countUnsynced() {
    const jobs = await getUnsyncedJobs();
    setUnsyncedCount(jobs.length);
  }

  async function loadJob(jobId: string) {
    const job = await getJob(jobId);
    setCurrentJob(job || null);
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

  async function handleSync() {
    setSyncing(true);
    setSyncMessage('Syncing...');
    
    try {
      const unsynced = await getUnsyncedJobs();
      
      if (unsynced.length === 0) {
        setSyncMessage('All jobs synced!');
        setTimeout(() => setSyncMessage(''), 2000);
        setSyncing(false);
        return;
      }

      // Get full job data with media
      const jobsWithMedia = await Promise.all(
        unsynced.map(job => getJobWithMedia(job.id))
      );

      // Send to API
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobs: jobsWithMedia.filter(Boolean),
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        // Mark all as synced
        const storage = await import('@/lib/storage');
        await Promise.all(unsynced.map(job => storage.markJobSynced(job.id)));
        setSyncMessage(`Synced ${unsynced.length} job(s)!`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        setSyncMessage('Sync failed. Will retry later.');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setSyncMessage('Sync failed. Check connection.');
    }

    setTimeout(() => setSyncMessage(''), 3000);
    setSyncing(false);
  }

  // List View
  if (view === 'list') {
    return (
      <div className="h-screen flex flex-col max-w-md mx-auto bg-white">
        <JobList
          onSelectJob={handleSelectJob}
          onCreateNew={handleCreateNew}
          refreshTrigger={refreshTrigger}
        />
        
        {/* Sync Bar */}
        <div className="bg-white border-t px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {unsyncedCount > 0 ? (
              <>
                <CloudOff className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-600">{unsyncedCount} unsynced</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-600">Synced</span>
              </>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || unsyncedCount === 0}
            className="text-sm text-blue-600 font-medium disabled:text-gray-400"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
        
        {syncMessage && (
          <div className="bg-blue-100 text-blue-800 px-4 py-2 text-center text-sm">
            {syncMessage}
          </div>
        )}
      </div>
    );
  }

  // Form View
  if (view === 'form') {
    return (
      <div className="h-screen flex flex-col max-w-md mx-auto bg-white">
        <JobForm
          jobId={selectedJobId}
          onSave={handleSaveJob}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  // Detail View
  return (
    <div className="h-screen flex flex-col max-w-md mx-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setView('list')}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">
            {currentJob?.clientName || 'Job Details'}
          </h1>
          <p className="text-xs text-gray-500">
            {currentJob && new Date(currentJob.createdAt).toLocaleDateString()}
          </p>
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

            {/* Notes */}
            {currentJob.notes && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{currentJob.notes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}