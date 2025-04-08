import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';

export default function ForceFuji() {
  const { status } = useAccount(); 
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (status === 'connected') {
      const timeout = setTimeout(() => {
        switchChain({ chainId: avalancheFuji.id });
      }, 300); // wait 300ms
  
      return () => clearTimeout(timeout);
    }
  }, [status, switchChain]);

  return null;
}
