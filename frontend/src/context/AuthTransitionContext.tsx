import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";

const TARGET = "/dashboard/matches";

type AuthTransitionContextValue = {
  isLoggingIn: boolean;
  startLogin: () => void;
  reset: () => void;
};

const AuthTransitionContext = createContext<AuthTransitionContextValue | null>(null);

export function AuthTransitionProvider({ children }: { children: React.ReactNode }) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { ready, authenticated } = usePrivy();
  const navigate = useNavigate();

  // When login is underway and we observe authenticated, redirect and reset
  useEffect(() => {
    if (isLoggingIn && ready && authenticated) {
      navigate(TARGET, { replace: true });
      setIsLoggingIn(false);
    }
  }, [isLoggingIn, ready, authenticated, navigate]);

  const startLogin = useCallback(() => {
    setIsLoggingIn(true);
  }, []);

  const reset = useCallback(() => {
    setIsLoggingIn(false);
  }, []);

  return (
    <AuthTransitionContext.Provider value={{ isLoggingIn, startLogin, reset }}>
      {children}
    </AuthTransitionContext.Provider>
  );
}

export function useAuthTransition() {
  const ctx = useContext(AuthTransitionContext);
  if (!ctx) throw new Error("useAuthTransition must be used within AuthTransitionProvider");
  return ctx;
}
