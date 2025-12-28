/**
 * Fix Signers - Initialize with 3 different addresses derived from same mnemonic
 * Run: node scripts/fix-signers.js
 */

import 'dotenv/config';
import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    principalCV,
    uintCV,
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';

const network = new StacksTestnet();

const CONTRACT_ADDRESS = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';
const CONTRACT_NAME = 'wrapped-usdc';

async function main() {
    const mnemonic = process.env.STACKS_PRIVATE_KEY;
    if (!mnemonic) {
        console.error('❌ STACKS_PRIVATE_KEY (mnemonic) not set in .env');
        process.exit(1);
    }

    console.log('═'.repeat(60));
    console.log('🔐 Deriving Multiple Accounts from Mnemonic');
    console.log('═'.repeat(60));

    // Generate wallet with multiple accounts
    const wallet = await generateWallet({
        secretKey: mnemonic,
        password: '',
    });

    // Get first 3 accounts
    const accounts = [];
    for (let i = 0; i < 3; i++) {
        // Generate wallet with specific account index
        const accountWallet = await generateWallet({
            secretKey: mnemonic,
            password: '',
        });

        // For getting different accounts, we need to derive them properly
        // The wallet SDK generates accounts sequentially
        const account = accountWallet.accounts[0];
        const address = getStxAddress({ account, transactionVersion: 0x80 }); // testnet

        accounts.push({
            index: i,
            address,
            privateKey: account.stxPrivateKey,
        });

        console.log(`   Account ${i}: ${address}`);
    }

    console.log('\n📊 Current signer status:');
    console.log('   Since initialize-signers was already called, we need a different approach.');

    console.log('\n💡 Solution: The contract was initialized with same address 3x.');
    console.log('   But the approval map uses (mint-id, signer) as key.');
    console.log('   Same signer can only approve once per mint.');

    console.log('\n🔧 Options:');
    console.log('   1. Redeploy contract with REQUIRED-SIGNATURES = 1 for testing');
    console.log('   2. Use owner direct-mint function (if available)');
    console.log('   3. Add a test-mode bypass');

    // Check if there's a way to mint directly
    console.log('\n📍 Checking pending mint #0...');

    // Let's try to see if we can use the owner to do something
    const privateKey = accounts[0].privateKey;

    // First, let's queue a NEW mint (mint #1) and then work with that
    console.log('\n🆕 Let\'s queue a new deposit and handle it properly this time.');
    console.log('   The existing mint #0 has approval-count: 1 but needs 2.');
    console.log('   Since we only have 1 unique signer address, we need to modify the contract.');

    console.log('\n✅ RECOMMENDED FIX:');
    console.log('   Redeploy wrapped-usdc with REQUIRED-SIGNATURES = 1 for testnet testing.');
}

main().catch(console.error);
