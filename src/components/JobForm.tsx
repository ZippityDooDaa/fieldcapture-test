'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Job, Client, PRIORITY_COLORS, PRIORITY_LABELS } from '@/types';
import { createJob, updateJob, getAllClients, seedClients, updateClientLastUsed, initDB, parseHotText } from '@/lib/storage';
import { syncService } from '@/lib/sync';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, ChevronDown, Calendar, Clock, Flag, MapPin } from 'lucide-react';

interface JobFormProps {
  jobId?: string;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  clientRef: string;
  notes: string;
  priority: number;
}

export default function JobForm({ jobId, onSave, onCancel }: JobFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [jobDate, setJobDate] = useState(() => {
    // Use local date, not UTC
    const d = new Date();
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return localDate;
  });
  const [jobTime, setJobTime] = useState(() => {
    // Default to 00:00 for new jobs (no specific time)
    return '00:00';
  });
  const [parsedPriority, setParsedPriority] = useState<number | null>(null);
  const [parsedDate, setParsedDate] = useState<Date | null>(null);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [location, setLocation] = useState<'OnSite' | 'Remote'>('OnSite');
  
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      clientRef: '',
      notes: '',
      priority: 5,
    }
  });

  const selectedClientRef = watch('clientRef');
  const priority = watch('priority');
  const notes = watch('notes');

  useEffect(() => {
    loadClients();
    
    // If editing, load existing job data
    if (jobId) {
      loadExistingJob();
    }
  }, [jobId]);

  async function loadExistingJob() {
    if (!jobId) return;
    const { getJob } = await import('@/lib/storage');
    const existing = await getJob(jobId);
    if (existing) {
      setValue('clientRef', existing.clientRef);
      setValue('notes', existing.notes);
      setValue('priority', existing.priority);
      setLocation(existing.location || 'OnSite');
      
      const jobDateObj = new Date(existing.createdAt);
      // Use local date, not UTC
      const localDate = `${jobDateObj.getFullYear()}-${String(jobDateObj.getMonth() + 1).padStart(2, '0')}-${String(jobDateObj.getDate()).padStart(2, '0')}`;
      setJobDate(localDate);
      const hours = jobDateObj.getHours().toString().padStart(2, '0');
      const mins = jobDateObj.getMinutes().toString().padStart(2, '0');
      setJobTime(`${hours}:${mins}`);
    }
  }

  useEffect(() => {
    const client = clients.find(c => c.ref === selectedClientRef);
    setSelectedClientName(client?.name || '');
  }, [selectedClientRef, clients]);

  // Parse hot text in notes
  const notesInputRef = useRef<HTMLTextAreaElement>(null);
  const lastNotesLength = useRef<number>(0);
  
  useEffect(() => {
    if (!notes) return;
    
    // Only process if text got shorter (hot text was removed) or on initial load
    if (notes.length < lastNotesLength.current || lastNotesLength.current === 0) {
      lastNotesLength.current = notes.length;
      return;
    }
    lastNotesLength.current = notes.length;
    
    // Check for hot text patterns
    const hasHotText = /\bP[1-5]\b|\btod(?:ay)?\b|\btom(?:orrow)?\b|\bnext week\b|\bnext\s+(?:sun|mon|tue|wed|thu|fri|sat)\b/i.test(notes);
    
    if (hasHotText) {
      const parsed = parseHotText(notes);
      if (parsed.priority) {
        setParsedPriority(parsed.priority);
        setValue('priority', parsed.priority);
      }
      if (parsed.date) {
        setParsedDate(parsed.date);
        // Format date properly for local timezone
        const d = parsed.date;
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setJobDate(localDate);
      }
      // Don't auto-remove hot text anymore - let user see it highlighted
    }
  }, [notes, setValue]);

  async function loadClients() {
    await initDB();
    await seedClients();
    const allClients = await getAllClients();
    // Sort by lastUsedAt desc
    allClients.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
    setClients(allClients);
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    
    const client = clients.find(c => c.ref === data.clientRef);
    if (!client) return;

    const dateTime = new Date(`${jobDate}T${jobTime}`);
    const now = Date.now();
    
    if (jobId) {
      // Update existing
      const existing = await import('@/lib/storage').then(m => m.getJob(jobId));
      if (existing) {
        const dateTime = new Date(`${jobDate}T${jobTime}`);
        await updateJob({
          ...existing,
          clientRef: data.clientRef,
          clientName: client.name,
          notes: data.notes,
          priority: data.priority as 1 | 2 | 3 | 4 | 5,
          createdAt: dateTime.getTime(),
          location,
          synced: 0,
        });
      }
    } else {
      // Create new
      const newJob: Job = {
        id: uuidv4(),
        clientRef: data.clientRef,
        clientName: client.name,
        createdAt: dateTime.getTime(),
        sessions: [],
        totalDurationMin: 0,
        notes: data.notes,
        synced: 0,
        priority: data.priority as 1 | 2 | 3 | 4 | 5,
        completed: false,
        completedAt: null,
        location,
      };
      await createJob(newJob);
    }

    await updateClientLastUsed(data.clientRef);
    
    // Sync to server
    await syncService.syncToServer();
    
    setLoading(false);
    onSave();
  }

  function handleClientSelect(client: Client) {
    setValue('clientRef', client.ref);
    setShowClientDropdown(false);
  }

  function handlePrioritySelect(p: number) {
    setValue('priority', p);
    setShowPriorityDropdown(false);
    setParsedPriority(null);
  }

  const priorityOptions = [1, 2, 3, 4, 5];

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 -ml-2 hover:bg-slate rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-fg" />
          </button>
          <h1 className="text-lg font-semibold text-fg">
            {jobId ? 'Edit Job' : 'New Job'}
          </h1>
        </div>
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={loading || !selectedClientRef}
          className="bg-primary text-dark px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Client Select */}
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              Client <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowClientDropdown(!showClientDropdown)}
                className={`w-full px-4 py-3 border rounded-lg text-left flex items-center justify-between bg-card ${
                  errors.clientRef ? 'border-destructive' : 'border-border'
                }`}
              >
                <span className={selectedClientName ? 'text-fg' : 'text-muted-fg'}>
                  {selectedClientName || 'Select a client...'}
                </span>
                <ChevronDown className={`w-5 h-5 text-muted-fg transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showClientDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {clients.map((client) => (
                    <button
                      key={client.ref}
                      type="button"
                      onClick={() => handleClientSelect(client)}
                      className="w-full px-4 py-3 text-left hover:bg-slate border-b border-border last:border-0"
                    >
                      <div className="font-medium text-fg">{client.name}</div>
                      <div className="text-sm text-muted-fg">{client.ref}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="hidden" {...register('clientRef', { required: 'Please select a client' })} />
            {errors.clientRef && (
              <p className="text-destructive text-sm mt-1">{errors.clientRef.message}</p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-fg mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date
                {parsedDate && (
                  <span className="text-primary ml-1 text-xs">
                    (auto-date)
                  </span>
                )}
              </label>
              <input
                type="date"
                value={jobDate}
                onChange={(e) => {
                  setJobDate(e.target.value);
                  setParsedDate(null);
                }}
                className="w-full px-3 py-3 bg-card text-fg border border-border rounded-lg focus:outline-none focus:border-primary text-base"
                style={{ minWidth: '140px' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                Time
              </label>
              <input
                type="time"
                value={jobTime}
                onChange={(e) => setJobTime(e.target.value)}
                className="w-full px-3 py-3 bg-card text-fg border border-border rounded-lg focus:outline-none focus:border-primary text-base"
                style={{ minWidth: '100px' }}
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              <Flag className="w-4 h-4 inline mr-1" />
              Priority
              {parsedPriority && (
                <span className="text-primary ml-1 text-xs">
                  (auto)
                </span>
              )}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                className="w-full px-4 py-3 border border-border rounded-lg text-left flex items-center justify-between bg-card"
              >
                <span className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] }}
                  />
                  <span className="text-fg">{PRIORITY_LABELS[priority as keyof typeof PRIORITY_LABELS]}</span>
                </span>
                <ChevronDown className={`w-5 h-5 text-muted-fg transition-transform ${showPriorityDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showPriorityDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                  {priorityOptions.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePrioritySelect(p)}
                      className="w-full px-4 py-3 text-left hover:bg-slate border-b border-border last:border-0 flex items-center gap-2"
                    >
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: PRIORITY_COLORS[p as keyof typeof PRIORITY_COLORS] }}
                      />
                      <span className="text-fg">{PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLocation('OnSite')}
                className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                  location === 'OnSite'
                    ? 'bg-primary text-dark'
                    : 'bg-card border border-border text-fg hover:bg-slate'
                }`}
              >
                On Site
              </button>
              <button
                type="button"
                onClick={() => setLocation('Remote')}
                className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                  location === 'Remote'
                    ? 'bg-primary text-dark'
                    : 'bg-card border border-border text-fg hover:bg-slate'
                }`}
              >
                Remote
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              Notes
            </label>
            <textarea
              {...register('notes')}
              name="notes"
              id="job-notes"
              rows={6}
              className="w-full px-4 py-3 bg-card text-fg border border-border rounded-lg resize-none focus:outline-none focus:border-primary"
              placeholder={`Add notes...\n\nHot text:\n• tod = today, tom = tomorrow\n• next thu = next Thursday\n• next week = next Tuesday\n• P1-P5 = priority level`}
              style={{ WebkitAppearance: 'none', appearance: 'none' }}
            />
          </div>
        </div>

        {/* Click outside to close dropdowns */}
        {(showClientDropdown || showPriorityDropdown) && (
          <div 
            className="fixed inset-0 z-0" 
            onClick={() => {
              setShowClientDropdown(false);
              setShowPriorityDropdown(false);
            }}
          />
        )}
      </form>

      {/* Footer */}
      <div className="bg-card border-t border-border p-4 space-y-2 safe-area-pb">
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={loading || !selectedClientRef}
          className="w-full bg-primary text-dark py-3 rounded-lg font-medium text-lg disabled:opacity-50 active:opacity-90"
        >
          {loading ? 'Saving...' : jobId ? 'Save Changes' : 'Create Job'}
        </button>
        <button
          onClick={onCancel}
          className="w-full bg-muted text-fg py-3 rounded-lg font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
