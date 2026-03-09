// src/scripts/generateAdminWallet.js
// ============================================
// GENERATE ADMIN XRPL WALLET
// ============================================
// Run this ONCE to create the admin's XRPL wallet
// Usage: npm run generate:wallet
//
// This script:
//   1. Connects to XRPL Testnet
//   2. Creates a new wallet
//   3. Funds it with free test XRP
//   4. Prints the address and seed
//   5. You copy these to your .env file

const xrplService = require('../services/XrplService');

const generateAdminWallet = async () => {
  try {
    console.log('🔑 Generating Admin XRPL Wallet...');
    console.log('   Network: XRPL Testnet\n');
    console.log('   This may take 10-20 seconds...\n');

    const wallet = await xrplService.generateWallet();

    console.log('\n═══════════════════════════════════════════');
    console.log('   ✅ ADMIN WALLET GENERATED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════');
    console.log(`   Address: ${wallet.address}`);
    console.log(`   Seed:    ${wallet.seed}`);
    console.log(`   Balance: ${wallet.balance} XRP`);
    console.log('═══════════════════════════════════════════');
    console.log('\n📋 Copy these lines to your .env file:\n');
    console.log(`ADMIN_WALLET_ADDRESS=${wallet.address}`);
    console.log(`ADMIN_WALLET_SEED=${wallet.seed}`);
    console.log('\n🔒 WARNING: Keep the SEED secret! Never share it.');
    console.log('   Anyone with the seed can spend the XRP.\n');

    await xrplService.disconnect();
  } catch (error) {
    console.error('❌ Failed to generate wallet:', error.message);
  }
  process.exit(0);
};

generateAdminWallet();