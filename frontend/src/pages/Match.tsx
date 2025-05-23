import React, { useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useMatches } from "@/context/MatchContext.tsx";
import { useFilter } from "@/context/FilterContext.tsx";
import MatchCard from "@/components/MatchCard.tsx";
import Betting from "@/components/Betting.tsx";
import MatchInfo from "@/components/MatchInfo.tsx";
import { MatchData } from "@/types/MatchData.ts";

const Match: React.FC = () => {
  const { matchId } = useParams();
  const { matches }: { matches: { [key: string]: MatchData } } = useMatches();
  const { setSelectedLeague } = useFilter();
  const rightColumnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rightColumnRef.current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [matchId]);

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
      <div className="w-full flex flex-col lg:flex-row">
        <div className="w-full lg:w-1/2 lg:max-h-[calc(100vh-80px)] bg-darkblue flex flex-col lg:overflow-hidden">
          <div className="breadcrumbs lg:fixed px-4 py-2 bg-darkblue text-white transform translate-y-[-4px]">
            <ul className="flex gap-2 text-xs">
              <li>
                <Link 
                  to="/dashboard/markets" 
                  className="hover:underline font-bold text-white"
                >
                  Markets
                </Link>
              </li>
              <li>
                <Link
                  to={`/dashboard/markets?league=${match.leagueId}`}
                  onClick={() => setSelectedLeague(match.leagueId ?? null)}
                  className="hover:underline font-bold text-white"
                >
                  {match.leagueName}
                </Link>
              </li>
              <li className="font-bold">
                <span className="text-redmagenta">
                  {match.homeTeamName} v {match.awayTeamName}
                </span>
              </li>
            </ul>
          </div>
          <div className="lg:fixed top-[116px] left-0 w-full lg:w-1/2 bg-darkblue overflow-hidden">
            <MatchCard match={match} />
          </div>
        </div>

        <div
          ref={rightColumnRef}
          className="w-full lg:w-1/2 lg:px-10 sm:px-6 xs:px-6 xxs:px-3.5 flex flex-col overflow-y-auto pb-20"
        >
          <Betting match={match} />
          <MatchInfo match={match} />
        </div>
      </div>
    </div>
  );
};

export default Match;
