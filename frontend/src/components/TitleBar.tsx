"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FaChartLine, FaFutbol, FaCreditCard, FaCoins } from "react-icons/fa";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { FaRegMoneyBillAlt } from "react-icons/fa";
import { MdAccountBalanceWallet } from "react-icons/md";
import { RiMenuLine } from "react-icons/ri";
import { useAccount, useReadContract } from "wagmi";
import { Dialog } from "@headlessui/react";
import { ethers } from "ethers";

const mUSDCABI = [
  {
    constant: true,
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
];
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
const mUSDCAddress = "0x7AE068827338662D81Dd2BD9194bd2D4663E65Ae";

const TitleBar = () => {
  const [isMobile, setIsMobile] = useState(false);
  const { address } = useAccount();
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [processingUSDC, setProcessingUSDC] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);

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

  const closeDrawer = () => {
    const drawerToggle = document.getElementById("my-drawer") as HTMLInputElement | null;
    if (drawerToggle) drawerToggle.checked = false;
  };

  useEffect(() => {
    if (address && !sessionStorage.getItem("claimedModalShown")) {
      setShowClaimModal(true);
      sessionStorage.setItem("claimedModalShown", "true");
    }
  }, [address]);

  const handleMintUSDC = async () => {
    if (!ethers.isAddress(address)) {
      alert("Invalid wallet address.");
      return;
    }
    setProcessingUSDC(true);
    try {
      const response = await fetch(`${SERVER_URL}/mint-usdc/${address}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Minting mUSDC failed");
      setShowClaimModal(false);
    } catch (err: any) {
      console.error(err);
      alert(`Minting mUSDC failed: ${err.message || "Unknown error"}`);
    } finally {
      setProcessingUSDC(false);
    }
  };

  const navItems = [
    { path: "/dashboard/matches", label: "Markets", icon: FaChartLine, activePaths: ["/dashboard/matches", "/dashboard/tournaments"] },
    { path: "/dashboard/predictions", label: "Predictions", icon: FaFutbol },
    { path: "/dashboard/get-funds", label: "Get Funds", icon: FaRegMoneyBillAlt },
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
                className="drawer-button bg-transparent border-0 text-white rounded-full hover:bg-gray-200 hover:text-darkblue select-none z-50 flex items-center justify-center w-11 h-11 flex-shrink-0 md:w-12 md:h-12"
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
                  className="object-contain select-none sm:h-[50px] sx:h-[50px] xxs:h-[48px] xxs:-ml-4"
                />
              </NavLink>
            </div>

            <div className="flex items-center space-x-4 lg:space-x-6">
              {!isMobile && (
                <div className="flex items-center gap-4 select-none">
                  {navItems.map(({ path, label, icon: Icon, activePaths }) => (
                    <NavLink
                      key={path}
                      to={path}
                      className={({ isActive }) =>
                        `group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                          isActive || (activePaths && activePaths.some(p => window.location.pathname.startsWith(p)))
                            ? "!text-redmagenta"
                            : "text-white"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`text-lg lg:text-xl ${
                              isActive || (activePaths && activePaths.some(p => window.location.pathname.startsWith(p)))
                                ? "text-redmagenta group-hover:opacity-80"
                                : "text-white group-hover:text-gray-200/80"
                            }`}
                          />
                          <span
                            className={`text-xs lg:text-sm capitalize ${
                              isActive || (activePaths && activePaths.some(p => window.location.pathname.startsWith(p)))
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
                })  => {
                  const ready = mounted;
                  const connected = ready && account;

                  return (
                    <button
                      onClick={connected ? openAccountModal : openConnectModal}
                      className={`
                        btn text-white w-auto
                        px-3 h-[28px] sm:px-3 sm:h-[28px]
                        md:px-4 md:h-[30px] lg:px-5 lg:h-[34px]
                        text-md sm:text-sm rounded-full select-none
                        flex items-center justify-center gap-2 whitespace-nowrap
                        transition-all bg-darkblue border-2 border-white
                        hover:text-gray-300 hover:border-gray-300 xxs:-mr-2
                        ${connected
                          ? "[@media(max-width:350px)]:px-1.5 [@media(max-width:350px)]:!h-[10px] [@media(max-width:350px)]:text-sm [@media(max-width:350px)]:gap-1"
                          : ""
                        }
                      `}
                    >
                      {connected ? (
                        <>
                          <MdAccountBalanceWallet
                            className={`
                              text-lg sm:text-md
                              max-[350px]:text-sm
                            `}
                          />
                          <span className="hidden sm:inline">
                            {account.address.slice(0, 6)}…{account.address.slice(-4)}
                          </span>
                          <span
                            className="
                              sm:hidden hidden
                              [@media(min-width:330px)_and_(max-width:350px)]:inline
                              [@media(min-width:330px)_and_(max-width:350px)]:text-xs
                            "
                          >
                            {account.address.slice(0, 3)}…
                          </span>
                          <span
                            className="
                              sm:hidden inline
                              [@media(min-width:330px)_and_(max-width:350px)]:hidden
                              text-xs
                            "
                          >
                            {account.address.slice(0, 4)}…
                          </span>
                          {connector?.icon && (
                            <img
                              src={connector.icon}
                              alt={connector.name}
                              className={`
                                w-4 h-4 sm:w-3 sm:h-3
                                max-[350px]:w-2 max-[350px]:h-2
                              `}
                              onError={(e) => (e.currentTarget.style.display = "none")}
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
              {navItems.map(({ path, label, icon: Icon, activePaths }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `group btn flex flex-col items-center justify-center w-1/3 p-0 m-0 bg-darkblue border-none hover:bg-transparent ${
                      isActive || (activePaths && activePaths.some(p => window.location.pathname.startsWith(p)))
                        ? "!text-redmagenta"
                        : "text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`text-lg lg:text-xl ${
                          isActive || (activePaths && activePaths.some(p => window.location.pathname.startsWith(p)))
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
                    onClick={() => {
                      connected ? openAccountModal() : openConnectModal();
                      closeDrawer();
                    }}
                  >
                    <p className="font-[Lato-Bold] text-lg text-white">
                      Balance: ${displayBalance} mUSDC
                    </p>
                  </li>
                );
              }}
            </ConnectButton.Custom>
            <hr className="border-gray-700 my-2" />
            {navItems.map(({ path, label, activePaths }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  onClick={closeDrawer}
                  className={({ isActive }) =>
                    `font-[Lato-Bold] text-lg text-white mb-4 ${
                      isActive || (activePaths && activePaths.some(p => window.location.pathname.startsWith(p)))
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
      <Dialog open={showClaimModal} onClose={() => setShowClaimModal(false)} className="fixed inset-0 flex items-center justify-center z-50">
        <div className="fixed inset-0 bg-black opacity-50"></div>
        <div className="bg-greyblue p-6 rounded-xl shadow-lg w-full max-w-sm sm:max-w-[280px] mx-auto text-center relative z-50">
          <button
            onClick={() => setShowClaimModal(false)}
            className="absolute top-2 right-2 text-white hover:text-gray-300 transition"
            aria-label="Close modal"
          >
            <IoIosCloseCircleOutline className="text-2xl sm:text-xl text-white" />
          </button>
          <h2 className="text-white text-2xl sm:text-xl font-semibold mb-3">Claim Free Bets</h2>
          <p className="text-gray-300 text-lg sm:text-base mb-1">You can claim</p>
          <p className="text-white font-bold text-lg sm:text-base mb-4">2000 mUSDC</p>
          <button
            onClick={handleMintUSDC}
            disabled={processingUSDC}
            className="mt-2 bg-greyblue border-2 border-white hover:border-blue-500 text-white font-semibold px-6 py-2 sm:px-4 sm:py-1.5 rounded-full transition disabled:opacity-50"
          >
            {processingUSDC ? "Claiming..." : "Claim Now"}
          </button>
        </div>
      </Dialog>
    </>
  );
};

export default TitleBar;