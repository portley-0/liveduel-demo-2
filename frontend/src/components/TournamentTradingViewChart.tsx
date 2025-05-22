import React, { useRef, useEffect, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  LineSeries,
  PriceFormat,
  SingleValueData,
  IRange,
} from "lightweight-charts";
import CustomTooltip from "./CustomTooltip.tsx";
import { TournamentData } from "@/types/TournamentData.ts";

export interface TournamentOddsHistory {
  timestamps: number[];
  teamOdds: Record<number, number[]>;
}

type Format = "decimal" | "percent" | "fraction";
type TimeRange = "1h" | "2h" | "1d" | "1w" | "default";

interface TournamentTradingViewChartProps {
  oddsHistory: TournamentOddsHistory;
  tournament: TournamentData;
  format: Format;
  onFormatChange: (newFormat: Format) => void;
}

interface TooltipState {
  active: boolean;
  label: number | null;
  payload: { dataKey: string; value: number | undefined }[];
  position: { left: number; top: number };
}

// Distinct colors for team lines
const TEAM_COLORS = [
  "rgba(0, 123, 255, 1)", // Blue
  "rgb(225, 29, 72)", // Redmagenta
  "rgba(128, 128, 128, 1)", // Gray
  "rgba(255, 193, 7, 1)", // Yellow
  "rgba(40, 167, 69, 1)", // Green
  "rgba(111, 66, 193, 1)", // Purple
  "rgba(255, 87, 34, 1)", // Orange
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

const TournamentTradingViewChart: React.FC<TournamentTradingViewChartProps> = ({
  oddsHistory,
  tournament,
  format,
  onFormatChange,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Record<number, ISeriesApi<"Line">>>({});

  const [timeRange, setTimeRange] = useState<TimeRange>("default");
  const [tooltip, setTooltip] = useState<TooltipState>({
    active: false,
    label: null,
    payload: [],
    position: { left: 0, top: 0 },
  });

  const getTimeRangeStart = (): number => {
    const now = Date.now();
    const ranges: Record<Exclude<TimeRange, "default">, number> = {
      "1h": now - 60 * 60 * 1000,
      "2h": now - 2 * 60 * 60 * 1000,
      "1d": now - 24 * 60 * 60 * 1000,
      "1w": now - 7 * 24 * 60 * 60 * 1000,
    };
    return timeRange === "default" ? now - 60 * 60 * 1000 : ranges[timeRange];
  };

  const localTimeFormatter = (time: Time): string => {
    const d = new Date((time as number) * 1000);
    const t = new Date();
    if (
      d.getDate() === t.getDate() &&
      d.getMonth() === t.getMonth() &&
      d.getFullYear() === t.getFullYear()
    ) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString();
  };

  const getPriceFormat = (): PriceFormat => {
    const minMove = 0.01;
    if (format === "decimal") return { type: "price", precision: 2, minMove };
    if (format === "percent")
      return { type: "custom", formatter: (v) => `${v.toFixed(2)}%`, minMove };
    return { type: "custom", formatter: decimalToFraction, minMove };
  };

  const DEFAULT_ODD = 3.00000030000003;
  const computeValue = (odd?: number): number => {
    const o = odd ?? DEFAULT_ODD;
    return format === "percent" ? 100 / o : o;
  };

  const updateSeriesAndFormat = () => {
    if (!chartRef.current) return;
    const startIndex = 2;
    const ts = (oddsHistory.timestamps || []).slice(startIndex);
    const teamOdds = oddsHistory.teamOdds || {};

    // Prepare data for each team
    const realData = ts
      .reduce<{ t: number; odds: Record<number, number | undefined> }[]>((acc, t, i) => {
        const entry: { t: number; odds: Record<number, number | undefined> } = { t, odds: {} };
        Object.keys(teamOdds).forEach((teamId) => {
          entry.odds[Number(teamId)] = teamOdds[Number(teamId)][i + startIndex];
        });
        acc.push(entry);
        return acc;
      }, [])
      .sort((a, b) => a.t - b.t);

    const now = Date.now();
    let rangeStart = getTimeRangeStart();
    let rangeEnd = now;
    const interval = 10 * 60 * 1000;
    const zoomFactor = 0.95;

    let displayData = realData;
    if (timeRange === "default" && realData.length > 0) {
      const zoomCount = Math.ceil(realData.length * zoomFactor);
      displayData = realData.slice(-zoomCount);
      rangeStart = realData[0].t - 30 * 60 * 1000;
    } else if (timeRange === "default") {
      rangeStart = now - 60 * 60 * 1000;
    }

    let pointsInRange = timeRange === "default" ? realData : realData.filter((p) => p.t >= rangeStart && p.t <= rangeEnd).slice(-4);

    let combinedData: { t: number; odds: Record<number, number | undefined> }[] = [];
    let flatlineOdds: Record<number, number> = {};

    if (realData.length > 0) {
      const priorPoint = realData.filter((p) => p.t < rangeStart).slice(-1)[0];
      Object.keys(teamOdds).forEach((teamId) => {
        flatlineOdds[Number(teamId)] = priorPoint?.odds[Number(teamId)] ?? DEFAULT_ODD;
      });
    } else {
      Object.keys(teamOdds).forEach((teamId) => {
        flatlineOdds[Number(teamId)] = DEFAULT_ODD;
      });
    }

    if (pointsInRange.length === 0) {
      for (let t = rangeStart; t <= rangeEnd; t += interval) {
        combinedData.push({ t, odds: { ...flatlineOdds } });
      }
    } else {
      const firstPoint = pointsInRange[0];
      for (let t = rangeStart; t <= firstPoint.t; t += interval) {
        combinedData.push({ t, odds: { ...flatlineOdds } });
      }
      combinedData.push(...pointsInRange);
    }

    combinedData = combinedData
      .sort((a, b) => a.t - b.t)
      .filter((item, index, arr) => index === 0 || item.t > arr[index - 1].t);

    // Update or create series for each team
    Object.keys(teamOdds).forEach((teamId, index) => {
      const tid = Number(teamId);
      if (!seriesRefs.current[tid]) {
        seriesRefs.current[tid] = chartRef.current!.addSeries(LineSeries, {
          color: TEAM_COLORS[index % TEAM_COLORS.length],
          lineWidth: 2,
          pointMarkersVisible: false,
        });
      }
      seriesRefs.current[tid].setData(
        combinedData.map((p) => ({
          time: (p.t / 1000) as Time,
          value: computeValue(p.odds[tid]),
        }))
      );
      seriesRefs.current[tid].applyOptions({ priceFormat: getPriceFormat(), pointMarkersVisible: false });
    });

    // Set visible range
    if (timeRange === "default" && displayData.length > 0) {
      const firstTime = displayData[0].t / 1000;
      const lastTime = displayData[displayData.length - 1].t / 1000;
      const padding = interval / 1000;
      const visibleRange: IRange<Time> = {
        from: firstTime as Time,
        to: (lastTime + padding) as Time,
      };
      chartRef.current!.timeScale().setVisibleRange(visibleRange);
    } else if (pointsInRange.length > 0) {
      const firstTime = Math.min(rangeStart, pointsInRange[0].t) / 1000;
      const lastTime = pointsInRange[pointsInRange.length - 1].t / 1000;
      const padding = interval / 1000;
      const visibleRange: IRange<Time> = {
        from: firstTime as Time,
        to: (lastTime + padding) as Time,
      };
      chartRef.current!.timeScale().setVisibleRange(visibleRange);
    } else if (combinedData.length > 0) {
      const firstTime = combinedData[0].t / 1000;
      const lastTime = combinedData[combinedData.length - 1].t / 1000;
      const padding = interval / 1000;
      const visibleRange: IRange<Time> = {
        from: firstTime as Time,
        to: (lastTime + padding) as Time,
      };
      chartRef.current!.timeScale().setVisibleRange(visibleRange);
    } else {
      chartRef.current!.timeScale().fitContent();
    }
  };

  const updateChartSizeAndLayout = () => {
    if (!chartContainerRef.current || !chartRef.current) return;
    const { clientWidth, clientHeight } = chartContainerRef.current;
    const isMobile = clientWidth < 500;
    chartRef.current.resize(clientWidth, clientHeight);
    chartRef.current.applyOptions({
      layout: { fontSize: isMobile ? 6 : 12 },
      rightPriceScale: {
        scaleMargins: isMobile ? { top: 0, bottom: 0 } : { top: 0.1, bottom: 0.1 },
        borderVisible: false,
      },
      timeScale: { barSpacing: isMobile ? 1 : 6 },
    });
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const obs = new ResizeObserver(updateChartSizeAndLayout);
    obs.observe(chartContainerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const c = chartContainerRef.current;
    const isMobile = c.clientWidth < 500;

    chartRef.current = createChart(c, {
      width: c.clientWidth,
      height: c.clientHeight,
      layout: {
        background: { color: "rgb(30, 41, 60)" },
        textColor: "#FFFFFF",
        fontSize: isMobile ? 6 : 12,
      },
      grid: {
        vertLines: { color: "#404040" },
        horzLines: { color: "#404040" },
      },
      localization: { timeFormatter: localTimeFormatter },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        fixRightEdge: true,
        rightOffset: 0,
        tickMarkFormatter: localTimeFormatter,
        barSpacing: isMobile ? 1 : 6,
      },
      rightPriceScale: {
        scaleMargins: isMobile ? { top: 0, bottom: 0 } : { top: 0.1, bottom: 0.1 },
        borderVisible: false,
      },
      crosshair: { mode: 0 },
    });

    chartRef.current.subscribeCrosshairMove((param) => {
      const w = c.clientWidth,
        h = c.clientHeight;
      if (
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > w ||
        param.point.y < 0 ||
        param.point.y > h
      ) {
        setTooltip((t) => ({ ...t, active: false }));
        return;
      }

      const payload = Object.keys(seriesRefs.current).map((teamId) => {
        const data = param.seriesData.get(seriesRefs.current[Number(teamId)]!) as SingleValueData;
        return { dataKey: teamId, value: data?.value }; // Use teamId as dataKey
      });

      const OFFSET = 15;
      let left = param.point.x + OFFSET;
      if (left > w - 96) left = param.point.x - OFFSET - 96;
      let top = param.point.y + OFFSET;
      if (top > h - 80) top = param.point.y - 80 - OFFSET;

      setTooltip({
        active: true,
        label: (param.time as number) * 1000,
        payload,
        position: { left, top },
      });
    });

    setTimeout(() => {
      updateSeriesAndFormat();
    }, 0);

    return () => chartRef.current?.remove();
  }, [timeRange]);

  useEffect(() => {
    updateSeriesAndFormat();
  }, [oddsHistory, format, timeRange]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 500;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          top: 3,
          left: 8,
          display: "flex",
          gap: 6,
          padding: isMobile ? "2px 4px" : "4px 6px",
          background: "rgba(30,41,60,0.8)",
          borderRadius: 4,
          zIndex: 10,
          transform: isMobile ? "scale(0.9)" : "scale(1)",
          transformOrigin: "top left",
        }}
      >
        {(["decimal", "percent", "fraction"] as Format[]).map((f) => (
          <button
            key={f}
            onClick={() => onFormatChange(f)}
            style={{
              padding: isMobile ? "1px 3px" : "1px 3px",
              fontSize: isMobile ? 10 : 12,
              cursor: "pointer",
              fontWeight: format === f ? "bold" : "normal",
              background: "transparent",
              border: "none",
              color: format === f ? "#fff" : "#ccc",
            }}
          >
            {f === "decimal" ? "Decimal" : f === "percent" ? "%" : "Fraction"}
          </button>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: isMobile ? 15 : 27,
          left: 8,
          display: "flex",
          gap: 6,
          padding: isMobile ? "1px 2px" : "2px 4px",
          background: "rgba(30,41,60,0.8)",
          borderRadius: 4,
          zIndex: 10,
        }}
      >
        {(["default", "1h", "2h", "1d", "1w"] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setTimeRange(r)}
            style={{
              padding: isMobile ? "1px 3px" : "1px 3px",
              fontSize: isMobile ? 10 : 12,
              cursor: "pointer",
              fontWeight: timeRange === r ? "bold" : "normal",
              background: "transparent",
              border: "none",
              color: timeRange === r ? "#fff" : "#ccc",
            }}
          >
            {r === "default" ? "Recent" : r}
          </button>
        ))}
      </div>

      <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />

      {tooltip.active && tooltip.label && (
        <div
          style={{
            position: "absolute",
            left: tooltip.position.left,
            top: tooltip.position.top,
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          <CustomTooltip
            active={tooltip.active}
            payload={tooltip.payload}
            label={tooltip.label}
            tournament={tournament}
            format={format}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(TournamentTradingViewChart, (prevProps, nextProps) => {
  const eq = (a?: number[], b?: number[]) => {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  };
  return (
    prevProps.format === nextProps.format &&
    eq(prevProps.oddsHistory.timestamps, nextProps.oddsHistory.timestamps) &&
    Object.keys(prevProps.oddsHistory.teamOdds).every((teamId) =>
      eq(
        prevProps.oddsHistory.teamOdds[Number(teamId)],
        nextProps.oddsHistory.teamOdds[Number(teamId)]
      )
    ) &&
    JSON.stringify(prevProps.tournament) === JSON.stringify(nextProps.tournament)
  );
});