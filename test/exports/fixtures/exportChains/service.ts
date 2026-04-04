import { canonicalizeEmail } from "./formattingBridge";

export function sendWelcomeEmail(email: string) {
  const canonical = canonicalizeEmail(email);
  // pretend to send email
  return `Sent welcome email to ${canonical}`;
}
