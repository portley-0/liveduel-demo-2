import React from "react";
import { TbCircleLetterDFilled } from "react-icons/tb";
import { MatchData } from "@/types/MatchData.ts";
import { TournamentData, /* TeamStanding */ } from "@/types/TournamentData.ts"; // TeamStanding commented out as it's no longer directly used here

type Format = "decimal" | "percent" | "fraction";

interface CustomTooltipProps {
  active?: boolean;
  payload?: { dataKey: string; value?: number }[];
  label?: number;
  matchData?: MatchData;
  tournament?: TournamentData;
  format: Format;
  teamIds?: string[]; // These are team IDs as strings, typically from Recharts dataKey
}

const TEAM_COLORS = [
  "rgba(0, 123, 255, 1)", // Blue
  "rgba(255, 193, 7, 1)", // Yellow
  "rgb(169, 169, 169)", // Gray
  "rgb(225,29,72)", // Red
];

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

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload = [],
  label,
  matchData,
  tournament,
  format,
  teamIds = [],
}) => {
  if (!active || !label || payload.length === 0) {
    return null;
  }

  const formatValue = (v?: number): string => {
    if (v == null) return "N/A";
    switch (format) {
      case "decimal":
        return v.toFixed(2);
      case "percent":
        return `${v.toFixed(2)}%`;
      case "fraction":
        return decimalToFraction(v);
      default:
        return v.toString();
    }
  };

  const formattedLabel = new Date(label).toLocaleString();

  const isMatchMode = !!matchData;

  // MODIFIED getTeamData function
  const getTeamData = (teamIdString: string) => {
    const teamIdNumber = parseInt(teamIdString, 10); // Convert string ID to number for lookup

    if (tournament && tournament.teamNames && tournament.teamNames[teamIdNumber]) {
      const name = tournament.teamNames[teamIdNumber];
      const logo = `https://media.api-sports.io/football/teams/${teamIdNumber}.png`;
      return { name, logo };
    }
    // Fallback if team not found in tournament.teamNames
    return { name: `Team ${teamIdString}`, logo: "/default-team-logo.png" };
  };

  return (
    <div className="bg-gray-900 p-2.5 border border-gray-300 rounded whitespace-nowrap">
      <div className="text-xs font-semibold text-white mb-1">{formattedLabel}</div>

      {isMatchMode
        ? payload.map((item) => {
            const { dataKey, value } = item;
            if (dataKey === "home") {
              return (
                <div key={dataKey} className="flex items-center mb-1">
                  <img
                    src={matchData!.homeTeamLogo}
                    alt={matchData!.homeTeamName}
                    className="w-5 h-5 mr-1.5"
                  />
                  <span className="text-xs font-semibold text-blue-500 whitespace-nowrap">
                    HOME: {formatValue(value)}
                  </span>
                </div>
              );
            }
            if (dataKey === "draw") {
              return (
                <div key={dataKey} className="flex items-center mb-1">
                  <TbCircleLetterDFilled className="text-xl text-gray-500 mr-1.5" />
                  <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                    DRAW: {formatValue(value)}
                  </span>
                </div>
              );
            }
            if (dataKey === "away") {
              return (
                <div key={dataKey} className="flex items-center">
                  <img
                    src={matchData!.awayTeamLogo}
                    alt={matchData!.awayTeamName}
                    className="w-5 h-5 mr-1.5"
                  />
                  <span className="text-xs font-semibold text-red-500 whitespace-nowrap">
                    AWAY: {formatValue(value)}
                  </span>
                </div>
              );
            }
            return null;
          })
        : teamIds.map((teamIdString, index) => { // teamId here is a string from props.teamIds (dataKey)
            const item = payload.find((p) => p.dataKey === teamIdString);
            const team = getTeamData(teamIdString); // Uses the modified getTeamData
            const color = TEAM_COLORS[index % TEAM_COLORS.length];

            return (
              <div key={teamIdString} className="flex items-center mb-1">
                <img src={team.logo} alt={team.name} className="w-5 h-5 mr-1.5" />
                <span
                  className="text-xs font-semibold whitespace-nowrap"
                  style={{ color }}
                >
                  {team.name}: {formatValue(item?.value)}
                </span>
              </div>
            );
          })}
    </div>
  );
};

export default CustomTooltip;
