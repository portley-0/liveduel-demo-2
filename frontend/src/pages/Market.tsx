import React from "react";
import { useParams } from "react-router-dom";
import { useMatches } from "@/context/MatchContext.tsx";
import MatchDetail from "@/components/MatchDetail.tsx";

const Market: React.FC = () => {
  const { matchId } = useParams(); 
  const { matches } = useMatches(); 

  const match = matchId && matches ? matches[Number(matchId)] : null;

  if (!match) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center text-white">
        Match not found.
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col p-4">
      <MatchDetail match={match} />
    </div>
  );
};

export default Market;
