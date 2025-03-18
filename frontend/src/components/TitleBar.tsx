"use client";

import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FaChartLine, FaFutbol, FaCreditCard, FaCoins } from "react-icons/fa";

const TitleBar = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    handleResize();
    window.addEventListener("resize", debouncedResize);
    return () => window.removeEventListener("resize", debouncedResize);
  }, []);

  const navItems = [
    { path: "/dashboard/markets", label: "Markets", icon: FaChartLine },
    { path: "/dashboard/predictions", label: "My Predictions", icon: FaFutbol },
    { path: "/dashboard/buy", label: "Buy $Duel", icon: FaCreditCard },
    { path: "/dashboard/stake", label: "Staking", icon: FaCoins },
  ];

  return (
    <>
      <div className="drawer">
        <input id="my-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content">
          <header className="flex items-center justify-between px-4 py-2 bg-darkblue h-[84px] shadow-md z-50 select-none">
            <div className="flex items-center space-x-2 select-none">
              <label
                htmlFor="my-drawer"
                className="drawer-button btn bg-transparent border-0 text-white text-3xl rounded-full hover:bg-gray-200 hover:text-darkblue select-none z-50 flex items-center justify-center w-12 h-12"
              >
                &#9776;
              </label>

              <NavLink
                to="/"
                className="btn bg-transparent border-none hover:bg-transparent select-none p-0 hover:opacity-80 translate-y-[3px]"
              >
                <img
                  src="/images/Liveduel-Logo.png"
                  alt="Liveduel Logo"
                  width={200}
                  height={62}
                  className="object-contain select-none"
                />
              </NavLink>

            </div>

            <div className="flex items-center space-x-4 lg:space-x-6">
              {!isMobile && (
                <div className="flex items-center gap-4 select-none">
                  {navItems.map(({ path, label, icon: Icon }) => (
                    <NavLink
                      key={path}
                      to={path}
                      className={({ isActive }) =>
                        `group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                          isActive ? "!text-redmagenta" : "text-white"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`text-lg lg:text-xl ${
                              isActive
                                ? "text-redmagenta group-hover:opacity-80" 
                                : "text-white group-hover:text-gray-200/80"
                            }`}
                          />
                          <span
                            className={`text-xs lg:text-sm capitalize ${
                              isActive
                                ? "text-redmagenta group-hover:opacity-80" 
                                : "text-white group-hover:text-gray-200/80"
                            }`}
                          >
                            {label}
                          </span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
              <NavLink
                to="/login"
                className="btn hover:bg-darkblue bg-darkblue border-2 border-white text-white hover:text-redmagenta 
                          w-[70px] h-[34px] 
                          sm:w-[70px] sm:h-[34px] 
                          md:w-[70px] md:h-[34px] 
                          lg:w-[70px] lg:h-[34px] 
                          text-lg sm:text-sm md:text-base 
                          rounded-full hover:border-redmagenta select-none flex items-center justify-center whitespace-nowrap"
              >
                Log in
              </NavLink>

            </div>
          </header>

          {isMobile && (
            <div className="fixed bottom-0 w-full bg-darkblue flex justify-around py-2 shadow-xl z-50">
              {navItems.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                      isActive ? "!text-redmagenta" : "text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`text-lg lg:text-xl ${
                          isActive
                            ? "text-redmagenta group-hover:opacity-80"
                            : "text-white group-hover:text-gray-300"
                        }`}
                      />
                      <span
                        className={`text-xs lg:text-sm capitalize ${
                          isActive
                            ? "text-redmagenta group-hover:opacity-80"
                            : "text-white group-hover:text-gray-300"
                        }`}
                      >
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <div className="drawer-side z-50">
          <label htmlFor="my-drawer" className="drawer-overlay fixed z-50"></label>
          <ul className="menu bg-greyblue text-base-content min-h-full w-80 p-4 z-50">
            {navItems.map(({ path, label }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  className={({ isActive }) =>
                    `font-[Lato-Bold] text-lg text-white mb-4 ${
                      isActive ? "!text-redmagenta" : "text-white hover:text-gray-300"
                    }`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};

export default TitleBar;