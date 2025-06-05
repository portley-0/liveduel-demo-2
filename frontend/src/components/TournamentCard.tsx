import React, { useState } from "react";
import { TournamentData, TeamStanding } from "@/types/TournamentData.ts"; // Assuming TeamStanding might still be used by TournamentTradingViewChart or elsewhere if not fully removed. If not, it can be removed.
import TournamentTradingViewChart from "./TournamentTradingViewChart.tsx";

interface TournamentCardProps {
  tournament: TournamentData;
}

type Format = "decimal" | "percent" | "fraction";

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
  const [format, setFormat] = useState<Format>("percent");

  const decimalToFraction = (decimal: number): string => {
    const frac = decimal - 1;
    if (frac <= 0) return "0/1"; // Or handle as per desired logic for non-positive implied probability
    const maxDenominator = 20;
    let bestNumer = 1;
    let bestDenom = 1;
    let minError = Math.abs(frac - bestNumer / bestDenom);
    for (let denom = 1; denom <= maxDenominator; denom++) {
      const numer = Math.round(frac * denom);
      if (numer === 0 && frac > 0) continue; // Avoid 0/X for positive fractions unless frac is truly 0
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
    const decimalOdds = probability > 0 ? 1 / probability : 1.0; // Default to 1.0 if probability is 0 or less to avoid division by zero
    if (format === "percent") return `${(100 / decimalOdds).toFixed(2)}%`;
    if (format === "fraction") return decimalToFraction(decimalOdds);
    return `${decimalOdds.toFixed(2)}x`;
  };

  // Updated to use tournament.teamNames and the specified URL for team logos
  const getTeamData = (teamId: number) => {
    const name = tournament.teamNames?.[teamId] || `Team ${teamId}`;
    const logo = `https://media.api-sports.io/football/teams/${teamId}.png`;
    // Fallback for logo if the image itself fails to load can be handled by <img onError> if needed,
    // or by checking if teamId is valid before constructing the URL.
    // For now, we construct the URL as requested.
    // If tournament.teamNames[teamId] is not present, name will be "Team <id>",
    // and these teams might be filtered out by the `teamsWithOdds` logic later.
    return { name, logo };
  };

  const teamsWithOdds = React.useMemo(() => {
    if (!tournament.latestOdds) return [];
    // Use tournament.teamIds if available, otherwise use keys from latestOdds
    const teamIdsToUse =
      tournament.teamIds || Object.keys(tournament.latestOdds).map(Number);

    return teamIdsToUse
      .map((teamId) => {
        const odds = tournament.latestOdds![teamId]; // Non-null assertion as we check tournament.latestOdds above
        const teamInfo = getTeamData(teamId); // Uses the updated getTeamData
        return {
          teamId,
          odds,
          name: teamInfo.name,
          logo: teamInfo.logo,
        };
      })
      // This filter will remove teams for which a name was not found in tournament.teamNames
      // (because getTeamData would have set name to `Team ${team.teamId}`)
      .filter((team) => team.name !== `Team ${team.teamId}`)
      .sort((a, b) => {
        // If tournament.teamIds is provided, sort by its order
        if (tournament.teamIds) {
          const indexA = tournament.teamIds.indexOf(a.teamId);
          const indexB = tournament.teamIds.indexOf(b.teamId);
          // Handle cases where a teamId might be in latestOdds but not in teamIds (if teamIds is the source of truth)
          if (indexA === -1 && indexB === -1) return a.odds - b.odds; // Fallback to odds sort if neither in teamIds
          if (indexA === -1) return 1; // Teams not in teamIds go to the end
          if (indexB === -1) return -1; // Teams not in teamIds go to the end
          return indexA - indexB;
        }
        // Default sort by odds if tournament.teamIds is not available
        return a.odds - b.odds;
      });
  }, [tournament.latestOdds, tournament.teamIds, tournament.teamNames]); // Added tournament.teamNames, removed tournament.standings

  const winnerData = React.useMemo(() => {
    if (
      tournament.resolvedAt &&
      tournament.outcome !== undefined &&
      tournament.teamIds &&
      tournament.teamIds[tournament.outcome] !== undefined
    ) {
      const winningTeamId = tournament.teamIds[tournament.outcome];
      return getTeamData(winningTeamId); // Uses the updated getTeamData
    }
    return null;
  }, [
    tournament.resolvedAt,
    tournament.outcome,
    tournament.teamIds,
    tournament.teamNames, // Added tournament.teamNames, removed tournament.standings
  ]);

  return (
    <div className="relative p-10 sm:px-7 xs:px-7 xxs:px-5 sm:pb-5 xs:pb-5 xxs:pb-5 lg:pr-4 flex flex-col w-full">
      {/* Top Section: Tournament Logo, Name, Volume, and Winner Info */}
      <div className="flex items-center xxs:mb-6 xs:mb-6 sm:mb-6 md:mb-7 lg:mb-8">
        <div
          className="bg-white flex items-center justify-center 
                       xxs:w-[80px] xxs:h-[80px] xs:w-[80px] xs:h-[80px] 
                       sm:w-[90px] sm:h-[90px] lg:w-[100px] lg:h-[100px] 
                       2xl:w-[140px] 2xl:h-[140px] aspect-square flex-shrink-0"
        >
          <img
            src={tournament.logo || "/default-tournament-logo.png"} // Use tournament.logo
            alt={tournament.name || "Tournament"} // Use tournament.name
            className="object-contain 
                       xxs:w-[70px] xxs:h-[70px] xs:w-[70px] xs:h-[70px] 
                       sm:w-[80px] sm:h-[80px] lg:w-[90px] lg:h-[90px] 
                       2xl:w-[130px] 2xl:h-[130px]"
          />
        </div>
        <div className="flex flex-col ml-4 flex-1 min-w-0">
          <span className="text-xl sm:text-2xl lg:text-3xl 2xl:text-4xl text-white font-[Lato-Bold] truncate">
            {/* Use tournament.name */}
            {tournament.name
              ? `${tournament.name} Winner`
              : "Tournament Winner"}
          </span>
          <span className="2xl:text-xl lg:text-xl sm:text-lg xs:text-lg xxs:text-lg text-gray-600 font-semibold">
            Volume: $
            {tournament.bettingVolume
              ? (tournament.bettingVolume / 1_000_000).toFixed(2)
              : "0.00"}
          </span>
          {tournament.resolvedAt && winnerData && (
            <div className="flex items-center mt-1 sm:mt-2">
              <img
                src={winnerData.logo} // Will use the new logo URL format
                alt={`${winnerData.name} logo`}
                className="object-contain w-[24px] h-[24px] mr-2"
              />
              <span className="text-xs sm:text-sm lg:text-base text-green-400 font-semibold">
                Winner: {winnerData.name} {/* Will use name from tournament.teamNames */}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Middle Section: TradingView Chart */}
      <div className="bg-lightgreyblue 2xl:h-[200px] lg:h-[160px] sm:h-[120px] xs:h-[100px] xxs:h-[100px] min-w-[200px]">
        <TournamentTradingViewChart
          oddsHistory={
            tournament.oddsHistory || { timestamps: [], teamOdds: {} }
          }
          tournament={tournament} // Pass the whole tournament object, chart might need other parts
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
              <div className="flex items-center min-w-0"> {/* Added min-w-0 for truncation to work */}
                <img
                  src={team.logo} // Uses new logo URL format
                  alt={team.name}
                  className="object-contain w-[36px] h-[36px] flex-shrink-0" // Added flex-shrink-0
                />
                <span className="text-white font-[Lato-Bold] 2xl:text-lg lg:text-md sm:text-sm xs:text-sm xxs:text-sm truncate max-w-[calc(100%-50px)] ml-3"> {/* Adjusted max-width for better truncation */}
                  {team.name} {/* Uses name from tournament.teamNames */}
                </span>
              </div>
              <span className="text-white font-[Lato-Bold] 2xl:text-xl lg:text-xl sm:text-lg xs:text-lg xxs:text-lg ml-2"> {/* Added ml-2 for spacing */}
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