import { usePrivy } from "@privy-io/react-auth";

export function useWalletLogin() {
  const { ready, connectWallet } = usePrivy();

  const walletLogin = () => {
    if (!ready ) return;
    connectWallet({
      walletChainType: "ethereum-only",
    });
  };

  return { walletLogin };
}
