import React, { useState } from "react";
import MatchList from "@/components/MatchList.tsx";
import FilterMenu from "@/components/FilterMenu.tsx"; 

const Markets: React.FC = () => {
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<string>("volume");
  const [liveOnly, setLiveOnly] = useState<boolean>(false);

  return (
    <div className="w-full min-h-screen flex flex-col">
      <FilterMenu
        selectedLeague={selectedLeague}
        setSelectedLeague={setSelectedLeague}
        sortBy={sortBy}
        setSortBy={setSortBy}
        liveOnly={liveOnly}
        setLiveOnly={setLiveOnly}
      />

      <div className="flex-grow will-change-scroll overscroll-y-contain">
        <MatchList selectedLeague={selectedLeague} sortBy={sortBy} liveOnly={liveOnly} />
      </div>
    </div>
  );
};

export default Markets;
