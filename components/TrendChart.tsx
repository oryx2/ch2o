import {
  CH2O_REFERENCE_PPM,
  Ch2oReading,
  TVOC_REFERENCE_LINES,
  formatPpm,
  formatTime,
} from "@/lib/formaldehyde";

type TrendChartProps = {
  readings: Ch2oReading[];
  color?: string;
  variant?: "ch2o" | "tvoc";
};

const WIDTH = 900;
const HEIGHT = 440;
const PADDING = 44;
const DEFAULT_COLOR = "var(--cyan)";

type SeriesPoint = {
  x: number;
  y: number;
  reading: Ch2oReading;
};

type ReferenceLine = {
  value: number;
  label: string;
  color: string;
};

function valueToY(value: number, minimum: number, range: number): number {
  return HEIGHT - PADDING - ((value - minimum) / range) * (HEIGHT - PADDING * 2);
}

function isYVisible(y: number): boolean {
  return y >= PADDING && y <= HEIGHT - PADDING;
}

function buildPoints(
  readings: Ch2oReading[],
  minimum: number,
  range: number,
  valueKey: "ppmValue",
): SeriesPoint[] {
  return readings
    .filter((reading) => reading[valueKey] !== null)
    .map((reading, pointIndex, filtered) => {
      const value = reading[valueKey] as number;
      const x =
        filtered.length === 1
          ? WIDTH / 2
          : PADDING + (pointIndex / (filtered.length - 1)) * (WIDTH - PADDING * 2);

      return { x, y: valueToY(value, minimum, range), reading };
    });
}

function ChartReferenceLines({
  lines,
  minimum,
  range,
}: {
  lines: ReferenceLine[];
  minimum: number;
  range: number;
}) {
  return (
    <>
      {lines.map((line, index) => {
        const y = valueToY(line.value, minimum, range);

        if (!isYVisible(y)) {
          return null;
        }

        return (
          <g key={line.value}>
            <line
              x1={PADDING}
              x2={WIDTH - PADDING}
              y1={y}
              y2={y}
              stroke={line.color}
              strokeDasharray="6 8"
              strokeOpacity="0.85"
            />
            <text
              x={index % 2 === 0 ? PADDING : WIDTH - PADDING}
              y={y - 8}
              fill={line.color}
              fontSize="12"
              textAnchor={index % 2 === 0 ? "start" : "end"}
            >
              {line.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function TrendChart({
  readings,
  color = DEFAULT_COLOR,
  variant = "ch2o",
}: TrendChartProps) {
  const chartReadings = readings.filter((reading) => reading.ppmValue !== null);

  if (chartReadings.length === 0) {
    return <div className="empty">还没有可展示的数据。传感器下一次上报后，这里会亮起来。</div>;
  }

  const values = chartReadings.map((reading) => reading.ppmValue as number);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(variant === "ch2o" ? 0.1 : 0.22, ...values);
  const range = maximum - minimum || 1;
  const points = buildPoints(chartReadings, minimum, range, "ppmValue");
  const referenceLines: ReferenceLine[] =
    variant === "ch2o"
      ? [{ value: CH2O_REFERENCE_PPM, label: `${CH2O_REFERENCE_PPM} ppm 参考线`, color: "#facc15" }]
      : [...TVOC_REFERENCE_LINES];
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const unitLabel = "ppm";

  return (
    <div className="chart-wrap">
      <svg
        aria-label={variant === "ch2o" ? "甲醛 ppm 趋势图" : "TVOC 趋势图"}
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        {[0, 1, 2, 3].map((line) => {
          const y = PADDING + line * ((HEIGHT - PADDING * 2) / 3);

          return (
            <line
              key={line}
              x1={PADDING}
              x2={WIDTH - PADDING}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.10)"
            />
          );
        })}

        <ChartReferenceLines lines={referenceLines} minimum={minimum} range={range} />

        {points.length > 1 ? (
          <path d={path} fill="none" stroke={color} strokeWidth="3" />
        ) : null}
        {points.map((point) => (
          <circle
            key={point.reading.id}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#071014"
            stroke={color}
            strokeWidth="2"
          />
        ))}
        {points.length > 0 ? (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="7"
            fill={color}
          />
        ) : null}

        <text x={PADDING} y={HEIGHT - 12} fill="rgba(237,253,247,0.62)" fontSize="12">
          {formatTime(chartReadings[0].recordedAt)}
        </text>
        <text
          x={WIDTH - PADDING}
          y={HEIGHT - 12}
          fill="rgba(237,253,247,0.62)"
          fontSize="12"
          textAnchor="end"
        >
          {formatTime(chartReadings[chartReadings.length - 1].recordedAt)}
        </text>
        <text x={PADDING} y={24} fill="rgba(237,253,247,0.72)" fontSize="12">
          {formatPpm(maximum)} {variant === "tvoc" ? "TVOC" : unitLabel}
        </text>
        <text x={PADDING} y={HEIGHT - PADDING + 18} fill="rgba(237,253,247,0.72)" fontSize="12">
          {formatPpm(minimum)} {variant === "tvoc" ? "TVOC" : unitLabel}
        </text>
      </svg>
    </div>
  );
}
