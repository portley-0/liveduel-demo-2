import React from "react";
import MatchList from "@/components/MatchList.tsx";
import TournamentList from "@/components/TournamentList.tsx";
import FilterMenu from "@/components/FilterMenu.tsx";
import SelectionsBar from "@/components/SelectionsBar.tsx";
import { useFilter } from "@/context/FilterContext.tsx";

const Markets: React.FC = () => {
  const { viewMode } = useFilter();

  return (
    <div className="w-full min-h-screen flex flex-col">
      <FilterMenu />

      <SelectionsBar />

      <div className="flex-grow will-change-scroll overscroll-y-contain">
        {viewMode === "games" ? <MatchList /> : <TournamentList />}
      </div>
    </div>
  );
};

export default Markets;
