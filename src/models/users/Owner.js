import { pool } from '../../PS F:\Projects 2025\SoftwereProjectL2Geveo\backend> npm run dev

> park_chain_backend@1.0.0 dev
> nodemon index.js

[nodemon] 3.1.10
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,cjs,json
[nodemon] starting `node index.js`
F:\Projects 2025\SoftwereProjectL2Geveo\backend\node_modules\pg-connection-string\index.js:39
  for (const entry of result.searchParams.entries()) {
                             ^

TypeError: Cannot read properties of undefined (reading 'searchParams')
    at parse (F:\Projects 2025\SoftwereProjectL2Geveo\backend\node_modules\pg-connection-string\index.js:39:30)
    at new ConnectionParameters (F:\Projects 2025\SoftwereProjectL2Geveo\backend\node_modules\pg\lib\connection-parameters.js:56:42)
    at new Client (F:\Projects 2025\SoftwereProjectL2Geveo\backend\node_modules\pg\lib\client.js:18:33)
    at BoundPool.newClient (F:\Projects 2025\SoftwereProjectL2Geveo\backend\node_modules\pg-pool\index.js:233:20)
    at BoundPool.connect (F:\Projects 2025\SoftwereProjectL2Geveo\backend\node_modules\pg-pool\index.js:227:10)
    at file:///F:/Projects%202025/SoftwereProjectL2Geveo/backend/src/config/db.js:12:6
    at ModuleJob.run (node:internal/modules/esm/module_job:271:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:547:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:116:5)

Node.js v22.13.0
[nodemon] app crashed - waiting for file changes before starting...
config/db.js';
import { BaseUser } from './BaseUser.js';

export class Owner extends BaseUser {
  constructor({ id, name, email, role, shop_name, rating }) {
    super({ id, name, email, role });
    this.shopName = shop_name;
    this.rating = rating;
  }

  static async findById(id) {
    const query = `
      SELECT u.*, s.shop_name, s.rating
      FROM users u
      JOIN sellers s ON u.id = s.user_id
      WHERE u.id = $1;
    `;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) return null;
    return new Owner(rows[0]);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      shopName: this.shopName,
      rating: this.rating
    };
  }
}
