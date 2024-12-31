'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  Filler,
  PointElement,
  ChartOptions,
} from 'chart.js';
import annotationPlugin, { AnnotationOptions } from 'chartjs-plugin-annotation';

ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, Legend, CategoryScale, Filler, annotationPlugin);

interface Team {
  id: number;
  name: string;
  logo: string;
}

interface Fixture {
  id: number;
  status: {
    elapsed: number | null;
    short: string;
  };
}

interface Match {
  fixture: Fixture;
  teams: {
    home: Team;
    away: Team;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

type ApiResponse = {
  response: Match[];
};

const LEAGUE_IDS = [2, 3, 39, 78, 357, 358];
const SEASON = '2024';

const MatchList: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const today = new Date();
        const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

        const allMatches: Match[] = [];

        for (const leagueId of LEAGUE_IDS) {
          const response = await axios.get<ApiResponse>('http://localhost:3001/api/fixtures', {
            params: {
              league: leagueId,
              season: SEASON,
              from: today.toISOString().split('T')[0],
              to: twoWeeksLater.toISOString().split('T')[0],
            },
          });

          if (response.data.response && Array.isArray(response.data.response)) {
            allMatches.push(...response.data.response);
          }
        }

        setMatches(allMatches);
        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching matches:', error.message);
        setError(error.response?.data || 'Failed to fetch matches. Please try again later.');
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  const generateOddsChartData = () => {
    const generateOddsOverTime = () => {
      return Array.from({ length: 10 }, () =>
        Array.from({ length: 3 }, () => parseFloat((Math.random() * 10).toFixed(1)))
      );
    };

    const oddsOverTime = generateOddsOverTime();

    return {
      labels: ['Start', '10m', '20m', '30m', '40m', 'HT', '60m', '70m', '80m', 'FT'],
      datasets: [
        {
          label: 'Home Win Odds',
          data: oddsOverTime.map((odds) => odds[0]),
          borderColor: 'rgba(0, 123, 255, 1)',
          backgroundColor: 'transparent',
          borderWidth: 2,
        },
        {
          label: 'Draw Odds',
          data: oddsOverTime.map((odds) => odds[1]),
          borderColor: 'rgba(128, 128, 128, 1)',
          backgroundColor: 'transparent',
          borderWidth: 2,
        },
        {
          label: 'Away Win Odds',
          data: oddsOverTime.map((odds) => odds[2]),
          borderColor: 'rgba(220, 53, 69, 1)',
          backgroundColor: 'transparent',
          borderWidth: 2,
        },
      ],
    };
  };

  const generateChartOptions = (): ChartOptions<'line'> => ({
    plugins: {
      legend: {
        display: false,
      },
      annotation: {
        annotations: {
          centerHorizontal: {
            type: 'line',
            yMin: 5.0,
            yMax: 5.0,
            borderColor: 'rgba(150, 150, 150, 0.8)',
            borderWidth: 1,
          } as AnnotationOptions<'line'>,
          centerVertical: {
            type: 'line',
            xMin: 4.5,
            xMax: 4.5,
            yMin: 0.0,
            yMax: 10.0,
            borderColor: 'rgba(150, 150, 150, 0.8)',
            borderWidth: 1,
          } as AnnotationOptions<'line'>,
        },
      },
    },
    maintainAspectRatio: false,
    responsive: true,
    scales: {
      x: {
        display: false,
      },
      y: {
        position: 'right',
        border: {
          display: false,
        },
        grid: {
          drawTicks: false,
          drawOnChartArea: true,
          color: (context) =>
            context.tick.value === 5.0 ? 'rgba(150, 150, 150, 0.8)' : 'transparent',
        },
        ticks: {
          stepSize: 2.5,
          callback: (value) => {
            if (typeof value === 'number') {
              return value === 10 ? '10' : value.toFixed(1);
            }
            return value;
          },
          color: 'rgba(150, 150, 150, 1)',
          font: {
            size: 8,
          },
          padding: 0,
        },
        min: 0.0,
        max: 10.0,
      },
    },
    layout: {
      padding: { right: 0 },
    },
    elements: {
      line: { tension: 0.3 },
      point: { radius: 0 },
    },
  });

  const isShortName = (name: string): boolean => name.length <= 10;

  const handleMatchClick = (matchId: number) => {
    router.push(`/dashboard/markets/${matchId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
      {matches.map((match) => (
        <button
          key={match.fixture.id}
          onClick={() => handleMatchClick(match.fixture.id)}
          className="relative group btn p-0 bg-greyblue text-white rounded-lg shadow-md w-full h-auto aspect-[6/5] transition-all hover:bg-hovergreyblue"
        >
          {/* Content container */}
          <div className="p-6 flex flex-col h-full">
            {/* Teams and score */}
            <div className="flex justify-between items-center mb-4">
              <div className={`flex flex-col ${isShortName(match.teams.home.name) ? 'items-center' : 'items-start'}`}>
                <img
                  src={match.teams.home.logo}
                  alt={match.teams.home.name}
                  className="object-contain mb-1 w-20 h-20 sm:w-14 sm:h-14"
                />
                <span className="text-lg sm:text-xs font-[Lato-Bold] mt-1">{match.teams.home.name}</span>
              </div>
              <div className="flex flex-col justify-center items-center absolute top-8 left-1/2 transform -translate-x-1/2">
                <div className="text-4xl sm:text-2xl font-[Quicksand Bold] text-pinkred">
                  {match.goals.home ?? 0}:{match.goals.away ?? 0}
                </div>
                <div className="text-base sm:text-xs font-[Quicksand Bold] text-pinkred">
                  {match.fixture.status.short === 'LIVE'
                    ? `In Progress (${match.fixture.status.elapsed ?? 0}')`
                    : 'Upcoming'}
                </div>
              </div>
              <div className={`flex flex-col ${isShortName(match.teams.away.name) ? 'items-center' : 'items-end'}`}>
                <img
                  src={match.teams.away.logo}
                  alt={match.teams.away.name}
                  className="object-contain mb-1 w-20 h-20 sm:w-14 sm:h-14"
                />
                <span className="text-lg sm:text-xs font-[Lato-Bold] mt-1">{match.teams.away.name}</span>
              </div>
            </div>

            {/* Odds chart */}
            <div className="mt-2 overflow-hidden bg-lightgreyblue h-[110px] sm:h-[80px]">
              <Chart type="line" data={generateOddsChartData()} options={generateChartOptions()} />
            </div>

            {/* Volume and odds */}
            <div className="flex justify-between items-end mt-3">
              <div className="text-sm sm:text-xs font-[Quicksand Bold]">
                <span className="block">Volume</span>
                <div className="text-white">$72,542</div>
              </div>
              <div className="flex space-x-4 text-sm sm:text-xs font-[Quicksand Bold]">
                <div className="flex flex-col items-center">
                  <span className="text-blue-400">$HOME</span>
                  <span className="text-blue-400 ">0.5</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-gray-400">$DRAW</span>
                  <span className="text-gray-400">3.9</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-red-500">$AWAY</span>
                  <span className="text-red-500">5.6</span>
                </div>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default MatchList;

