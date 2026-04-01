// src/services/XrplService.js
// ============================================
// XRPL BLOCKCHAIN SERVICE
// ============================================
//
// ⚠️ NEW FLOW (No more wallet creation!)
//   1. Driver pays Admin via Xaman App
//   2. Backend VERIFIES the transaction hash
//   3. Backend PAYS Seller (80%) using Admin's seed
//
// 🔑 KEY CHANGE:
//   We NO LONGER generate wallets.
//   We only use the ADMIN_WALLET_SEED to pay sellers.

const xrpl = require('xrpl');
require('dotenv').config();

class XrplService {
  constructor() {
    this.client = null;
    this.networkUrl = process.env.XRPL_NETWORK;
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  async connect() {
    if (this.client && this.client.isConnected()) return;
    this.client = new xrpl.Client(this.networkUrl);
    await this.client.connect();
    console.log('🔗 Connected to XRPL:', this.networkUrl);
  }

  async disconnect() {
    if (this.client && this.client.isConnected()) {
      await this.client.disconnect();
      console.log('🔌 Disconnected from XRPL');
    }
  }

  async ensureConnected() {
    if (!this.client || !this.client.isConnected()) await this.connect();
  }

  // ============================================
  // ❌ REMOVED: generateWallet()
  // ============================================
  // We don't create wallets anymore.
  // Drivers use Xaman. Sellers use Xaman.
  // We just store their wallet addresses in the DB.

  // ============================================
  // READ OPERATIONS (Verification)
  // ============================================

  /**
   * Get balance of ANY wallet (Admin, Seller, or Driver)
   */
  async getBalance(address) {
    await this.ensureConnected();
    try {
      const response = await this.client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });
      const balanceDrops = response.result.account_data.Balance;
      return xrpl.dropsToXrp(balanceDrops);
    } catch (error) {
      if (error.data?.error === 'actNotFound') return '0';
      throw error;
    }
  }

  /**
   * ✅ NEW: Verify Driver Payment
   * 
   * The Driver pays the Admin via Xaman App.
   * The App sends us the Transaction Hash.
   * We check the blockchain to confirm it's real.
   * 
   * @param {string} txHash - The hash from the Xaman app
   * @returns {Object} { success: true, amount: 10.5 } or { success: false }
   */
  async verifyDriverPayment(txHash) {
    await this.ensureConnected();
    console.log(`🔍 Verifying transaction: ${txHash}`);

    try {
      const response = await this.client.request({
        command: 'tx',
        transaction: txHash,
        binary: false
      });

      const tx = response.result;
      const isSuccess = tx.meta.TransactionResult === 'tesSUCCESS';
      
      // Check if the payment was actually sent TO the Admin
      const adminAddress = process.env.ADMIN_WALLET_ADDRESS;
      const isSentToAdmin = tx.Destination === adminAddress;

      if (!isSuccess) {
        console.log('❌ Transaction failed on blockchain');
        return { success: false, reason: 'Transaction failed' };
      }

      if (!isSentToAdmin) {
        console.log(`❌ Sent to wrong address: ${tx.Destination}`);
        return { success: false, reason: 'Not sent to admin' };
      }

      const amountXrp = xrpl.dropsToXrp(tx.Amount);
      console.log(`✅ Verified! Driver paid ${amountXrp} XRP to Admin.`);

      return { 
        success: true, 
        amountXrp: amountXrp,
        txHash: tx.hash,
        memo: tx.Memos?.[0]?.Memo?.MemoData 
      };

    } catch (error) {
      console.log('❌ Transaction not found or invalid');
      return { success: false, reason: 'Invalid hash' };
    }
  }

  /**
   * Check any transaction (generic helper)
   */
  async verifyTransaction(txHash) {
    await this.ensureConnected();
    try {
      const response = await this.client.request({
        command: 'tx',
        transaction: txHash,
        binary: false
      });
      const tx = response.result;
      return {
        exists: true,
        success: tx.meta.TransactionResult === 'tesSUCCESS',
        from: tx.Account,
        to: tx.Destination,
        amountXrp: xrpl.dropsToXrp(tx.Amount)
      };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }

  // ============================================
  // WRITE OPERATIONS (Admin pays Seller)
  // ============================================

  /**
   * ✅ NEW: Pay Seller (The 80% Split)
   * 
   * This is the ONLY payment the backend sends.
   * We use the ADMIN's seed to sign.
   * 
   * Flow: Admin Wallet -> Seller Wallet
   * 
   * @param {string} sellerAddress - Where to send money
   * @param {number} amountXrp - How much (80% of booking)
   * @param {string} bookingId - For the memo
   */
  async paySeller(sellerAddress, amountXrp, bookingId) {
    await this.ensureConnected();

    // 🔑 IMPORTANT: We use the Admin's seed from .env
    const adminSeed = process.env.ADMIN_WALLET_SEED;
    if (!adminSeed) throw new Error('ADMIN_WALLET_SEED not set in .env!');

    const senderWallet = xrpl.Wallet.fromSeed(adminSeed);

    const payment = {
      TransactionType: 'Payment',
      Account: senderWallet.address,
      Destination: sellerAddress,
      Amount: xrpl.xrpToDrops(amountXrp.toString())
    };

    // Add memo so seller knows which booking this is for
    if (bookingId) {
      payment.Memos = [{
        Memo: {
          MemoType: Buffer.from('text/plain', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(`payout:${bookingId}`, 'utf8').toString('hex').toUpperCase()
        }
      }];
    }

    const prepared = await this.client.autofill(payment);
    const signed = senderWallet.sign(prepared);

    console.log(`📤 Admin paying Seller: ${amountXrp} XRP`);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    const success = result.result.meta.TransactionResult === 'tesSUCCESS';
    console.log(success ? '✅ Seller paid successfully' : '❌ Seller payment failed');

    return {
      success,
      txHash: signed.hash,
      resultCode: result.result.meta.TransactionResult
    };
  }
}

module.exports = new XrplService();