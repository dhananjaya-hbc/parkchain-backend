const { query } = require('./src/config/db');

async function test() {
  const result = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
  console.log(result.rows.map(r => r.column_name));
  process.exit(0);
}
test();