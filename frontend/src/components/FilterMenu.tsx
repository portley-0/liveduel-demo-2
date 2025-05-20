import React, { useState, useEffect, useRef } from "react";
import { useFilter } from "@/context/FilterContext.tsx";
import { LuCirclePlus, LuCircleCheck } from "react-icons/lu";

const LEAGUES = [
  { id: null, name: "All Leagues" },
  { id: "uefa", name: "UEFA Leagues" },
  { id: 2, name: "UEFA Champions League" },
  { id: 3, name: "UEFA Europa League" },
  { id: 848, name: "UEFA Conference League" },
  { id: 39, name: "Premier League" },
  { id: 140, name: "La Liga" },
  { id: 78, name: "Bundesliga" },
  { id: 61, name: "Ligue 1" },
  { id: 135, name: "Serie A" },
];

const SORT_OPTIONS = [
  { id: "volume", name: "Volume" },
  { id: "date-asc", name: "Date (ASC)" },
  { id: "date-desc", name: "Date (DESC)" },
];

const MOBILE_BREAKPOINT = 768;
const ARROW_WIDTH = 20;
const SORT_EXTRA = 10; 

const SORT_SELECT_CLASS =
  "select select-sm select-ghost text-white bg-darkblue font-bold text-sm " +
  "transition-all duration-200 ease-in-out whitespace-nowrap";

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
    addDefaultSelection,
    defaultSelections,
    viewMode,
    setViewMode,
  } = useFilter();

  const categoryRef = useRef<HTMLSpanElement>(null);
  const sortRef = useRef<HTMLSpanElement>(null);

  const [initialCategoryWidth, setInitialCategoryWidth] = useState<number | null>(null);
  const [categoryWidth, setCategoryWidth] = useState(190);
  const [sortWidth, setSortWidth] = useState(140);

  const smallLeagues = [61, 140, 135];
  const mediumLeagues = [null, 78];
  const isSmallLeague =
    selectedLeague !== null &&
    typeof selectedLeague === "number" &&
    smallLeagues.includes(selectedLeague);
  const isMediumLeague =
    selectedLeague !== null &&
    typeof selectedLeague === "number" &&
    mediumLeagues.includes(selectedLeague);

  const selectClassName =
    "select select-sm select-ghost text-white bg-darkblue font-bold text-sm " +
    "transition-all duration-200 ease-in-out overflow-hidden whitespace-nowrap text-ellipsis md:overflow-visible md:whitespace-nowrap";

  const isMobileViewport = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

  useEffect(() => {
    if (categoryRef.current && initialCategoryWidth === null) {
      const base = categoryRef.current.getBoundingClientRect().width + 45;
      setInitialCategoryWidth(base);
      setCategoryWidth(base);
    }
  }, [initialCategoryWidth]);

  useEffect(() => {
    if (!categoryRef.current) return;
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    const textW = categoryRef.current.getBoundingClientRect().width;
    const padding = isSmallLeague ? 30 : isMediumLeague ? 35 : 40;

    if (isMobile && initialCategoryWidth) {
      setCategoryWidth(initialCategoryWidth);
    } else {
      const raw = textW + padding + ARROW_WIDTH;
      setCategoryWidth(Math.max(100, raw));
    }
  }, [selectedLeague, isSmallLeague, isMediumLeague, initialCategoryWidth]);

  useEffect(() => {
    if (sortRef.current) {
      const textW = sortRef.current.getBoundingClientRect().width;
      const raw = textW + 40 + SORT_EXTRA;
      setSortWidth(Math.max(110, Math.min(raw, 180)));
    }
  }, [sortBy]);

  const isLeagueSelected =
    selectedLeague !== null &&
    defaultSelections.some(
      (sel) => sel.type === "league" && sel.id === selectedLeague && !sel.autoAdded
    );

  return (
    <div className="sticky top-0 z-20 bg-darkblue py-1 px-4 flex flex-col space-y-2 shadow-xl">
      <h1 className="text-xs font-bold text-white">Markets</h1>

      <div className="flex items-center justify-between space-x-2 pb-1">
        <span className="text-sm font-bold text-white">Category:</span>
        <div className="relative flex-1 min-w-0">
          <span
            ref={categoryRef}
            className="absolute opacity-0 pointer-events-none whitespace-nowrap text-sm font-bold"
          >
            {LEAGUES.find((l) => l.id === selectedLeague)?.name || "All Leagues"}
          </span>

          <select
            className={selectClassName}
            style={
              isMobileViewport
                ? {
                    width: "100%",
                    minWidth: `${categoryWidth}px`,
                  }
                : {
                    width: `${categoryWidth}px`,
                  }
            }
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

          {selectedLeague !== null && (
            <div className="absolute right-0 top-0 w-8 h-8">
              <button
                onClick={() => {
                  if (!isLeagueSelected) {
                    const league = LEAGUES.find((l) => l.id === selectedLeague);
                    league &&
                      league.id !== null &&
                      addDefaultSelection({
                        id: league.id,
                        type: "league",
                        name: league.name,
                      });
                  }
                }}
                className="w-full h-full flex items-center justify-center hidden"
                title="Add league to Selected"
              >
                {isLeagueSelected ? (
                  <LuCircleCheck className="text-blue-500 w-6 h-6" />
                ) : (
                  <LuCirclePlus className="text-white w-6 h-6 hover:text-gray-300" />
                )}
              </button>
            </div>
          )}
        </div>

        <div className="flex space-x-2 -mr-3">
        <button
            className={`btn btn-sm btn-ghost font-bold text-white ${
              viewMode === "games"
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-greyblue hover:bg-hovergreyblue"
            } active:scale-95 `}
            onClick={() => setViewMode("games")}
          >
            Games
          </button>
          <button
            className={`btn btn-sm btn-ghost font-bold text-white ${
              viewMode === "futures"
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-greyblue hover:bg-hovergreyblue"
            } active:scale-95 `}
            onClick={() => setViewMode("futures")}
          >
            Futures
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-2 whitespace-nowrap">
          <span className="text-sm font-bold text-white">Sort by:</span>
          <div className="relative">
            <span
              ref={sortRef}
              className="absolute opacity-0 pointer-events-none whitespace-nowrap text-sm font-bold"
            >
              {SORT_OPTIONS.find((o) => o.id === sortBy)?.name || "Volume"}
            </span>
            <select
              className={SORT_SELECT_CLASS}
              style={{ width: `${sortWidth}px` }}
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
