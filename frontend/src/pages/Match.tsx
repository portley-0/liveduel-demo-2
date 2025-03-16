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
    <div className="w-full h-screen flex flex-col lg:flex-row mx-auto">

      <div className="breadcrumbs fixed top-[80px] left-0 w-full px-4 py-2 z-50 bg-darkblue text-white">
        <ul className="flex gap-2 text-xs">
          <li>
            <Link to="/dashboard/markets" className="hover:underline font-bold text-white">
              Markets
            </Link>
          </li>
          <li className="font-bold text-white">{match.leagueName}</li>
          <li className="font-bold">
            <span className="text-redmagenta">{match.homeTeamName} v {match.awayTeamName}</span>
          </li>
        </ul>
      </div>

      <div className="fixed top-[116px] left-0 w-full lg:w-1/2 h-[calc(100vh-116px)] bg-darkblue overflow-hidden">
        <MatchCard match={match} />
      </div>

      <div className="w-full ml-auto lg:w-1/2 h-screen overflow-y-auto flex flex-col gap-6">
        <Betting match={match} />
        <MatchInfo match={match} />
      </div>

    </div>
  );
};

export default Match;
