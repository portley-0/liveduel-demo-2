import React from "react";
import { MatchData } from "@/types/MatchData.ts";
import TradingViewChart from './TradingViewChart.tsx'; 

interface MatchCardProps {
  match: MatchData;
}

const MatchCard: React.FC<MatchCardProps> = ({ match }) => {
  const homePrice = match.latestOdds?.home ?? 0.3333;
  const drawPrice = match.latestOdds?.draw ?? 0.3333;
  const awayPrice = match.latestOdds?.away ?? 0.3333;

  const formatKickoffTime = (timestamp?: number) => {
    if (!timestamp) return "TBD";
    return new Date(timestamp * 1000).toLocaleString([], {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="relative p-10 mt-[-20px] sm:px-7 xs:px-7 xxs:px-5 sm:pb-5 xs:pb-5 xxs:pb-5 lg:pr-4 flex flex-col w-full lg:max-h-[calc(100vh-80px)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex flex-col items-start">
          <img
            src={match.homeTeamLogo}
            alt={match.homeTeamName}
            className="object-contain 2xl:w-[140px] 2xl:h-[140px] lg:w-[100px] lg:h-[100px] xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px] xxs:w-[75px] xxs:h-[75px]"
          />
          <span className="2xl:text-2xl lg:text-xl text-white font-[Lato-Bold] mt-3 mb-3 xs:mb-1 xxs:mb-1 sm:mb-2 truncate max-w-[180px]">
            {match.homeTeamName}
          </span>
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center">
          <span
            className={`2xl:text-5xl lg:text-4xl sm:text-2xl xs:text-2xl xxs:text-2xl font-bold ${
              match.statusShort && ["1H", "2H", "INT", "BT", "HT", "LIVE", "ET", "P"].includes(match.statusShort)
                ? "text-redmagenta"
                : "text-white"
            }`}
          >
            {match.homeScore ?? 0}:{match.awayScore ?? 0}
          </span>
          <span
            className={`2xl:text-xl lg:text-lg sm:text-md font-semibold ${
              match.statusShort && ["1H", "2H", "INT", "BT", "HT", "LIVE", "ET", "P"].includes(match.statusShort)
                ? "text-redmagenta"
                : "text-white"
            }`}
          >
            {match.statusShort && ["FT", "AET", "PEN"].includes(match.statusShort)
              ? "Full Time"
              : match.statusShort &&
                ["1H", "2H", "INT", "BT", "HT", "LIVE", "ET", "P"].includes(match.statusShort)
              ? `In Progress ${match.elapsed ? `(${match.elapsed}’)` : ""}`
              : formatKickoffTime(match.matchTimestamp)}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <img
            src={match.awayTeamLogo}
            alt={match.awayTeamName}
            className="object-contain 2xl:w-[140px] 2xl:h-[140px] lg:w-[100px] lg:h-[100px] xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px] xxs:w-[75px] xxs:h-[75px]"
          />
          <span className="2xl:text-2xl lg:text-xl text-white font-[Lato-Bold] mt-3 mb-2 sm:mb-1 xs:mb-1 xxs:mb-1 truncate max-w-[180px]">
            {match.awayTeamName}
          </span>
        </div>
      </div>
      
      <div className="bg-lightgreyblue 2xl:h-[200] lg:h-[160px] sm:h-[100px] xs:h-[100px] xxs:h-[100px] min-w-[200px]">
        <TradingViewChart 
          oddsHistory={match.oddsHistory || { timestamps: [], homeOdds: [], drawOdds: [], awayOdds: [] }}
          matchData={match}
        />
      </div>

      <div className="flex justify-between items-end mt-2 text-white">
        <div className="2xl:text-2xl lg:text-xl sm:text-sm xs:text-sm xxs:text-sm font-[Quicksand Bold]">
          <span className="block font-semibold">Volume</span>
          <div className="text-white font-semibold">
            ${match.bettingVolume ? (match.bettingVolume / 1_000_000).toFixed(2) : "0.00"}
          </div>
        </div>
        <div className="flex space-x-4 2xl:text-2xl lg:text-xl sm:text-sm xs:text-sm xxs:text-sm font-[Quicksand Bold]">
          <div className="flex flex-col items-center">
            <span className="text-blue-400 font-semibold">$HOME</span>
            <span className="text-blue-400 font-semibold">
              {match.oddsHistory?.homeOdds.slice(-1)[0]?.toFixed(2) ?? homePrice.toFixed(2)}x
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-gray-400 font-semibold">$DRAW</span>
            <span className="text-gray-400 font-semibold">
              {match.oddsHistory?.drawOdds.slice(-1)[0]?.toFixed(2) ?? drawPrice.toFixed(2)}x
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-redmagenta font-semibold">$AWAY</span>
            <span className="text-redmagenta font-semibold">
              {match.oddsHistory?.awayOdds.slice(-1)[0]?.toFixed(2) ?? awayPrice.toFixed(2)}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchCard;
