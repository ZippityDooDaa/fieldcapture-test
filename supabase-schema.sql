-- Enable RLS
alter table if exists jobs enable row level security;
alter table if exists clients enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view all jobs" on jobs;
drop policy if exists "Users can insert their own jobs" on jobs;
drop policy if exists "Users can update their own jobs" on jobs;
drop policy if exists "Users can delete their own jobs" on jobs;
drop policy if exists "Users can view all clients" on clients;
drop policy if exists "Users can insert clients" on clients;

-- Create tables

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  name text not null,
  created_at timestamp with time zone default now(),
  user_id text not null
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  client_ref text not null,
  client_name text not null,
  notes text default '',
  priority integer default 5,
  location text default 'OnSite',
  completed boolean default false,
  completed_at timestamp with time zone,
  sessions jsonb default '[]',
  total_duration_min integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  synced_at timestamp with time zone default now()
);

-- Indexes for performance
create index if not exists idx_jobs_user_id on jobs(user_id);
create index if not exists idx_jobs_updated_at on jobs(updated_at);

-- RLS Policies - Allow all access (device ID based, no auth required)
create policy "Allow all operations on jobs" on jobs
  for all using (true) with check (true);

create policy "Allow all operations on clients" on clients
  for all using (true) with check (true);

-- Function to update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_updated_at on jobs;
create trigger jobs_updated_at
  before update on jobs
  for each row execute function update_updated_at();
