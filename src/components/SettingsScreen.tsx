'use client';

import { useState, useEffect } from 'react';
import { Client, SUPPORT_LEVEL_COLORS, SUPPORT_LEVEL_OPTIONS } from '@/types';
import { getAllClients, saveClients, getAllJobs, saveJobs } from '@/lib/storage';
import { syncService } from '@/lib/sync';
import { ArrowLeft, Plus, Trash2, Edit2, Check, X, Building2, ArrowUpDown } from 'lucide-react';

interface SettingsScreenProps {
  onBack: () => void;
}

type SortField = 'name' | 'ref' | 'lastUsed';

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingRef, setEditingRef] = useState<string | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('lastUsed');
  const [sortReverse, setSortReverse] = useState(false);
  
  // Form state
  const [newRef, setNewRef] = useState('');
  const [newName, setNewName] = useState('');
  const [newSupportLevel, setNewSupportLevel] = useState<Client['supportLevel']>('BreakFix');
  const [editRef, setEditRef] = useState('');
  const [editName, setEditName] = useState('');
  const [editSupportLevel, setEditSupportLevel] = useState<Client['supportLevel']>('BreakFix');

  useEffect(() => {
    loadClients();
  }, [sortField, sortReverse]);

  async function loadClients() {
    setLoading(true);
    let allClients = await getAllClients();
    
    // Sort clients
    allClients.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'ref':
          comparison = a.ref.localeCompare(b.ref);
          break;
        case 'lastUsed':
          comparison = (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
          break;
      }
      
      return sortReverse ? -comparison : comparison;
    });
    
    setClients(allClients);
    setLoading(false);
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newRef.trim() || !newName.trim()) return;

    const ref = newRef.trim().toUpperCase();
    
    // Check if ref already exists
    if (clients.some(c => c.ref === ref)) {
      alert('Client reference already exists');
      return;
    }

    const newClient: Client = {
      id: crypto.randomUUID(),
      ref,
      name: newName.trim(),
      supportLevel: newSupportLevel,
      createdAt: Date.now(),
      lastUsedAt: 0,
    };

    const updatedClients = [...clients, newClient];
    await saveClients(updatedClients);
    setClients(updatedClients);
    
    // Reset form
    setNewRef('');
    setNewName('');
    setNewSupportLevel('BreakFix');
    setIsAdding(false);
  }

  async function handleEditClient(client: Client) {
    if (!editName.trim() || !editRef.trim()) return;

    const newName = editName.trim();
    const newRef = editRef.trim().toUpperCase();
    const oldRef = client.ref;

    // Check if new ref already exists (and it's not the current client)
    if (newRef !== oldRef && clients.some(c => c.ref === newRef)) {
      alert('Client reference already exists');
      return;
    }

    // Build updated client
    const updatedClient: Client = {
      ...client,
      ref: newRef,
      name: newName,
      supportLevel: editSupportLevel,
    };

    // If ref changed, we need to remove old and add new
    let updatedClients: Client[];
    if (newRef !== oldRef) {
      updatedClients = clients.filter(c => c.ref !== oldRef);
      updatedClients.push(updatedClient);
    } else {
      updatedClients = clients.map(c =>
        c.ref === oldRef ? updatedClient : c
      );
    }

    await saveClients(updatedClients);

    // Cascade changes to local jobs
    const allJobs = await getAllJobs();
    const affected = allJobs.map(j => {
      if (j.clientRef === oldRef) {
        return {
          ...j,
          clientRef: newRef,
          clientName: newName,
          synced: 0
        };
      }
      return j;
    });
    await saveJobs(affected);
    window.dispatchEvent(new CustomEvent('jobs-updated'));

    // Push to server
    syncService.syncToServer();

    setClients(updatedClients);
    setEditingRef(null);
    setEditRef('');
    setEditName('');
  }

  async function handleDeleteClient(ref: string) {
    if (!confirm('Delete this client? This will not delete their jobs.')) return;
    
    const updatedClients = clients.filter(c => c.ref !== ref);
    await saveClients(updatedClients);
    setClients(updatedClients);
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-card border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-slate rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-fg" />
            </button>
            <h1 className="text-lg font-bold" style={{ color: '#a8d600' }}>Settings</h1>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-primary text-dark px-3 py-1.5 rounded-lg font-medium active:opacity-90 text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Add Client Form */}
        {isAdding && (
          <div className="bg-card border border-border rounded-lg p-4 mb-4">
            <h2 className="font-semibold text-fg mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              New Client
            </h2>
            <form onSubmit={handleAddClient} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Reference Code</label>
                <input
                  type="text"
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value.toUpperCase())}
                  placeholder="e.g., CLIENT001"
                  className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-sm text-fg placeholder-muted-fg focus:outline-none focus:border-primary"
                  required
                />
                <p className="text-xs text-muted-fg mt-1">Unique code used to identify this client</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Client Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., ABC Plumbing"
                  className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-sm text-fg placeholder-muted-fg focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Support Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPORT_LEVEL_OPTIONS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setNewSupportLevel(level)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newSupportLevel === level
                          ? 'ring-2 ring-offset-1 ring-offset-bg'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: SUPPORT_LEVEL_COLORS[level] + '20',
                        color: SUPPORT_LEVEL_COLORS[level],
                      }}
                    >
                      {level === 'BreakFix' ? 'Break/Fix' : level}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary text-dark py-2 rounded-lg font-medium text-sm active:opacity-90"
                >
                  Add Client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewRef('');
                    setNewName('');
                    setNewSupportLevel('BreakFix');
                  }}
                  className="px-4 py-2 bg-slate text-fg rounded-lg font-medium text-sm border border-border"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Clients List Header with Sort */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-slate border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-fg flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Clients ({clients.length})
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-slate border border-border rounded px-2 py-1 text-sm text-fg"
              >
                <option value="lastUsed">Most Used</option>
                <option value="name">Name</option>
                <option value="ref">Ref</option>
              </select>
              <button
                onClick={() => setSortReverse(!sortReverse)}
                className={`p-1.5 rounded transition-colors ${sortReverse ? 'bg-primary text-dark' : 'bg-slate text-fg'}`}
                title={sortReverse ? 'Reverse order' : 'Normal order'}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="p-4 text-center text-muted-fg">Loading...</div>
          ) : clients.length === 0 ? (
            <div className="p-4 text-center text-muted-fg">
              No clients yet. Add your first client above.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {clients.map((client) => (
                <div
                  key={client.ref}
                  className="px-4 py-3 hover:bg-slate/50 transition-colors"
                >
                  {editingRef === client.ref ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editRef}
                          onChange={(e) => setEditRef(e.target.value.toUpperCase())}
                          className="w-24 px-2 py-1 bg-slate border border-border rounded text-sm text-fg font-bold"
                          style={{ 
                            backgroundColor: SUPPORT_LEVEL_COLORS[editSupportLevel] + '20',
                            color: SUPPORT_LEVEL_COLORS[editSupportLevel]
                          }}
                        />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 bg-slate border border-border rounded text-sm text-fg"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-fg mb-1 block">Support Level</label>
                        <div className="grid grid-cols-3 gap-2">
                          {SUPPORT_LEVEL_OPTIONS.map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setEditSupportLevel(level)}
                              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                                editSupportLevel === level
                                  ? 'ring-2 ring-offset-1 ring-offset-bg'
                                  : 'opacity-70 hover:opacity-100'
                              }`}
                              style={{
                                backgroundColor: SUPPORT_LEVEL_COLORS[level] + '20',
                                color: SUPPORT_LEVEL_COLORS[level],
                              }}
                            >
                              {level === 'BreakFix' ? 'Break/Fix' : level}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClient(client)}
                          className="flex-1 bg-primary text-dark py-1.5 rounded text-sm font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingRef(null);
                            setEditRef('');
                            setEditName('');
                          }}
                          className="px-4 py-1.5 bg-slate text-fg rounded text-sm border border-border"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-sm font-bold px-2 py-0.5 rounded"
                            style={{ 
                              backgroundColor: SUPPORT_LEVEL_COLORS[client.supportLevel] + '20',
                              color: SUPPORT_LEVEL_COLORS[client.supportLevel]
                            }}
                          >
                            {client.ref}
                          </span>
                          <span className="font-medium text-fg truncate">{client.name}</span>
                        </div>
                        <div className="text-xs text-muted-fg mt-0.5">
                          {client.supportLevel === 'BreakFix' ? 'Break/Fix' : client.supportLevel}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingRef(client.ref);
                            setEditRef(client.ref);
                            setEditName(client.name);
                            setEditSupportLevel(client.supportLevel);
                          }}
                          className="p-2 text-muted-fg hover:text-fg hover:bg-slate rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.ref)}
                          className="p-2 text-muted-fg hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
