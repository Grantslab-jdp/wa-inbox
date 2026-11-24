-- Outbound messages, read state, web push.

-- Record a message we sent through the Cloud API and move the conversation to the top.
create or replace function public.wa_record_outbound(
  p_conversation_id uuid,
  p_wamid text,
  p_type text,
  p_body text,
  p_sent_by_email text,
  p_raw jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_msg uuid; v_pnid text;
begin
  select phone_number_id into v_pnid from wa_conversations where id = p_conversation_id;
  insert into wa_messages (conversation_id, phone_number_id, wamid, direction, type, body, status, sent_by_email, sent_at, raw)
  values (p_conversation_id, v_pnid, p_wamid, 'out', p_type, p_body, 'sent', p_sent_by_email, now(), p_raw)
  returning id into v_msg;
  update wa_conversations
     set last_message_at = now(),
         last_message_preview = left(coalesce(p_body, '[' || p_type || ']'), 140)
   where id = p_conversation_id;
  return v_msg;
end;
$$;
revoke execute on function public.wa_record_outbound from public, anon, authenticated;

-- Browser push subscriptions (one per device).
create table public.wa_push_subscriptions (
  endpoint text primary key,
  email text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.wa_push_subscriptions enable row level security;
-- service role only

-- Server-side settings (e.g. the VAPID key pair for web push, generated on first use).
create table public.wa_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.wa_config enable row level security;
-- service role only
