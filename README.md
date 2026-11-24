# WhatsApp inbox

Mobile-first inbox (PWA) for our WhatsApp Business numbers on the Meta Cloud API.
Multi-number from day one: every conversation belongs to a `phone_number_id`.
It is the human side of a future agent setup (`handled_by`, `handover_requested`, `wa_numbers.agent_config` are reserved for that).

## Pieces

- `src/app/api/whatsapp/webhook/route.ts` — Meta webhook. `GET` answers the verify-token handshake; `POST` checks `X-Hub-Signature-256` against the app secret, stores the delivery verbatim in `wa_webhook_events`, returns 200, then (after the response) records messages/statuses and downloads media into the private `wa-media` bucket.
- `supabase/migrations/` — tables live in the Moissanite SA Supabase project, all prefixed `wa_`, with RLS limited to emails in `wa_members`.
- `scripts/send-test-webhook.mjs <url> <appSecret>` — posts a signed fake inbound message.

## Environment (Vercel only, never in code)

See `.env.example`. The access token must be a permanent System User token.
