-- WhatsApp inbox: core tables.
-- Multi-number from day one: every conversation and message belongs to a phone_number_id.
-- All tables are prefixed wa_ so they can live in public alongside anything else.

-- People allowed into the inbox (Grant and Tracy). RLS checks this list.
create table public.wa_members (
  email text primary key,
  display_name text,
  added_at timestamptz not null default now()
);

create or replace function public.wa_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wa_members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- One row per WhatsApp business phone number (Moissanite SA now, JDP later).
create table public.wa_numbers (
  phone_number_id text primary key,          -- Meta's Phone number ID
  waba_id text,                              -- WhatsApp Business Account ID
  display_phone_number text,
  label text,                                -- e.g. 'Moissanite SA', 'JDP'
  -- Reserved for the agent phase: per-number instructions, tone, etc. Not used in v1.
  agent_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.wa_conversations (
  id uuid primary key default gen_random_uuid(),
  phone_number_id text not null references public.wa_numbers(phone_number_id),
  wa_id text not null,                       -- customer's WhatsApp ID (their number)
  contact_name text,
  last_message_at timestamptz,
  last_message_preview text,
  last_inbound_at timestamptz,               -- drives the 24-hour customer service window
  unread_count integer not null default 0,
  -- Reserved for the agent phase: who is replying, and whether the agent has asked a human to take over.
  handled_by text not null default 'human' check (handled_by in ('human', 'agent')),
  handover_requested boolean not null default false,
  created_at timestamptz not null default now(),
  unique (phone_number_id, wa_id)
);
create index wa_conversations_list_idx
  on public.wa_conversations (phone_number_id, last_message_at desc nulls last);

create table public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,
  phone_number_id text not null references public.wa_numbers(phone_number_id),
  wamid text unique,                         -- Meta's message ID; dedupes webhook retries
  direction text not null check (direction in ('in', 'out')),
  type text not null,                        -- text, image, document, audio, template, ...
  body text,                                 -- text body or media caption
  media_id text,
  media_mime text,
  media_filename text,
  media_path text,                           -- path in the wa-media storage bucket once downloaded
  status text,                               -- out: sent, delivered, read, failed
  error jsonb,
  sent_by_email text,                        -- which of us sent an outbound message
  sent_at timestamptz not null default now(),-- WhatsApp's timestamp
  raw jsonb,
  created_at timestamptz not null default now()
);
create index wa_messages_thread_idx on public.wa_messages (conversation_id, sent_at);

-- Every webhook delivery, verbatim, so nothing is ever lost even if processing fails.
create table public.wa_webhook_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  processed_at timestamptz,
  error text
);

-- Record an inbound message atomically: upsert the conversation, insert the message
-- (ignoring retries of the same wamid) and bump unread / window state.
create or replace function public.wa_record_inbound(
  p_phone_number_id text,
  p_display_phone_number text,
  p_wa_id text,
  p_contact_name text,
  p_wamid text,
  p_type text,
  p_body text,
  p_media_id text,
  p_media_mime text,
  p_media_filename text,
  p_sent_at timestamptz,
  p_raw jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv uuid;
  v_msg uuid;
begin
  insert into wa_numbers (phone_number_id, display_phone_number)
  values (p_phone_number_id, p_display_phone_number)
  on conflict (phone_number_id) do update
    set display_phone_number = coalesce(wa_numbers.display_phone_number, excluded.display_phone_number);

  insert into wa_conversations (phone_number_id, wa_id, contact_name)
  values (p_phone_number_id, p_wa_id, p_contact_name)
  on conflict (phone_number_id, wa_id) do update
    set contact_name = coalesce(excluded.contact_name, wa_conversations.contact_name)
  returning id into v_conv;

  insert into wa_messages (conversation_id, phone_number_id, wamid, direction, type, body,
                           media_id, media_mime, media_filename, sent_at, raw)
  values (v_conv, p_phone_number_id, p_wamid, 'in', p_type, p_body,
          p_media_id, p_media_mime, p_media_filename, p_sent_at, p_raw)
  on conflict (wamid) do nothing
  returning id into v_msg;

  if v_msg is not null then
    update wa_conversations
       set unread_count = unread_count + 1,
           last_inbound_at = greatest(coalesce(last_inbound_at, p_sent_at), p_sent_at),
           last_message_at = greatest(coalesce(last_message_at, p_sent_at), p_sent_at),
           last_message_preview = left(coalesce(p_body, '[' || p_type || ']'), 140)
     where id = v_conv;
  end if;

  return v_msg;  -- null when this was a duplicate delivery
end;
$$;

-- Apply a delivery status, only ever moving forward (sent -> delivered -> read); failed always wins.
create or replace function public.wa_apply_status(p_wamid text, p_status text, p_error jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update wa_messages
     set status = p_status,
         error = coalesce(p_error, error)
   where wamid = p_wamid
     and (
       p_status = 'failed'
       or coalesce(array_position(array['sent','delivered','read'], status), 0)
          < coalesce(array_position(array['sent','delivered','read'], p_status), 0)
     );
$$;

revoke execute on function public.wa_record_inbound from public, anon, authenticated;
revoke execute on function public.wa_apply_status from public, anon, authenticated;

-- RLS: members can read and update the inbox; only the server (service role) writes messages.
alter table public.wa_members enable row level security;
alter table public.wa_numbers enable row level security;
alter table public.wa_conversations enable row level security;
alter table public.wa_messages enable row level security;
alter table public.wa_webhook_events enable row level security;

create policy "members read members" on public.wa_members for select to authenticated using (public.wa_is_member());
create policy "members read numbers" on public.wa_numbers for select to authenticated using (public.wa_is_member());
create policy "members read conversations" on public.wa_conversations for select to authenticated using (public.wa_is_member());
create policy "members update conversations" on public.wa_conversations for update to authenticated
  using (public.wa_is_member()) with check (public.wa_is_member());
create policy "members read messages" on public.wa_messages for select to authenticated using (public.wa_is_member());
-- wa_webhook_events: no policies, service role only.

-- Live updates for the UI.
alter publication supabase_realtime add table public.wa_conversations, public.wa_messages;

-- Private bucket for downloaded media.
insert into storage.buckets (id, name, public) values ('wa-media', 'wa-media', false)
on conflict (id) do nothing;
create policy "members read media" on storage.objects for select to authenticated
  using (bucket_id = 'wa-media' and public.wa_is_member());

insert into public.wa_members (email, display_name) values
  ('grant@jdp.co.za', 'Grant'),
  ('tracy@moissanite.co.za', 'Tracy');

insert into public.wa_numbers (phone_number_id, waba_id, display_phone_number, label) values
  ('1510360822155867', '2716577155445101', '27101008760', 'Moissanite SA')
on conflict (phone_number_id) do nothing;
