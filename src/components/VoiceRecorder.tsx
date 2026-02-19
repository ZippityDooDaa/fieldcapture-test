'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceNote } from '@/types';
import { addVoiceNote, getVoiceNotesByJob, deleteVoiceNote } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react';

interface VoiceRecorderProps {
  jobId: string;
  onVoiceNotesChange?: () => void;
}

export default function VoiceRecorder({ jobId, onVoiceNotesChange }: VoiceRecorderProps) {
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load voice notes
  const loadVoiceNotes = useCallback(async () => {
    const existing = await getVoiceNotesByJob(jobId);
    setVoiceNotes(existing);
  }, [jobId]);

  useEffect(() => {
    loadVoiceNotes();
  }, [loadVoiceNotes]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const voiceNote: VoiceNote = {
            id: uuidv4(),
            jobId,
            audioBlob: base64data,
            duration: recordingTime,
            createdAt: Date.now(),
          };
          await addVoiceNote(voiceNote);
          await loadVoiceNotes();
          onVoiceNotesChange?.();
        };
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Recording error:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function playVoiceNote(voiceNote: VoiceNote) {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(voiceNote.audioBlob);
    audioRef.current = audio;
    setPlayingId(voiceNote.id);
    
    audio.play();
    audio.onended = () => {
      setPlayingId(null);
    };
  }

  function pauseVoiceNote() {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
    }
  }

  async function handleDelete(voiceNoteId: string) {
    if (confirm('Delete this voice note?')) {
      await deleteVoiceNote(voiceNoteId);
      await loadVoiceNotes();
      onVoiceNotesChange?.();
    }
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Voice Notes</h3>
        <span className="text-sm text-gray-500">{voiceNotes.length} note{voiceNotes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Voice Notes List */}
      {voiceNotes.length > 0 && (
        <div className="space-y-2 mb-4">
          {voiceNotes.map((note) => (
            <div key={note.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
              <button
                onClick={() => playingId === note.id ? pauseVoiceNote() : playVoiceNote(note)}
                className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0"
              >
                {playingId === note.id ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600">
                  {formatTime(note.duration)}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(note.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(note.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recording Interface */}
      {isRecording ? (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="font-mono text-lg">{formatTime(recordingTime)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startRecording}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg py-6 flex flex-col items-center gap-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Mic className="w-8 h-8" />
          <span className="text-sm font-medium">Record Voice Note</span>
        </button>
      )}
    </div>
  );
}