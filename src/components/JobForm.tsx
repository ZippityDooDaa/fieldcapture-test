'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Job, Client, PRIORITY_COLORS, PRIORITY_LABELS, SUPPORT_LEVEL_COLORS } from '@/types';
import { getAllClients, seedClients, updateClientLastUsed, parseHotText, updateJob, createJob, getJob } from '@/lib/storage';
import { syncService } from '@/lib/sync';
import { ArrowLeft, Save, Calendar, Clock, Flag, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface JobFormProps {
  jobId?: string;
  onSave: () => void;
  onCancel: () => void;
}

interface JobFormData {
  clientRef: string;
  notes: string;
  priority: string;
}

export default function JobForm({ jobId, onSave, onCancel }: JobFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [parsedPriority, setParsedPriority] = useState<number | null>(null);
  const [parsedDate, setParsedDate] = useState<Date | null>(null);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [location, setLocation] = useState<'OnSite' | 'Remote'>('OnSite');
  
  const filteredClients = clients.filter(client => {
    const searchLower = clientSearch.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.ref.toLowerCase().includes(searchLower)
    );
  });

  const priorityOptions = [1, 2, 3, 4, 5] as const;

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<JobFormData>({
    defaultValues: {
      clientRef: '',
      notes: '',
      priority: '5',
    },
  });

  const notes = watch('notes');
  const priority = watch('priority') as unknown as 1 | 2 | 3 | 4 | 5;
  const clientRef = watch('clientRef');

  useEffect(() => {
    seedClients();
    loadClients();
  }, []);

  useEffect(() => {
    if (jobId) {
      loadExistingJob();
    }
  }, [jobId]);

  const [jobDate, setJobDate] = useState(() => {
    const d = new Date();
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return localDate;
  });

  const [jobTime, setJobTime] = useState('09:00');
  const [parsedSupportLevel, setParsedSupportLevel] = useState<Client['supportLevel'] | null>(null);

  async function loadClients() {
    const allClients = await getAllClients();
    setClients(allClients);
  }

  async function loadExistingJob() {
    const { getJob } = await import('@/lib/storage');
    const existing = await getJob(jobId!);
    if (existing) {
      setValue('clientRef', existing.clientRef);
      setValue('notes', existing.notes);
      setValue('priority', String(existing.priority));
      setLocation(existing.location || 'OnSite');
      const d = new Date(existing.createdAt);
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setJobDate(localDate);
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      setJobTime(`${hours}:${mins}`);
    }
  }

  async function handleClientSelect(client: Client) {
    setValue('clientRef', client.ref);
    setClientSearch('');
    setShowClientDropdown(false);
    // Update last used
    await updateClientLastUsed(client.ref);
  }

  function handlePrioritySelect(priority: 1 | 2 | 3 | 4 | 5) {
    setValue('priority', String(priority));
    setShowPriorityDropdown(false);
  }

  // Parse hot text in notes - only when text gets shorter (hot text was removed)
  const notesInputRef = useRef<HTMLTextAreaElement>(null);
  const lastNotesLength = useRef<number>(0);
  
  useEffect(() => {
    if (!notes) return;
    
    if (notes.length < lastNotesLength.current || lastNotesLength.current === 0) {
      lastNotesLength.current = notes.length;
      return;
    }
    lastNotesLength.current = notes.length;
    
    const hasHotText = /\bP[1-5]\b|\btod(?:ay)?\b|\btom(?:orrow)?\b|\bnext week\b|\bnext\s+(?:sun|mon|tue|wed|thu|fri|sat)\b/i.test(notes);
    
    if (hasHotText) {
      const parsed = parseHotText(notes);
      if (parsed.priority) {
        setParsedPriority(parsed.priority);
        setValue('priority', String(parsed.priority));
      }
      if (parsed.date) {
        setParsedDate(parsed.date);
        const d = parsed.date;
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setJobDate(localDate);
      }
      if (parsed.text !== notes) {
        setValue('notes', parsed.text, { shouldValidate: false });
      }
    }
  }, [notes, setValue]);

  async function onSubmit(data: JobFormData) {
    const dateTime = new Date(`${jobDate}T${jobTime}`);
    
    // Check if client exists
    const client = clients.find(c => c.ref === data.clientRef);
    if (!client) {
      alert('Please select a valid client');
      return;
    }
    
    // Update client last used
    await updateClientLastUsed(data.clientRef);
    
    if (jobId) {
      const existing = await getJob(jobId);
      if (existing) {
        await updateJob({
          ...existing,
          clientRef: data.clientRef,
          clientName: client.name,
          notes: data.notes,
          priority: data.priority as unknown as 1 | 2 | 3 | 4 | 5,
          createdAt: dateTime.getTime(),
          location,
          synced: 0,
        });
        await syncService.syncToServer();
        await syncService.forceSync();
      }
    } else {

      const newJob: Job = {
        id: crypto.randomUUID(),
        clientRef: data.clientRef,
        clientName: client.name,
        createdAt: dateTime.getTime(),
        sessions: [],
        totalDurationMin: 0,
        notes: data.notes,
        synced: 0,
        priority: data.priority as unknown as 1 | 2 | 3 | 4 | 5,
        completed: false,
        completedAt: null,
        location,
      };
      await createJob(newJob);
      await syncService.syncToServer();
      await syncService.forceSync();
    }
    
    setParsedPriority(null);
    setParsedDate(null);
    setJobDate(() => {
      const d = new Date();
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return localDate;
    });
    setJobTime('09:00');
    setValue('notes', '');
    setValue('priority', '5');
    setValue('clientRef', '');
    
    onSave();
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="bg-card border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 -ml-2 hover:bg-slate rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-fg" />
            </button>
            <h1 className="text-lg font-bold" style={{ color: '#a8d600' }}>
              {jobId ? 'Edit Job' : 'New Job'}
            </h1>
          </div>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 bg-primary text-dark px-3 py-1.5 rounded-lg font-medium active:opacity-90"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save</span>
            <span className="sm:hidden">✓</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Client Search */}
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Client
            </label>
            <div className="relative">
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                placeholder="Search by name or reference..."
                className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-sm text-fg placeholder-muted-fg focus:outline-none focus:border-primary"
              />
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredClients.map((client) => (
                    <button
                      key={client.ref}
                      type="button"
                      onClick={() => handleClientSelect(client)}
                      className="w-full px-4 py-3 text-left hover:bg-slate border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="font-bold px-2 py-0.5 rounded text-sm"
                          style={{ 
                            backgroundColor: SUPPORT_LEVEL_COLORS[client.supportLevel] + '20',
                            color: SUPPORT_LEVEL_COLORS[client.supportLevel]
                          }}
                        >
                          {client.ref}
                        </span>
                        <span className="text-fg">{client.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {clientRef && clients.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ 
                    backgroundColor: SUPPORT_LEVEL_COLORS[clients.find(c => c.ref === clientRef)?.supportLevel || 'BreakFix'] + '20',
                    color: SUPPORT_LEVEL_COLORS[clients.find(c => c.ref === clientRef)?.supportLevel || 'BreakFix']
                  }}>
                    {clientRef}
                  </span>
                </div>
              )}
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
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-sm text-fg focus:outline-none focus:border-primary"
                  >
                    {priorityOptions.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                )}
              />
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

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-fg mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date
                {parsedDate && (
                  <span className="text-primary ml-1 text-xs">
                    (auto)
                  </span>
                )}
              </label>
              <input
                type="date"
                value={jobDate}
                onChange={(e) => setJobDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-sm text-fg focus:outline-none focus:border-primary"
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
                className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-sm text-fg focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-fg mb-1">Notes</label>
            <textarea
              ref={notesInputRef}
              value={notes}
              onChange={(e) => setValue('notes', e.target.value, { shouldValidate: false })}
              placeholder="Job details..."
              className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-sm text-fg placeholder-muted-fg focus:outline-none focus:border-primary h-32 resize-none"
            />
            {parsedPriority && (
              <div className="mt-1 text-xs text-primary">
                Detected P{parsedPriority} priority
              </div>
            )}
            {parsedDate && (
              <div className="mt-1 text-xs text-primary">
                Detected {parsedDate.toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}