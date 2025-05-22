import React, { useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useTournaments } from "@/context/TournamentContext.tsx";
import { useFilter } from "@/context/FilterContext.tsx";
import TournamentCard from "@/components/TournamentCard.tsx";
//import TournamentBetting from "@/components/TournamentBetting.tsx";
//import TournamentInfo from "@/components/TournamentInfo.tsx";
import { TournamentData } from "@/types/TournamentData.ts";

const Tournament: React.FC = () => {
  const { tournamentId } = useParams();
  const { tournaments }: { tournaments: { [key: string]: TournamentData } } = useTournaments();
  const { setSelectedLeague } = useFilter();
  const rightColumnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rightColumnRef.current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [tournamentId]);

  if (!tournamentId || !tournaments || !tournaments[tournamentId]) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center text-white">
        Tournament not found.
      </div>
    );
  }

  const tournament = tournaments[tournamentId];

  return (
    <div className="w-full min-h-screen bg-darkblue">
      <div className="w-full flex flex-col lg:flex-row">
        <div className="w-full lg:w-1/2 lg:max-h-[calc(100vh-80px)] bg-darkblue flex flex-col lg:overflow-hidden">
          <div className="breadcrumbs lg:fixed px-4 py-2 bg-darkblue text-white transform translate-y-[-4px]">
            <ul className="flex gap-2 text-xs">
              <li>
                <Link 
                  to="/dashboard/tournaments" 
                  className="hover:underline font-bold text-white"
                >
                  Tournaments
                </Link>
              </li>
              <li>
                <Link
                  to={`/dashboard/markets?league=${tournament.tournamentId}`}
                  onClick={() => setSelectedLeague(tournament.tournamentId ?? null)}
                  className="hover:underline font-bold text-white"
                >
                {tournament.name}
                </Link>
              </li>
              <li className="font-bold">
                <span className="text-redmagenta">
                  Win Competition
                </span>
              </li>
            </ul>
          </div>
          <div className="lg:fixed top-[116px] left-0 w-full lg:w-1/2 bg-darkblue overflow-hidden">
            <TournamentCard tournament={tournament} />
          </div>
        </div>

        <div
          ref={rightColumnRef}
          className="w-full lg:w-1/2 lg:px-10 sm:px-6 xs:px-6 xxs:px-3.5 flex flex-col overflow-y-auto pb-20"
        >
  
        </div>
      </div>
    </div>
  );
};

export default Tournament;  