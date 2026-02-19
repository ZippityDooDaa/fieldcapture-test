'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceNote } from '@/types';
import { addVoiceNote, getVoiceNotesByJob, deleteVoiceNote, updateVoiceNote } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { Mic, Square, Play, Pause, Trash2, Sparkles } from 'lucide-react';

interface VoiceRecorderProps {
  jobId: string;
  onVoiceNotesChange?: () => void;
}

export default function VoiceRecorder({ jobId, onVoiceNotesChange }: VoiceRecorderProps) {
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimeRef = useRef<number>(0);

  // Load voice notes
  const loadVoiceNotes = useCallback(async () => {
    const existing = await getVoiceNotesByJob(jobId);
    setVoiceNotes(existing);
  }, [jobId]);

  useEffect(() => {
    loadVoiceNotes();
  }, [loadVoiceNotes]);

  async function transcribeAudio(audioBlob: string): Promise<string | null> {
    try {
      // Convert base64 to blob
      const response = await fetch(audioBlob);
      const blob = await response.blob();
      
      // Create form data for Groq API
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'en');
      
      const apiResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY || ''}`,
        },
        body: formData,
      });

      if (!apiResponse.ok) {
        console.error('Transcription failed:', await apiResponse.text());
        return null;
      }

      const data = await apiResponse.json();
      return data.text || null;
    } catch (err) {
      console.error('Transcription error:', err);
      return null;
    }
  }

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
        // Get the actual final duration from the ref
        const finalDuration = recordingTimeRef.current;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const voiceNote: VoiceNote = {
            id: uuidv4(),
            jobId,
            audioBlob: base64data,
            duration: finalDuration > 0 ? finalDuration : 1,
            createdAt: Date.now(),
          };
          await addVoiceNote(voiceNote);
          await loadVoiceNotes();
          onVoiceNotesChange?.();
          
          // Auto-transcribe after saving
          setTranscribingId(voiceNote.id);
          const transcript = await transcribeAudio(base64data);
          if (transcript) {
            const updatedVoiceNote = { ...voiceNote, transcript };
            await updateVoiceNote(updatedVoiceNote);
            await loadVoiceNotes();
          }
          setTranscribingId(null);
        };
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          recordingTimeRef.current = newTime;
          return newTime;
        });
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
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-fg">Voice Notes</h3>
        <span className="text-sm text-muted-fg">{voiceNotes.length} note{voiceNotes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Voice Notes List */}
      {voiceNotes.length > 0 && (
        <div className="space-y-2 mb-4">
          {voiceNotes.map((note) => (
            <div key={note.id} className="flex flex-col gap-2 bg-slate p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => playingId === note.id ? pauseVoiceNote() : playVoiceNote(note)}
                  disabled={transcribingId === note.id}
                  className="w-10 h-10 bg-primary text-dark rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                >
                  {playingId === note.id ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg">
                    {formatTime(note.duration)}
                  </p>
                  <p className="text-xs text-muted-fg">
                    {new Date(note.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-2 text-muted-fg hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {/* Transcript */}
              {transcribingId === note.id && (
                <div className="flex items-center gap-2 text-xs text-muted-fg animate-pulse">
                  <Sparkles className="w-3 h-3" />
                  <span>Transcribing...</span>
                </div>
              )}
              {note.transcript && (
                <div className="border-t border-border pt-2 mt-1">
                  <div className="flex items-center gap-1 text-xs text-primary mb-1">
                    <Sparkles className="w-3 h-3" />
                    <span>🎤 Transcribed</span>
                  </div>
                  <p className="text-sm text-muted-fg italic">
                    "{note.transcript}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recording Interface */}
      {isRecording ? (
        <div className="bg-destructive/10 border-2 border-destructive/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="font-mono text-lg text-fg">{formatTime(recordingTime)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="bg-destructive text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startRecording}
          className="w-full border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center gap-2 text-muted-fg hover:border-primary hover:text-primary transition-colors"
        >
          <Mic className="w-8 h-8" />
          <span className="text-sm font-medium">Record Voice Note</span>
        </button>
      )}
    </div>
  );
}
