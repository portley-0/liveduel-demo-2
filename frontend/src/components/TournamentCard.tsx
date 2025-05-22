import React, { useState } from "react";
import { TournamentData, TeamStanding } from "@/types/TournamentData.ts";
import TournamentTradingViewChart from "./TournamentTradingViewChart.tsx";

interface TournamentCardProps {
  tournament: TournamentData;
}

type Format = "decimal" | "percent" | "fraction";

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
  const [format, setFormat] = useState<Format>("percent");

  const decimalToFraction = (decimal: number): string => {
    const frac = decimal - 1;
    if (frac <= 0) return "0/1";
    const maxDenominator = 20;
    let bestNumer = 1;
    let bestDenom = 1;
    let minError = Math.abs(frac - bestNumer / bestDenom);
    for (let denom = 1; denom <= maxDenominator; denom++) {
      const numer = Math.round(frac * denom);
      const approx = numer / denom;
      const error = Math.abs(frac - approx);
      if (error < minError) {
        minError = error;
        bestNumer = numer;
        bestDenom = denom;
      }
    }
    return `${bestNumer}/${bestDenom}`;
  };

  const formatOdds = (odd: number): string => {
    if (format === "percent") return `${(100 / odd).toFixed(2)}%`;
    if (format === "fraction") return decimalToFraction(odd);
    return `${odd.toFixed(2)}x`;
  };

  // Extract team data from standings
  const getTeamData = (teamId: number) => {
    if (!tournament.standings?.league.standings) {
      return { name: `Team ${teamId}`, logo: "/default-team-logo.png" };
    }
    const standings = tournament.standings.league.standings;
    const flatStandings = Array.isArray(standings[0])
      ? (standings as TeamStanding[][]).flat()
      : (standings as TeamStanding[]);
    const team = flatStandings.find((t) => t.team.id === teamId);
    return team
      ? { name: team.team.name, logo: team.team.logo }
      : { name: `Team ${teamId}`, logo: "/default-team-logo.png" };
  };

  // Get teams with odds for display
  const teamsWithOdds = React.useMemo(() => {
    if (!tournament.latestOdds) return [];
    return Object.entries(tournament.latestOdds)
      .map(([teamId, odds]) => {
        const id = Number(teamId);
        const team = getTeamData(id);
        return {
          teamId: id,
          odds,
          name: team.name,
          logo: team.logo,
        };
      })
      .filter((team) => team.logo && team.name !== `Team ${team.teamId}`)
      .sort((a, b) => a.odds - b.odds); // Sort by odds (ascending)
  }, [tournament.latestOdds, tournament.standings]);

  return (
    <div className="relative p-10 mt-[-20px] sm:px-7 xs:px-7 xxs:px-5 sm:pb-5 xs:pb-5 xxs:pb-5 lg:pr-4 flex flex-col w-full lg:max-h-[calc(100vh-80px)]">
      {/* Top Section: Tournament Logo and Name */}
      <div className="flex items-center mb-4">
        <img
          src={tournament.logo || "/default-tournament-logo.png"}
          alt={tournament.name || "Tournament"}
          className="object-contain 2xl:w-[140px] 2xl:h-[140px] lg:w-[100px] lg:h-[100px] xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px] xxs:w-[75px] xxs:h-[75px]"
        />
        <span className="2xl:text-2xl lg:text-xl text-white font-[Lato-Bold] ml-4 truncate max-w-[300px]">
          {tournament.name ? `${tournament.name} Winner` : "Tournament Winner"}
        </span>
      </div>

      {/* Middle Section: TradingView Chart */}
      <div className="bg-lightgreyblue 2xl:h-[200px] lg:h-[160px] sm:h-[100px] xs:h-[100px] xxs:h-[100px] min-w-[200px]">
        <TournamentTradingViewChart
          oddsHistory={tournament.oddsHistory || { timestamps: [], teamOdds: {} }}
          tournament={tournament}
          format={format}
          onFormatChange={setFormat}
        />
      </div>

      {/* Bottom Section: Team List with Odds */}
      <div className="mt-4 text-white">
        <div className="2xl:text-2xl lg:text-xl sm:text-sm xs:text-sm xxs:text-sm font-[Quicksand Bold]">
          <span className="block font-semibold">Volume</span>
          <div className="text-white font-semibold">
            ${tournament.bettingVolume ? (tournament.bettingVolume / 1_000_000).toFixed(2) : "0.00"}
          </div>
        </div>
        <div className="mt-4">
          {teamsWithOdds.map((team) => (
            <div
              key={team.teamId}
              className="flex items-center justify-between py-2 border-b border-gray-700"
            >
              <div className="flex items-center">
                <img
                  src={team.logo}
                  alt={team.name}
                  className="object-contain w-[40px] h-[40px] mr-3"
                />
                <span className="text-white font-[Lato-Bold] 2xl:text-lg lg:text-md sm:text-sm xs:text-sm xxs:text-sm truncate max-w-[200px]">
                  {team.name}
                </span>
              </div>
              <span className="text-redmagenta font-[Quicksand Bold] 2xl:text-lg lg:text-md sm:text-sm xs:text-sm xxs:text-sm">
                {formatOdds(team.odds)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TournamentCard;