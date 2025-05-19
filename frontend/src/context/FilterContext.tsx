import React, { createContext, useContext, useState, ReactNode } from "react";

export interface DefaultSelection {
  id: string | number;
  type: "league" | "match";
  name: string;
  autoAdded?: boolean;
}

export interface FilterState {
  selectedLeague: number | "uefa" | null;
  sortBy: string;
  liveOnly: boolean;
  deployedOnly: boolean;
  selectedOnly: boolean;
  defaultSelections: DefaultSelection[];
  viewMode: "games" | "futures";
}

export interface FilterContextType extends FilterState {
  setSelectedLeague: (league: number | "uefa" | null) => void;
  setSortBy: (sort: string) => void;
  setLiveOnly: (live: boolean) => void;
  setDeployedOnly: (deployed: boolean) => void;
  setSelectedOnly: (selected: boolean) => void;
  addDefaultSelection: (selection: DefaultSelection) => void;
  removeDefaultSelection: (id: string | number) => void;
  setViewMode: (mode: "games" | "futures") => void;
}

const UEFA_LEAGUES = [
  { id: 2, name: "UEFA Champions League" },
  { id: 3, name: "UEFA Europa League" },
  { id: 848, name: "UEFA Conference League" },
];
const UEFA_LEAGUES_IDS = UEFA_LEAGUES.map((league) => league.id);

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedLeague, setSelectedLeagueState] = useState<number | "uefa" | null>(null);
  const [sortBy, setSortByState] = useState<string>("volume");
  const [liveOnly, setLiveOnlyState] = useState<boolean>(false);
  const [deployedOnly, setDeployedOnlyState] = useState<boolean>(false);
  const [selectedOnly, setSelectedOnlyState] = useState<boolean>(false);
  const [defaultSelections, setDefaultSelections] = useState<DefaultSelection[]>([]);
  const [viewMode, setViewMode] = useState<"games" | "futures">("games");

  const setSelectedLeague = (league: number | "uefa" | null) => {
    setSelectedLeagueState(league);
    if (selectedOnly) {
      setSelectedOnlyState(false);
    }
  };


  const setSortBy = (sort: string) => setSortByState(sort);
  const setLiveOnly = (live: boolean) => setLiveOnlyState(live);
  const setDeployedOnly = (deployed: boolean) => setDeployedOnlyState(deployed);
  const setSelectedOnly = (selected: boolean) => {
    if (selected) {
      setSelectedLeagueState(null);
    }
    setSelectedOnlyState(selected);
  };

  const addDefaultSelection = (selection: DefaultSelection) => {
    setDefaultSelections((prev) => {
      let newSelections = [...prev];
      const existing = newSelections.find(
        (item) => item.id === selection.id && item.type === selection.type
      );
  
      if (!existing) {
        newSelections.push(selection);
      } else {
        if (existing.autoAdded && !selection.autoAdded) {
          newSelections = newSelections.map((item) =>
            item.id === selection.id && item.type === selection.type
              ? { ...item, autoAdded: false }
              : item
          );
        }
      }
  
      if (selection.id === "uefa") {
        UEFA_LEAGUES.forEach((leagueItem) => {
          if (
            !newSelections.find(
              (item) => item.id === leagueItem.id && item.type === "league"
            )
          ) {
            newSelections.push({
              id: leagueItem.id,
              type: "league",
              name: leagueItem.name,
              autoAdded: true,
            });
          }
        });
      }
      return newSelections;
    });
  };
  
  const removeDefaultSelection = (id: string | number) => {
    const isUefaGloballySelected = defaultSelections.some(
      (item) => item.type === "league" && item.id === "uefa"
    );

    if (id === "uefa") {
      setDefaultSelections((prev) =>
        prev.filter((item) => {
          if (item.id === "uefa") return false;
          if (item.type === "league" && typeof item.id === "number" && UEFA_LEAGUES_IDS.includes(item.id) && item.autoAdded) {
            return false;
          }
          return true;
        })
      );
      return;
    }

    if (typeof id === "number" && UEFA_LEAGUES_IDS.includes(id)) {
      const item = defaultSelections.find(
        (sel) => sel.type === "league" && sel.id === id
      );
      if (isUefaGloballySelected && item && item.autoAdded) {
        return; 
      }
    }
    setDefaultSelections((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <FilterContext.Provider
      value={{
        selectedLeague,
        sortBy,
        liveOnly,
        deployedOnly,
        selectedOnly,
        defaultSelections,
        setSelectedLeague,
        setSortBy,
        setLiveOnly,
        setDeployedOnly,
        setSelectedOnly,
        addDefaultSelection,
        removeDefaultSelection,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
};
