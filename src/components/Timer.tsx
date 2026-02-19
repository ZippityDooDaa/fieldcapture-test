'use client';

import { useState, useEffect, useCallback } from 'react';
import { Job } from '@/types';
import { updateJob } from '@/lib/storage';
import { Play, Square, Pause, RotateCcw } from 'lucide-react';

interface TimerProps {
  job: Job;
  onUpdate: () => void;
}

export default function Timer({ job, onUpdate }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Calculate initial elapsed time from job data
  useEffect(() => {
    if (job.startedAt && job.endedAt) {
      // Job is complete
      const duration = Math.floor((job.endedAt - job.startedAt) / 1000 / 60);
      setElapsed(duration * 60); // Convert to seconds for display
      setIsRunning(false);
    } else if (job.startedAt && !job.endedAt) {
      // Job is running
      const now = Date.now();
      const seconds = Math.floor((now - job.startedAt) / 1000);
      setElapsed(seconds);
      setIsRunning(true);
    } else {
      // Job hasn't started
      setElapsed(0);
      setIsRunning(false);
    }
  }, [job]);

  // Update timer every second when running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  async function startTimer() {
    const now = Date.now();
    await updateJob({
      ...job,
      startedAt: now,
      endedAt: null,
      durationMin: null,
    });
    setIsRunning(true);
    setElapsed(0);
    onUpdate();
  }

  async function stopTimer() {
    const now = Date.now();
    const durationMin = Math.floor((now - (job.startedAt || now)) / 1000 / 60);
    await updateJob({
      ...job,
      endedAt: now,
      durationMin: durationMin > 0 ? durationMin : 1,
    });
    setIsRunning(false);
    setElapsed(durationMin * 60);
    onUpdate();
  }

  async function resetTimer() {
    if (confirm('Reset timer? This will clear the current session.')) {
      await updateJob({
        ...job,
        startedAt: null,
        endedAt: null,
        durationMin: null,
      });
      setIsRunning(false);
      setElapsed(0);
      onUpdate();
    }
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

  const isComplete = !!job.endedAt;

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Job Timer</h3>
        {isComplete && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
            Complete
          </span>
        )}
        {isRunning && (
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 animate-pulse">
            Running
          </span>
        )}
      </div>

      {/* Time Display */}
      <div className="text-center py-4">
        <div className={`text-5xl font-mono font-bold tracking-wider ${
          isRunning ? 'text-blue-600' : isComplete ? 'text-green-600' : 'text-gray-700'
        }`}>
          {formatTime(elapsed)}
        </div>
        {job.durationMin && isComplete && (
          <p className="text-sm text-gray-500 mt-2">
            Total: {job.durationMin} minute{job.durationMin !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isRunning && !isComplete && (
          <button
            onClick={startTimer}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 active:bg-blue-700"
          >
            <Play className="w-5 h-5" />
            Start Job
          </button>
        )}

        {isRunning && (
          <button
            onClick={stopTimer}
            className="flex-1 bg-red-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 active:bg-red-700"
          >
            <Square className="w-5 h-5" />
            Stop Job
          </button>
        )}

        {isComplete && (
          <>
            <button
              onClick={resetTimer}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium flex items-center justify-center gap-2 active:bg-gray-200"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
            <button
              onClick={startTimer}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 active:bg-blue-700"
            >
              <Play className="w-5 h-5" />
              Resume
            </button>
          </>
        )}
      </div>
    </div>
  );
}