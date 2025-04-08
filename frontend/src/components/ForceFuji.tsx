import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';

export default function ForceFuji() {
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (isConnected) {
      switchChain({ chainId: avalancheFuji.id });
    }
  }, [isConnected, switchChain]);

  return null;
}
