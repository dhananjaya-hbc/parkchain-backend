const cron = require('node-cron');
const { query } = require('../config/db');

const initBookingCleanupCron = () => {
  // Run every 1 minute
  cron.schedule('* * * * *', async () => {
    try {
      const result = await query(
        `UPDATE bookings
         SET booking_status = 'cancelled',
             payment_status = 'failed',
             updated_at = NOW()
         WHERE booking_status = 'pending'
           AND created_at < NOW() - INTERVAL '5 minutes'
         RETURNING id`
      );

      if (result.rows.length > 0) {
        console.log(`✅ [CRON] Released ${result.rows.length} expired pending booking(s).`);
      }
    } catch (error) {
      console.error('❌ [CRON] Error cleaning up expired bookings:', error.message);
    }
  });

  console.log('🕒 Booking cleanup cron job initialized (5 min timeout).');
};

module.exports = initBookingCleanupCron;
