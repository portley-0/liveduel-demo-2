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

  const formatOdds = (probability: number): string => {
    const decimalOdds = probability > 0 ? 1 / probability : 1.0;
    if (format === "percent") return `${(100 / decimalOdds).toFixed(2)}%`;
    if (format === "fraction") return decimalToFraction(decimalOdds);
    return `${decimalOdds.toFixed(2)}x`;
  };

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

  const teamsWithOdds = React.useMemo(() => {
    if (!tournament.latestOdds) return [];
    const teamIdsToUse = tournament.teamIds || Object.keys(tournament.latestOdds).map(Number);
    return teamIdsToUse
      .map((teamId) => {
        const odds = tournament.latestOdds![teamId];
        const team = getTeamData(teamId);
        return {
          teamId,
          odds,
          name: team.name,
          logo: team.logo,
        };
      })
      .filter((team) => team.logo && team.name !== `Team ${team.teamId}`)
      .sort((a, b) => {
        if (tournament.teamIds) {
          const indexA = tournament.teamIds.indexOf(a.teamId);
          const indexB = tournament.teamIds.indexOf(b.teamId);
          return indexA - indexB;
        }
        return a.odds - b.odds;
      });
  }, [tournament.latestOdds, tournament.standings, tournament.teamIds]);

  const winnerData = React.useMemo(() => {
    if (
      tournament.resolvedAt &&
      tournament.outcome !== undefined &&
      tournament.teamIds &&
      tournament.teamIds[tournament.outcome] !== undefined
    ) {
      const winningTeamId = tournament.teamIds[tournament.outcome];
      return getTeamData(winningTeamId);
    }
    return null;
  }, [tournament.resolvedAt, tournament.outcome, tournament.teamIds, tournament.standings]);

  return (
    <div className="relative p-10 sm:px-7 xs:px-7 xxs:px-5 sm:pb-5 xs:pb-5 xxs:pb-5 lg:pr-4 flex flex-col w-full">
      {/* Top Section: Tournament Logo, Name, Volume, and Winner Info */}
      <div className="flex items-center xxs:mb-6 xs:mb-6 sm:mb-6 md:mb-7 lg:mb-8">
        {/* MODIFIED: Logo container sizes for mobile */}
        <div className="bg-white flex items-center justify-center 
                       xxs:w-[80px] xxs:h-[80px] xs:w-[80px] xs:h-[80px] 
                       sm:w-[90px] sm:h-[90px] lg:w-[100px] lg:h-[100px] 
                       2xl:w-[140px] 2xl:h-[140px] aspect-square flex-shrink-0">
          {/* MODIFIED: Logo image sizes for mobile */}
          <img
            src={tournament?.standings?.league?.logo || "/default-tournament-logo.png"}
            alt={tournament?.standings?.league?.name || "Tournament"}
            className="object-contain 
                       xxs:w-[70px] xxs:h-[70px] xs:w-[70px] xs:h-[70px] 
                       sm:w-[80px] sm:h-[80px] lg:w-[90px] lg:h-[90px] 
                       2xl:w-[130px] 2xl:h-[130px]"
          />
        </div>
        <div className="flex flex-col ml-4 flex-1 min-w-0">
          {/* MODIFIED: Title font sizes for mobile */}
          <span className="text-xl sm:text-2xl lg:text-3xl 2xl:text-4xl text-white font-[Lato-Bold]">
            {tournament?.standings?.league?.name ? `${tournament.standings.league.name} Winner` : "Tournament Winner"}
          </span>
          <span className="2xl:text-xl lg:text-xl sm:text-lg xs:text-lg xxs:text-lg text-gray-600 font-semibold">
            Volume: ${tournament.bettingVolume ? (tournament.bettingVolume / 1_000_000).toFixed(2) : "0.00"}
          </span>
          {tournament.resolvedAt && winnerData && (
            // MODIFIED: Winner div margin for mobile
            <div className="flex items-center mt-1 sm:mt-2">
              <img
                src={winnerData.logo}
                alt={`${winnerData.name} logo`}
                className="object-contain w-[24px] h-[24px] mr-2"
              />
              <span className="text-xs sm:text-sm lg:text-base text-green-400 font-semibold">
                Winner: {winnerData.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Middle Section: TradingView Chart */}
      <div className="bg-lightgreyblue 2xl:h-[200px] lg:h-[160px] sm:h-[120px] xs:h-[100px] xxs:h-[100px] min-w-[200px]">
        <TournamentTradingViewChart
          oddsHistory={tournament.oddsHistory || { timestamps: [], teamOdds: {} }}
          tournament={tournament}
          format={format}
          onFormatChange={setFormat}
        />
      </div>

      {/* Bottom Section: Team List with Odds */}
      <div className="mt-4 text-white">
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
                  className="object-contain w-[36px] h-[36px]"
                />
                <span className="text-white font-[Lato-Bold] 2xl:text-lg lg:text-md sm:text-sm xs:text-sm xxs:text-sm truncate max-w-[200px] ml-3">
                  {team.name}
                </span>
              </div>
              <span className="text-white font-[Lato-Bold] 2xl:text-xl lg:text-xl sm:text-lg xs:text-lg xxs:text-lg">
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