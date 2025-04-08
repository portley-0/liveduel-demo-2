import React from "react";
import { TbCircleLetterDFilled } from "react-icons/tb";
import { MatchData } from "@/types/MatchData.ts";

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: number;
  matchData: MatchData;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, matchData }) => {
  if (active && payload && payload.length) {
    const homeOddsDecimal = payload.find((item) => item.dataKey === "home")?.value;
    const drawOddsDecimal = payload.find((item) => item.dataKey === "draw")?.value;
    const awayOddsDecimal = payload.find((item) => item.dataKey === "away")?.value;

    const formatOdds = (odds: number | undefined) => {
      return odds ? (1 / odds).toFixed(2) : "N/A";
    };

    const formattedLabel = new Date(label!).toLocaleString();

    return (
      <div className="bg-gray-900 p-2.5 border border-gray-300 rounded">
        <div className="text-xs font-semibold text-white mb-1">{formattedLabel}</div>
        <div className="flex items-center mb-1">
          <img
            src={matchData.homeTeamLogo}
            alt={matchData.homeTeamName}
            className="w-5 h-5 mr-1.5"
          />
          <span className="text-xs font-semibold text-blue-500">
            Home: {formatOdds(homeOddsDecimal)}
          </span>
        </div>
        <div className="flex items-center mb-1">
          <TbCircleLetterDFilled className="text-xl text-gray-500 mr-1.5" />
          <span className="text-xs font-semibold text-gray-500">
            Draw: {formatOdds(drawOddsDecimal)}
          </span>
        </div>
        <div className="flex items-center">
          <img
            src={matchData.awayTeamLogo}
            alt={matchData.awayTeamName}
            className="w-5 h-5 mr-1.5"
          />
          <span className="text-xs font-semibold text-red-500">
            Away: {formatOdds(awayOddsDecimal)}
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default CustomTooltip;
