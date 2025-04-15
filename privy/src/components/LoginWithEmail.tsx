import { useState } from "react"; 
import { useLoginWithEmail } from "@privy-io/react-auth";
import { FaArrowLeft } from "react-icons/fa";

interface LoginWithEmailProps {
  onBack: () => void;
}

export default function LoginWithEmail({ onBack }: LoginWithEmailProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { sendCode, loginWithCode } = useLoginWithEmail();

  const handleSendCode = async () => {
    setIsSending(true);
    await sendCode({ email });
    setTimeout(() => {
      setIsSending(false);
    }, 2000);
  };

  const handleLoginWithCode = async () => {
    setIsProcessing(true);
    await loginWithCode({ code });
    setTimeout(() => {
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4 text-white">
        Email Login | Signup
      </h3>
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
        className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isSending ? "Sending" : "Send Code"}
      </button>
      <input
        type="text"
        placeholder="Enter OTP code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full text-white p-2 border-2 border-gray-300 rounded mb-4 mt-4 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 bg-[#324155]"
      />
      <button
        onClick={handleLoginWithCode}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1E293C] text-gray-300 font-semibold border-2 border-gray-300 hover:border-blue-500 focus:border-transparent py-3 px-6 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isProcessing ? "Processing" : "Continue"}
      </button>
      <button
        onClick={onBack}
        className="w-full mt-4 flex items-center justify-center gap-2 rounded-full bg-transparent text-gray-300 font-semibold py-3 px-6 hover:opacity-80 focus:outline-none"
      >
        <FaArrowLeft size={20} />
        Back
      </button>
    </div>
  );
}
