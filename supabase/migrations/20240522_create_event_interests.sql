create table if not exists public.event_interests (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint event_interests_pkey primary key (id),
  constraint event_interests_user_event_unique unique (user_id, event_id)
);

alter table public.event_interests enable row level security;

create policy "Users can view all interests"
  on public.event_interests for select
  using (true);

create policy "Users can insert their own interests"
  on public.event_interests for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own interests"
  on public.event_interests for delete
  using (auth.uid() = user_id);
