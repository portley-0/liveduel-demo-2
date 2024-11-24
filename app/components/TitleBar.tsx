'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaChartLine, FaFutbol, FaCreditCard, FaCoins } from 'react-icons/fa';
import { usePathname } from 'next/navigation';

const TitleBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [activePath, setActivePath] = useState(pathname);
  const [isMobile, setIsMobile] = useState(false);

  // Detect screen size for mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prefetch routes
  useEffect(() => {
    const routesToPrefetch = [
      '/dashboard/markets',
      '/dashboard/predictions',
      '/dashboard/buy',
      '/dashboard/stake',
    ];
    routesToPrefetch.forEach((route) => router.prefetch(route));
  }, [router]);

  // Handle click with immediate view change
  const handleClick = (path: string) => {
    if (activePath !== path) {
      setActivePath(path); // Update active path immediately for UI feedback
      router.push(path); // Navigate to the new route
    }
  };

  return (
    <>
      <div className="drawer">
        <input id="my-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-2 bg-darkblue h-[84px] shadow-md z-40 select-none">
            {/* Left Section: Drawer and Logo */}
            <div className="flex items-center space-x-2 select-none">
              {/* Drawer Icon */}
              <label
                htmlFor="my-drawer"
                className="drawer-button btn bg-transparent border-0 text-white text-3xl rounded-full hover:bg-gray-200 hover:text-darkblue select-none z-50"
                style={{
                  width: '50px',
                  height: '50px',
                  marginTop: '-5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                &#9776;
              </label>
              {/* Logo */}
              <button
                onClick={() => router.push('/')}
                className="btn bg-transparent border-none hover:bg-transparent select-none p-0 hover:opacity-80"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <Image
                  src="/Liveduel-Logo.png"
                  alt="Liveduel Logo"
                  width={200}
                  height={62}
                  className="object-contain select-none"
                />
              </button>
            </div>

            {/* Right Section: Options Icons and Login */}
            <div className="flex items-center space-x-4 lg:space-x-6">
              {!isMobile && (
                <div className="flex items-center gap-4 select-none">
                  <button
                    className={`group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                      activePath === '/dashboard/markets' ? '!text-redmagenta' : 'text-white'
                    }`}
                    onClick={() => handleClick('/dashboard/markets')}
                  >
                    <FaChartLine
                      className={`text-lg lg:text-xl ${
                        activePath === '/dashboard/markets'
                          ? '!text-redmagenta'
                          : 'group-hover:text-gray-300'
                      }`}
                    />
                    <span
                      className={`text-xs lg:text-sm capitalize ${
                        activePath === '/dashboard/markets'
                          ? '!text-redmagenta'
                          : 'group-hover:text-gray-300'
                      }`}
                    >
                      Markets
                    </span>
                  </button>
                  <button
                    className={`group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                      activePath === '/dashboard/predictions' ? '!text-redmagenta' : 'text-white'
                    }`}
                    onClick={() => handleClick('/dashboard/predictions')}
                  >
                    <FaFutbol
                      className={`text-lg lg:text-xl ${
                        activePath === '/dashboard/predictions'
                          ? '!text-redmagenta'
                          : 'group-hover:text-gray-300'
                      }`}
                    />
                    <span
                      className={`text-xs lg:text-sm capitalize ${
                        activePath === '/dashboard/predictions'
                          ? '!text-redmagenta'
                          : 'group-hover:text-gray-300'
                      }`}
                    >
                      My Predictions
                    </span>
                  </button>
                  <button
                    className={`group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                      activePath === '/dashboard/buy' ? '!text-redmagenta' : 'text-white'
                    }`}
                    onClick={() => handleClick('/dashboard/buy')}
                  >
                    <FaCreditCard
                      className={`text-lg lg:text-xl ${
                        activePath === '/dashboard/buy'
                          ? '!text-redmagenta'
                          : 'group-hover:text-gray-300'
                      }`}
                    />
                    <span
                      className={`text-xs lg:text-sm capitalize ${
                        activePath === '/dashboard/buy'
                          ? '!text-redmagenta'
                          : 'group-hover:text-gray-300'
                      }`}
                    >
                      Buy $Duel
                    </span>
                  </button>
                  <button
                    className={`group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                      activePath === '/dashboard/stake' ? '!text-redmagenta' : 'text-white'
                    }`}
                    onClick={() => handleClick('/dashboard/stake')}
                  >
                    <FaCoins
                      className={`text-lg lg:text-xl ${
                        activePath === '/dashboard/stake'
                          ? '!text-redmagenta'
                          : 'group-hover:text-gray-300'
                      }`}
                    />
                    <span
                      className={`text-xs lg:text-sm capitalize ${
                        activePath === '/dashboard/stake'
                          ? '!text-redmagenta'
                          : 'group-hover:text-gray-300'
                      }`}
                    >
                      Staking
                    </span>
                  </button>
                </div>
              )}
              <button
                className="btn hover:bg-darkblue bg-darkblue border-2 border-white text-white hover:text-redmagenta px-5 py-2 rounded-full text-lg lg:text-base hover:border-redmagenta select-none flex items-center justify-center whitespace-nowrap"
                onClick={() => router.push('/login')}
                style={{ lineHeight: '1', transform: 'translateY(-6px)', marginTop: '10px' }}
              >
                Log in
              </button>
            </div>
          </header>

          {isMobile && (
            <div className="fixed bottom-0 w-full bg-darkblue flex justify-around py-2 shadow-md z-50">
              <button
                className={`group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                  activePath === '/dashboard/markets' ? '!text-redmagenta' : 'text-white'
                }`}
                onClick={() => handleClick('/dashboard/markets')}
              >
                <FaChartLine
                  className={`text-lg lg:text-xl ${
                    activePath === '/dashboard/markets'
                      ? '!text-redmagenta'
                      : 'group-hover:text-gray-300'
                  }`}
                />
                <span
                  className={`text-xs lg:text-sm capitalize ${
                    activePath === '/dashboard/markets'
                      ? '!text-redmagenta'
                      : 'group-hover:text-gray-300'
                  }`}
                >
                  Markets
                </span>
              </button>
              <button
                className={`group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                  activePath === '/dashboard/predictions' ? '!text-redmagenta' : 'text-white'
                }`}
                onClick={() => handleClick('/dashboard/predictions')}
              >
                <FaFutbol
                  className={`text-lg lg:text-xl ${
                    activePath === '/dashboard/predictions'
                      ? '!text-redmagenta'
                      : 'group-hover:text-gray-300'
                  }`}
                />
                <span
                  className={`text-xs lg:text-sm capitalize ${
                    activePath === '/dashboard/predictions'
                      ? '!text-redmagenta'
                      : 'group-hover:text-gray-300'
                  }`}
                >
                  My Predictions
                </span>
              </button>
              <button
                className={`group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                  activePath === '/dashboard/buy' ? '!text-redmagenta' : 'text-white'
                }`}
                onClick={() => handleClick('/dashboard/buy')}
              >
                <FaCreditCard
                  className={`text-lg lg:text-xl ${
                    activePath === '/dashboard/buy'
                      ? '!text-redmagenta'
                      : 'group-hover:text-gray-300'
                  }`}
                />
                <span
                  className={`text-xs lg:text-sm capitalize ${
                    activePath === '/dashboard/buy'
                      ? '!text-redmagenta'
                      : 'group-hover:text-gray-300'
                  }`}
                >
                  Buy $Duel
                </span>
              </button>
              <button
                className={`group btn flex flex-col items-center bg-darkblue border-none hover:bg-transparent ${
                  activePath === '/dashboard/stake' ? '!text-redmagenta' : 'text-white'
                }`}
                onClick={() => handleClick('/dashboard/stake')}
              >
                <FaCoins
                  className={`text-lg lg:text-xl ${
                    activePath === '/dashboard/stake'
                      ? '!text-redmagenta'
                      : 'group-hover:text-gray-300'
                  }`}
                />
                <span
                  className={`text-xs lg:text-sm capitalize ${
                    activePath === '/dashboard/stake'
                      ? '!text-redmagenta'
                      : 'group-hover:text-gray-300'
                  }`}
                >
                  Staking
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Drawer Side Content */}
        <div className="drawer-side z-50">
          <label htmlFor="my-drawer" className="drawer-overlay fixed z-50"></label>
          <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4 z-50">
            <li>
              <button
                onClick={() => {
                  setActivePath('/dashboard/markets');
                  handleClick('/dashboard/markets');
                }}
                className={`font-[Lato-Bold] text-lg text-white mb-4 ${
                  activePath === '/dashboard/markets'
                    ? '!text-redmagenta'
                    : 'text-white hover:text-gray-300'
                }`}
              >
                Markets
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActivePath('/dashboard/predictions');
                  handleClick('/dashboard/predictions');
                }}
                className={`font-[Lato-Bold] text-lg text-white mb-4 ${
                  activePath === '/dashboard/predictions'
                    ? '!text-redmagenta'
                    : 'text-white hover:text-gray-300'
                }`}
              >
                My Predictions
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActivePath('/dashboard/buy');
                  handleClick('/dashboard/buy');
                }}
                className={`font-[Lato-Bold] text-lg text-white mb-4 ${
                  activePath === '/dashboard/buy'
                    ? '!text-redmagenta'
                    : 'text-white hover:text-gray-300'
                }`}
              >
                Buy $Duel
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActivePath('/dashboard/stake');
                  handleClick('/dashboard/stake');
                }}
                className={`font-[Lato-Bold] text-lg text-white mb-4 ${
                  activePath === '/dashboard/stake'
                    ? '!text-redmagenta'
                    : 'text-white hover:text-gray-300'
                }`}
              >
                Stake
              </button>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default TitleBar;
