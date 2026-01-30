'use client';

import { BridgeForm } from '@/components/BridgeForm';
import { BridgeStats } from '@/components/BridgeStats';
import { TransactionHistory } from '@/components/TransactionHistory';
import { ConnectButton } from '@/components/ConnectButton';
import { FooterStats } from '@/components/FooterStats';
import { config } from '@/lib/config';

const isMainnet = config.network === 'mainnet';


export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-[#375BD2] selection:text-white flex flex-col">
      {/* Minimal Header */}
      <header className="w-full border-b border-[#222]">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#375BD2] rounded-lg"></div>
            <span className="font-bold text-lg tracking-tight">StacksBridge</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs font-medium bg-[#111] px-3 py-1.5 rounded-full border border-[#222]">
              <div className={`w-2 h-2 rounded-full ${isMainnet ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-gray-300">{isMainnet ? 'Mainnet' : 'Testnet'}</span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 relative z-10 w-full max-w-screen-xl mx-auto">

        {/* Subtle Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#375BD2] opacity-[0.03] blur-[120px] rounded-full -z-10 pointer-events-none"></div>

        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-white">
            Bridge USDC
          </h1>
          <p className="text-gray-400 text-lg">
            Fast, secure transfers between Base and Stacks.
          </p>
        </div>

        {/* Bridge Card Area */}
        <div className="w-full max-w-[480px]">
          <BridgeForm />
        </div>

        {/* Footer Stats - Dynamic */}
        <FooterStats />
      </div>

      {/* Secondary Content - History & Deep Stats (Below Fold) */}
      <div className="border-t border-[#222] bg-[#0A0A0A] py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h3 className="text-xl font-bold mb-8 text-white">Bridge Activity</h3>
          <BridgeStats />
          <div className="mt-12">
            <TransactionHistory />
          </div>
        </div>
      </div>

    </main>
  );
}
