import React, { createContext, useContext, useState, ReactNode } from "react";

export interface DefaultSelection {
  id: string | number;
  type: "league" | "match";
  name: string;
}

export interface FilterState {
  selectedLeague: number | null;
  sortBy: string;
  liveOnly: boolean;
  deployedOnly: boolean;
  selectedOnly: boolean;
  defaultSelections: DefaultSelection[];
}

export interface FilterContextType extends FilterState {
  setSelectedLeague: (league: number | null) => void;
  setSortBy: (sort: string) => void;
  setLiveOnly: (live: boolean) => void;
  setDeployedOnly: (deployed: boolean) => void;
  setSelectedOnly: (selected: boolean) => void;
  addDefaultSelection: (selection: DefaultSelection) => void;
  removeDefaultSelection: (id: string | number) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Individual state properties
  const [selectedLeague, setSelectedLeagueState] = useState<number | null>(null);
  const [sortBy, setSortByState] = useState<string>("volume");
  const [liveOnly, setLiveOnlyState] = useState<boolean>(false);
  const [deployedOnly, setDeployedOnlyState] = useState<boolean>(false);
  const [selectedOnly, setSelectedOnlyState] = useState<boolean>(false);
  const [defaultSelections, setDefaultSelections] = useState<DefaultSelection[]>([]);

  // When a user selects a new category, we automatically turn off the "Selected Only" mode.
  const setSelectedLeague = (league: number | null) => {
    setSelectedLeagueState(league);
    if (selectedOnly) {
      setSelectedOnlyState(false);
    }
  };

  // Simple setters for other filters
  const setSortBy = (sort: string) => setSortByState(sort);
  const setLiveOnly = (live: boolean) => setLiveOnlyState(live);
  const setDeployedOnly = (deployed: boolean) => setDeployedOnlyState(deployed);
  const setSelectedOnly = (selected: boolean) => {
    if (selected) {
      setSelectedLeagueState(null);
    }
    setSelectedOnlyState(selected);
  };

  // Add a selection ensuring duplicates aren’t added.
  const addDefaultSelection = (selection: DefaultSelection) => {
    setDefaultSelections((prev) => {
      if (!prev.find((item) => item.id === selection.id && item.type === selection.type)) {
        return [...prev, selection];
      }
      return prev;
    });
  };

  // Remove a selection by id.
  const removeDefaultSelection = (id: string | number) => {
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
