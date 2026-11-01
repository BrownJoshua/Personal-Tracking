import { useEffect, useMemo, useRef, useState } from "react";

/** Validated for the dark glass surface (dataviz validator, dark mode). */
export const chartColors = { series1: "#0FA696", series2: "#7076F0", context: "rgba(167,179,198,0.55)", grid: "rgba(255,255,255,0.08)", axis: "#A7B3C6" };

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function useWidth(initial = 0) {
  const [w, setW] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  });
  return [w, ref] as const;
}

/** Single-series bar chart with hover tooltip and a table view. */
export function BarChart({ title, data, unit, color = chartColors.series1, height = 180, formatLabel = shortDate }: {
  title: string;
  data: { label: string; value: number }[];
  unit: string;
  color?: string;
  height?: number;
  formatLabel?: (l: string) => string;
}) {
  const [width, ref] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const pad = { top: 10, bottom: 24, left: 36, right: 8 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const gap = 2;
  const bw = data.length ? (plotW - gap * (data.length - 1)) / data.length : 0;
  const y = (v: number) => pad.top + plotH - (v / nice) * plotH;
  const h = hover !== null ? data[hover] : null;

  return (
    <figure className="chart" aria-label={title}>
      <figcaption className="chart-head">
        <span>{title}</span>
        <button className="link-btn small" onClick={() => setTable((t) => !t)}>{table ? "Chart" : "Table"}</button>
      </figcaption>
      {table ? (
        <table className="table table-compact">
          <thead><tr><th>Week</th><th className="num">{unit}</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label}><td>{formatLabel(d.label)}</td><td className="num">{d.value.toLocaleString()}</td></tr>)}</tbody>
        </table>
      ) : (
        <div ref={ref} className="chart-plot" onMouseLeave={() => setHover(null)}>
          {width > 0 && <svg width={width} height={height} role="img" aria-label={`${title}: ${data.map((d) => `${formatLabel(d.label)} ${d.value}`).join(", ")}`}>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={pad.left} x2={width - pad.right} y1={y(nice * f)} y2={y(nice * f)} stroke={chartColors.grid} />
                <text x={pad.left - 6} y={y(nice * f) + 4} fontSize={10} fill={chartColors.axis} textAnchor="end">{Math.round(nice * f).toLocaleString()}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = pad.left + i * (bw + gap);
              const bh = d.value > 0 ? Math.max(2, (d.value / nice) * plotH) : 0;
              const r = Math.min(4, bw / 2, bh);
              const top = pad.top + plotH - bh;
              return (
                <g key={d.label} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
                  <rect x={x} y={pad.top} width={bw + gap} height={plotH} fill="transparent" />
                  {bh > 0 && (
                    <path
                      d={`M${x},${pad.top + plotH} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + bw - r},${top} Q${x + bw},${top} ${x + bw},${top + r} L${x + bw},${pad.top + plotH} Z`}
                      fill={color}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                    />
                  )}
                </g>
              );
            })}
            {data.length > 0 && (
              <>
                <text x={pad.left} y={height - 6} fontSize={10} fill={chartColors.axis}>{formatLabel(data[0]!.label)}</text>
                <text x={width - pad.right} y={height - 6} fontSize={10} fill={chartColors.axis} textAnchor="end">{formatLabel(data[data.length - 1]!.label)}</text>
              </>
            )}
          </svg>}
          {h && hover !== null && (
            <div className="chart-tooltip" style={{ left: Math.min(width - 150, Math.max(0, pad.left + hover * (bw + gap) + bw / 2 - 70)) }}>
              <div className="muted small">{formatLabel(h.label)}</div>
              <strong>{h.value.toLocaleString()}</strong> {unit}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

export interface LineSeries { key: string; label: string; color: string; style: "line" | "dots"; points: { x: string; y: number }[] }

/** Time series on one y-axis, with crosshair tooltip, legend (≥2 series) and table view. */
export function LineChart({ title, series, unit, height = 220, decimals = 1 }: { title: string; series: LineSeries[]; unit: string; height?: number; decimals?: number }) {
  const [width, ref] = useWidth();
  const [hover, setHover] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(), [series]);
  const all = series.flatMap((s) => s.points.map((p) => p.y));
  const pad = { top: 10, bottom: 24, left: 40, right: 44 };
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const p = (hi - lo) * 0.15; lo = Math.floor((lo - p) * 2) / 2; hi = Math.ceil((hi + p) * 2) / 2;
  const plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;
  const t0 = xs.length ? Date.parse(xs[0]!) : 0;
  const span = xs.length > 1 ? Date.parse(xs[xs.length - 1]!) - t0 : 1;
  const sx = (x: string) => pad.left + (xs.length > 1 ? ((Date.parse(x) - t0) / span) * plotW : plotW / 2);
  const sy = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * plotH;
  const fmt = (v: number) => v.toFixed(decimals);
  if (!xs.length) return <p className="muted">No data yet.</p>;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = xs[0]!;
    for (const d of xs) if (Math.abs(sx(d) - x) < Math.abs(sx(best) - x)) best = d;
    setHover(best);
  }
  const vals = hover ? series.map((s) => ({ s, p: s.points.find((q) => q.x === hover) })).filter((v) => v.p) : [];

  return (
    <figure className="chart" aria-label={title}>
      <figcaption className="chart-head">
        <span>{title}</span>
        <span className="chart-legend">
          {series.length >= 2 && series.map((s) => (
            <span key={s.key}><i style={{ background: s.color, height: s.style === "line" ? 2 : 8, width: s.style === "line" ? 16 : 8, borderRadius: 4 }} />{s.label}</span>
          ))}
          <button className="link-btn small" onClick={() => setTable((t) => !t)}>{table ? "Chart" : "Table"}</button>
        </span>
      </figcaption>
      {table ? (
        <table className="table table-compact">
          <thead><tr><th>Date</th>{series.map((s) => <th key={s.key} className="num">{s.label}</th>)}</tr></thead>
          <tbody>{[...xs].reverse().map((d) => (
            <tr key={d}><td>{shortDate(d)}</td>{series.map((s) => { const q = s.points.find((v) => v.x === d); return <td key={s.key} className="num">{q ? `${fmt(q.y)} ${unit}` : "—"}</td>; })}</tr>
          ))}</tbody>
        </table>
      ) : (
        <div ref={ref} className="chart-plot">
          {width > 0 && <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img"
            aria-label={`${title}, ${xs.length} dates from ${shortDate(xs[0]!)} to ${shortDate(xs[xs.length - 1]!)}`}>
            {[0, 1, 2, 3].map((i) => { const v = lo + ((hi - lo) * i) / 3; return (
              <g key={i}>
                <line x1={pad.left} x2={width - pad.right} y1={sy(v)} y2={sy(v)} stroke={chartColors.grid} />
                <text x={pad.left - 6} y={sy(v) + 4} fontSize={10} fill={chartColors.axis} textAnchor="end">{v.toFixed(v % 1 ? 1 : 0)}</text>
              </g>
            ); })}
            <text x={pad.left} y={height - 6} fontSize={10} fill={chartColors.axis}>{shortDate(xs[0]!)}</text>
            {xs.length > 1 && <text x={width - pad.right} y={height - 6} fontSize={10} fill={chartColors.axis} textAnchor="end">{shortDate(xs[xs.length - 1]!)}</text>}
            {series.map((s) => s.style === "line" ? (
              <path key={s.key} d={s.points.map((q, i) => `${i ? "L" : "M"}${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(" ")} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ) : (
              <g key={s.key}>{s.points.map((q) => <circle key={q.x} cx={sx(q.x)} cy={sy(q.y)} r={4} fill={s.color} stroke="#0f2236" strokeWidth={2} />)}</g>
            ))}
            {series.filter((s) => s.style === "line" && s.points.length).map((s) => { const l = s.points[s.points.length - 1]!; return (
              <text key={`d${s.key}`} x={sx(l.x) + 6} y={sy(l.y) + 4} fontSize={11} fontWeight={600} fill="#eef2f7">{fmt(l.y)}</text>
            ); })}
            {hover && (
              <g>
                <line x1={sx(hover)} x2={sx(hover)} y1={pad.top} y2={pad.top + plotH} stroke={chartColors.axis} strokeDasharray="3 3" />
                {vals.map(({ s, p: q }) => <circle key={s.key} cx={sx(hover)} cy={sy(q!.y)} r={5} fill={s.color} stroke="#eef2f7" strokeWidth={2} />)}
              </g>
            )}
          </svg>}
          {hover && (
            <div className="chart-tooltip" style={{ left: Math.min(width - 170, Math.max(0, sx(hover) - 80)) }}>
              <div className="muted small">{shortDate(hover)}</div>
              {vals.map(({ s, p: q }) => <div key={s.key}>{s.label}: <strong>{fmt(q!.y)}</strong> {unit}</div>)}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
