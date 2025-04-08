import React from "react";
import MatchList from "@/components/MatchList.tsx";
import FilterMenu from "@/components/FilterMenu.tsx";
import SelectionsBar from "@/components/SelectionsBar.tsx";

const Markets: React.FC = () => {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <FilterMenu />

      <SelectionsBar />

      <div className="flex-grow will-change-scroll overscroll-y-contain">
        <MatchList />
      </div>
    </div>
  );
};

export default Markets;
