// Suggested labels; any custom label can be typed too.
export const PRESET_LABELS = ["Enquiry", "Quoted", "Paid", "Shipped", "Trade", "Follow up"];

export function labelColour(label: string): string {
  let h = 0;
  for (const ch of label.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 70%)`;
}
