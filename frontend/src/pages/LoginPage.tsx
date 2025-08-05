import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import LoginModal from "../components/LoginModal.tsx";

const TARGET = "/dashboard/matches";

function LoginPage() {
  const { ready, authenticated } = usePrivy();
  const [showModal, setShowModal] = useState(false);

  // Wait for Privy to initialize before deciding
  useEffect(() => {
    if (!ready) {
      setShowModal(false);
      return;
    }
    if (authenticated) {
      setShowModal(false);
      return;
    }
    // small debounce to avoid flash
    const t = setTimeout(() => setShowModal(true), 100);
    return () => clearTimeout(t);
  }, [ready, authenticated]);

  if (!ready) {
    // nothing while initializing (you could replace with a minimal loader if desired)
    return null;
  }

  if (authenticated) {
    return <Navigate to={TARGET} replace />;
  }

  if (showModal) {
    return (
      <div className="w-full min-h-screen">
        <LoginModal />
      </div>
    );
  }

  return null;
}

export default LoginPage;
