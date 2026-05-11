import nodemailer from "nodemailer";

type InviteEmailInput = {
  to: string;
  actionUrl: string;
  appOrigin: string;
  fullName: string;
  roleLabel: string;
  mode?: "invite" | "recovery";
};

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required email setting: ${name}`);
  }
  return value;
}

function isSmtpEnabled() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_PORT?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim() &&
    process.env.SMTP_FROM?.trim(),
  );
}

function buildInviteHtml({ actionUrl, appOrigin, fullName, roleLabel, mode = "invite" }: InviteEmailInput) {
  const safeName = fullName || "there";
  const isRecovery = mode === "recovery";
  const heading = isRecovery ? "Your access has been updated" : "You're invited";
  const actionLabel = isRecovery ? "Set Password" : "Accept Invite";
  const actionCopy = isRecovery
    ? "Use the link below to set a new password and access your account."
    : "Use the link below to activate your account and finish setting your password.";
  return `
    <div style="font-family: Georgia, serif; color: #2b241c; line-height: 1.6;">
      <p style="font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #8b5d32; margin: 0 0 12px;">
        FlockTrax Admin
      </p>
      <h2 style="margin: 0 0 12px; font-size: 28px; color: #1f2a1f;">${heading}</h2>
      <p style="margin: 0 0 12px;">Hello ${safeName},</p>
      <p style="margin: 0 0 12px;">
        ${
          isRecovery
            ? `Your FlockTrax access is active with the role <strong>${roleLabel}</strong>.`
            : `You have been invited to FlockTrax with the role <strong>${roleLabel}</strong>.`
        }
      </p>
      <p style="margin: 0 0 18px;">
        ${actionCopy}
      </p>
      <p style="margin: 0 0 20px;">
        <a
          href="${actionUrl}"
          style="display: inline-block; background: #8b572a; color: #fff8ef; text-decoration: none; padding: 12px 18px; border-radius: 12px; font-weight: 700;"
        >
          ${actionLabel}
        </a>
      </p>
      <p style="margin: 0 0 8px; font-size: 14px;">
        If the button does not open, use this link:
      </p>
      <p style="margin: 0 0 16px; font-size: 13px; word-break: break-all;">
        <a href="${actionUrl}" style="color: #425cb9;">${actionUrl}</a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #6b675f;">
        FlockTrax Admin: <a href="${appOrigin}" style="color: #425cb9;">${appOrigin}</a>
      </p>
    </div>
  `;
}

function buildInviteText({ actionUrl, appOrigin, fullName, roleLabel, mode = "invite" }: InviteEmailInput) {
  const safeName = fullName || "there";
  const isRecovery = mode === "recovery";
  return [
    "FlockTrax Admin",
    "",
    `Hello ${safeName},`,
    "",
    isRecovery
      ? `Your FlockTrax access is active with the role ${roleLabel}.`
      : `You have been invited to FlockTrax with the role ${roleLabel}.`,
    isRecovery
      ? "Use the link below to set a new password and access your account:"
      : "Use the link below to activate your account and finish setting your password:",
    "",
    actionUrl,
    "",
    `FlockTrax Admin: ${appOrigin}`,
  ].join("\n");
}

export async function sendInviteEmail(input: InviteEmailInput) {
  if (!isSmtpEnabled()) {
    throw new Error(
      "Invite email sending is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
    );
  }

  const host = readRequiredEnv("SMTP_HOST");
  const port = Number.parseInt(readRequiredEnv("SMTP_PORT"), 10);
  const user = readRequiredEnv("SMTP_USER");
  const pass = readRequiredEnv("SMTP_PASS");
  const from = readRequiredEnv("SMTP_FROM");
  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureValue ? ["1", "true", "yes", "on"].includes(secureValue) : port === 465;
  const replyTo = process.env.SMTP_REPLY_TO?.trim() || undefined;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a valid port number.");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transport.sendMail({
    from,
    to: input.to,
    replyTo,
    subject: input.mode === "recovery" ? "FlockTrax account access" : "FlockTrax account invitation",
    text: buildInviteText(input),
    html: buildInviteHtml(input),
  });
}
