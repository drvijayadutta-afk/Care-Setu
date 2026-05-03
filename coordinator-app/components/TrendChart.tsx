'use client';

interface DataPoint {
  date: string;   // ISO or parseable date string
  value: number;
  label?: string; // tooltip label override
}

interface TrendChartProps {
  data: DataPoint[];
  refMin?: number;
  refMax?: number;
  unit?: string;
  criticalHigh?: number;
  criticalLow?: number;
  height?: number;
  showDots?: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function TrendChart({
  data,
  refMin,
  refMax,
  unit = '',
  criticalHigh,
  criticalLow,
  height = 140,
  showDots = true,
}: TrendChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-gray-400 py-4">
        At least 2 data points needed to display a trend.
      </div>
    );
  }

  const W = 480;
  const H = height;
  const PAD = { top: 12, right: 16, bottom: 28, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const values = data.map(d => d.value);
  const allBounds = [...values];
  if (refMin != null) allBounds.push(refMin);
  if (refMax != null) allBounds.push(refMax);

  const rawMin = Math.min(...allBounds);
  const rawMax = Math.max(...allBounds);
  const padding = (rawMax - rawMin) * 0.15 || 1;
  const yMin = rawMin - padding;
  const yMax = rawMax + padding;

  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const pointColor = (v: number): string => {
    if (criticalLow != null && v <= criticalLow) return '#dc2626'; // red-600
    if (criticalHigh != null && v >= criticalHigh) return '#dc2626';
    if (refMin != null && v < refMin) return '#d97706'; // amber-600
    if (refMax != null && v > refMax) return '#d97706';
    return '#16a34a'; // green-600
  };

  const linePoints = data
    .map((d, i) => `${xScale(i)},${yScale(d.value)}`)
    .join(' ');

  // Y-axis ticks (4–5 evenly spaced)
  const yTicks: number[] = [];
  const tickCount = 4;
  for (let t = 0; t <= tickCount; t++) {
    yTicks.push(yMin + (t / tickCount) * (yMax - yMin));
  }

  // Reference band (if both bounds given)
  const refBandPath =
    refMin != null && refMax != null
      ? `M${PAD.left},${yScale(refMax)} L${PAD.left + chartW},${yScale(refMax)} L${PAD.left + chartW},${yScale(refMin)} L${PAD.left},${yScale(refMin)} Z`
      : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: '280px', height: `${H}px` }}
        aria-label="Trend chart"
      >
        {/* Reference range shaded band */}
        {refBandPath && (
          <path d={refBandPath} fill="#bbf7d0" opacity="0.45" />
        )}

        {/* Y-axis ticks + grid lines */}
        {yTicks.map((tick, i) => {
          const y = yScale(tick);
          return (
            <g key={i}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke="#e5e7eb" strokeWidth="1"
              />
              <text
                x={PAD.left - 4} y={y + 4}
                textAnchor="end" fontSize="9" fill="#9ca3af"
              >
                {tick % 1 === 0 ? tick.toFixed(0) : tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels — show first, last, and middle if room */}
        {data.map((d, i) => {
          const show = i === 0 || i === data.length - 1 || (data.length > 4 && i === Math.floor(data.length / 2));
          if (!show) return null;
          return (
            <text
              key={i}
              x={xScale(i)} y={H - 4}
              textAnchor="middle" fontSize="9" fill="#9ca3af"
            >
              {formatDate(d.date)}
            </text>
          );
        })}

        {/* Trend line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points with tooltips */}
        {showDots && data.map((d, i) => (
          <g key={i}>
            <circle
              cx={xScale(i)} cy={yScale(d.value)} r={4}
              fill={pointColor(d.value)} stroke="white" strokeWidth="1.5"
            />
            <title>{formatDate(d.date)}: {d.value} {unit}</title>
          </g>
        ))}

        {/* Ref range labels */}
        {refMax != null && (
          <text
            x={PAD.left + chartW + 2} y={yScale(refMax) + 4}
            fontSize="8" fill="#16a34a"
          >↑{refMax}</text>
        )}
        {refMin != null && (
          <text
            x={PAD.left + chartW + 2} y={yScale(refMin) + 4}
            fontSize="8" fill="#16a34a"
          >↓{refMin}</text>
        )}
      </svg>
    </div>
  );
}

// Minimal sparkline — single-color line, no axes, for inline use
interface SparklineProps {
  values: number[];
  height?: number;
  color?: string;
  alertBelow?: number; // color red if any value ≤ this
}

export function Sparkline({ values, height = 32, color = '#6366f1', alertBelow }: SparklineProps) {
  if (values.length < 2) return null;

  const W = 80;
  const H = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xStep = W / (values.length - 1);
  const yOf = (v: number) => H - 2 - ((v - min) / range) * (H - 4);

  const pts = values.map((v, i) => `${i * xStep},${yOf(v)}`).join(' ');
  const hasAlert = alertBelow != null && values.some(v => v <= alertBelow);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={hasAlert ? '#dc2626' : color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
