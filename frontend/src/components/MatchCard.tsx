import React from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { MatchData } from "@/types/MatchData.ts";

function convertToDecimalOdds(probability: number): number {
  return probability > 0 ? 1 / probability : 10.0;
}

interface MatchCardProps {
  match: MatchData;
}

const MatchCard: React.FC<MatchCardProps> = ({ match }) => {
  const homePrice = convertToDecimalOdds(match.latestOdds?.home ?? 0.3333);
  const drawPrice = convertToDecimalOdds(match.latestOdds?.draw ?? 0.3333);
  const awayPrice = convertToDecimalOdds(match.latestOdds?.away ?? 0.3333);

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
    <div className="relative p-10 mt-[-20px] sm:px-7 xs:px-7 sm:pb-5 xs:pb-5 lg:pr-4 flex flex-col w-full lg:max-h-[calc(100vh-80px)]">
      <div className="flex justify-between items-center mb-3">
        <div className="flex flex-col items-start">
          <img
            src={match.homeTeamLogo}
            alt={match.homeTeamName}
            className="object-contain xl:w-[140px] xl:h-[140px] lg:w-[100px] lg:h-[100px] xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px]"
          />
          <span className="lg:text-xl text-white font-[Lato-Bold] mt-3 mb-3 xs:mb-1 sm:mb-2 truncate max-w-[180px]">
            {match.homeTeamName}
          </span>
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center">
          <span className="lg:text-4xl sm:text-2xl xs:text-2xl font-bold text-redmagenta">
            {match.homeScore ?? 0}:{match.awayScore ?? 0}
          </span>
          <span className="lg:text-lg sm:text-md text-redmagenta font-semibold">
            {match.statusShort && ["FT", "AET", "PEN"].includes(match.statusShort)
              ? "Full Time"
              : match.statusShort && ["1H", "2H", "INT", "BT", "HT", "LIVE", "ET", "P"].includes(match.statusShort)
              ? `In Progress ${match.elapsed ? `(${match.elapsed}’)` : ""}`
              : formatKickoffTime(match.matchTimestamp)}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <img
            src={match.awayTeamLogo}
            alt={match.awayTeamName}
            className="object-contain xl:w-[140px] xl:h-[140px] lg:w-[100px] lg:h-[100px] xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px]"
          />
          <span className="lg:text-xl text-white font-[Lato-Bold] mt-3 mb-3 sm:mb-1 xs:mb-1 truncate max-w-[180px]">
            {match.awayTeamName}
          </span>
        </div>
      </div>

      <div className="bg-lightgreyblue lg:h-[160px] sm:h-[100px] xs:h-[100px] min-w-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={match.chartData ?? []}
            margin={{ left: 0, right: 7, top: 5, bottom: 5 }}
          >
            <XAxis dataKey="time" hide />
            <YAxis
              domain={[0, 10]}
              allowDecimals
              ticks={[0, 1, 2.5, 5, 7.5, 10]}
              tickFormatter={(tick) => (tick % 1 === 0 ? tick : tick.toFixed(1))}
              tick={{ fill: "white", fontSize: 10, textAnchor: "end", dx: 5 }}
              tickSize={2}
              tickCount={5}
              minTickGap={2}
              interval={0}
              width={3}
              axisLine={false}
              tickLine={false}
              orientation="right"
            />
            <Line
              type="linear"
              dataKey="home"
              stroke="rgba(0, 123, 255, 1)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="linear"
              dataKey="draw"
              stroke="rgba(128, 128, 128, 1)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="linear"
              dataKey="away"
              stroke="rgb(225, 29, 72)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-end mt-2 text-white">
        <div className="lg:text-xl sm:text-sm xs:text-sm font-[Quicksand Bold]">
          <span className="block font-semibold">Volume</span>
          <div className="text-white font-semibold">
            $
            {match.bettingVolume
              ? (match.bettingVolume / 1_000_000).toFixed(2)
              : "0.00"}
          </div>
        </div>
        <div className="flex space-x-4 lg:text-xl sm:text-sm xs:text-sm font-[Quicksand Bold]">
          <div className="flex flex-col items-center">
            <span className="text-blue-400 font-semibold">$HOME</span>
            <span className="text-blue-400 font-semibold">
              {homePrice.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-gray-400 font-semibold">$DRAW</span>
            <span className="text-gray-400 font-semibold">
              {drawPrice.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-redmagenta font-semibold">$AWAY</span>
            <span className="text-redmagenta font-semibold">
              {awayPrice.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchCard;
