alter table public.wa_conversations
  add column notes text,
  add column labels text[] not null default '{}',
  add column assigned_to text;

-- Website orders for a WhatsApp contact, matched on phone number (0821234567 / +27 82 123 4567 / 27821234567).
create or replace function public.wa_orders_for(p_wa_id text)
returns table (id uuid, ref text, amount_zar numeric, status text, created_at timestamptz, name text)
language sql stable security definer set search_path = public as $$
  select o.id, o.m_payment_id, o.amount_zar, o.status, o.created_at, trim(coalesce(o.first_name,'') || ' ' || coalesce(o.last_name,''))
  from orders o
  where public.wa_is_member()
    and p_wa_id ~ '^\d{8,15}$'
    and regexp_replace(regexp_replace(coalesce(o.phone,''), '\D', '', 'g'), '^0', '27') = p_wa_id
  order by o.created_at desc
  limit 20;
$$;
revoke execute on function public.wa_orders_for from public, anon;
grant execute on function public.wa_orders_for to authenticated;
