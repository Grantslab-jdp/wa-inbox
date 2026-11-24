// Usage: node scripts-send-test.mjs <url> <appSecret>  — posts a signed fake inbound text message.
import { createHmac } from "node:crypto";
const [url, secret] = process.argv.slice(2);
const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "TEST", changes: [{ field: "messages", value: {
  messaging_product: "whatsapp", metadata: { phone_number_id: "TEST_PNID", display_phone_number: "27000000000" },
  contacts: [{ wa_id: "27820000000", profile: { name: "Test Customer" } }],
  messages: [{ id: "wamid.TEST" + Date.now(), from: "27820000000", timestamp: String(Math.floor(Date.now()/1000)), type: "text", text: { body: "Hello from the test script" } }] } }] }] });
const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body });
console.log(r.status, await r.text());
