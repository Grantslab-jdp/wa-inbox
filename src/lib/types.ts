export type WaNumber = { phone_number_id: string; label: string | null; display_phone_number: string | null; waba_id: string | null };

export type Conversation = {
  id: string;
  phone_number_id: string;
  wa_id: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_inbound_at: string | null;
  unread_count: number;
  handled_by: "human" | "agent";
  handover_requested: boolean;
  notes: string | null;
  labels: string[];
  assigned_to: string | null;
};

export type Member = { email: string; display_name: string | null };

export type Message = {
  id: string;
  conversation_id: string;
  wamid: string | null;
  direction: "in" | "out";
  type: string;
  body: string | null;
  media_mime: string | null;
  media_filename: string | null;
  media_path: string | null;
  status: string | null;
  error: unknown;
  sent_by_email: string | null;
  sent_at: string;
};
