import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

const FIXED_192x64_SCALING_FACTOR = BigInt("18446744073709551616");

const convertToDecimal = (value: bigint): number => {
  return Number((value * 10000n) / FIXED_192x64_SCALING_FACTOR) / 10000;
};

const convertToDecimalOdds = (probability: number): number => {
  return probability > 0 ? 1 / probability : 10.0;
};

interface MatchDetailProps {
  match: any; 
}

const MatchDetail: React.FC<MatchDetailProps> = ({ match }) => {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!match) return;

    const oddsData = match.oddsHistory?.timestamps?.length ? match.oddsHistory : null;

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Match Header */}
      <h1 className="text-2xl font-bold text-white mb-4">{match.homeTeamName} vs {match.awayTeamName}</h1>

      {/* Match Score & Team Logos */}
      <div className="flex justify-between items-center bg-darkblue p-4 rounded-lg shadow-lg">
        <div className="flex flex-col items-center">
          <img src={match.homeTeamLogo} alt={match.homeTeamName} className="w-20 h-20" />
          <span className="text-white text-lg">{match.homeTeamName}</span>
        </div>

        <div className="text-white text-2xl font-bold">
          {match.homeScore ?? 0} : {match.awayScore ?? 0}
        </div>

        <div className="flex flex-col items-center">
          <img src={match.awayTeamLogo} alt={match.awayTeamName} className="w-20 h-20" />
          <span className="text-white text-lg">{match.awayTeamName}</span>
        </div>
      </div>

      {/* Odds Graph */}
      <div className="mt-6 bg-lightgreyblue h-[300px] min-w-[200px]">
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
            <Line type="linear" dataKey="away" stroke="rgba(220, 53, 69, 1)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MatchDetail;
