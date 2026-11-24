// WhatsApp's customer service window: free-form replies are allowed for 24 hours after
// the customer's last message. Outside it, only approved templates can be sent.
export const WINDOW_MS = 24 * 60 * 60 * 1000;

export function windowClosesAt(lastInboundAt: string | null): number | null {
  return lastInboundAt ? new Date(lastInboundAt).getTime() + WINDOW_MS : null;
}

export function windowOpen(lastInboundAt: string | null, now = Date.now()): boolean {
  const closes = windowClosesAt(lastInboundAt);
  return closes !== null && now < closes;
}
