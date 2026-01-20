'use client';

import { BridgeForm } from '@/components/BridgeForm';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
    >
      Connect Wallet
    </button>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-xl">🌉</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">Base ↔ Stacks</h1>
              <p className="text-xs text-gray-500">USDC Bridge</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Network</p>
              <p className="text-sm font-semibold text-yellow-400">Testnet</p>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-400 to-orange-400 bg-clip-text text-transparent">
              Bridge USDC
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Move USDC between Base (L2) and Stacks (Bitcoin L2) with{" "}
            <span className="text-green-400 font-semibold">80% lower fees</span>{" "}
            than ETH L1 routes.
          </p>
        </div>

        {/* Bridge Card */}
        <div className="max-w-md mx-auto">
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 shadow-2xl">
            <BridgeForm />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">~$0.50</p>
            <p className="text-xs text-gray-500">Avg Bridge Fee</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">2s</p>
            <p className="text-xs text-gray-500">Base Finality</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-orange-400">~15min</p>
            <p className="text-xs text-gray-500">Total Time</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">2/3</p>
            <p className="text-xs text-gray-500">Multi-Sig</p>
          </div>
        </div>

        {/* Security Info */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-gradient-to-r from-blue-900/20 to-orange-900/20 border border-gray-800 rounded-xl p-6">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              🔒 Security Features
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Multi-Sig</p>
                <p className="text-white font-semibold">2-of-3 Approval</p>
              </div>
              <div>
                <p className="text-gray-400">Rate Limits</p>
                <p className="text-white font-semibold">10K/tx, 50K/hr</p>
              </div>
              <div>
                <p className="text-gray-400">Timelock</p>
                <p className="text-white font-semibold">1hr for large TXs</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <p className="text-center text-gray-600 text-sm">
            Built with 💜 for the Bitcoin & Ethereum ecosystems
          </p>
        </div>
      </footer>
    </main>
  );
}
