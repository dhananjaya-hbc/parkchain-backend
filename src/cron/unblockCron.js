const cron = require('node-cron');
const { query } = require('../config/db');

const initUnblockCron = () => {
  // Run every 1 minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      const result = await query(
        `UPDATE spots 
         SET is_blocked_by_seller = false, 
             block_start_time = null, 
             block_end_time = null, 
             block_reason = null, 
             updated_at = NOW() 
         WHERE is_blocked_by_seller = true 
           AND block_end_time <= $1
         RETURNING id`,
        [now]
      );

      if (result.rows.length > 0) {
        console.log(`✅ [CRON] Unblocked ${result.rows.length} spot(s) automatically.`);
      }
    } catch (error) {
      console.error('❌ [CRON] Error unblocking spots:', error.message);
    }
  });

  console.log('🕒 Spot unblocking cron job initialized.');
};

module.exports = initUnblockCron;
