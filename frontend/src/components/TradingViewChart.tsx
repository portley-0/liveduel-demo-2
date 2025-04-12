import React, { useRef, useEffect, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  LineSeries,
} from "lightweight-charts";
import { MatchData } from "@/types/MatchData.ts";
import CustomTooltip from "./CustomTooltip.tsx"; 

export interface OddsHistory {
  timestamps?: number[];
  homeOdds?: number[];
  drawOdds?: number[];
  awayOdds?: number[];
}

interface TradingViewChartProps {
  oddsHistory: OddsHistory;
  matchData: MatchData;
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
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const homeSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const drawSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const awaySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState>({
    active: false,
    label: null,
    payload: [],
    position: { left: 0, top: 0 },
  });

  const TOOLTIP_WIDTH = 96;
  const TOOLTIP_HEIGHT = 80;
  const TOOLTIP_MARGIN = 15;

  const localTimeFormatter = (time: Time): string => {
    const date = new Date((time as number) * 1000);
    const today = new Date();
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString();
  };

  const updateChartSizeAndLayout = () => {
    if (chartContainerRef.current && chartRef.current) {
      const { clientWidth, clientHeight } = chartContainerRef.current;
      const isMobile = clientWidth < 500;
      const newFontSize = isMobile ? 6 : 12;
      
      const newScaleMargins = isMobile ? { top: 0, bottom: 0 } : { top: 0.1, bottom: 0.1 };
      
      const newBarSpacing = isMobile ? 1 : 6;
      
      chartRef.current.resize(clientWidth, clientHeight);
      chartRef.current.applyOptions({
        layout: { fontSize: newFontSize },
        rightPriceScale: { scaleMargins: newScaleMargins },
        timeScale: { barSpacing: newBarSpacing },
      });
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const containerWidth = chartContainerRef.current.clientWidth;
    const isMobile = containerWidth < 500;
    const initialFontSize = isMobile ? 6 : 12;
    const initialScaleMargins = isMobile ? { top: 0, bottom: 0 } : { top: 0.1, bottom: 0.1 };
    const initialBarSpacing = isMobile ? 1 : 6;

    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { color: "rgb(30, 41, 60)" },
        textColor: "#FFFFFF",
        fontSize: initialFontSize,
      },
      grid: {
        vertLines: { color: "#404040" },
        horzLines: { color: "#404040" },
      },
      localization: {
        timeFormatter: localTimeFormatter,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        fixRightEdge: true,
        rightOffset: 0,
        tickMarkFormatter: localTimeFormatter,
        barSpacing: initialBarSpacing,
      },
      rightPriceScale: {
        scaleMargins: initialScaleMargins,
      },
      crosshair: {
        mode: 0,
      },
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
      if (
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current!.clientHeight
      ) {
        setTooltip((prev) => ({ ...prev, active: false }));
        return;
      }

      const homeData = param.seriesData.get(homeSeriesRef.current!) as { time: Time; value: number };
      const drawData = param.seriesData.get(drawSeriesRef.current!) as { time: Time; value: number };
      const awayData = param.seriesData.get(awaySeriesRef.current!) as { time: Time; value: number };

      const payload = [
        { dataKey: "home", value: homeData ? homeData.value : undefined },
        { dataKey: "draw", value: drawData ? drawData.value : undefined },
        { dataKey: "away", value: awayData ? awayData.value : undefined },
      ];

      let left = param.point.x + TOOLTIP_MARGIN;
      if (left > chartContainerRef.current!.clientWidth - TOOLTIP_WIDTH) {
        left = param.point.x - TOOLTIP_MARGIN - TOOLTIP_WIDTH;
      }
      let top = param.point.y + TOOLTIP_MARGIN;
      if (top > chartContainerRef.current!.clientHeight - TOOLTIP_HEIGHT) {
        top = param.point.y - TOOLTIP_HEIGHT - TOOLTIP_MARGIN;
      }

      setTooltip({
        active: true,
        label: (param.time as number) * 1000,
        payload,
        position: { left, top },
      });
    });

    window.addEventListener("resize", updateChartSizeAndLayout);
    updateChartSizeAndLayout();

    return () => {
      window.removeEventListener("resize", updateChartSizeAndLayout);
      chartRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    const homeData = (oddsHistory.timestamps || []).map((timestamp, index) => ({
      time: (timestamp / 1000) as Time,
      value: oddsHistory.homeOdds?.[index] || 0,
    }));
    const drawData = (oddsHistory.timestamps || []).map((timestamp, index) => ({
      time: (timestamp / 1000) as Time,
      value: oddsHistory.drawOdds?.[index] || 0,
    }));
    const awayData = (oddsHistory.timestamps || []).map((timestamp, index) => ({
      time: (timestamp / 1000) as Time,
      value: oddsHistory.awayOdds?.[index] || 0,
    }));

    homeSeriesRef.current?.setData(homeData);
    drawSeriesRef.current?.setData(drawData);
    awaySeriesRef.current?.setData(awayData);

    chartRef.current?.timeScale().fitContent();
    chartRef.current?.timeScale().applyOptions({ rightOffset: 0 });
  }, [oddsHistory]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
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
            matchData={matchData}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(
  TradingViewChart,
  (prevProps, nextProps) => {
    const arraysEqual = (a?: number[], b?: number[]) => {
      if (a === b) return true;
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };

    return (
      arraysEqual(prevProps.oddsHistory.timestamps, nextProps.oddsHistory.timestamps) &&
      arraysEqual(prevProps.oddsHistory.homeOdds, nextProps.oddsHistory.homeOdds) &&
      arraysEqual(prevProps.oddsHistory.drawOdds, nextProps.oddsHistory.drawOdds) &&
      arraysEqual(prevProps.oddsHistory.awayOdds, nextProps.oddsHistory.awayOdds)
    );
  }
);
