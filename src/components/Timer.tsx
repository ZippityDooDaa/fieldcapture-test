'use client';

import { useState, useEffect, useCallback } from 'react';
import { Job, TimeSession } from '@/types';
import { updateJob, createSession, endSession, calculateTotalDuration, formatDurationLong } from '@/lib/storage';
import { Play, Square, RotateCcw, Clock, ChevronDown, ChevronUp, Edit2, Check, X } from 'lucide-react';

interface TimerProps {
  job: Job;
  onUpdate: () => void;
}

interface SessionEditorProps {
  session: TimeSession;
  onSave: (session: TimeSession) => void;
  onCancel: () => void;
}

function SessionEditor({ session, onSave, onCancel }: SessionEditorProps) {
  // Helper to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  
  // Initialize from session timestamps - keep date and time separate
  const [startDate, setStartDate] = useState(formatDateLocal(session.startedAt));
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(session.startedAt);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  });
  
  const [endDate, setEndDate] = useState(() => {
    if (!session.endedAt) return '';
    return formatDateLocal(session.endedAt);
  });
  const [endTime, setEndTime] = useState(() => {
    if (!session.endedAt) return '';
    const d = new Date(session.endedAt);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  });

  function handleSave() {
    // Parse dates explicitly to avoid timezone issues
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startedAt = new Date(startYear, startMonth - 1, startDay, startHour, startMinute).getTime();
    
    let endedAt: number | null = null;
    if (endDate && endTime) {
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      endedAt = new Date(endYear, endMonth - 1, endDay, endHour, endMinute).getTime();
    }
    
    const durationMin = endedAt && endedAt > startedAt
      ? Math.floor((endedAt - startedAt) / 1000 / 60)
      : null;

    onSave({
      ...session,
      startedAt,
      endedAt,
      durationMin: durationMin && durationMin > 0 ? durationMin : (endedAt ? 1 : null),
    });
  }

  return (
    <div className="bg-slate rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-fg block mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-2 py-1 bg-dark text-fg border border-border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-fg block mb-1">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-2 py-1 bg-dark text-fg border border-border rounded text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-fg block mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-2 py-1 bg-dark text-fg border border-border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-fg block mb-1">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-2 py-1 bg-dark text-fg border border-border rounded text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 bg-primary text-dark py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
        >
          <Check className="w-4 h-4" />
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-muted text-muted-fg py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Timer({ job, onUpdate }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showSessions, setShowSessions] = useState(job.sessions.length > 0);
  const [editingSession, setEditingSession] = useState<string | null>(null);

  // Get active session (one without endedAt)
  const activeSession = job.sessions.find(s => !s.endedAt);

  // Calculate initial elapsed time from active session
  useEffect(() => {
    if (activeSession) {
      const now = Date.now();
      const seconds = Math.floor((now - activeSession.startedAt) / 1000);
      setElapsed(seconds);
      setIsRunning(true);
    } else {
      setElapsed(0);
      setIsRunning(false);
    }
  }, [activeSession, job.sessions]);

  // Update timer every second when running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && activeSession) {
      interval = setInterval(() => {
        const now = Date.now();
        const seconds = Math.floor((now - activeSession.startedAt) / 1000);
        setElapsed(seconds);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, activeSession]);

  async function startTimer() {
    const newSession = createSession();
    const updatedJob: Job = {
      ...job,
      sessions: [...job.sessions, newSession],
    };
    await updateJob(updatedJob);
    setIsRunning(true);
    setElapsed(0);
    onUpdate();
  }

  async function stopTimer() {
    if (!activeSession) return;

    const endedSession = endSession(activeSession);
    const updatedSessions = job.sessions.map(s => 
      s.id === activeSession.id ? endedSession : s
    );
    
    const totalDuration = calculateTotalDuration(updatedSessions);
    
    const updatedJob: Job = {
      ...job,
      sessions: updatedSessions,
      totalDurationMin: totalDuration,
    };
    
    await updateJob(updatedJob);
    setIsRunning(false);
    setElapsed(endedSession.durationMin ? endedSession.durationMin * 60 : 0);
    onUpdate();
  }

  async function handleSaveSession(editedSession: TimeSession) {
    const updatedSessions = job.sessions.map(s => 
      s.id === editedSession.id ? editedSession : s
    );
    
    const totalDuration = calculateTotalDuration(updatedSessions);
    
    const updatedJob: Job = {
      ...job,
      sessions: updatedSessions,
      totalDurationMin: totalDuration,
    };
    
    await updateJob(updatedJob);
    setEditingSession(null);
    onUpdate();
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('Delete this time session?')) return;
    
    const updatedSessions = job.sessions.filter(s => s.id !== sessionId);
    const totalDuration = calculateTotalDuration(updatedSessions);
    
    const updatedJob: Job = {
      ...job,
      sessions: updatedSessions,
      totalDurationMin: totalDuration,
    };
    
    await updateJob(updatedJob);
    onUpdate();
  }

  function formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function formatSessionTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatSessionDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const hasSessions = job.sessions.length > 0;
  const isComplete = !isRunning && hasSessions;

  // Calculate total duration including running session for display
  function getDisplayTotalMinutes(): number {
    const completedTotal = job.totalDurationMin || 0;
    if (isRunning && activeSession) {
      const runningMinutes = Math.floor(elapsed / 60);
      return completedTotal + runningMinutes;
    }
    return completedTotal;
  }

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-fg">Job Timer</h3>
        {isComplete && (
          <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
            Complete
          </span>
        )}
        {isRunning && (
          <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 animate-pulse">
            Running
          </span>
        )}
      </div>

      {/* Time Display */}
      <div className="text-center py-4">
        <div className={`text-5xl font-mono font-bold tracking-wider ${
          isRunning ? 'text-primary' : isComplete ? 'text-primary' : 'text-fg'
        }`}>
          {formatTime(elapsed)}
        </div>
        {getDisplayTotalMinutes() > 0 && (
          <p className="text-sm text-muted-fg mt-2">
            Total: {formatDurationLong(getDisplayTotalMinutes())}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        {!isRunning && !activeSession && (
          <button
            onClick={startTimer}
            className="flex-1 bg-primary text-dark py-3 rounded-lg font-medium flex items-center justify-center gap-2 active:opacity-90"
          >
            <Play className="w-5 h-5" />
            {hasSessions ? 'Resume Job' : 'Start Job'}
          </button>
        )}

        {isRunning && (
          <button
            onClick={stopTimer}
            className="flex-1 bg-destructive text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 active:opacity-90"
          >
            <Square className="w-5 h-5" />
            Stop Job
          </button>
        )}
      </div>

      {/* Sessions List */}
      {hasSessions && (
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="w-full flex items-center justify-between text-sm text-muted-fg hover:text-fg transition-colors"
          >
            <span>{job.sessions.length} session{job.sessions.length !== 1 ? 's' : ''}</span>
            {showSessions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSessions && (
            <div className="mt-3 space-y-2">
              {job.sessions.map((session, index) => (
                <div key={session.id}>
                  {editingSession === session.id ? (
                    <SessionEditor
                      session={session}
                      onSave={handleSaveSession}
                      onCancel={() => setEditingSession(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between bg-slate rounded-lg p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-fg">#{index + 1}</span>
                          <span className="text-sm text-fg">
                            {formatSessionDate(session.startedAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-muted-fg" />
                          <span className="text-sm text-muted-fg">
                            {formatSessionTime(session.startedAt)}
                            {session.endedAt ? (
                              <> - {formatSessionTime(session.endedAt)}</>
                            ) : (
                              <span className="text-primary ml-1">(running)</span>
                            )}
                          </span>
                        </div>
                        {session.durationMin && session.durationMin > 0 && (
                          <div className="text-xs text-muted-fg mt-1">
                            {formatDurationLong(session.durationMin)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingSession(session.id)}
                          className="p-2 text-muted-fg hover:text-fg hover:bg-muted rounded-lg transition-colors"
                          title="Edit session times"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="p-2 text-muted-fg hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Delete session"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
