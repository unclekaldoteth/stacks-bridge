import "dotenv/config";
import { StacksMainnet, StacksTestnet } from "@stacks/network";
import { TransactionVersion } from "@stacks/transactions";

export const NETWORK = process.env.NETWORK || "testnet";
export const IS_MAINNET = NETWORK === "mainnet";

export const STACKS_API_URL =
    process.env.STACKS_API_URL ||
    (IS_MAINNET ? "https://api.hiro.so" : "https://api.testnet.hiro.so");
export const STACKS_CORE_API_URL =
    process.env.STACKS_CORE_API_URL ||
    process.env.STACKS_API_URL ||
    (IS_MAINNET ? "https://stacks-node-api.mainnet.stacks.co" : "https://stacks-node-api.testnet.stacks.co");

export const network = IS_MAINNET ? new StacksMainnet() : new StacksTestnet();
network.apiUrl = STACKS_API_URL;
network.coreApiUrl = STACKS_CORE_API_URL;

export const txVersion = IS_MAINNET ? TransactionVersion.Mainnet : TransactionVersion.Testnet;

export function resolveContract(defaultName, defaultAddress) {
    const contractAddress = process.env.STACKS_CONTRACT_ADDRESS || defaultAddress;
    const contractName = process.env.STACKS_CONTRACT_NAME || defaultName;

    return { contractAddress, contractName };
}

export function requireContract(defaultName, defaultAddress) {
    const { contractAddress, contractName } = resolveContract(defaultName, defaultAddress);
    if (!contractAddress) {
        console.error("❌ STACKS_CONTRACT_ADDRESS not set in .env");
        process.exit(1);
    }
    if (!contractName) {
        console.error("❌ STACKS_CONTRACT_NAME not set in .env");
        process.exit(1);
    }

    return { contractAddress, contractName };
}

export function stacksExplorerTxUrl(txId) {
    const base = `https://explorer.hiro.so/txid/${txId}`;
    return IS_MAINNET ? base : `${base}?chain=testnet`;
}

export function stacksExplorerAddressUrl(address) {
    const base = `https://explorer.hiro.so/address/${address}`;
    return IS_MAINNET ? base : `${base}?chain=testnet`;
}
