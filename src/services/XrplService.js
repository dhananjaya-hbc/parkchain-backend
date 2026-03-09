// src/services/XrplService.js
// ============================================
// XRPL BLOCKCHAIN SERVICE
// ============================================
//
// This is the CORE of our payment system.
// It connects to the XRP Ledger and handles:
//   1. Creating wallets
//   2. Sending XRP payments
//   3. Processing the 20/80 payment split
//   4. Verifying transactions
//
// XRPL Basics:
// ─────────────
// - XRP is the cryptocurrency of the XRP Ledger
// - 1 XRP = 1,000,000 "drops" (like 1 dollar = 100 cents)
// - Transactions take 3-5 seconds (very fast!)
// - Transaction fee is ~0.00001 XRP (almost free!)
// - Testnet gives you FREE test XRP to experiment with
//
// How XRPL differs from Ethereum:
// ─────────────────────────────────
// - No smart contracts (no Solidity)
// - Built-in payment operations
// - Much faster (3-5 sec vs 12+ sec)
// - Much cheaper fees
// - We implement business logic (split) on our server

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

  /**
   * Connect to the XRPL network
   * 
   * Think of this like opening a phone line to the blockchain.
   * We need an open connection to send/receive data.
   * 
   * Testnet = practice network with fake money
   * Mainnet = real network with real money
   */
  async connect() {
    // Don't connect twice
    if (this.client && this.client.isConnected()) {
      return;
    }

    this.client = new xrpl.Client(this.networkUrl);
    await this.client.connect();
    console.log('🔗 Connected to XRPL:', this.networkUrl);
  }

  /**
   * Disconnect from XRPL
   * Always disconnect when done to free resources
   */
  async disconnect() {
    if (this.client && this.client.isConnected()) {
      await this.client.disconnect();
      console.log('🔌 Disconnected from XRPL');
    }
  }

  /**
   * Make sure we're connected before any operation
   * Called internally before every blockchain operation
   */
  async ensureConnected() {
    if (!this.client || !this.client.isConnected()) {
      await this.connect();
    }
  }

  // ============================================
  // WALLET MANAGEMENT
  // ============================================

  /**
   * Generate a new XRPL wallet
   * 
   * On Testnet, this:
   *   1. Creates a new wallet (address + seed)
   *   2. Funds it with free test XRP (usually ~100 XRP)
   * 
   * What is a wallet?
   *   - address: like your bank account number (public, safe to share)
   *   - seed: like your PIN/password (NEVER share this!)
   *   - With the seed, you can sign transactions (send money)
   * 
   * @returns {Object} { address, seed, balance }
   */
  async generateWallet() {
    await this.ensureConnected();

    // fundWallet() is a Testnet-only feature
    // It creates a wallet AND gives it free test XRP
    const { wallet, balance } = await this.client.fundWallet();

    console.log(`💰 New wallet created: ${wallet.address} (Balance: ${balance} XRP)`);

    return {
      address: wallet.address,
      seed: wallet.seed,
      publicKey: wallet.publicKey,
      balance: balance
    };
  }

  /**
   * Get wallet balance
   * 
   * @param {string} address - XRPL wallet address
   * @returns {string} Balance in XRP
   */
  async getBalance(address) {
    await this.ensureConnected();

    try {
      const response = await this.client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });

      // Balance comes in "drops", convert to XRP
      const balanceDrops = response.result.account_data.Balance;
      return xrpl.dropsToXrp(balanceDrops);
    } catch (error) {
      if (error.data?.error === 'actNotFound') {
        return '0';  // Account doesn't exist yet
      }
      throw error;
    }
  }

  // ============================================
  // PAYMENT TRANSACTIONS
  // ============================================

  /**
   * Send XRP from one wallet to another
   * 
   * How a payment works on XRPL:
   *   1. Build the transaction (from, to, amount)
   *   2. Autofill (adds fee and sequence number)
   *   3. Sign with sender's seed (proves ownership)
   *   4. Submit to the network
   *   5. Wait for validation (3-5 seconds)
   *   6. Check result: tesSUCCESS = payment worked!
   * 
   * @param {string} senderSeed - Sender's secret seed
   * @param {string} destinationAddress - Receiver's wallet address
   * @param {number} amountXrp - Amount in XRP
   * @param {string} memo - Optional note (e.g., booking ID)
   * @returns {Object} Transaction result
   */
  async sendPayment(senderSeed, destinationAddress, amountXrp, memo = '') {
    await this.ensureConnected();

    // Recreate the wallet from its seed (to sign the transaction)
    const senderWallet = xrpl.Wallet.fromSeed(senderSeed);

    // Build the payment transaction
    const payment = {
      TransactionType: 'Payment',
      Account: senderWallet.address,       // From
      Destination: destinationAddress,      // To
      Amount: xrpl.xrpToDrops(amountXrp.toString())  // Amount in drops
    };

    // Add memo if provided (stored on the blockchain!)
    // Memos must be hex-encoded on XRPL
    if (memo) {
      payment.Memos = [
        {
          Memo: {
            MemoType: Buffer.from('text/plain', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
          }
        }
      ];
    }

    // Autofill adds:
    //   - Fee (tiny network fee, ~0.00001 XRP)
    //   - Sequence (transaction counter, prevents replay attacks)
    //   - LastLedgerSequence (transaction expires if not processed quickly)
    const prepared = await this.client.autofill(payment);

    // Sign the transaction with the sender's secret seed
    // This proves the sender authorized this payment
    const signed = senderWallet.sign(prepared);

    console.log(`📤 Sending ${amountXrp} XRP`);
    console.log(`   From: ${senderWallet.address}`);
    console.log(`   To:   ${destinationAddress}`);
    console.log(`   Hash: ${signed.hash}`);

    // Submit and wait for the blockchain to validate
    // This takes about 3-5 seconds
    const result = await this.client.submitAndWait(signed.tx_blob);

    // Check if transaction succeeded
    const txResult = result.result.meta.TransactionResult;
    const success = txResult === 'tesSUCCESS';

    console.log(`${success ? '✅' : '❌'} Result: ${txResult}`);

    return {
      success,
      txHash: signed.hash,
      resultCode: txResult,
      ledgerIndex: result.result.ledger_index,
      fee: xrpl.dropsToXrp(result.result.Fee),
      from: senderWallet.address,
      to: destinationAddress,
      amountXrp: amountXrp,
      amountDrops: parseInt(xrpl.xrpToDrops(amountXrp.toString()))
    };
  }

  // ============================================
  // THE "SMART CONTRACT" — PAYMENT SPLIT LOGIC
  // ============================================

  /**
   * Process a complete booking payment with 20/80 split
   * 
   * This is the main "smart contract" function!
   * It executes TWO blockchain transactions:
   * 
   * Transaction 1: Driver → Admin (full amount)
   *   Driver sends the total booking cost to the admin wallet
   * 
   * Transaction 2: Admin → Seller (80%)
   *   Admin automatically sends 80% to the spot owner
   *   Admin keeps 20% as platform commission
   * 
   * Example with 10 XRP booking:
   *   TX1: Driver ──10 XRP──→ Admin     (admin receives 10 XRP)
   *   TX2: Admin  ──8 XRP───→ Seller    (seller gets 80%)
   *   Admin keeps: 10 - 8 = 2 XRP       (admin keeps 20%)
   * 
   * @param {string} driverSeed - Driver's wallet secret seed
   * @param {string} sellerWalletAddress - Seller's XRPL address
   * @param {number} totalAmountXrp - Total booking cost
   * @param {string} bookingId - Booking ID (stored as memo on blockchain)
   * @returns {Object} Both transaction results
   */
  async processBookingPayment(driverSeed, sellerWalletAddress, totalAmountXrp, bookingId) {
    await this.ensureConnected();

    const adminAddress = process.env.ADMIN_WALLET_ADDRESS;
    const adminSeed = process.env.ADMIN_WALLET_SEED;
    const commissionPercent = parseInt(process.env.ADMIN_COMMISSION_PERCENT) || 20;
    const sellerPercent = parseInt(process.env.SELLER_SHARE_PERCENT) || 80;

    // Calculate the split
    const adminCommission = parseFloat((totalAmountXrp * commissionPercent / 100).toFixed(6));
    const sellerAmount = parseFloat((totalAmountXrp * sellerPercent / 100).toFixed(6));

    console.log('\n💳 ═══════════════════════════════════════');
    console.log('   PROCESSING BOOKING PAYMENT');
    console.log('═══════════════════════════════════════════');
    console.log(`   Booking ID:        ${bookingId}`);
    console.log(`   Total Amount:      ${totalAmountXrp} XRP`);
    console.log(`   Admin Fee (${commissionPercent}%):   ${adminCommission} XRP`);
    console.log(`   Seller Share (${sellerPercent}%): ${sellerAmount} XRP`);
    console.log('═══════════════════════════════════════════\n');

    // ──────────────────────────────────────────
    // TRANSACTION 1: Driver → Admin (full amount)
    // ──────────────────────────────────────────
    console.log('📌 Step 1/2: Driver → Admin Wallet');
    const driverToAdminTx = await this.sendPayment(
      driverSeed,
      adminAddress,
      totalAmountXrp,
      `booking:${bookingId}:driver_payment`
    );

    if (!driverToAdminTx.success) {
      console.error('❌ Step 1 FAILED: Driver payment rejected');
      return {
        success: false,
        failedStep: 'driver_to_admin',
        error: driverToAdminTx.resultCode,
        driverToAdminTx,
        adminToSellerTx: null
      };
    }

    console.log('✅ Step 1 DONE: Admin received full payment\n');

    // ──────────────────────────────────────────
    // TRANSACTION 2: Admin → Seller (80%)
    // ──────────────────────────────────────────
    console.log('📌 Step 2/2: Admin → Seller Wallet (80%)');
    const adminToSellerTx = await this.sendPayment(
      adminSeed,
      sellerWalletAddress,
      sellerAmount,
      `booking:${bookingId}:seller_payout`
    );

    if (!adminToSellerTx.success) {
      console.error('❌ Step 2 FAILED: Seller payout rejected');
      console.error('⚠️  Admin has the money but seller did not receive!');
      return {
        success: false,
        failedStep: 'admin_to_seller',
        error: adminToSellerTx.resultCode,
        driverToAdminTx,
        adminToSellerTx
      };
    }

    console.log('✅ Step 2 DONE: Seller received 80%\n');

    console.log('🎉 ═══════════════════════════════════════');
    console.log('   PAYMENT FULLY PROCESSED!');
    console.log('═══════════════════════════════════════════\n');

    return {
      success: true,
      totalAmountXrp,
      adminCommission,
      sellerAmount,
      driverToAdminTx,
      adminToSellerTx
    };
  }

  // ============================================
  // TRANSACTION VERIFICATION
  // ============================================

  /**
   * Verify a transaction exists on the XRPL blockchain
   * 
   * Anyone can verify any transaction using its hash!
   * This is the power of blockchain — full transparency.
   * 
   * @param {string} txHash - Transaction hash
   * @returns {Object} Transaction details from the blockchain
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
      const success = tx.meta.TransactionResult === 'tesSUCCESS';

      return {
        exists: true,
        success,
        hash: tx.hash,
        from: tx.Account,
        to: tx.Destination,
        amountDrops: tx.Amount,
        amountXrp: xrpl.dropsToXrp(tx.Amount),
        fee: xrpl.dropsToXrp(tx.Fee),
        ledgerIndex: tx.ledger_index,
        resultCode: tx.meta.TransactionResult
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }
}

// Export a SINGLETON instance
// This means the entire app shares ONE XrplService object
// So we maintain ONE connection to the network
module.exports = new XrplService();