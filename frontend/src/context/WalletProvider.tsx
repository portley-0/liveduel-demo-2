import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  darkTheme,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import {
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
  metaMaskWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, WagmiProvider } from "wagmi";
import { createClient as createViemClient } from "viem";
import { avalancheFuji } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactNode } from "react";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        metaMaskWallet({ chains: [avalancheFuji] }),
        injectedWallet({ chains: [avalancheFuji] }),
        rainbowWallet({ chains: [avalancheFuji] }),
        walletConnectWallet({ chains: [avalancheFuji] }),
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
  client({ chain }) {
    return createViemClient({
      chain,
      transport: http(),
    });
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
