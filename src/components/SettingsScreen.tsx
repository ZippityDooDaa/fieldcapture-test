'use client';

import { useState, useEffect } from 'react';
import { Client } from '@/types';
import { getAllClients, saveClients, updateClientLastUsed } from '@/lib/storage';
import { ArrowLeft, Plus, Trash2, Edit2, Check, X, Building2 } from 'lucide-react';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingRef, setEditingRef] = useState<string | null>(null);
  
  // Form state
  const [newRef, setNewRef] = useState('');
  const [newName, setNewName] = useState('');
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    const allClients = await getAllClients();
    // Sort by last used (most recent first)
    allClients.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
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
      lastUsedAt: 0,
    };

    const updatedClients = [...clients, newClient];
    await saveClients(updatedClients);
    setClients(updatedClients);
    
    // Reset form
    setNewRef('');
    setNewName('');
    setIsAdding(false);
  }

  async function handleEditClient(client: Client) {
    if (!editName.trim()) return;
    
    const updatedClients = clients.map(c => 
      c.ref === client.ref ? { ...c, name: editName.trim() } : c
    );
    
    await saveClients(updatedClients);
    setClients(updatedClients);
    setEditingRef(null);
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
            <h1 className="text-lg font-bold text-fg">Settings</h1>
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
                  }}
                  className="px-4 py-2 bg-slate text-fg rounded-lg font-medium text-sm border border-border"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Clients List */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-slate border-b border-border">
            <h2 className="font-semibold text-fg flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Clients ({clients.length})
            </h2>
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
                  className="px-4 py-3 flex items-center justify-between hover:bg-slate/50 transition-colors"
                >
                  {editingRef === client.ref ? (
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-fg">{client.ref}</span>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate border border-border rounded text-sm text-fg"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditClient(client)}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingRef(null);
                          setEditName('');
                        }}
                        className="p-1.5 text-muted-fg hover:bg-slate rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="font-medium text-fg truncate">{client.name}</div>
                        <div className="text-xs text-muted-fg">{client.ref}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingRef(client.ref);
                            setEditName(client.name);
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
                    </>
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
