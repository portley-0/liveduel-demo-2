import React, { useRef, useEffect, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  LineSeries,
  PriceFormat,
  SingleValueData,
} from "lightweight-charts";
import { MatchData } from "@/types/MatchData.ts";
import CustomTooltip from "./CustomTooltip.tsx";

export interface OddsHistory {
  timestamps?: number[];
  homeOdds?: number[];
  drawOdds?: number[];
  awayOdds?: number[];
}

type Format = "decimal" | "percent" | "fraction";
type TimeRange = "1h" | "2h" | "1d" | "1w";

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

interface TradingViewChartProps {
  oddsHistory: OddsHistory;
  matchData: MatchData;
  format: Format;
  onFormatChange: (newFormat: Format) => void;
}

interface TooltipState {
  active: boolean;
  label: number | null;
  payload: { dataKey: string; value: number | undefined }[];
  position: { left: number; top: number };
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
  oddsHistory,
  matchData,
  format,
  onFormatChange,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const homeSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const drawSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const awaySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [timeRange, setTimeRange] = useState<TimeRange>("1d");
  const [tooltip, setTooltip] = useState<TooltipState>({
    active: false,
    label: null,
    payload: [],
    position: { left: 0, top: 0 },
  });

  const getTimeRangeStart = (): number => {
    const now = Date.now();
    const ranges: Record<TimeRange, number> = {
      "1h": now - 60 * 60 * 1000,
      "2h": now - 2 * 60 * 60 * 1000,
      "1d": now - 24 * 60 * 60 * 1000,
      "1w": now - 7 * 24 * 60 * 60 * 1000,
    };
    return ranges[timeRange];
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

  const DEFAULT_ODD = 3.0;
  const computeValue = (odd?: number): number => {
    const o = odd ?? DEFAULT_ODD;
    return format === "percent" ? 100 / o : o;
  };

  const updateSeriesAndFormat = () => {
    if (!chartRef.current) return;
    const startIndex = 2;
    const ts = (oddsHistory.timestamps || []).slice(startIndex);
    const ho = (oddsHistory.homeOdds || []).slice(startIndex);
    const dr = (oddsHistory.drawOdds || []).slice(startIndex);
    const aw = (oddsHistory.awayOdds || []).slice(startIndex);

    const rangeStart = getTimeRangeStart();

    const filtered = ts.reduce<
      { t: number; h?: number; d?: number; a?: number }[]
    >((acc, t, i) => {
      if (t >= rangeStart) {
        acc.push({
          t,
          h: ho[i],
          d: dr[i],
          a: aw[i],
        });
      }
      return acc;
    }, []);

    homeSeriesRef.current!.setData(
      filtered.map((p) => ({
        time: (p.t / 1000) as Time,
        value: computeValue(p.h),
      }))
    );
    drawSeriesRef.current!.setData(
      filtered.map((p) => ({
        time: (p.t / 1000) as Time,
        value: computeValue(p.d),
      }))
    );
    awaySeriesRef.current!.setData(
      filtered.map((p) => ({
        time: (p.t / 1000) as Time,
        value: computeValue(p.a),
      }))
    );

    chartRef.current.timeScale().fitContent();
    const pf = getPriceFormat();
    homeSeriesRef.current!.applyOptions({ priceFormat: pf });
    drawSeriesRef.current!.applyOptions({ priceFormat: pf });
    awaySeriesRef.current!.applyOptions({ priceFormat: pf });
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
    chartRef.current.timeScale().fitContent();
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

    homeSeriesRef.current = chartRef.current.addSeries(LineSeries, {
      color: "rgba(0, 123, 255, 1)",
      lineWidth: 2,
    });
    drawSeriesRef.current = chartRef.current.addSeries(LineSeries, {
      color: "rgba(128, 128, 128, 1)",
      lineWidth: 2,
    });
    awaySeriesRef.current = chartRef.current.addSeries(LineSeries, {
      color: "rgb(225, 29, 72)",
      lineWidth: 2,
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

      const homeData = param.seriesData.get(homeSeriesRef.current!) as SingleValueData;
      const drawData = param.seriesData.get(drawSeriesRef.current!) as SingleValueData;
      const awayData = param.seriesData.get(awaySeriesRef.current!) as SingleValueData;

      const payload = [
        { dataKey: "home", value: homeData?.value },
        { dataKey: "draw", value: drawData?.value },
        { dataKey: "away", value: awayData?.value },
      ];

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

    updateSeriesAndFormat();
    return () => chartRef.current?.remove();
  }, []);

  useEffect(() => {
    updateSeriesAndFormat();
  }, [oddsHistory, format, timeRange]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 500;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* format tabs */}
      <div
        style={{
          position: "absolute",
          top: 8,
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
              padding: "2px 4px",
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

      {/* time range filter */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          display: "flex",
          gap: 6,
          padding: isMobile ? "2px 4px" : "4px 6px",
          background: "rgba(30,41,60,0.8)",
          borderRadius: 4,
          zIndex: 10,
        }}
      >
        {(["1h", "2h", "1d", "1w"] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setTimeRange(r)}
            style={{
              padding: "2px 4px",
              fontSize: isMobile ? 10 : 12,
              cursor: "pointer",
              fontWeight: timeRange === r ? "bold" : "normal",
              background: "transparent",
              border: "none",
              color: timeRange === r ? "#fff" : "#ccc",
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* chart */}
      <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* tooltip */}
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
            matchData={matchData}
            format={format}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(TradingViewChart, (prevProps, nextProps) => {
  const eq = (a?: number[], b?: number[]) => {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  };
  return (
    prevProps.format === nextProps.format &&
    eq(prevProps.oddsHistory.timestamps, nextProps.oddsHistory.timestamps) &&
    eq(prevProps.oddsHistory.homeOdds, nextProps.oddsHistory.homeOdds) &&
    eq(prevProps.oddsHistory.drawOdds, nextProps.oddsHistory.drawOdds) &&
    eq(prevProps.oddsHistory.awayOdds, nextProps.oddsHistory.awayOdds)
  );
});
