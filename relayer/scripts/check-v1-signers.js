/**
 * Check signers on v1 contract and available accounts from mnemonic
 * Run: node scripts/check-v1-signers.js
 */

import 'dotenv/config';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { TransactionVersion } from '@stacks/transactions';

const STACKS_API = 'https://api.testnet.hiro.so';
const CONTRACT_ADDRESS = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';
const CONTRACT_NAME = 'wrapped-usdc';

async function checkSigner(index) {
    const url = `${STACKS_API}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-signer`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender: CONTRACT_ADDRESS,
            arguments: [`0x0100000000000000000000000000000000${index.toString(16).padStart(2, '0')}`],
        }),
    });

    const data = await response.json();
    return data;
}

async function main() {
    const mnemonic = process.env.STACKS_PRIVATE_KEY;
    if (!mnemonic) {
        console.error('❌ STACKS_PRIVATE_KEY not set');
        process.exit(1);
    }

    console.log('═'.repeat(60));
    console.log('📊 V1 Contract Signer Analysis');
    console.log('═'.repeat(60));

    // Generate wallet with multiple accounts
    const wallet = await generateWallet({ secretKey: mnemonic, password: '' });

    console.log('\n📍 Available Accounts from Mnemonic:');
    for (let i = 0; i < 3; i++) {
        const account = wallet.accounts[i];
        if (account) {
            const testnetAddr = getStxAddress({ account, transactionVersion: TransactionVersion.Testnet });
            const mainnetAddr = getStxAddress({ account, transactionVersion: TransactionVersion.Mainnet });
            console.log(`   Account ${i}:`);
            console.log(`     Testnet: ${testnetAddr}`);
            console.log(`     Mainnet: ${mainnetAddr}`);
        }
    }

    console.log('\n📍 Contract Owner (deployer):');
    console.log(`   ${CONTRACT_ADDRESS}`);

    console.log('\n📍 Registered Signers on V1:');
    console.log('   (Checking via API... this may show encoded values)');

    for (let i = 0; i < 3; i++) {
        try {
            const result = await checkSigner(i);
            console.log(`   Signer ${i}: ${JSON.stringify(result.result || result.error || 'unknown')}`);
        } catch (e) {
            console.log(`   Signer ${i}: Error - ${e.message}`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('💡 To use V1 with 2 signers, you need:');
    console.log('   1. Two different Stacks mnemonics/private keys');
    console.log('   2. Each must be registered as a signer on the contract');
    console.log('   3. Both must approve before execute can succeed');
    console.log('═'.repeat(60));
}

main().catch(console.error);
