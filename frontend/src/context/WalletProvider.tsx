import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  darkTheme,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  injectedWallet,
  coreWallet,
  rabbyWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { toPrivyWallet } from '@privy-io/cross-app-connect/rainbow-kit';
import { createConfig, http, WagmiProvider } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactNode } from "react";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        metaMaskWallet,
        toPrivyWallet({
          id: 'cm935vklg01mhla0mlm1x4lf4',
          name: 'Privy (Google/Email)',
          iconUrl: '/images/privy.png'
        }),
        coreWallet,
        rabbyWallet,
        trustWallet,
        walletConnectWallet,
        injectedWallet,
      ],
    },
  ],
  {
    appName: "LiveDuel Demo 2",
    projectId: "e87d4bfd159146fc8d6fb15484d62a2c",
  }
);

const config = createConfig({
  chains: [avalancheFuji],
  connectors,
  transports: {
    [avalancheFuji.id]: http('https://api.avax-test.network/ext/bc/C/rpc'),
  },
});

const queryClient = new QueryClient();

export default function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={[avalancheFuji]} theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
