import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import TitleBar from "@/components/TitleBar.tsx";
import { lazy, Suspense } from "react";

const Matches = lazy(() => import("@/pages/Matches.tsx"));
const Tournaments = lazy(() => import("@/pages/Tournaments.tsx"));
const Match = lazy(() => import("@/pages/Match.tsx"));
const Tournament = lazy(() => import("@/pages/Tournament.tsx"));
const Predictions = lazy(() => import("@/pages/Predictions.tsx"));
const GetFunds = lazy(() => import("@/pages/GetFunds.tsx"));
const LoginPage = lazy(() => import("@/pages/LoginPage.tsx"));

const App: React.FC = () => {
  const { pathname } = useLocation();
  const isLogin = pathname === "/login" || pathname === "/auth/callback";


  useEffect(() => {
    if (pathname === "/login") {
      document.title = "𝗟𝗼𝗴 𝗶𝗻 𝘁𝗼 𝗟𝗶𝘃𝗲𝗗𝘂𝗲𝗹";
    } else {
      document.title = "𝗟𝗶𝘃𝗲𝗗𝘂𝗲𝗹 𝗗𝗲𝗺𝗼 𝟮";
    }
  }, [pathname]);

  useEffect(() => {
    const routesToPrefetch = [
      () => import("@/pages/Matches.tsx"),
      () => import("@/pages/Tournaments.tsx"),
      () => import("@/pages/Match.tsx"),
      () => import("@/pages/Tournament.tsx"),
      () => import("@/pages/Predictions.tsx"),
      () => import("@/pages/GetFunds.tsx"),
      () => import("@/pages/LoginPage.tsx"),
    ];

    routesToPrefetch.forEach((preloadRoute) => {
      const idleCallback = window.requestIdleCallback || function (cb: any) { setTimeout(cb, 1); };
      idleCallback(() => preloadRoute());
    });
  }, []);

  return (
    <div className="bg-darkblue min-h-screen flex flex-col">
      {!isLogin && (
        <div className="fixed top-0 left-0 w-full z-50">
          <TitleBar />
        </div>
      )}

      <div
        className={`flex-grow min-h-screen overflow-y-auto bg-darkblue ${isLogin ? "" : "pt-[84px]"}`}
      >
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex justify-center items-center">
              <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
            </div>
          }
        >
          <Routes>
            <Route
              path="/login"
              element={
                <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/50">
                  <div className="relative w-full max-w-md mx-4">
                    <LoginPage />
                  </div>
                </div>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard/matches" replace />} />
            <Route path="/dashboard/matches" element={<Matches />} />
            <Route path="/dashboard/tournaments" element={<Tournaments />} />
            <Route path="/dashboard/matches/:matchId" element={<Match />} />
            <Route path="/dashboard/tournaments/:tournamentId" element={<Tournament />} />
            <Route path="/dashboard/predictions" element={<Predictions />} />
            <Route path="/dashboard/get-funds" element={<GetFunds />} />
            <Route path="*" element={<Navigate to="/dashboard/matches" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
};

export default App;
