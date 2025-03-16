import React from "react";
import { useParams } from "react-router-dom";
import { useMatches } from "@/context/MatchContext.tsx";
import MatchCard from "@/components/MatchCard.tsx";
import Betting from "@/components/Betting.tsx";
import MatchInfo from "@/components/MatchInfo.tsx";
import { MatchData } from "@/types/MatchData.ts"; 

const Match: React.FC = () => {
  const { matchId } = useParams(); 
  const { matches }: { matches: { [key: string]: MatchData } } = useMatches(); // Use type-safe matches

  const match = matchId && matches ? matches[matchId] : null; // Get the correct match

  if (!match) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center text-white">
        Match not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full mx-auto">
      {/* Left/Top: Match Card */}
      <div className="w-full lg:w-1/2">
        <MatchCard match={match} />
      </div>

      {/* Right/Bottom: Betting Interface & Match Info */}
      <div className="w-full lg:w-1/2 flex flex-col gap-6">
        <Betting match={match} />  {/* Pass match to Betting component */}
        <MatchInfo match={match} />  {/* Pass match to MatchInfo component */}
      </div>
    </div>
  );
};

export default Match;

