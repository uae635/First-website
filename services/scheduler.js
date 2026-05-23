import cron from 'node-cron';
import { getOverduePayments, getAllPendingPayments, getAllSettings } from '../db.js';
import { sendReminderEmail } from './email.js';

export function startScheduler() {
  // Run daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[scheduler] Running daily payment reminder check...');
    try {
      const settings = getAllSettings();

      const today = new Date().toISOString().slice(0, 10);
      const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const overdue = getOverduePayments();
      const allPending = getAllPendingPayments();
      const upcoming = allPending.filter(p => p.due_date >= today && p.due_date <= sevenDaysOut);

      if (overdue.length > 0 || upcoming.length > 0) {
        const result = await sendReminderEmail(settings, overdue, upcoming);
        if (result.sent) {
          console.log(`[scheduler] Reminder sent to ${result.to} — ${overdue.length} overdue, ${upcoming.length} upcoming`);
        } else {
          console.log('[scheduler] Email not configured, skipped');
        }
      } else {
        console.log('[scheduler] No overdue or upcoming payments — no email sent');
      }
    } catch (err) {
      console.error('[scheduler] Error:', err.message);
    }
  });

  console.log('[scheduler] Daily reminder scheduled for 08:00');
}
