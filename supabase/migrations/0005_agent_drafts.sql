-- Agent stage 1: suggested replies. The agent never sends; it writes a draft a person sends, edits or dismisses.
create table public.wa_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,
  for_message_id uuid references public.wa_messages(id) on delete set null, -- the inbound message it answers
  status text not null default 'pending' check (status in ('pending', 'sent', 'dismissed', 'superseded', 'error')),
  body text,
  needs_human boolean not null default false,
  reason text,                    -- why it needs a person, or a short note on what it relied on
  error text,
  model text,
  input_tokens integer,
  output_tokens integer,
  requested_by text,              -- null when drafted automatically on an inbound message
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index wa_drafts_conv_idx on public.wa_drafts (conversation_id, created_at desc);

alter table public.wa_drafts enable row level security;
create policy "members read drafts" on public.wa_drafts for select to authenticated using (public.wa_is_member());
create policy "members update drafts" on public.wa_drafts for update to authenticated using (public.wa_is_member()) with check (public.wa_is_member());

alter publication supabase_realtime add table public.wa_drafts;

-- Members may edit a number's agent settings (house rules, auto-draft on/off).
create policy "members update numbers" on public.wa_numbers for update to authenticated using (public.wa_is_member()) with check (public.wa_is_member());
