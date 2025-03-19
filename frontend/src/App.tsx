import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TitleBar from "@/components/TitleBar.tsx";
import { lazy, Suspense } from "react";

const Markets = lazy(() => import("@/pages/Markets.tsx"));
const Market = lazy(() => import("@/pages/Match.tsx"));
const Predictions = lazy(() => import("@/pages/Predictions.tsx"));
const BuyDuel = lazy(() => import("@/pages/BuyDuel.tsx"));
const Staking = lazy(() => import("@/pages/Staking.tsx"));

const App: React.FC = () => {
  useEffect(() => {
    const routesToPrefetch = [
      () => import("@/pages/Markets.tsx"),
      () => import("@/pages/Match.tsx"), 
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
      <div className="fixed top-0 left-0 w-full z-50">
        <TitleBar />
      </div>

      <div className="flex-grow min-h-screen overflow-y-auto mt-[84px] bg-darkblue">
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

