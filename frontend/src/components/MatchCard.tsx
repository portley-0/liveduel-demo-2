import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { MatchData } from "@/types/MatchData.ts";  

const FIXED_192x64_SCALING_FACTOR = BigInt("18446744073709551616");

const convertToDecimal = (value: bigint): number => {
  return Number((value * 10000n) / FIXED_192x64_SCALING_FACTOR) / 10000;
};

const convertToDecimalOdds = (probability: number): number => {
  return probability > 0 ? 1 / probability : 10.0;
};

const MatchCard: React.FC<{ match: MatchData }> = ({ match }) => {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!match || !match.oddsHistory) return;

    const oddsData = match.oddsHistory.timestamps.length ? match.oddsHistory : null;

    if (oddsData) {
      const newEntries = oddsData.timestamps.map((timestamp: number, index: number) => {
        const homeProbability = convertToDecimal(BigInt(oddsData.homeOdds[index]));
        const drawProbability = convertToDecimal(BigInt(oddsData.drawOdds[index]));
        const awayProbability = convertToDecimal(BigInt(oddsData.awayOdds[index]));

        return {
          timestamp,
          time: new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          home: convertToDecimalOdds(homeProbability),
          draw: convertToDecimalOdds(drawProbability),
          away: convertToDecimalOdds(awayProbability),
        };
      });

      setChartData(newEntries);
    }
  }, [match]);

  const homePrice = convertToDecimalOdds(convertToDecimal(BigInt(match.latestOdds?.home ?? "6148914691236516864")));
  const drawPrice = convertToDecimalOdds(convertToDecimal(BigInt(match.latestOdds?.draw ?? "6148914691236516864")));
  const awayPrice = convertToDecimalOdds(convertToDecimal(BigInt(match.latestOdds?.away ?? "6148914691236516864")));

  const formatKickoffTime = (timestamp: number | undefined) => {
    if (!timestamp) return "TBD";
    return new Date(timestamp * 1000).toLocaleString([], {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  };

  return (
    <div className="relative p-12 flex flex-col w-full h-auto aspect-[6/5]">
      {/* Team Logos & Score */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex flex-col items-start">
          <img src={match.homeTeamLogo} alt={match.homeTeamName} className="object-contain w-[100px] h-[100px]" />
          <span className="text-2xl text-white font-[Lato-Bold] mt-1 truncate max-w-[250px]">
            {match.homeTeamName}
          </span>
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-2 flex flex-col items-center">
          <span className="text-3xl font-bold text-redmagenta">
            {match.homeScore ?? 0}:{match.awayScore ?? 0}
          </span>
          <span className="text-xl text-redmagenta font-semibold">
            {match.statusShort && ["FT", "AET", "PEN"].includes(match.statusShort)
              ? "Full Time"
              : match.statusShort && ["1H", "2H", "INT", "BT", "HT", "LIVE", "ET", "P"].includes(match.statusShort)
              ? `In Progress ${match.elapsed ? `(${match.elapsed}’)` : ""}`
              : formatKickoffTime(match.matchTimestamp)}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <img src={match.awayTeamLogo} alt={match.awayTeamName} className="object-contain w-[100px] h-[100px]" />
          <span className="text-2xl text-white font-[Lato-Bold] mt-1 truncate max-w-[250px]">
            {match.awayTeamName}
          </span>
        </div>
      </div>

      <div className="bg-lightgreyblue h-[300px] min-w-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 0, right: 7, top: 5, bottom: 5 }}>  
              <XAxis dataKey="time" hide />
              <YAxis
                domain={[0, 10]}
                allowDecimals={true}
                ticks={[0, 1, 2.5, 5, 7.5, 10]}
                tickFormatter={(tick) => (tick % 1 === 0 ? tick : tick.toFixed(1))}
                tick={{ fill: "white", fontSize: 7, textAnchor: "end", dx: 5, dy: 0 }}
                tickSize={2}
                tickCount={5}
                minTickGap={2}
                interval={0}
                width={3}
                axisLine={false}
                tickLine={false}
                orientation="right"
              />
              <Line type="linear" dataKey="home" stroke="rgba(0, 123, 255, 1)" strokeWidth={2} dot={false} />
              <Line type="linear" dataKey="draw" stroke="rgba(128, 128, 128, 1)" strokeWidth={2} dot={false} />
              <Line type="linear" dataKey="away" stroke="rgb(225, 29, 72)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Betting Volume & Odds */}
      <div className="flex justify-between items-end mt-2 text-white">
        <div className="text-xl font-[Quicksand Bold]">
          <span className="block font-semibold">Volume</span>
          <div className="text-white font-semibold">
            ${match.bettingVolume ? (match.bettingVolume / 1_000_000).toFixed(2) : "0.00"}
          </div>
        </div>
        <div className="flex space-x-4 text-xl font-[Quicksand Bold]">
          <div className="flex flex-col items-center">
            <span className="text-blue-400 font-semibold">$HOME</span>
            <span className="text-blue-400 font-semibold">{homePrice.toFixed(1)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-gray-400 font-semibold">$DRAW</span>
            <span className="text-gray-400 font-semibold">{drawPrice.toFixed(1)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-redmagenta font-semibold">$AWAY</span>
            <span className="text-redmagenta font-semibold">{awayPrice.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchCard;

