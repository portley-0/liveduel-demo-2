import React, { useState, useEffect, useRef } from "react";
import { useFilter } from "@/context/FilterContext.tsx";
import { useLocation, useNavigate } from "react-router-dom";

const LEAGUES = [
  { id: null, name: "All Leagues" },
  { id:34, name: "World Cup Qualifying" },
  //{ id: 13, name: "Copa Libertadores" },
  //{ id: 71, name: "Brasileirão Série A" },
  //{ id: 11, name: "Copa Sudamericana" },
  //{ id: 15, name: "Fifa Club World Cup" },
  //{ id:743, name: "UEFA Womens Championship" },
  //{ id: 130, name: "Copa Argentina" },
  //{ id: 239, name: "Categoría Primera A (Colombia)" },
  //{ id: 265, name: "Chilean Primera División" }
  //{ id: "uefa", name: "UEFA Leagues" },
  { id: 2, name: "UEFA Champions League" },
  //{ id: 3, name: "UEFA Europa League" },
  //{ id: 848, name: "UEFA Conference League" },
  { id: 39, name: "Premier League" },
  //{ id: 140, name: "La Liga" },
  //{ id: 78, name: "Bundesliga" },
  //{ id: 61, name: "Ligue 1" },
  //{ id: 135, name: "Serie A" },
];

const SORT_OPTIONS = [
  { id: "volume", name: "Volume" },
  { id: "date-asc", name: "Date (ASC)" },
  { id: "date-desc", name: "Date (DESC)" },
];

const MOBILE_BREAKPOINT = 768;

const BASE_SELECT_CLASS =
  "select select-sm select-ghost text-white bg-darkblue font-bold text-sm " +
  "transition-all duration-200 ease-in-out";

const CATEGORY_SELECT_CLASS = `${BASE_SELECT_CLASS} text-ellipsis md:text-clip md:overflow-visible md:whitespace-normal`;

const FilterMenu: React.FC = () => {
  const {
    selectedLeague,
    setSelectedLeague,
    sortBy,
    setSortBy,
    liveOnly,
    setLiveOnly,
    deployedOnly,
    setDeployedOnly,
  } = useFilter();

  const location = useLocation();
  const navigate = useNavigate();

  const categoryRef = useRef<HTMLSelectElement>(null);
  const categoryTextRef = useRef<HTMLSpanElement>(null);
  const sortRef = useRef<HTMLSelectElement>(null);

  const [categoryWidth, setCategoryWidth] = useState<string>("100%");
  const [sortWidth, setSortWidth] = useState<string>("100%");

  const isMobileViewport = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

  // Calculate widths for both dropdowns based on viewport and selected text
  useEffect(() => {
    const updateWidths = () => {
      const viewportWidth = window.innerWidth;
      if (viewportWidth >= MOBILE_BREAKPOINT) {
        // Desktop: size Category to selected text width, Sort by to auto
        if (categoryTextRef.current) {
          const textWidth = categoryTextRef.current.getBoundingClientRect().width;
          const padding = 46; // Slightly increased padding for arrow and spacing
          const calculatedWidth = Math.min(Math.max(textWidth + padding, 80), 300); // Min 80px, max 300px
          setCategoryWidth(`${calculatedWidth}px`);
        } else {
          setCategoryWidth("auto");
        }
        setSortWidth("auto");
      } else {
        // Mobile: calculate max width to avoid pushing buttons out
        const buttonSpace = 120; // Approx width for "Games" and "Futures" buttons
        const labelSpace = 60; // Approx width for "Category:" and "Sort by:" labels
        const padding = 16; // Account for container padding
        const availableWidth = viewportWidth - buttonSpace - labelSpace - padding;

        // Allocate 60% to category, 50% to sort, with caps
        setCategoryWidth(`${Math.min(availableWidth * 0.6, 200)}px`);
        setSortWidth(`${Math.min(availableWidth * 0.5, 120)}px`);
      }
    };

    updateWidths();
    window.addEventListener("resize", updateWidths);
    return () => window.removeEventListener("resize", updateWidths);
  }, [selectedLeague]);

  return (
    <div className="sticky top-0 z-20 bg-darkblue py-1 px-4 flex flex-col space-y-2">
      <h1 className="text-xs font-bold text-white">Markets</h1>

      <div className="flex items-center justify-between space-x-2 pb-1">
        <span className="text-sm font-bold text-white">Category:</span>
        <div className="relative flex-1 min-w-0">
          <span
            ref={categoryTextRef}
            className="absolute opacity-0 pointer-events-none whitespace-nowrap text-sm font-bold"
          >
            {LEAGUES.find((l) => l.id === selectedLeague)?.name || "All Leagues"}
          </span>
          <select
            ref={categoryRef}
            className={CATEGORY_SELECT_CLASS}
            style={{
              width: categoryWidth,
              maxWidth: isMobileViewport ? categoryWidth : "none",
            }}
            value={selectedLeague ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") setSelectedLeague(null);
              else if (val === "uefa") setSelectedLeague("uefa");
              else setSelectedLeague(Number(val));
            }}
          >
            {LEAGUES.map((league) => (
              <option key={String(league.id)} value={league.id ?? ""}>
                {league.name}
              </option>
            ))}
          </select>

        </div>

        <div className="flex space-x-2 -mr-3">
          <button
            className={`btn btn-sm btn-ghost font-bold text-white ${
              location.pathname.includes("/matches")
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-greyblue hover:bg-hovergreyblue"
            } active:scale-95 `}
            onClick={() => navigate("/dashboard/matches")}
          >
            Games
          </button>
          <button
            className={`btn btn-sm btn-ghost font-bold text-white ${
              location.pathname.includes("/tournaments")
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-greyblue hover:bg-hovergreyblue"
            } active:scale-95 `}
            onClick={() => navigate("/dashboard/tournaments")}
          >
            Futures
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-2 whitespace-nowrap">
          <span className="text-sm font-bold text-white">Sort by:</span>
          <div className="relative">
            <select
              ref={sortRef}
              className={BASE_SELECT_CLASS}
              style={{
                width: sortWidth,
                maxWidth: isMobileViewport ? sortWidth : "none",
              }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div data-theme="dark" className="bg-darkblue flex flex-col space-y-2 whitespace-nowrap">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 -mt-1">
            <span className="text-sm font-bold text-white text-right">Deployed Only</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={deployedOnly}
              onChange={() => setDeployedOnly(!deployedOnly)}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
            <span className="text-sm font-bold text-white text-right">Live Only</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={liveOnly}
              onChange={() => setLiveOnly(!liveOnly)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterMenu;