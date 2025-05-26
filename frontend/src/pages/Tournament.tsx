import React, { useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useTournaments } from "@/context/TournamentContext.tsx";
import { useFilter } from "@/context/FilterContext.tsx";
import TournamentBetting from "@/components/TournamentBetting.tsx";
import TournamentCard from "@/components/TournamentCard.tsx";
import TournamentInfo from "@/components/TournamentInfo.tsx";
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
        <div className="w-full lg:w-3/5 bg-darkblue flex flex-col overflow-y-auto">
          <div className="breadcrumbs sticky top-0 z-10 px-4 py-2 bg-darkblue text-white">
            <ul className="flex gap-2 text-xs">
              <li>
                <Link
                  to="/dashboard/tournaments"
                  className="hover:underline font-bold text-white"
                >
                  Markets
                </Link>
              </li>
              <li>
                <Link
                  to={`/dashboard/tournaments?league=${tournament.tournamentId}`}
                  onClick={() => setSelectedLeague(tournament.tournamentId ?? null)}
                  className="hover:underline font-bold text-white"
                >
                  {tournament?.standings?.league?.name}
                </Link>
              </li>
              <li className="font-bold">
                <span className="text-redmagenta">Win Competition</span>
              </li>
            </ul>
          </div>
          <div className="w-full">
            <TournamentCard tournament={tournament} />
          </div>
        </div>

        <div
          ref={rightColumnRef}
          className="w-full lg:w-2/5 lg:px-5 sm:px-6 xs:px-6 xxs:px-3.5 flex flex-col overflow-y-auto pb-20"
        >
          <TournamentBetting tournament={tournament} />
          <TournamentInfo tournament={tournament} />
        </div>
      </div>
    </div> 
  );
};

export default Tournament;

