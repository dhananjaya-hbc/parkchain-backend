// src/services/FraudDetectionService.js
// ============================================
// AI FRAUD DETECTION SERVICE
// ============================================
// Analyzes driver booking patterns to detect suspicious activity
//
// Risk Score: 0-100
//   0-30:  LOW RISK    → Normal booking
//   31-60: MEDIUM RISK → Some concerns
//   61-100: HIGH RISK  → Suspicious activity

const { query } = require('../config/db');

class FraudDetectionService {

  // ============================================
  // MAIN: Analyze a booking for fraud
  // ============================================
  async analyzeBooking(driverId, spotId, startTime, endTime, totalAmountXrp) {
    console.log(`\n🔍 AI Fraud Detection — Analyzing booking...`);

    const warnings = [];
    let riskScore = 0;

    // Run all checks
    const cancelledCheck = await this.checkCancelledBookings(driverId);
    riskScore += cancelledCheck.score;
    if (cancelledCheck.warning) warnings.push(cancelledCheck.warning);

    const frequencyCheck = await this.checkBookingFrequency(driverId);
    riskScore += frequencyCheck.score;
    if (frequencyCheck.warning) warnings.push(frequencyCheck.warning);

    const durationCheck = this.checkUnusualDuration(startTime, endTime);
    riskScore += durationCheck.score;
    if (durationCheck.warning) warnings.push(durationCheck.warning);

    const amountCheck = await this.checkUnusualAmount(totalAmountXrp, spotId);
    riskScore += amountCheck.score;
    if (amountCheck.warning) warnings.push(amountCheck.warning);

    const failedPaymentCheck = await this.checkFailedPayments(driverId);
    riskScore += failedPaymentCheck.score;
    if (failedPaymentCheck.warning) warnings.push(failedPaymentCheck.warning);

    const overlapCheck = await this.checkDriverOverlap(driverId, startTime, endTime);
    riskScore += overlapCheck.score;
    if (overlapCheck.warning) warnings.push(overlapCheck.warning);

    // Cap at 100
    riskScore = Math.min(riskScore, 100);

    // Determine risk level
    let riskLevel = 'low';
    if (riskScore > 60) riskLevel = 'high';
    else if (riskScore > 30) riskLevel = 'medium';

    console.log(`🤖 Risk Score: ${riskScore}/100 (${riskLevel.toUpperCase()})`);
    console.log(`   Warnings: ${warnings.length > 0 ? warnings.join(', ') : 'None'}`);

    return {
      riskScore,
      riskLevel,
      warnings,
      checks: {
        cancelledBookings: cancelledCheck,
        bookingFrequency: frequencyCheck,
        unusualDuration: durationCheck,
        unusualAmount: amountCheck,
        failedPayments: failedPaymentCheck,
        driverOverlap: overlapCheck,
      }
    };
  }

  // ============================================
  // CHECK 1: Too many cancelled bookings today
  // ============================================
  async checkCancelledBookings(driverId) {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM bookings 
       WHERE driver_id = $1 
         AND booking_status = 'cancelled'
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [driverId]
    );

    const count = parseInt(result.rows[0].count);

    if (count >= 3) {
      return {
        score: 25,
        warning: `${count} cancelled bookings in last 24 hours`,
        detail: `Driver cancelled ${count} bookings today`
      };
    } else if (count >= 2) {
      return {
        score: 10,
        warning: `${count} cancelled bookings in last 24 hours`,
        detail: `Driver cancelled ${count} bookings today`
      };
    }

