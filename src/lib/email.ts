import { Resend } from "resend";

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
};

type NewPostEmailParams = {
  postId: string;
  title: string;
  authorEmail: string;
    preview: string;
};

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const defaultFrom = process.env.NOTIFY_EMAIL_FROM?.trim();

  // Keep core app flows working if email is not configured.
  if (!apiKey || !(params.from ?? defaultFrom)) {
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: params.from ?? defaultFrom!,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new Error(error.message || "Failed to send email");
  }
}

export async function sendNewPostEmail(params: NewPostEmailParams): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3333";
  const recipient = process.env.NEW_POST_NOTIFY_EMAIL?.trim() || "reilabs@astrorei.io";
  const postUrl = `${appUrl.replace(/\/$/, "")}/post/${params.postId}`;
    const previewHtml = params.preview;

  await sendEmail({
    from: process.env.NOTIFY_EMAIL_FROM?.trim() || "ReiLabs <no-reply@astrorei.io>",
    to: recipient,
    subject: `New post created: ${params.title}`,
      html: `
      <div style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1f2937;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1f2937);color:#ffffff;">
            <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">ReiLabs</p>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;">
              <h1 style="margin:0;font-size:22px;line-height:1.3;">New Post Published</h1>
              <a
                href="${postUrl}"
                style="display:inline-block;background:#ffffff;color:#111827;text-decoration:none;padding:8px 12px;border-radius:8px;font-weight:600;font-size:13px;white-space:nowrap;"
              >
                Open Post
              </a>
            </div>
          </div>

          <div style="padding:24px;">
            <p style="margin:0 0 10px;font-size:14px;color:#4b5563;">Author: <strong style="color:#111827;">${params.authorEmail}</strong></p>
            <h2 style="margin:0 0 12px;font-size:20px;line-height:1.35;color:#111827;">${params.title}</h2>
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;">Post Content</p>
            <div style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">${previewHtml}</div>

            <a
              href="${postUrl}"
              style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px;"
            >
              Open Post
            </a>
          </div>
        </div>

        <p style="max-width:620px;margin:14px auto 0;font-size:12px;color:#6b7280;">This notification was sent automatically by ReiLabs.</p>
      </div>
    `,
  });
}