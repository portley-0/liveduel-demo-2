import { useState } from "react";
import LoginWithEmail from "./LoginWithEmail";
import { useGoogleLogin } from "../hooks/useGoogleLogin";
import { useWalletLogin } from "../hooks/useWalletLogin";
import { FcGoogle } from "react-icons/fc";
import { MdOutlineMailOutline } from "react-icons/md";
import { BiSolidWallet } from "react-icons/bi";

export default function LoginModal() {
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const { walletLogin } = useWalletLogin();
  const { googleLogin } = useGoogleLogin();

  return (
    <div className="max-w-md mx-auto p-6 bg-[#00001E] shadow-md min-h-screen flex flex-col">
      <div className="flex flex-col items-center mt-2 mb-10">
        <span className="text-white text-2xl font-semibold">Welcome to</span>
        <img
          src="/Liveduel-Logo.png"
          alt="LiveDuel Logo"
          className="mt-2"
          style={{ maxHeight: "40px" }}
        />
      </div>

      {!showEmailLogin && (
        <p className="mt-4 text-center text-white text-2xl font-semibold">
          Log in or Sign up
        </p>
      )}

      <div className="w-full mt-4">
        {showEmailLogin ? (
          <LoginWithEmail onBack={() => setShowEmailLogin(false)} />
        ) : (
          <div className="flex flex-col space-y-4 w-full">
            <button
              onClick={() => setShowEmailLogin(true)}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none "
            >
              <MdOutlineMailOutline size={20} />
              Continue with Email
            </button>
            <button
              onClick={googleLogin}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none "
            >
              <FcGoogle size={20} />
              Continue with Google
            </button>
            <button
              onClick={walletLogin}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none "
            >
              <BiSolidWallet size={20} />
              Continue with Wallet
            </button>
          </div>
        )}
      </div>

      {!showEmailLogin && (
        <div className="flex justify-center mt-10">
          <img src="privy.svg" alt="Privy Logo" className="h-3 w-auto" />
        </div>
      )}

      

    </div>
  );
}