    return { score: 0, warning: null, detail: 'No recent cancellations' };
  }

  // ============================================
  // CHECK 2: Too many bookings in short period
  // ============================================
  async checkBookingFrequency(driverId) {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM bookings 
       WHERE driver_id = $1 
         AND booking_status NOT IN ('cancelled')
         AND created_at > NOW() - INTERVAL '1 hour'`,
      [driverId]
    );

    const count = parseInt(result.rows[0].count);

    if (count >= 5) {
      return {
        score: 30,
        warning: `${count} bookings in the last hour — unusual activity`,
        detail: `${count} bookings created in 1 hour`
      };
    } else if (count >= 3) {
      return {
        score: 15,
        warning: `${count} bookings in the last hour`,
        detail: `${count} bookings created in 1 hour`
      };
    }

    return { score: 0, warning: null, detail: 'Normal booking frequency' };
  }

  // ============================================
  // CHECK 3: Unusually long duration
  // ============================================
  checkUnusualDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationHours = (end - start) / (1000 * 60 * 60);

    if (durationHours > 12) {
      return {
        score: 20,
        warning: `Unusually long booking: ${durationHours.toFixed(1)} hours`,
        detail: `${durationHours.toFixed(1)} hour duration is above average`
      };
    } else if (durationHours > 8) {
      return {
        score: 10,
        warning: `Long booking: ${durationHours.toFixed(1)} hours`,
        detail: `${durationHours.toFixed(1)} hour duration`
      };
    }

    return { score: 0, warning: null, detail: `${durationHours.toFixed(1)} hours — normal duration` };
  }

  // ============================================
  // CHECK 4: Amount much higher than spot average
  // ============================================
  async checkUnusualAmount(totalAmountXrp, spotId) {
    const result = await query(
      `SELECT AVG(total_price_xrp) as avg_price, 
              MAX(total_price_xrp) as max_price
       FROM bookings 
       WHERE spot_id = $1 
         AND booking_status NOT IN ('cancelled')`,
      [spotId]
    );

    const avgPrice = parseFloat(result.rows[0].avg_price) || 0;
    const amount = parseFloat(totalAmountXrp);

    // If no history, skip check
    if (avgPrice === 0) {
      return { score: 0, warning: null, detail: 'First booking at this spot' };
    }

    if (amount > avgPrice * 3) {
      return {
        score: 20,
        warning: `Amount ${amount.toFixed(2)} XRP is 3x above average (${avgPrice.toFixed(2)} XRP)`,
        detail: `Spot average: ${avgPrice.toFixed(2)} XRP`
      };
    }

    return { score: 0, warning: null, detail: `Amount within normal range` };
  }

  // ============================================
  // CHECK 5: Previous failed payments
  // ============================================
  async checkFailedPayments(driverId) {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM bookings 
       WHERE driver_id = $1 
         AND payment_status = 'failed'
         AND created_at > NOW() - INTERVAL '7 days'`,
      [driverId]
    );

    const count = parseInt(result.rows[0].count);

    if (count >= 3) {
      return {
        score: 25,
        warning: `${count} failed payments in the last 7 days`,
        detail: `${count} payment failures recently`
      };
    } else if (count >= 1) {
      return {
        score: 10,
        warning: `${count} failed payment(s) in the last 7 days`,
        detail: `${count} payment failure recently`
      };
    }

    return { score: 0, warning: null, detail: 'No recent payment failures' };
  }

  // ============================================
  // CHECK 6: Driver already has booking at same time
  // ============================================
  async checkDriverOverlap(driverId, startTime, endTime) {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM bookings 
       WHERE driver_id = $1 
         AND start_time < $3 
         AND end_time > $2
         AND booking_status IN ('pending', 'confirmed', 'active')`,
      [driverId, startTime, endTime]
    );

    const count = parseInt(result.rows[0].count);

    if (count >= 2) {
      return {
        score: 25,
        warning: `Driver has ${count} other bookings at the same time`,
        detail: `${count} overlapping bookings found`
      };
    } else if (count >= 1) {
      return {
        score: 10,
        warning: `Driver has another booking at the same time`,
        detail: `1 overlapping booking found`
      };
    }

    return { score: 0, warning: null, detail: 'No overlapping bookings' };
  }
}

module.exports = new FraudDetectionService();