export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          ref: string
          name: string
          created_at: string
          user_id: string
        }
        Insert: {
          id?: string
          ref: string
          name: string
          created_at?: string
          user_id: string
        }
        Update: {
          id?: string
          ref?: string
          name?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          client_ref: string
          client_name: string
          notes: string
          priority: number
          location: string
          completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
          synced_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_ref: string
          client_name: string
          notes?: string
          priority?: number
          location?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          synced_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client_ref?: string
          client_name?: string
          notes?: string
          priority?: number
          location?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          synced_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}