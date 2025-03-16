import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TitleBar from "@/components/TitleBar.tsx";
import { lazy, Suspense } from "react";

const Markets = lazy(() => import("@/pages/Markets.tsx"));
const Market = lazy(() => import("@/pages/Market.tsx")); // Added this for dynamic match pages
const Predictions = lazy(() => import("@/pages/Predictions.tsx"));
const BuyDuel = lazy(() => import("@/pages/BuyDuel.tsx"));
const Staking = lazy(() => import("@/pages/Staking.tsx"));

const App: React.FC = () => {
  useEffect(() => {
    const routesToPrefetch = [
      () => import("@/pages/Markets.tsx"),
      () => import("@/pages/Market.tsx"), // Prefetch match details page
      () => import("@/pages/Predictions.tsx"),
      () => import("@/pages/BuyDuel.tsx"),
      () => import("@/pages/Staking.tsx"),
    ];

    routesToPrefetch.forEach((preloadRoute) => {
      window.requestIdleCallback(() => preloadRoute());
    });
  }, []);

  return (
    <div className="bg-darkblue min-h-screen flex flex-col">
      {/* Fixed TitleBar at the top */}
      <div className="fixed top-0 left-0 w-full z-50">
        <TitleBar />
      </div>

      {/* Page content below the TitleBar, scrollable */}
      <div className="flex-grow overflow-y-auto mt-[84px]">
        <Suspense fallback={<div className="text-white text-center"></div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard/markets" />} />
            <Route path="/dashboard/markets" element={<Markets />} />
            <Route path="/dashboard/markets/:matchId" element={<Market />} /> {/* Added dynamic route */}
            <Route path="/dashboard/predictions" element={<Predictions />} />
            <Route path="/dashboard/buy" element={<BuyDuel />} />
            <Route path="/dashboard/stake" element={<Staking />} />
            <Route path="*" element={<Navigate to="/dashboard/markets" />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
};

export default App;

