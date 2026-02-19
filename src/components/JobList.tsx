'use client';

import { useState, useEffect } from 'react';
import { Job } from '@/types';
import { getAllJobs, deleteJob, initDB } from '@/lib/storage';
import { format } from 'date-fns';
import { Clock, Trash2, Camera, Mic, Search, X, ChevronRight } from 'lucide-react';

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

  useEffect(() => {
    loadJobs();
  }, [refreshTrigger]);

  async function loadJobs() {
    setLoading(true);
    await initDB();
    const allJobs = await getAllJobs();
    // Sort by createdAt desc
    allJobs.sort((a, b) => b.createdAt - a.createdAt);
    setJobs(allJobs);
    setLoading(false);
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

  function formatDuration(minutes: number | null): string {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function getStatusColor(job: Job): string {
    if (job.endedAt) return 'bg-green-100 text-green-800 border-green-200';
    if (job.startedAt) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  }

  function getStatusText(job: Job): string {
    if (job.endedAt) return 'Complete';
    if (job.startedAt) return 'In Progress';
    return 'Pending';
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Field Jobs</h1>
          <button
            onClick={onCreateNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium active:bg-blue-700"
          >
            + New Job
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Job List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'No jobs found' : 'No jobs yet. Create your first job!'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => onSelectJob(job.id)}
                className="bg-white rounded-lg border p-4 active:bg-gray-50 cursor-pointer shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(job)}`}>
                        {getStatusText(job)}
                      </span>
                      {job.synced === 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                          Unsynced
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{job.clientName}</h3>
                    <p className="text-sm text-gray-500">
                      {format(job.createdAt, 'MMM d, yyyy')}
                    </p>
                    {job.durationMin && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(job.durationMin)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                
                {/* Quick stats */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Camera className="w-4 h-4" />
                    Photos
                  </span>
                  <span className="flex items-center gap-1">
                    <Mic className="w-4 h-4" />
                    Voice
                  </span>
                </div>

                {/* Delete button (only on confirm) */}
                {deleteConfirm === job.id && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(job.id);
                      }}
                      className="flex-1 bg-red-600 text-white py-2 rounded text-sm font-medium"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(null);
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="bg-white border-t p-4 safe-area-pb">
        <button
          onClick={onCreateNew}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-lg active:bg-blue-700"
        >
          Start New Job
        </button>
      </div>
    </div>
  );
}