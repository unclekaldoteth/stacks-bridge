/**
 * Check pending mint status
 * Run: node scripts/check-mint.js <mint-id>
 */

import { cvToJSON, uintCV, deserializeCV } from '@stacks/transactions';
import { requireContract, STACKS_API_URL } from './stacks-env.js';

const { contractAddress: CONTRACT_ADDRESS, contractName: CONTRACT_NAME } = requireContract(
    'wrapped-usdc-v2',
    'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM'
);
const mintId = parseInt(process.argv[2]) || 0;

async function main() {
    console.log('═'.repeat(60));
    console.log(`📊 Checking Pending Mint #${mintId}`);
    console.log('═'.repeat(60));

    const url = `${STACKS_API_URL}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-pending-mint`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender: CONTRACT_ADDRESS,
            arguments: [Buffer.from(uintCV(mintId).serialize()).toString('hex')],
        }),
    });

    const data = await response.json();

    if (!data.okay || !data.result) {
        console.log('❌ Mint not found or API error');
        console.log('Response:', JSON.stringify(data, null, 2));
        return;
    }

    try {
        const result = deserializeCV(Buffer.from(data.result.slice(2), 'hex'));
        console.log('Result:', cvToJSON(result));
    } catch (e) {
        console.log('Raw result:', data.result);
    }
}

main().catch(console.error);
