import { Ch2oReading, formatTime } from "@/lib/formaldehyde";

type TrendChartProps = {
  readings: Ch2oReading[];
};

const WIDTH = 900;
const HEIGHT = 440;
const PADDING = 44;

export function TrendChart({ readings }: TrendChartProps) {
  if (readings.length === 0) {
    return <div className="empty">还没有可展示的数据。传感器下一次上报后，这里会亮起来。</div>;
  }

  const values = readings.map((reading) => reading.ppmValue);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0.1, ...values);
  const range = maximum - minimum || 1;
  const points = readings.map((reading, index) => {
    const x =
      readings.length === 1
        ? WIDTH / 2
        : PADDING + (index / (readings.length - 1)) * (WIDTH - PADDING * 2);
    const y =
      HEIGHT - PADDING - ((reading.ppmValue - minimum) / range) * (HEIGHT - PADDING * 2);

    return { x, y, reading };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const safeLimitY = HEIGHT - PADDING - ((0.08 - minimum) / range) * (HEIGHT - PADDING * 2);
  const latest = points[points.length - 1];

  return (
    <svg
      aria-label="甲醛 ppm 趋势图"
      role="img"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
        </linearGradient>
      </defs>

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

      {safeLimitY >= PADDING && safeLimitY <= HEIGHT - PADDING ? (
        <>
          <line
            x1={PADDING}
            x2={WIDTH - PADDING}
            y1={safeLimitY}
            y2={safeLimitY}
            stroke="#facc15"
            strokeDasharray="6 8"
            strokeOpacity="0.8"
          />
          <text x={PADDING} y={safeLimitY - 8} fill="#facc15" fontSize="12">
            0.08 ppm 参考线
          </text>
        </>
      ) : null}

      <path
        d={`${path} L ${points[points.length - 1].x} ${HEIGHT - PADDING} L ${points[0].x} ${
          HEIGHT - PADDING
        } Z`}
        fill="url(#areaGradient)"
      />
      <path d={path} fill="none" stroke="url(#lineGradient)" strokeWidth="4" />

      {points.map((point) => (
        <circle
          key={point.reading.id}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#071014"
          stroke="#67e8f9"
          strokeWidth="2"
        />
      ))}

      <circle cx={latest.x} cy={latest.y} r="8" fill="#4ade80" />
      <text x={PADDING} y={HEIGHT - 12} fill="rgba(237,253,247,0.62)" fontSize="12">
        {formatTime(readings[0].recordedAt)}
      </text>
      <text
        x={WIDTH - PADDING}
        y={HEIGHT - 12}
        fill="rgba(237,253,247,0.62)"
        fontSize="12"
        textAnchor="end"
      >
        {formatTime(readings[readings.length - 1].recordedAt)}
      </text>
      <text x={PADDING} y={24} fill="rgba(237,253,247,0.72)" fontSize="12">
        {maximum.toFixed(3)} ppm
      </text>
      <text x={PADDING} y={HEIGHT - PADDING + 18} fill="rgba(237,253,247,0.72)" fontSize="12">
        {minimum.toFixed(3)} ppm
      </text>
    </svg>
  );
}
