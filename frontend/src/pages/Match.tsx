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

  if (!matchId || !matches || !matches[matchId]) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center text-white">
        Match not found.
      </div>
    );
  }

  const match = matches[matchId];

  return (
    <div className="w-full min-h-screen bg-darkblue">
      {/* Main Content Wrapper */}
      <div className="w-full flex flex-col lg:flex-row">
        {/* LEFT COLUMN: Breadcrumbs & MatchCard */}
        <div className="w-full lg:w-1/2 lg:max-h-[calc(100vh-80px)] bg-darkblue flex flex-col lg:overflow-hidden">
          {/* Breadcrumbs - Moved Inside Left Column */}
          <div className="breadcrumbs lg:fixed px-4 py-2 bg-darkblue text-white">
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

          <div className="lg:fixed left-0 w-full lg:w-1/2 bg-darkblue overflow-hidden">
            <MatchCard match={match} />
          </div>
        </div>

        {/* RIGHT COLUMN: Betting & MatchInfo */}
        <div className="w-full lg:w-1/2 lg:px-10 sm:px-6 xs:px-6 flex flex-col overflow-y-auto pb-20">
          <Betting match={match} />
          <MatchInfo match={match} />
        </div>
      </div>
    </div>
  );
};

export default Match;
