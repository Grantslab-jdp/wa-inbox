-- Outbound media: members upload straight to storage under out/, then the server forwards it to WhatsApp.
create policy "wa members upload outbound media" on storage.objects for insert to authenticated
  with check (bucket_id = 'wa-media' and (storage.foldername(name))[1] = 'out' and public.wa_is_member());

-- Saved snippets for things we say often. phone_number_id null = available on every number.
create table public.wa_quick_replies (
  id uuid primary key default gen_random_uuid(),
  phone_number_id text references public.wa_numbers(phone_number_id) on delete cascade,
  title text not null,
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.wa_quick_replies enable row level security;
create policy "members manage quick replies" on public.wa_quick_replies for all to authenticated
  using (public.wa_is_member()) with check (public.wa_is_member());
