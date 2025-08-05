import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
  useLogin,
} from "@privy-io/react-auth";
import { FcGoogle } from "react-icons/fc";
import { MdOutlineMailOutline } from "react-icons/md";
import { BiSolidWallet } from "react-icons/bi";
import { IoClose } from "react-icons/io5";
import { FaArrowLeft } from "react-icons/fa";

type LoginModalProps = {};

const TARGET = "/dashboard/matches";

export default function LoginModal({}: LoginModalProps) {
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const navigate = useNavigate();

  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();

  // Email login setup
  const {
    sendCode,
    loginWithCode,
  } = useLoginWithEmail({
    onComplete: () => {
      // authenticated flip handled below
    },
    onError: (err) => {
      console.error("Email login error:", err);
      setInFlight(false);
      setIsProcessing(false);
    },
  });

  // OAuth login setup
  const {
    state: oauthState,
    initOAuth: initGoogleOAuth,
  } = useLoginWithOAuth({
    onComplete: () => {
      // authenticated flip handled below
    },
    onError: (err) => {
      console.error("Google OAuth error:", err);
      setInFlight(false);
    },
  });

  // Redirect once authenticated
  useEffect(() => {
    if (ready && authenticated) {
      navigate(TARGET, { replace: true });
    }
  }, [ready, authenticated, navigate]);

  const close = useCallback(() => {
    navigate(TARGET, { replace: true });
  }, [navigate]);

  // Email login local state
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendCode = async () => {
    setIsSending(true);
    try {
      await sendCode({ email });
    } finally {
      setTimeout(() => setIsSending(false), 2000);
    }
  };

  const handleLoginWithCode = async () => {
    setInFlight(true);
    setIsProcessing(true);
    try {
      await loginWithCode({ code });
    } catch {
      // error path handled in onError
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        if (!(ready && authenticated)) {
          setInFlight(false);
        }
      }, 500);
    }
  };

  const googleLogin = async () => {
    setInFlight(true);
    try {
      await initGoogleOAuth({ provider: "google", disableSignup: false });
    } catch (err) {
      console.error("Google login initiation failed:", err);
      setInFlight(false);
    }
  };

  const walletLogin = async () => {
    if (!ready) return;
    setInFlight(true);
    try {
      await login({
        loginMethods: ["wallet"],
        walletChainType: "ethereum-only",
        disableSignup: false,
      });
    } catch (err) {
      console.error("Wallet login failed:", err);
      setInFlight(false);
    }
  };

  const oauthLoading = oauthState?.status === "loading";

  // show loader during any in-flight login before auth confirms
  if ((inFlight || oauthLoading) && !(ready && authenticated)) {
    return (
      <div className="fixed inset-0 z-3000 flex justify-center items-center bg-[#00001E]">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner text-blue-700 h-12 w-12" />
          <p className="text-white">Signing you in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-3000 flex justify-center items-start bg-[#00001E] overflow-auto">
      <button
        aria-label="Close login"
        onClick={close}
        className="fixed top-4 right-4 z-60 p-2 rounded-full hover:bg-white/10 focus:outline-none"
      >
        <IoClose size={28} className="text-white" />
      </button>

      <div className="relative max-w-md w-full mx-4 bg-[#00001E] shadow-md rounded-2xl flex flex-col p-6">
        <div className="flex flex-col items-center mt-2 mb-10">
          <span className="text-white text-2xl font-semibold">Welcome to</span>
          <img
            src="/images/Liveduel-Logo.png"
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
            <div className="p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-4">
                <button
                  aria-label="Back"
                  onClick={() => setShowEmailLogin(false)}
                  className="mr-2"
                >
                  <FaArrowLeft size={18} className="text-white" />
                </button>
                <h3 className="text-xl font-semibold mb-0 text-white">
                  Email Login | Signup
                </h3>
              </div>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-white p-2 border-2 border-gray-300 rounded mb-4 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 bg-[#324155]"
              />
              <button
                onClick={handleSendCode}
                disabled={isSending}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 mb-4"
              >
                {isSending ? "Sending" : "Send Code"}
              </button>
              <input
                type="text"
                placeholder="Enter OTP code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-white p-2 border-2 border-gray-300 rounded mb-4 mt-2 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 bg-[#324155]"
              />
              <button
                onClick={handleLoginWithCode}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-700 disabled:opacity-50"
              >
                {isProcessing ? "Processing" : "Continue"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col space-y-4 w-full">
              <button
                onClick={() => setShowEmailLogin(true)}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none"
              >
                <MdOutlineMailOutline size={20} />
                Continue with Email
              </button>
              <button
                onClick={googleLogin}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none"
              >
                <FcGoogle size={20} />
                Continue with Google
              </button>
              <button
                onClick={walletLogin}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none"
              >
                <BiSolidWallet size={20} />
                Continue with Wallet
              </button>
            </div>
          )}
        </div>

        {!showEmailLogin && (
          <div className="flex justify-center mt-10">
            <img
              src="/images/privy.svg"
              alt="Privy Logo"
              className="h-3 w-auto"
            />
          </div>
        )}
      </div>
    </div>
  );
}
