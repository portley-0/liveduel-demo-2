import React, { useState, useEffect, useRef } from "react";

const LEAGUES = [
  { id: null, name: "All Leagues" },
  { id: 2, name: "UEFA Champions League" },
  { id: 3, name: "UEFA Europa League" },
  { id: 39, name: "Premier League" },
  { id: 140, name: "La Liga" },
  { id: 78, name: "Bundesliga" },
  { id: 61, name: "Ligue 1" },
  { id: 135, name: "Serie A" },
  { id: 88, name: "Eredivisie" },
  { id: 71, name: "Brazil Serie A" },
  { id: 253, name: "MLS" },
  { id: 130, name: "Copa Argentina" },
  { id: 94, name: "Primeira Liga" },
  { id: 98, name: "J1 League" },
  { id: 848, name: "UEFA Conference League" }
];


// Sorting Options
const SORT_OPTIONS = [
  { id: "volume", name: "Volume" },
  { id: "date-asc", name: "Date (ASC)" },
  { id: "date-desc", name: "Date (DESC)" },
];

interface FilterMenuProps {
  selectedLeague: number | null;
  setSelectedLeague: (league: number | null) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  liveOnly: boolean;
  setLiveOnly: React.Dispatch<React.SetStateAction<boolean>>;
}

const FilterMenu: React.FC<FilterMenuProps> = ({
  selectedLeague,
  setSelectedLeague,
  sortBy,
  setSortBy,
  liveOnly,
  setLiveOnly,
}) => {
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
            {LEAGUES.find((league) => league.id === selectedLeague)?.name ?? "All Leagues"}
          </span>
          <select
            className="select select-sm select-ghost text-white bg-darkblue font-bold text-sm transition-all duration-200 ease-in-out"
            style={{ width: `${categoryWidth}px` }}
            value={selectedLeague ?? ""}
            onChange={(e) => setSelectedLeague(e.target.value === "" ? null : Number(e.target.value))}
          >
            {LEAGUES.map((league) => (
              <option key={league.id} value={league.id ?? ""} className="font-bold text-sm">
                {league.name}
              </option>
            ))}
          </select>
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

        <div data-theme="dark" className="bg-darkblue">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-white">Live Only</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={liveOnly}
              onChange={() => setLiveOnly((prev: boolean) => !prev)}
            />
          </div>
        </div>
      </div>
    </div>

  );
};

export default FilterMenu;
