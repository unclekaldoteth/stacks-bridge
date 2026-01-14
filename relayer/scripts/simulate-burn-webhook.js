import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.WEBHOOK_PORT || "3000";
const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${port}/chainhook/burn`;
const token = process.env.WEBHOOK_AUTH_TOKEN || "bridge-secret-token";

const amountUsdc = process.env.AMOUNT_USDC || "100";
const amountMicro = (BigInt(amountUsdc) * 1_000_000n).toString();
const sender = process.env.STACKS_SENDER || "ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function resolveBaseAddress() {
    if (process.env.BASE_ADDRESS && process.env.BASE_ADDRESS !== ZERO_ADDRESS) {
        return process.env.BASE_ADDRESS;
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const localDeployments = path.resolve(__dirname, "../../evm/deployments.local.json");

    if (fs.existsSync(localDeployments)) {
        const deploymentInfo = JSON.parse(fs.readFileSync(localDeployments, "utf8"));
        if (deploymentInfo?.fundedUser) {
            return deploymentInfo.fundedUser;
        }
    }

    throw new Error(
        "BASE_ADDRESS is required and must be a non-zero EVM address (or ensure evm/deployments.local.json exists)."
    );
}

const baseAddress = resolveBaseAddress();

if (!/^0x[a-fA-F0-9]{40}$/.test(baseAddress) || baseAddress === ZERO_ADDRESS) {
    throw new Error(`Invalid BASE_ADDRESS: ${baseAddress}`);
}

const payload = {
    apply: [
        {
            transactions: [
                {
                    metadata: {
                        kind: { type: "ContractCall" },
                        receipt: {
                            events: [
                                {
                                    type: "SmartContractEvent",
                                    data: {
                                        value: {
                                            type: "tuple",
                                            value: {
                                                event: { type: "string_ascii", value: "burn" },
                                                sender: { type: "principal", value: sender },
                                                amount: { type: "uint", value: amountMicro },
                                                "base-address": { type: "string_ascii", value: baseAddress },
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                    transaction_identifier: { hash: "0xlocal-burn" },
                },
            ],
        },
    ],
};

async function main() {
    console.log(`Posting burn event to: ${webhookUrl}`);
    console.log(`Base address: ${baseAddress}`);
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Webhook failed (${response.status}): ${text}`);
    }

    const body = await response.json();
    console.log("✅ Webhook accepted:", body);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
