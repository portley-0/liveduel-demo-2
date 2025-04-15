import { useLoginWithOAuth } from "@privy-io/react-auth";

export function useGoogleLogin() {
  const { initOAuth } = useLoginWithOAuth();

  const googleLogin = async () => {
    try {
      await initOAuth({ provider: "google", disableSignup: false });
    } catch (err) {
      console.error("Google login failed:", err);
    }
  };

  return { googleLogin };
}
