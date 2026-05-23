import nodemailer from 'nodemailer';

function createTransport(settings) {
  return nodemailer.createTransport({
    host: settings.email_host || 'smtp.gmail.com',
    port: parseInt(settings.email_port || '587'),
    secure: parseInt(settings.email_port || '587') === 465,
    auth: {
      user: settings.email_user,
      pass: settings.email_pass
    }
  });
}

export async function sendReminderEmail(settings, overdue, upcoming) {
  if (!settings.email_user || !settings.email_pass) {
    console.log('[email] Not configured — skipping reminder');
    return { skipped: true };
  }

  const recipient = settings.email_recipient || settings.email_user;
  const transport = createTransport(settings);

  const currency = settings.currency || 'AED';
  const fmt = (n) => `${currency} ${Number(n).toLocaleString('en', { minimumFractionDigits: 2 })}`;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  let html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f5f7fa; padding: 20px;">
  <div style="background: #1e3a5f; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 22px;">PropertyTrack</h1>
    <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Payment Reminder — ${today}</p>
  </div>
  <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px;">
`;

  if (overdue.length > 0) {
    html += `<h2 style="color: #e74c3c; margin-top: 0;">⚠ Overdue Payments (${overdue.length})</h2><table style="width:100%;border-collapse:collapse;">`;
    for (const p of overdue) {
      const tenants = JSON.parse(p.tenants_json || '[]').map(t => t.name).join(', ') || 'N/A';
      html += `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;">
          <strong>${p.property_name}</strong> — Unit ${p.unit_number}<br>
          <span style="color:#666;font-size:13px;">${tenants}</span>
        </td>
        <td style="padding:10px 0;text-align:right;">
          <span style="color:#e74c3c;font-weight:bold;">${fmt(p.amount)}</span><br>
          <span style="color:#999;font-size:12px;">Due: ${p.due_date}</span>
        </td>
      </tr>`;
    }
    html += '</table>';
  }

  if (upcoming.length > 0) {
    html += `<h2 style="color: #f4a261; margin-top: ${overdue.length ? '24px' : '0'};">📅 Upcoming Payments (${upcoming.length})</h2><table style="width:100%;border-collapse:collapse;">`;
    for (const p of upcoming) {
      const tenants = JSON.parse(p.tenants_json || '[]').map(t => t.name).join(', ') || 'N/A';
      html += `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;">
          <strong>${p.property_name}</strong> — Unit ${p.unit_number}<br>
          <span style="color:#666;font-size:13px;">${tenants}</span>
        </td>
        <td style="padding:10px 0;text-align:right;">
          <span style="font-weight:bold;">${fmt(p.amount)}</span><br>
          <span style="color:#999;font-size:12px;">Due: ${p.due_date}</span>
        </td>
      </tr>`;
    }
    html += '</table>';
  }

  if (overdue.length === 0 && upcoming.length === 0) {
    html += '<p style="color:#27ae60;text-align:center;font-size:16px;">All payments are up to date!</p>';
  }

  html += `
    <p style="margin-top: 24px; font-size: 12px; color: #999; text-align: center;">
      Sent by PropertyTrack &mdash; your property management app
    </p>
  </div>
</div>`;

  const totalOverdue = overdue.reduce((s, p) => s + p.amount, 0);
  const totalUpcoming = upcoming.reduce((s, p) => s + p.amount, 0);
  let subject = 'PropertyTrack Daily Report';
  if (overdue.length > 0) subject = `⚠ ${overdue.length} Overdue Payment${overdue.length > 1 ? 's' : ''} — ${fmt(totalOverdue)}`;
  else if (upcoming.length > 0) subject = `📅 ${upcoming.length} Payment${upcoming.length > 1 ? 's' : ''} Due Soon — ${fmt(totalUpcoming)}`;

  await transport.sendMail({ from: settings.email_user, to: recipient, subject, html });
  return { sent: true, to: recipient };
}

export async function sendTestEmail(settings) {
  const transport = createTransport(settings);
  const recipient = settings.email_recipient || settings.email_user;
  await transport.sendMail({
    from: settings.email_user,
    to: recipient,
    subject: 'PropertyTrack — Test Email',
    html: '<p>Your PropertyTrack email reminders are configured correctly!</p>'
  });
  return { sent: true, to: recipient };
}
