const { query } = require('./src/config/db');

async function test() {
  await query("UPDATE users SET kyc_status = 'APPROVED' WHERE wallet_address = 'rpkem1esxp4aWy8C9BcDawZffNnqhPSWfB'");
  console.log("Updated.");
  process.exit(0);
}
test();