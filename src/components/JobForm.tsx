'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Job, Client } from '@/types';
import { createJob, updateJob, getAllClients, seedClients, updateClientLastUsed, initDB } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, ChevronDown } from 'lucide-react';

interface JobFormProps {
  jobId?: string;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  clientRef: string;
  notes: string;
}

export default function JobForm({ jobId, onSave, onCancel }: JobFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      clientRef: '',
      notes: '',
    }
  });

  const selectedClientRef = watch('clientRef');

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    const client = clients.find(c => c.ref === selectedClientRef);
    setSelectedClientName(client?.name || '');
  }, [selectedClientRef, clients]);

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

    const now = Date.now();
    
    if (jobId) {
      // Update existing
      const existing = await import('@/lib/storage').then(m => m.getJob(jobId));
      if (existing) {
        await updateJob({
          ...existing,
          clientRef: data.clientRef,
          clientName: client.name,
          notes: data.notes,
          synced: 0,
        });
      }
    } else {
      // Create new
      const newJob: Job = {
        id: uuidv4(),
        clientRef: data.clientRef,
        clientName: client.name,
        createdAt: now,
        startedAt: null,
        endedAt: null,
        durationMin: null,
        notes: data.notes,
        synced: 0,
      };
      await createJob(newJob);
    }

    await updateClientLastUsed(data.clientRef);
    setLoading(false);
    onSave();
  }

  function handleClientSelect(client: Client) {
    setValue('clientRef', client.ref);
    setShowClientDropdown(false);
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">
          {jobId ? 'Edit Job' : 'New Job'}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Client Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowClientDropdown(!showClientDropdown)}
                className={`w-full px-4 py-3 border rounded-lg text-left flex items-center justify-between bg-white ${
                  errors.clientRef ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <span className={selectedClientName ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedClientName || 'Select a client...'}
                </span>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showClientDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {clients.map((client) => (
                    <button
                      key={client.ref}
                      type="button"
                      onClick={() => handleClientSelect(client)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-0"
                    >
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-gray-500">{client.ref}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="hidden" {...register('clientRef', { required: 'Please select a client' })} />
            {errors.clientRef && (
              <p className="text-red-500 text-sm mt-1">{errors.clientRef.message}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any notes about this job..."
            />
          </div>
        </div>

        {/* Click outside to close dropdown */}
        {showClientDropdown && (
          <div 
            className="fixed inset-0 z-0" 
            onClick={() => setShowClientDropdown(false)}
          />
        )}
      </form>

      {/* Footer */}
      <div className="bg-white border-t p-4 space-y-2 safe-area-pb">
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={loading || !selectedClientRef}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-lg disabled:bg-gray-300 active:bg-blue-700"
        >
          {loading ? 'Saving...' : jobId ? 'Save Changes' : 'Create Job'}
        </button>
        <button
          onClick={onCancel}
          className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}