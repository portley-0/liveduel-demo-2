import React, { useState, useEffect, useRef } from "react";
import { useFilter } from "@/context/FilterContext.tsx";
import { LuCirclePlus, LuCircleCheck } from "react-icons/lu";

const LEAGUES = [
  { id: null, name: "All Leagues" },
  { id: "uefa", name: "UEFA Leagues" },
  { id: 2, name: "UEFA Champions League" },
  { id: 3, name: "UEFA Europa League" },
  { id: 39, name: "Premier League" },
  { id: 140, name: "La Liga" },
  { id: 78, name: "Bundesliga" },
  { id: 61, name: "Ligue 1" },
  { id: 135, name: "Serie A" },
  { id: 848, name: "UEFA Conference League" },
];

const SORT_OPTIONS = [
  { id: "volume", name: "Volume" },
  { id: "date-asc", name: "Date (ASC)" },
  { id: "date-desc", name: "Date (DESC)" },
];

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
    selectedOnly,
    setSelectedOnly,
    addDefaultSelection,
    defaultSelections,
  } = useFilter();

  const categoryRef = useRef<HTMLSpanElement>(null);
  const sortRef = useRef<HTMLSpanElement>(null);
  const [categoryWidth, setCategoryWidth] = useState(190);
  const [sortWidth, setSortWidth] = useState(140);

  useEffect(() => {
    if (categoryRef.current) {
      const textWidth = categoryRef.current.offsetWidth + 45;
      setCategoryWidth(Math.max(100, Math.min(textWidth, 300)));
    }
  }, [selectedLeague]);

  useEffect(() => {
    if (sortRef.current) {
      const textWidth = sortRef.current.offsetWidth + 40;
      setSortWidth(Math.max(110, Math.min(textWidth, 170)));
    }
  }, [sortBy]);

  const isLeagueSelected =
  selectedLeague !== null &&
  defaultSelections.some(
    (selection) =>
      selection.type === "league" &&
      selection.id === selectedLeague &&
      selection.autoAdded !== true
  );

  return (
    <div className="sticky top-0 z-20 bg-darkblue py-1 px-4 flex flex-col space-y-2 shadow-xl">
      <h1 className="text-xs font-bold text-white">Markets</h1>

      <div className="flex items-center space-x-2">
        <span className="text-sm font-bold text-white">Category:</span>
        <div className="relative">
          <span
            ref={categoryRef}
            className="absolute opacity-0 pointer-events-none whitespace-nowrap text-sm font-bold"
          >
            {LEAGUES.find((league) => league.id === selectedLeague)?.name ??
              "All Leagues"}
          </span>
          <div className="relative">
            <div className="flex items-center">
              <select
                className="select select-sm select-ghost text-white bg-darkblue font-bold text-sm transition-all duration-200 ease-in-out"
                style={{ width: `${categoryWidth}px` }}
                value={selectedLeague ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setSelectedLeague(null);
                  } else if (value === "uefa") {
                    setSelectedLeague("uefa");
                  } else {
                    setSelectedLeague(Number(value));
                  }
                }}
              >
                {LEAGUES.map((league) => (
                  <option
                    key={league.id}
                    value={league.id ?? ""}
                    className="font-bold text-sm"
                  >
                    {league.name}
                  </option>
                ))}
              </select>
              {selectedLeague !== null && (
                <div className="ml-2 relative" style={{ width: "2rem", height: "2rem" }}>
                  <button
                    onClick={() => {
                      if (!isLeagueSelected) {
                        const league = LEAGUES.find((l) => l.id === selectedLeague);
                        if (league && league.id !== null) {
                          addDefaultSelection({
                            id: league.id,
                            type: "league",
                            name: league.name,
                          });
                        }
                      }
                    }}
                    className="absolute inset-0 bg-transparent rounded-full flex items-center justify-center"
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
          </div>

        </div>
      </div>

      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-bold text-white">Sort by:</span>
          <div className="relative">
            <span
              ref={sortRef}
              className="absolute opacity-0 pointer-events-none whitespace-nowrap text-sm font-bold"
            >
              {SORT_OPTIONS.find((option) => option.id === sortBy)?.name ?? "Volume"}
            </span>
            <select
              className="select select-sm select-ghost text-white bg-darkblue font-bold text-sm transition-all duration-200 ease-in-out"
              style={{ width: `${sortWidth}px` }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id} className="font-bold text-sm">
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div data-theme="dark" className="bg-darkblue flex flex-col space-y-2">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 -mt-3">
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
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
            <span className="text-sm font-bold text-white text-right">Selected Only</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={selectedOnly}
              onChange={() => setSelectedOnly(!selectedOnly)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterMenu;
