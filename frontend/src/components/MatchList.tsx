import React from "react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useMatches } from "@/context/MatchContext.tsx";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

const FIXED_192x64_SCALING_FACTOR = BigInt("18446744073709551616");

const convertToDecimal = (value: bigint): number => {
  return Number((value * 10000n) / FIXED_192x64_SCALING_FACTOR) / 10000;
};

const convertToDecimalOdds = (probability: number): number => {
  return probability > 0 ? 1 / probability : 10.0; 
};

const generateFlatlineOdds = () => {
  const now = Date.now();
  return {
    timestamps: Array.from({ length: 10 }, (_, i) => now - i * 60000), 
    homeOdds: Array(10).fill(FIXED_192x64_SCALING_FACTOR / 3n), 
    drawOdds: Array(10).fill(FIXED_192x64_SCALING_FACTOR / 3n),
    awayOdds: Array(10).fill(FIXED_192x64_SCALING_FACTOR / 3n),
  };
};

interface MatchListProps {
  selectedLeague: number | null;
  sortBy: string;
  liveOnly: boolean;
}

const MatchList: React.FC<MatchListProps> = ({ selectedLeague, sortBy, liveOnly }) => {
  const { matches } = useMatches();
  const [chartData, setChartData] = useState<Record<number, any>>({});
  
  useEffect(() => {
    if (!matches) return;
  
    setChartData((prevChartData) => {
      const newChartData = { ...prevChartData };
  
      Object.values(matches).forEach((match) => {
        const matchId = match.matchId;
        if (!matchId) return;
  
        const existingData = newChartData[matchId] ?? [];
  
        const oddsData = match.oddsHistory?.timestamps?.length ? match.oddsHistory : generateFlatlineOdds();
  
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
  
        const mergedData = [...existingData, ...newEntries]
          .sort((a, b) => a.timestamp - b.timestamp)
          .reduce((acc, entry) => {
            if (!acc.some((e: typeof entry) => e.timestamp === entry.timestamp)) acc.push(entry);
            return acc;
          }, [] as typeof existingData);
  
        newChartData[matchId] = mergedData;
      });
  
      return newChartData;
    });
  
  }, [matches]);  
  
  if (!matches || Object.keys(matches).length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center items-center">
        <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
      </div>
    );
  }

  let filteredMatches = Object.values(matches);

  if (selectedLeague !== null) {
    filteredMatches = filteredMatches.filter((match) => match.leagueId === selectedLeague);
  }

  const LIVE_STATUSES = ["1H", "2H", "INT", "BT", "HT", "LIVE", "ET", "P"];

  if (liveOnly) {
    filteredMatches = filteredMatches.filter((match) => match.statusShort && LIVE_STATUSES.includes(match.statusShort));
  }

  if (sortBy === "volume") {
    filteredMatches.sort((a, b) => (b.bettingVolume ?? 0) - (a.bettingVolume ?? 0));
  } else if (sortBy === "date-asc") {
    filteredMatches.sort((a, b) => (a.matchTimestamp ?? 0) - (b.matchTimestamp ?? 0));
  } else if (sortBy === "date-desc") {
    filteredMatches.sort((a, b) => (b.matchTimestamp ?? 0) - (a.matchTimestamp ?? 0));
  }

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-7 gap-4 p-4 pb-[80px]">
      {filteredMatches.map((match) => {

        const homePrice = convertToDecimalOdds(convertToDecimal(BigInt(match.latestOdds?.home ?? 6148914691236516864)));
        const drawPrice = convertToDecimalOdds(convertToDecimal(BigInt(match.latestOdds?.draw ?? 6148914691236516864)));
        const awayPrice = convertToDecimalOdds(convertToDecimal(BigInt(match.latestOdds?.away ?? 6148914691236516864)));

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
          <Link
            key={match.matchId}
            to={`/dashboard/markets/${match.matchId}`}
            className="w-full h-auto aspect-[6/5]"
          >
            <button
              className="relative group transition-all duration-200 ease-in-out bg-greyblue text-white rounded-xl shadow-md w-full h-full flex flex-col hover:bg-hovergreyblue active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="p-5 xs:p-6 flex flex-col h-full">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex flex-col">
                    <img src={match.homeTeamLogo} alt={match.homeTeamName} className="object-contain w-16 h-16 xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px] lg:w-14 lg:h-14" />
                    <span className="text-sm xs:text-lg sm:text-lg lg:text-sm font-[Lato-Bold] mt-1 mb-1 truncate max-w-[140px]">{match.homeTeamName}</span>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-2 flex flex-col items-center">
                    <span className="text-3xl xs:text-2xl font-bold text-redmagenta">
                      {match.homeScore ?? 0}:{match.awayScore ?? 0}
                    </span>
                    <span className="text-xs text-redmagenta font-semibold">
                      {match.statusShort && ["FT", "AET", "PEN"].includes(match.statusShort)
                        ? "Full Time"
                        : match.statusShort && LIVE_STATUSES.includes(match.statusShort)
                        ? `In Progress (${match.elapsed}’)`
                        : formatKickoffTime(match.matchTimestamp)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <img src={match.awayTeamLogo} alt={match.awayTeamName} className="object-contain w-16 h-16 xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px] lg:w-14 lg:h-14" />
                    <span className="text-sm xs:text-lg sm:text-lg lg:text-sm font-[Lato-Bold] mt-1 mb-1 truncate max-w-[140px]">{match.awayTeamName}</span>
                  </div>
                </div>

                <div className="bg-lightgreyblue h-[300px] min-w-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData[match.matchId]} margin={{ left: 0, right: 7, top: 5, bottom: 5 }}>  
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


                <div className="flex justify-between items-end mt-2">
                  <div className="text-xs font-[Quicksand Bold]">
                    <span className="block font-semibold">Volume</span>
                    <div className="text-white font-semibold">
                      ${match.bettingVolume ? (match.bettingVolume / 1_000_000).toFixed(2) : "0.00"}
                    </div>
                  </div>
                  <div className="flex space-x-4 text-xs font-[Quicksand Bold]">
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
            </button>
          </Link>

        );
      })}
    </div>
  );
};

export default MatchList;