import React from "react";
import { TbCircleLetterDFilled } from "react-icons/tb";
import { MatchData } from "@/types/MatchData.ts";

type Format = "decimal" | "percent" | "fraction";

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


interface CustomTooltipProps {
  active?: boolean;
  // now allow undefined values
  payload?: { dataKey: string; value?: number }[];
  label?: number;
  matchData: MatchData;
  format: Format;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload = [],
  label,
  matchData,
  format,
}) => {
  if (!active || !label || payload.length === 0) {
    return null;
  }

  const homeVal = payload.find((p) => p.dataKey === "home")?.value;
  const drawVal = payload.find((p) => p.dataKey === "draw")?.value;
  const awayVal = payload.find((p) => p.dataKey === "away")?.value;

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

  return (
    <div className="bg-gray-900 p-2.5 border border-gray-300 rounded whitespace-nowrap">
      <div className="text-xs font-semibold text-white mb-1">
        {formattedLabel}
      </div>

      <div className="flex items-center mb-1">
        <img
          src={matchData.homeTeamLogo}
          alt={matchData.homeTeamName}
          className="w-5 h-5 mr-1.5"
        />
        <span className="text-xs font-semibold text-blue-500 whitespace-nowrap">
          HOME: {formatValue(homeVal)}
        </span>
      </div>

      <div className="flex items-center mb-1">
        <TbCircleLetterDFilled className="text-xl text-gray-500 mr-1.5" />
        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
          DRAW: {formatValue(drawVal)}
        </span>
      </div>

      <div className="flex items-center">
        <img
          src={matchData.awayTeamLogo}
          alt={matchData.awayTeamName}
          className="w-5 h-5 mr-1.5"
        />
        <span className="text-xs font-semibold text-red-500 whitespace-nowrap">
          AWAY: {formatValue(awayVal)}
        </span>
      </div>
    </div>
  );
};

export default CustomTooltip;
