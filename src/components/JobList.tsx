'use client';

import { useState, useEffect } from 'react';
import { Job, PRIORITY_COLORS } from '@/types';
import { getAllJobs, deleteJob, initDB, updateJob } from '@/lib/storage';
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
  ChevronUp
} from 'lucide-react';

interface JobListProps {
  onSelectJob: (jobId: string) => void;
  onCreateNew: () => void;
  refreshTrigger: number;
}

export default function JobList({ onSelectJob, onCreateNew, refreshTrigger }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, [refreshTrigger]);

  async function loadJobs() {
    setLoading(true);
    await initDB();
    const allJobs = await getAllJobs();
    
    // Sort: Date → Priority → Time
    allJobs.sort((a, b) => {
      // First by date (newest first)
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

  const filteredJobs = jobs.filter(job => 
    job.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.notes.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleDelete(jobId: string) {
    if (deleteConfirm === jobId) {
      await deleteJob(jobId);
      setDeleteConfirm(null);
      await loadJobs();
    } else {
      setDeleteConfirm(jobId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  }

  function formatDuration(minutes: number): string {
    if (minutes === 0) return '';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-fg">Field Jobs</h1>
          <button
            onClick={onCreateNew}
            className="bg-primary text-dark px-4 py-2 rounded-lg font-medium active:opacity-90"
          >
            + New
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-fg" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-slate border border-border rounded-lg text-sm text-fg placeholder-muted-fg focus:outline-none focus:border-primary"
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
            {Object.entries(groupedJobs).map(([dateKey, { label, jobs: dateJobs }]) => (
              <div key={dateKey} className="py-2">
                <div className="px-4 py-2 text-xs font-medium text-muted-fg uppercase tracking-wider">
                  {label}
                </div>
                <div className="space-y-1">
                  {dateJobs.map((job) => (
                    <div
                      key={job.id}
                      className={`group px-4 py-3 hover:bg-slate/50 transition-colors ${
                        job.completed ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => toggleComplete(job, e)}
                          className="mt-0.5 flex-shrink-0"
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

                        {/* Content */}
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => onSelectJob(job.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getPriorityColor(job.priority) }}
                            />
                            <h3 className={`font-medium truncate ${
                              job.completed ? 'line-through text-muted-fg' : 'text-fg'
                            }`}>
                              {job.clientName}
                            </h3>
                          </div>
                          
                          {/* Meta row */}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-fg">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {job.totalDurationMin > 0 
                                ? formatDuration(job.totalDurationMin)
                                : 'No time'
                              }
                            </span>
                            {job.sessions.length > 0 && (
                              <span>{job.sessions.length} session{job.sessions.length !== 1 ? 's' : ''}</span>
                            )}
                            {job.synced === 0 && (
                              <span className="text-primary">• Unsynced</span>
                            )}
                          </div>

                          {/* Notes preview */}
                          {job.notes && (
                            <p className="text-sm text-muted-fg mt-1 line-clamp-2">
                              {job.notes}
                            </p>
                          )}

                          {/* Expanded sessions */}
                          {expandedJob === job.id && job.sessions.length > 0 && (
                            <div className="mt-2 pl-4 border-l-2 border-border space-y-1">
                              {job.sessions.map((session, idx) => (
                                <div key={session.id} className="text-xs text-muted-fg">
                                  Session {idx + 1}: {formatDuration(session.durationMin || 0)}
                                  {session.endedAt ? '' : ' (running)'}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Expand button if has sessions */}
                          {job.sessions.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedJob(expandedJob === job.id ? null : job.id);
                              }}
                              className="mt-1 flex items-center gap-1 text-xs text-muted-fg hover:text-fg"
                            >
                              {expandedJob === job.id ? (
                                <><ChevronUp className="w-3 h-3" /> Hide sessions</>
                              ) : (
                                <><ChevronDown className="w-3 h-3" /> Show sessions</>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {deleteConfirm === job.id ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(job.id);
                              }}
                              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(job.id);
                              }}
                              className="p-2 text-muted-fg hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
