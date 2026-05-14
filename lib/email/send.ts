import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "ArachNet <hello@arachnet.app>";

export async function sendWelcomeEmail(to: string, planLabel: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You're in — welcome to ArachNet",
    text: [
      `Welcome to ArachNet (${planLabel} plan).`,
      "",
      "Your workspace is ready. Your first daily decision digest will land tomorrow at 7am.",
      "",
      "Get started: https://app.arachnet.app/today",
      "",
      "— The ArachNet team",
    ].join("\n"),
  });
}

export async function sendCancellationEmail(to: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your ArachNet subscription has been cancelled",
    text: [
      "Your ArachNet subscription has been cancelled.",
      "",
      "Your data will be retained for 30 days. You can reactivate anytime at arachnet.app/pricing.",
      "",
      "— The ArachNet team",
    ].join("\n"),
  });
}

export async function sendPaymentFailedEmail(to: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Action required: ArachNet payment failed",
    text: [
      "We couldn't process your ArachNet payment.",
      "",
      "Please update your payment method to keep your subscription active:",
      "https://app.arachnet.app/settings/billing",
      "",
      "— The ArachNet team",
    ].join("\n"),
  });
}
