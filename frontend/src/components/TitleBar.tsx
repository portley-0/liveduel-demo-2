"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FaChartLine, FaFutbol, FaCreditCard, FaCoins } from "react-icons/fa";
import { FaRegMoneyBillAlt } from "react-icons/fa";
import { MdAccountBalanceWallet } from "react-icons/md";
import { RiMenuLine } from "react-icons/ri";
import { useAccount, useReadContract } from "wagmi";

const mUSDCABI = [
  {
    constant: true,
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
];

const mUSDCAddress = "0xB1cC53DfF11c564Fbe22145a0b07588e7648db74";

const TitleBar = () => {
  const [isMobile, setIsMobile] = useState(false);
  const { address } = useAccount();

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
    { path: "/dashboard/predictions", label: "Predictions", icon: FaFutbol },
    { path: "/dashboard/get-funds", label: "Get Funds", icon: FaRegMoneyBillAlt },
    { path: "/dashboard/buy", label: "Buy $Duel", icon: FaCreditCard },
    { path: "/dashboard/stake", label: "Staking", icon: FaCoins },
  ];

  const { data: balance, isError, isLoading, refetch } = useReadContract({
    address: mUSDCAddress,
    abi: mUSDCABI,
    functionName: "balanceOf",
    args: [address],
  });

  useEffect(() => {
    if (!address) return;
    const intervalId = setInterval(() => {
      refetch();
    }, 15000); 
    return () => clearInterval(intervalId);
  }, [address, refetch]);

  const formattedBalance =
    !isLoading && !isError && balance
      ? (parseFloat(balance.toString()) / 1000000).toFixed(2)
      : null;

  return (
    <>
      <div className="drawer">
        <input id="my-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content">
          <header className="flex items-center justify-between px-4 py-2 bg-darkblue h-[84px] shadow-md z-50 select-none">
            <div className="flex items-center space-x-2 select-none">
              <label
                htmlFor="my-drawer"
                className="drawer-button bg-transparent border-0 text-white rounded-full hover:bg-gray-200 hover:text-darkblue select-none z-50 flex items-center justify-center w-12 h-12"
              >
                <RiMenuLine className="!text-3xl !sm:text-2xl" />
              </label>
              <NavLink
                to="/"
                className="btn bg-transparent border-none hover:bg-transparent select-none p-0 hover:opacity-80"
              >
                <img
                  src="/images/Liveduel-Logo.png"
                  alt="Liveduel Logo"
                  width={200}
                  height={62}
                  className="object-contain select-none sm:h-[50px] sx:h-[50px]"
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


              <ConnectButton.Custom>
                {({
                  account,
                  openConnectModal,
                  openAccountModal,
                  mounted,
                  connector,
                }: {
                  account: { address: string } | null;
                  openConnectModal: () => void;
                  openAccountModal: () => void;
                  mounted: boolean;
                  connector: { icon: string; name: string } | null;
                }) => {
                  const ready = mounted;
                  const connected = ready && account;

                  return (
                    <button
                      onClick={connected ? openAccountModal : openConnectModal}
                      className={`btn text-white w-auto min-w-[100px] px-3 h-[28px] sm:px-2 sm:h-[26px] md:px-4 md:h-[30px] lg:px-5 lg:h-[34px] text-md sm:text-sm md:text-sm rounded-full select-none flex items-center justify-center gap-2 whitespace-nowrap transition-all ${
                        connected
                          ? "bg-darkblue border-2 border-white hover:text-gray-300 hover:border-gray-300"
                          : "bg-darkblue border-2 border-white hover:text-gray-300 hover:border-gray-300"
                      }`}
                    >
                      {connected ? (
                        <>
                          <MdAccountBalanceWallet className="text-lg sm:text-md" />
                          <span className="hidden sm:inline">
                            {account.address.slice(0, 6)}...{account.address.slice(-4)}
                          </span>
                          <span className="sm:hidden">
                            {account.address.slice(0, 4)}..
                          </span>
                          {connector?.icon && (
                            <img
                              src={connector.icon}
                              alt={connector.name}
                              className="w-4 h-4 sm:w-3 sm:h-3"
                              onError={(e) =>
                                (e.currentTarget.style.display = "none")
                              }
                            />
                          )}
                        </>
                      ) : (
                        "Log in"
                      )}
                    </button>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </header>
          
          {isMobile && (
            <div className="fixed bottom-0 w-full bg-darkblue flex py-2 shadow-xl z-50">
              {navItems.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `group btn flex flex-col items-center justify-center w-1/5 p-0 m-0 bg-darkblue border-none hover:bg-transparent ${
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
                        className={`w-full text-center text-xs lg:text-sm capitalize whitespace-nowrap`}
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
          <ul className="menu bg-gray-900 text-base-content min-h-full w-80 p-4 z-50">
            <ConnectButton.Custom>
              {({
                account,
                openConnectModal,
                openAccountModal,
                mounted,
              }: {
                account: { address: string } | null;
                openConnectModal: () => void;
                openAccountModal: () => void;
                mounted: boolean;
              }) => {
                const ready = mounted;
                const connected = ready && account;
                const displayBalance = isLoading
                  ? "Loading..."
                  : (formattedBalance || "0.00");
                return (
                  <li
                    className="mb-4 cursor-pointer"
                    onClick={connected ? openAccountModal : openConnectModal}
                  >
                    <p className="font-[Lato-Bold] text-lg text-white">
                      Balance: ${displayBalance} mUSDC 
                    </p>
                  </li>
                );
              }}
            </ConnectButton.Custom>
            <hr className="border-gray-700 my-2" />
            {navItems.map(({ path, label }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  className={({ isActive }) =>
                    `font-[Lato-Bold] text-lg text-white mb-4 ${
                      isActive
                        ? "!text-redmagenta"
                        : "text-white hover:text-gray-300"
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
