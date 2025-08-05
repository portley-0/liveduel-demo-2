"use client";
import { useState, useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { FaChartLine, FaFutbol, FaRegMoneyBillAlt } from "react-icons/fa";
import { RiMenuLine } from "react-icons/ri";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { Dialog } from "@headlessui/react";
import { usePrivy } from "@privy-io/react-auth";
import { UserPill } from "@privy-io/react-auth/ui";
import { BrowserProvider, Contract, formatUnits, isAddress, JsonRpcProvider } from "ethers";

const mUSDCABI = [
  {
    constant: true,
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
];
const mUSDCAddress = "0x78FD2A3454A4F37C5518FE7E8AB07001DC0572Ce";
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL;

const truncateAddress = (addr: string) => {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const FUJI_CHAIN_ID = 43113;

const getInjectedProvider = (): BrowserProvider | null => {
  if (
    typeof window !== "undefined" &&
    (window as any).ethereum &&
    typeof (window as any).ethereum.request === "function"
  ) {
    return new BrowserProvider((window as any).ethereum as any);
  }
  return null;
};

const getProviderForRead = async (): Promise<BrowserProvider | JsonRpcProvider> => {
  const injected = getInjectedProvider();
  if (injected) {
    try {
      const network = await injected.getNetwork();
      const chainIdBigInt =
        typeof network.chainId === "bigint" ? network.chainId : BigInt(network.chainId);
      if (chainIdBigInt === BigInt(FUJI_CHAIN_ID)) {
        return injected;
      }
    } catch {
      // ignore and fallback
    }
  }
  return new JsonRpcProvider(FUJI_RPC);
};

const TitleBar: React.FC = () => {
  const { ready, authenticated, user } = usePrivy();
  const [isMobile, setIsMobile] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [processingUSDC, setProcessingUSDC] = useState(false);
  const [totalTxs, setTotalTxs] = useState(0);
  const [balance, setBalance] = useState<string | null>(null);

  type LinkedAccount = {
    address?: string;
    [key: string]: any;
  };

  const walletAddress = useMemo<string | null>(() => {
    const linked: any = user?.linkedAccounts;
    if (!Array.isArray(linked)) return null;

    for (const entry of linked as LinkedAccount[]) {
      if (
        entry?.address &&
        typeof entry.address === "string" &&
        entry.address.startsWith("0x") &&
        isAddress(entry.address)
      ) {
        return entry.address;
      }
    }
    return null;
  }, [user]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    let timeout: number;
    const debounced = () => {
      clearTimeout(timeout);
      // @ts-ignore
      timeout = window.setTimeout(onResize, 100);
    };
    onResize();
    window.addEventListener("resize", debounced);
    return () => window.removeEventListener("resize", debounced);
  }, []);

  useEffect(() => {
    const query = `
      query GetTotalTxs {
        platformStats(id: "platform-stats") { totalTxs }
      }
    `;
    const fetchTotal = async () => {
      if (!SUBGRAPH_URL) return;
      try {
        const resp = await fetch(SUBGRAPH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const { data } = await resp.json();
        if (data?.platformStats) setTotalTxs(Number(data.platformStats.totalTxs));
      } catch (e) {
        console.error("Failed to fetch total txs", e);
      }
    };
    fetchTotal();
    const id = setInterval(fetchTotal, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (authenticated && !sessionStorage.getItem("claimedModalShown")) {
      setShowClaimModal(true);
      sessionStorage.setItem("claimedModalShown", "true");
    }
  }, [authenticated]);

  useEffect(() => {
    if (!walletAddress) {
      setBalance(null);
      return;
    }

    const updateBalance = async () => {
      if (!walletAddress) return;
      try {
        const provider = await getProviderForRead();

        // ensure contract exists at address
        const code = await provider.getCode(mUSDCAddress);
        if (code === "0x") {
          console.warn("No contract code at mUSDC address on current provider; cannot fetch balance.", {
            contractAddress: mUSDCAddress,
            provider: provider instanceof BrowserProvider ? "BrowserProvider" : "JsonRpcProvider",
          });
          setBalance(null);
          return;
        }

        const contract = new Contract(mUSDCAddress, mUSDCABI, provider);
        const bal: bigint = await contract.balanceOf(walletAddress);
        setBalance(parseFloat(formatUnits(bal, 6)).toFixed(2));
      } catch (e) {
        console.error("Failed fetching on-chain mUSDC balance", e);
        setBalance(null);
      }
    };

    updateBalance();
    const id = setInterval(updateBalance, 15000);
    return () => clearInterval(id);
  }, [walletAddress]);

  const handleMintUSDC = async () => {
    if (!authenticated || !user || !walletAddress) {
      alert("Log in and connect wallet first");
      return;
    }
    setProcessingUSDC(true);
    try {
      const resp = await fetch(`${SERVER_URL}/mint-usdc/${user.id}`, {
        method: "POST",
        credentials: "include",
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Mint failed");

      const provider = await getProviderForRead();
      const contract = new Contract(mUSDCAddress, mUSDCABI, provider);
      const bal: bigint = await contract.balanceOf(walletAddress);
      setBalance(parseFloat(formatUnits(bal, 6)).toFixed(2));

      setShowClaimModal(false);
    } catch (e: any) {
      console.error(e);
      alert(`Claim failed: ${e.message}`);
    } finally {
      setProcessingUSDC(false);
    }
  };

  const closeDrawer = () => {
    const chk = document.getElementById("my-drawer") as HTMLInputElement | null;
    if (chk) chk.checked = false;
  };

  const navItems = [
    {
      path: "/dashboard/matches",
      label: "Markets",
      icon: FaChartLine,
      activePaths: ["/dashboard/matches", "/dashboard/tournaments"],
    },
    { path: "/dashboard/predictions", label: "Predictions", icon: FaFutbol, activePaths: [] },
    { path: "/dashboard/get-funds", label: "Get Funds", icon: FaRegMoneyBillAlt, activePaths: [] },
  ];

  const logoImageElement = (
    <img
      src="/images/Liveduel-Logo.png"
      alt="Liveduel Logo"
      width={200}
      height={62}
      className="object-contain select-none sm:h-[50px] sx:h-[50px] xxs:h-[48px] xxs:-ml-4"
    />
  );

  return (
    <>
      <div className="drawer">
        <input id="my-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content">
          <header className="flex items-center justify-between px-4 py-2 bg-darkblue h-[84px] z-50 select-none">
            <div className="flex items-center space-x-2 select-none">
              <label
                htmlFor="my-drawer"
                className="drawer-button bg-transparent border-0 text-white rounded-full hover:bg-gray-200 hover:text-darkblue select-none z-50 flex items-center justify-center w-11 h-11 flex-shrink-0 md:w-12 md:h-12"
              >
                <RiMenuLine className="!text-3xl !sm:text-2xl" />
              </label>
              <NavLink to="/" className="btn bg-transparent border-none hover:bg-transparent select-none p-0 hover:opacity-80">
                {logoImageElement}
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

              <div className="flex items-center gap-2 relative z-[3000] overflow-visible">
                {authenticated && walletAddress ? (
                  <UserPill
                    action={{ type: "connectWallet" }}
                    size={32}
                    label={
                      <div className="btn text-white px-3 h-[28px] sm:px-3 sm:h-[28px] md:px-4 md:h-[30px] lg:px-5 lg:h-[34px] text-md sm:text-sm rounded-full select-none flex items-center justify-center gap-2 whitespace-nowrap transition-all bg-darkblue border-2 border-white hover:text-gray-300 hover:border-gray-300">
                        <span className="hidden sm:inline">{truncateAddress(walletAddress)}</span>
                        <span className="inline sm:hidden text-xs">{truncateAddress(walletAddress)}</span>
                      </div>
                    }
                  />
                ) : (
                  <NavLink
                    to="/login"
                    replace
                    className="btn text-white px-4 py-2 rounded-full bg-darkblue border-2 border-white hover:text-gray-300 hover:border-gray-300 select-none"
                  >
                    Log in
                  </NavLink>
                )}
              </div>
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
                      <span className="w-full text-center text-xs lg:text-sm capitalize whitespace-nowrap">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <div className="drawer-side z-50">
          <label htmlFor="my-drawer" className="drawer-overlay fixed" />
          <ul className="menu bg-gray-900 text-base-content min-h-full w-80 p-4">
            {!(authenticated && walletAddress) ? (
              <li className="mb-4">
                <NavLink to="/login" onClick={closeDrawer} className="font-[Lato-Bold] text-lg text-white hover:text-gray-300">
                  Log in
                </NavLink>
              </li>
            ) : (
              <li className="mb-4">
                <p className="font-[Lato-Bold] text-lg text-white">
                  Balance: ${balance ?? "0.00"} mUSDC
                </p>
              </li>
            )}
            <hr className="border-gray-700 my-2" />
            {navItems.map(({ path, label, activePaths }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  onClick={closeDrawer}
                  className={({ isActive }) =>
                    `font-[Lato-Bold] text-lg mb-4 ${
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
            <li className="mt-auto">
              <p className="font-semibold text-md text-gray-400 pointer-events-none">
                Total Txs: {totalTxs > 0 ? totalTxs.toLocaleString() : "..."}
              </p>
            </li>
          </ul>
        </div>
      </div>

      <Dialog
        open={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        className="fixed inset-0 flex items-center justify-center z-50"
      >
        <div className="fixed inset-0 bg-black opacity-50" />
        <div className="bg-greyblue p-6 rounded-xl shadow-lg w-full max-w-sm sm:max-w-[280px] mx-auto text-center relative z-50">
          <button
            onClick={() => setShowClaimModal(false)}
            className="absolute top-2 right-2 text-white hover:text-gray-300 transition"
            aria-label="Close"
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
