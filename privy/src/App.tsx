import { usePrivy, useWallets } from "@privy-io/react-auth";
import LoginModal from "./components/LoginModal";

function App() {
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
  const { ready, authenticated, user } = usePrivy();

  if (authenticated) {
    console.log(user);
  }

  if (!ready) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center items-center">
        <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen">
      <LoginModal />
    </div>
  );
}

export default App;
