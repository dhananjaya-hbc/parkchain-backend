import { pool } from '../../config/db.js';
import { BaseUser } from './BaseUser.js';

export class Driver extends BaseUser {
  constructor({ id, name, email, role, address, points }) {
    super({ id, name, email, role });
    this.address = address;
    this.points = points;
  }

  static async create({ name, email, role, address, points }) {
    // return newly created driver
  }
  
  static async findById(id) {
    //return driver
  }
  
  static async deleteById(id) {
    //delete driver
  }

  static async updateById(id, updateData) {
    //update driver
  }

  toJSON() {
    return {
      ...super.toJSON(),
      address: this.address,
      points: this.points
    };
  }
}
