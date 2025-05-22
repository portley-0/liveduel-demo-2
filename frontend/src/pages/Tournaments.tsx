import React from "react";
import TournamentList from "@/components/TournamentList.tsx";
import FilterMenu from "@/components/FilterMenu.tsx";

const Tournaments: React.FC = () => {

  return (
    <div className="w-full min-h-screen flex flex-col">
      <FilterMenu />

      <div className="flex-grow will-change-scroll overscroll-y-contain">
        <TournamentList />
      </div>
    </div>
  );
};

export default Tournaments;