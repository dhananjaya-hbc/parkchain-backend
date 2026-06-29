const cron = require('node-cron');
const { query } = require('../config/db');
const { fireEvent, EVENTS } = require('../events/NotificationEvents');

const initBookingReminderCron = () => {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log('[CRON] Running booking reminder check...');
      
      // Select upcoming bookings starting in the next 20 minutes
      const result = await query(
        `SELECT b.id, b.driver_id, b.start_time, s.title AS spot_title
         FROM bookings b
         JOIN spots s ON b.spot_id = s.id
         WHERE b.booking_status = 'confirmed'
           AND b.reminder_sent = false
           AND b.start_time > NOW()
           AND b.start_time <= NOW() + INTERVAL '100 minutes'`
      );

      const bookings = result.rows;
      if (bookings.length > 0) {
        console.log(`[CRON] Found ${bookings.length} upcoming booking(s) to notify.`);

        for (const booking of bookings) {
          const startTime = new Date(booking.start_time);
          const now = new Date();
          const msLeft = startTime.getTime() - now.getTime();
          const minutesLeft = Math.max(1, Math.round(msLeft / 60000));

          // Send notification
          await fireEvent(EVENTS.BOOKING_STARTING_SOON, booking.driver_id, {
            spotName: booking.spot_title,
            minutesLeft: minutesLeft,
          });

          // Mark reminder as sent
          await query(
            `UPDATE bookings
             SET reminder_sent = true
             WHERE id = $1`,
            [booking.id]
          );

          console.log(`[CRON] Notification sent to driver ${booking.driver_id} for booking ${booking.id} starting in ${minutesLeft} mins.`);
        }
      }
    } catch (error) {
      console.error('❌ [CRON] Error sending booking reminders:', error.message);
    }
  });

  console.log('🕒 Booking reminder cron job initialized (runs every 10 minutes).');
};

module.exports = initBookingReminderCron;
