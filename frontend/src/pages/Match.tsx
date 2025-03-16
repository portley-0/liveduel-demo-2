import React from "react";
import { useParams, Link } from "react-router-dom";
import { useMatches } from "@/context/MatchContext.tsx";
import MatchCard from "@/components/MatchCard.tsx";
import Betting from "@/components/Betting.tsx";
import MatchInfo from "@/components/MatchInfo.tsx";
import { MatchData } from "@/types/MatchData.ts"; 

const Match: React.FC = () => {
  const { matchId } = useParams(); 
  const { matches }: { matches: { [key: string]: MatchData } } = useMatches();

  const match = matchId && matches ? matches[matchId] : null;

  if (!match) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center text-white">
        Match not found.
      </div>
    );
  }

  return (
    <div className="relative w-full flex flex-col lg:flex-row gap-4 mx-auto">

      {/* Breadcrumbs - Positioned Above Both Containers */}
      <div className="breadcrumbs absolute top-0 left-0 w-full px-4 py-1 z-10 bg-darkblue text-white">
        <ul className="flex gap-2 text-xs text-white">
          <li className="font-bold text-white">
            <Link to="/dashboard/markets" className="hover:underline font-bold text-white">
              Markets
            </Link>
          </li>
          <li className="font-bold text-white">{match.leagueName}</li>
          <li className="font-bold text-white">
            <span className="font-bold text-redmagenta">{match.homeTeamName} v {match.awayTeamName}</span>
          </li>
        </ul>
      </div>

      {/* Main Content: MatchCard on the Left, Betting & MatchInfo on the Right */}
      <div className="flex flex-col lg:flex-row w-full gap-4 pt-6">
        {/* Left Container: Match Card */}
        <div className="w-full lg:w-1/2">
          <MatchCard match={match} />
        </div>

        {/* Right Container: Betting & Match Info */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          <Betting match={match} />
          <MatchInfo match={match} />
        </div>
      </div>

    </div>
  );
};

export default Match;
