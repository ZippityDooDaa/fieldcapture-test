'use client';

import { useState, useEffect } from 'react';
import { Job, PRIORITY_COLORS, TimeSession } from '@/types';
import { getAllJobs, deleteJob, createJob, initDB, updateJob, createSession, endSession, calculateTotalDuration, hasActiveSession, getActiveSession } from '@/lib/storage';
import { syncService } from '@/lib/sync';
import { format } from 'date-fns';
import {
  Trash2,
  Search,
  X,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Flag,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  AlertCircle,
  MapPin,
  Undo2,
  RefreshCw,
  LogOut
} from 'lucide-react';

interface JobListProps {
  onSelectJob: (jobId: string) => void;
  onEditJob?: (jobId: string) => void;
  onCreateNew: () => void;
  refreshTrigger: number;
  userId: string;
  onLogout?: () => void;
}

export default function JobList({ onSelectJob, onEditJob, onCreateNew, refreshTrigger, userId, onLogout }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [swipedJob, setSwipedJob] = useState<string | null>(null);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [activeTimers, setActiveTimers] = useState<Record<string, number>>({});
  const [deletedJob, setDeletedJob] = useState<{ job: Job; timeoutId: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Update active timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      const timers: Record<string, number> = {};
      jobs.forEach(job => {
        const activeSession = getActiveSession(job);
        if (activeSession) {
          timers[job.id] = Math.floor((Date.now() - activeSession.startedAt) / 1000);
        }
      });
      setActiveTimers(timers);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [jobs]);

  useEffect(() => {
    loadJobs();
  }, [refreshTrigger]);

  // Initialize sync service
  useEffect(() => {
    const initSync = async () => {
      try {
        await syncService.init(userId);
        setLastSync(new Date());
        setSyncError(null);
      } catch (err) {
        console.error('[Sync] Init error:', err);
        setSyncError('Init failed');
      }
    };
    initSync();
    
    // Listen for sync updates
    const handleSyncUpdate = () => {
      loadJobs();
      setLastSync(new Date());
    };
    window.addEventListener('jobs-updated', handleSyncUpdate);
    
    // Listen for sync errors
    const handleSyncError = (e: any) => {
      console.error('[Sync] Error:', e.detail);
      setSyncError(e.detail || 'Sync failed');
    };
    window.addEventListener('sync-error', handleSyncError);
    
    return () => {
      syncService.cleanup();
      window.removeEventListener('jobs-updated', handleSyncUpdate);
      window.removeEventListener('sync-error', handleSyncError);
    };
  }, []);

  async function loadJobs() {
    setLoading(true);
    await initDB();
    const allJobs = await getAllJobs();
    
    // Sort: Active first, then Date → Priority → Time
    allJobs.sort((a, b) => {
      // Active sessions first
      const aActive = hasActiveSession(a);
      const bActive = hasActiveSession(b);
      if (aActive !== bActive) return bActive ? 1 : -1;
      
      // Then by date (newest first)
      const dateDiff = b.createdAt - a.createdAt;
      if (dateDiff !== 0) return dateDiff;
      
      // Then by priority (lower number = higher priority)
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by total duration (longest first)
      return b.totalDurationMin - a.totalDurationMin;
    });
    
    setJobs(allJobs);
    setLoading(false);
  }

  async function toggleComplete(job: Job, e: React.MouseEvent) {
    e.stopPropagation();
    const updatedJob: Job = {
      ...job,
      completed: !job.completed,
      completedAt: !job.completed ? Date.now() : null,
      synced: 0,
    };
    await updateJob(updatedJob);
    await loadJobs();
  }

  async function handleQuickStart(job: Job, e: React.MouseEvent) {
    e.stopPropagation();
    
    // Check if job is from a different day
    const jobDate = new Date(job.createdAt);
    const today = new Date();
    const isDifferentDay = jobDate.toDateString() !== today.toDateString();
    
    if (isDifferentDay) {
      // Create new job for today
      const newJob: Job = {
        id: crypto.randomUUID(),
        clientRef: job.clientRef,
        clientName: job.clientName,
        createdAt: Date.now(),
        sessions: [createSession()],
        totalDurationMin: 0,
        notes: `Continued from ${jobDate.toLocaleDateString()}`,
        synced: 0,
        priority: job.priority,
        completed: false,
        completedAt: null,
        location: job.location || 'OnSite',
      };
      await createJob(newJob);
      await loadJobs();
      return;
    }
    
    // End any other active sessions first
    const activeJob = jobs.find(j => hasActiveSession(j) && j.id !== job.id);
    if (activeJob) {
      const updatedActiveJob = { ...activeJob };
      const activeSession = getActiveSession(activeJob);
      if (activeSession) {
        const endedSession = endSession(activeSession);
        updatedActiveJob.sessions = updatedActiveJob.sessions.map(s => 
          s.id === endedSession.id ? endedSession : s
        );
        updatedActiveJob.totalDurationMin = calculateTotalDuration(updatedActiveJob.sessions);
        updatedActiveJob.synced = 0;
        await updateJob(updatedActiveJob);
      }
    }
    
    // Start new session for this job
    const updatedJob = { ...job };
    const newSession = createSession();
    updatedJob.sessions = [...updatedJob.sessions, newSession];
    updatedJob.synced = 0;
    await updateJob(updatedJob);
    await loadJobs();
  }

  async function handleQuickStop(job: Job, e: React.MouseEvent) {
    e.stopPropagation();
    
    const activeSession = getActiveSession(job);
    if (!activeSession) return;
    
    const updatedJob = { ...job };
    const endedSession = endSession(activeSession);
    updatedJob.sessions = updatedJob.sessions.map(s => 
      s.id === endedSession.id ? endedSession : s
    );
    updatedJob.totalDurationMin = calculateTotalDuration(updatedJob.sessions);
    updatedJob.synced = 0;
    await updateJob(updatedJob);
    await loadJobs();
  }

  const filteredJobs = jobs.filter(job => 
    job.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.notes.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleDelete(jobId: string) {
    const jobToDelete = jobs.find(j => j.id === jobId);
    if (!jobToDelete) return;
    
    // Clear any existing undo timeout
    if (deletedJob?.timeoutId) {
      window.clearTimeout(deletedJob.timeoutId);
    }
    
    // Remove job from UI immediately
    setJobs(jobs.filter(j => j.id !== jobId));
    setSwipedJob(null);
    
    // Set up 5-second undo window
    const timeoutId = window.setTimeout(async () => {
      await deleteJob(jobId);
      // Trigger sync after permanent delete
      await syncService.syncToServer();
      setDeletedJob(null);
    }, 5000);
    
    setDeletedJob({ job: jobToDelete, timeoutId });
  }
  
  function handleUndoDelete() {
    if (deletedJob?.timeoutId) {
      window.clearTimeout(deletedJob.timeoutId);
    }
    if (deletedJob?.job) {
      setJobs(prev => [...prev, deletedJob.job]);
    }
    setDeletedJob(null);
  }

  function formatDuration(minutes: number): string {
    if (minutes === 0) return '';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function formatActiveTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function getPriorityColor(priority: number): string {
    return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[5];
  }

  // Group jobs by date
  const groupedJobs = filteredJobs.reduce((groups, job) => {
    const dateKey = format(job.createdAt, 'yyyy-MM-dd');
    const dateLabel = format(job.createdAt, 'EEEE, MMM d');
    if (!groups[dateKey]) {
      groups[dateKey] = { label: dateLabel, jobs: [] };
    }
    groups[dateKey].jobs.push(job);
    return groups;
  }, {} as Record<string, { label: string; jobs: Job[] }>);

  // Sort date keys chronologically (newest first)
  const sortedDateKeys = Object.keys(groupedJobs).sort((a, b) => b.localeCompare(a));

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-card border-b border-border px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-fg">Job Tracka</h1>
          <div className="flex items-center gap-2">
            {deletedJob && (
              <button
                onClick={handleUndoDelete}
                className="bg-destructive text-white px-3 py-1.5 rounded-lg font-medium active:opacity-90 text-sm flex items-center gap-1"
              >
                <Undo2 className="w-4 h-4" />
                Undo
              </button>
            )}
            <button
              onClick={async () => {
                setIsSyncing(true);
                setSyncError(null);
                try {
                  await syncService.forceSync();
                  setLastSync(new Date());
                } catch (err) {
                  setSyncError('Sync failed');
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className={`px-3 py-1.5 rounded-lg font-medium active:opacity-90 text-sm flex items-center gap-1 ${
                syncError 
                  ? 'bg-destructive text-white' 
                  : isSyncing 
                    ? 'bg-muted text-muted-fg' 
                    : 'bg-slate text-fg hover:bg-slate/80'
              }`}
              title={lastSync ? `Last sync: ${lastSync.toLocaleTimeString()}` : 'Sync now'}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {syncError ? '!' : ''}
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-3 py-1.5 rounded-lg font-medium active:opacity-90 text-sm flex items-center gap-1 bg-slate text-muted-fg hover:bg-slate/80"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onCreateNew}
              className="bg-primary text-dark px-3 py-1.5 rounded-lg font-medium active:opacity-90 text-sm"
            >
              + New
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-fg" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-9 py-1.5 bg-slate border border-border rounded-lg text-sm text-fg placeholder-muted-fg focus:outline-none focus:border-primary"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-fg" />
            </button>
          )}
        </div>
      </div>

      {/* Job List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-muted-fg">Loading...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-8 text-muted-fg">
            {searchTerm ? 'No jobs found' : 'No jobs yet. Create your first job!'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedDateKeys.map((dateKey) => {
              const { label, jobs: dateJobs } = groupedJobs[dateKey];
              return (
              <div key={dateKey}>
                <div className="px-3 py-1 text-xs font-medium text-muted-fg uppercase tracking-wider">
                  {label}
                </div>
                <div>
                  {dateJobs.map((job) => {
                    const isActive = hasActiveSession(job);
                    const activeSession = getActiveSession(job);
                    const isSwiped = swipedJob === job.id;
                    
                    return (
                    <div
                      key={job.id}
                      className="relative overflow-hidden"
                      onTouchStart={(e) => {
                        setSwipeStartX(e.touches[0].clientX);
                      }}
                      onTouchMove={(e) => {
                        if (swipeStartX === null) return;
                        const diff = e.touches[0].clientX - swipeStartX;
                        // Swiping right reveals delete (need 50px right swipe)
                        if (diff > 50) {
                          setSwipedJob(job.id);
                        } else if (diff < -30) {
                          // Swiping left hides delete
                          setSwipedJob(null);
                        }
                      }}
                      onTouchEnd={() => {
                        setSwipeStartX(null);
                      }}
                    >
                      {/* Delete Background Layer */}
                      <div 
                        className={`absolute inset-y-0 left-0 bg-destructive flex items-center px-4 transition-transform duration-200 ${
                          isSwiped ? 'translate-x-0' : '-translate-x-full'
                        }`}
                        style={{ width: '80px' }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(job.id);
                          }}
                          className="flex flex-col items-center gap-1 text-white"
                        >
                          <Trash2 className="w-6 h-6" />
                          <span className="text-xs font-medium">Delete</span>
                        </button>
                      </div>

                      {/* Job Content - slides to reveal delete */}
                      <div 
                        className={`relative bg-bg transition-transform duration-200 ${
                          isSwiped ? 'translate-x-20' : 'translate-x-0'
                        } ${job.completed ? 'opacity-50' : ''} ${isActive ? 'bg-destructive/5' : ''}`}
                      >
                        <div className="grid grid-cols-[auto_1fr_auto] gap-1.5 items-start py-0.5 px-3">
                          {/* Checkbox - col 1 */}
                          <button
                            onClick={(e) => toggleComplete(job, e)}
                            className="mt-0.5"
                          >
                            {job.completed ? (
                              <CheckCircle2 
                                className="w-5 h-5" 
                                style={{ color: getPriorityColor(job.priority) }}
                              />
                            ) : (
                              <Circle 
                                className="w-5 h-5 text-muted-fg" 
                                style={{ 
                                  borderColor: getPriorityColor(job.priority),
                                  color: getPriorityColor(job.priority)
                                }}
                              />
                            )}
                          </button>

                          {/* Content - col 2 */}
                          <div className="min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2">
                              <span 
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getPriorityColor(job.priority) }}
                              />
                              <h3 
                                className={`font-medium truncate cursor-pointer hover:text-primary ${
                                  job.completed ? 'line-through text-muted-fg' : 'text-fg'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onEditJob) {
                                    onEditJob(job.id);
                                  } else {
                                    onSelectJob(job.id);
                                  }
                                }}
                              >
                                {job.clientName}
                              </h3>
                              {isActive && (
                                <span className="flex items-center gap-1 text-xs text-destructive font-medium">
                                  <AlertCircle className="w-3 h-3" />
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            
                            {/* Meta row */}
                            <div className="flex items-center gap-2 text-xs text-muted-fg flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {(() => {
                                  let totalMin = job.totalDurationMin || 0;
                                  if (isActive && activeTimers[job.id]) {
                                    totalMin += Math.floor(activeTimers[job.id] / 60);
                                  }
                                  return totalMin > 0 
                                    ? formatDuration(totalMin)
                                    : 'No time';
                                })()}
                              </span>
                              {job.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {job.location}
                                </span>
                              )}
                              {(() => {
                                const jobTime = new Date(job.createdAt);
                                const hours = jobTime.getHours();
                                const mins = jobTime.getMinutes();
                                if (hours !== 0 || mins !== 0) {
                                  return (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {hours.toString().padStart(2, '0')}:{mins.toString().padStart(2, '0')}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {job.sessions.length > 0 && (
                                <span>{job.sessions.length} session{job.sessions.length !== 1 ? 's' : ''}</span>
                              )}
                              {job.synced === 0 && (
                                <span className="text-primary">• Unsynced</span>
                              )}
                            </div>

                            {job.notes && (
                              <p 
                                className="text-sm text-muted-fg line-clamp-2 cursor-pointer"
                                onClick={() => onSelectJob(job.id)}
                              >
                                {job.notes}
                              </p>
                            )}

                            {expandedJob === job.id && job.sessions.length > 0 && (
                              <div className="pl-4 border-l-2 border-border space-y-0.5">
                                {job.sessions.map((session, idx) => (
                                  <div key={session.id} className={`text-xs ${!session.endedAt ? 'text-destructive font-medium' : 'text-muted-fg'}`}>
                                    Session {idx + 1}: {formatDuration(session.durationMin || 0)}
                                    {!session.endedAt && ' (RUNNING)'}
                                  </div>
                                ))}
                              </div>
                            )}

                            {job.sessions.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedJob(expandedJob === job.id ? null : job.id);
                                }}
                                className="flex items-center gap-1 text-xs text-muted-fg hover:text-fg"
                              >
                                {expandedJob === job.id ? (
                                  <><ChevronUp className="w-3 h-3" /> Hide sessions</>
                                ) : (
                                  <><ChevronDown className="w-3 h-3" /> Show sessions</>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Button - col 3 */}
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={(e) => isActive ? handleQuickStop(job, e) : handleQuickStart(job, e)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                                isActive 
                                  ? 'bg-destructive text-white hover:bg-destructive/90' 
                                  : 'bg-slate text-fg hover:bg-primary hover:text-dark'
                              }`}
                              title={isActive ? 'Stop timer' : 'Start timer'}
                            >
                              {isActive ? (
                                <Square className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4 ml-0.5" />
                              )}
                            </button>
                            {isActive && activeTimers[job.id] && (
                              <span className="text-xs font-mono font-medium text-destructive">
                                {formatActiveTime(activeTimers[job.id])}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="bg-card border-t border-border p-4 safe-area-pb">
        <button
          onClick={onCreateNew}
          className="w-full bg-primary text-dark py-3 rounded-lg font-medium text-lg active:opacity-90"
        >
          Start New Job
        </button>
      </div>
    </div>
  );
}
