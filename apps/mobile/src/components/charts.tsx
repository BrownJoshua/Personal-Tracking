import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { colors, space } from "../theme";
import { styles } from "./ui";

/**
 * Chart palette validated for the dark glass surfaces (dataviz validator, dark mode):
 * both pass lightness, chroma, CVD and contrast checks. Two-series charts always carry a
 * legend + direct label because tritan separation is in the 6–8 band.
 */
export const chartColors = { series1: "#0FA696", series2: "#7076F0", context: "rgba(167,179,198,0.55)", grid: "rgba(255,255,255,0.08)", axis: "#A7B3C6" };

export interface Series {
  key: string;
  label: string;
  color: string;
  style: "line" | "dots";
  points: { x: string; y: number }[];
}

const PAD = { top: 12, right: 44, bottom: 22, left: 40 };
/** react-native-svg uses the system font natively; on web it would fall back to a serif font. */
const FONT = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" : undefined;

function niceDomain(values: number[]): [number, number] {
  if (!values.length) return [0, 1];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.15;
  return [Math.floor((lo - pad) * 2) / 2, Math.ceil((hi + pad) * 2) / 2];
}

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Time-series line/dot chart on one y-axis, with touch crosshair, tooltip and a table view. */
export function LineChart({
  series,
  height = 180,
  unit,
  decimals = 1,
  summary,
}: {
  series: Series[];
  height?: number;
  unit: string;
  decimals?: number;
  /** Plain-language description for screen readers. */
  summary: string;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(), [series]);
  const [y0, y1] = niceDomain(series.flatMap((s) => s.points.map((p) => p.y)));
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const t0 = xs.length ? Date.parse(xs[0]!) : 0;
  const span = xs.length > 1 ? Date.parse(xs[xs.length - 1]!) - t0 : 1;
  const sx = (x: string) => PAD.left + (xs.length > 1 ? ((Date.parse(x) - t0) / span) * plotW : plotW / 2);
  const sy = (y: number) => PAD.top + (1 - (y - y0) / (y1 - y0)) * plotH;
  const ticks = [0, 1, 2, 3].map((i) => y0 + ((y1 - y0) * i) / 3);
  const fmt = (v: number) => v.toFixed(decimals);
  const legend = series.length >= 2;

  function onTouch(e: GestureResponderEvent) {
    if (!xs.length) return;
    const x = e.nativeEvent.locationX;
    let best = xs[0]!;
    for (const d of xs) if (Math.abs(sx(d) - x) < Math.abs(sx(best) - x)) best = d;
    setActive(best);
  }

  if (!xs.length) return <Text style={styles.muted}>No data in this range yet.</Text>;
  const activeValues = active ? series.map((s) => ({ s, p: s.points.find((p) => p.x === active) })).filter((v) => v.p) : [];

  return (
    <View style={{ gap: space.sm }}>
      {legend && (
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          {series.map((s) => (
            <View key={s.key} style={styles.row}>
              {s.style === "line" ? (
                <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: s.color }} />
              ) : (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
              )}
              <Text style={[styles.muted, { fontSize: 12 }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
      {table ? (
        <View accessibilityLabel={summary}>
          <View style={[styles.row, styles.listItem]}>
            <Text style={[styles.muted, { flex: 1 }]}>Date</Text>
            {series.map((s) => <Text key={s.key} style={[styles.muted, { flex: 1, textAlign: "right" }]}>{s.label}</Text>)}
          </View>
          {[...xs].reverse().map((d) => (
            <View key={d} style={[styles.row, styles.listItem]}>
              <Text style={[styles.text, { flex: 1 }]}>{shortDate(d)}</Text>
              {series.map((s) => {
                const p = s.points.find((q) => q.x === d);
                return <Text key={s.key} style={[styles.text, { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] }]}>{p ? `${fmt(p.y)} ${unit}` : "—"}</Text>;
              })}
            </View>
          ))}
        </View>
      ) : (
        <View
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={onTouch}
          onResponderMove={onTouch}
          onResponderRelease={() => setTimeout(() => setActive(null), 1800)}
          accessible
          accessibilityRole="image"
          accessibilityLabel={summary}
          style={{ height }}
        >
          {width > 0 && (
            <Svg width={width} height={height}>
              {ticks.map((t) => (
                <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke={chartColors.grid} strokeWidth={1} />
              ))}
              {ticks.map((t) => (
                <SvgText fontFamily={FONT} key={`l${t}`} x={PAD.left - 6} y={sy(t) + 4} fontSize={10} fill={chartColors.axis} textAnchor="end">
                  {t.toFixed(t % 1 ? 1 : 0)}
                </SvgText>
              ))}
              <SvgText fontFamily={FONT} x={PAD.left} y={height - 6} fontSize={10} fill={chartColors.axis}>{shortDate(xs[0]!)}</SvgText>
              {xs.length > 1 && (
                <SvgText fontFamily={FONT} x={width - PAD.right} y={height - 6} fontSize={10} fill={chartColors.axis} textAnchor="end">{shortDate(xs[xs.length - 1]!)}</SvgText>
              )}
              {series.map((s) =>
                s.style === "line" ? (
                  <Path
                    key={s.key}
                    d={s.points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ")}
                    stroke={s.color}
                    strokeWidth={2}
                    fill="none"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : (
                  s.points.map((p) => <Circle key={`${s.key}${p.x}`} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.color} stroke={colors.bgTop} strokeWidth={2} />)
                ),
              )}
              {/* Direct label on the last point of each line series. */}
              {series
                .filter((s) => s.style === "line" && s.points.length)
                .map((s) => {
                  const last = s.points[s.points.length - 1]!;
                  return (
                    <SvgText fontFamily={FONT} key={`d${s.key}`} x={sx(last.x) + 6} y={sy(last.y) + 4} fontSize={11} fontWeight="600" fill={colors.text}>
                      {fmt(last.y)}
                    </SvgText>
                  );
                })}
              {active && (
                <>
                  <Line x1={sx(active)} x2={sx(active)} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.muted} strokeWidth={1} strokeDasharray="3,3" />
                  {activeValues.map(({ s, p }) => (
                    <Circle key={`a${s.key}`} cx={sx(active)} cy={sy(p!.y)} r={5} fill={s.color} stroke={colors.text} strokeWidth={2} />
                  ))}
                </>
              )}
            </Svg>
          )}
          {active && width > 0 && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: Math.min(Math.max(0, sx(active) - 70), width - 140),
                width: 140,
                padding: 8,
                borderRadius: 10,
                backgroundColor: "rgba(13,27,46,0.92)",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={[styles.muted, { fontSize: 11 }]}>{shortDate(active)}</Text>
              {activeValues.map(({ s, p }) => (
                <Text key={s.key} style={[styles.text, { fontSize: 13 }]}>
                  {s.label}: <Text style={{ fontWeight: "700" }}>{fmt(p!.y)} {unit}</Text>
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
      <Pressable onPress={() => setTable((t) => !t)} accessibilityRole="button" style={{ alignSelf: "flex-end" }}>
        <Text style={{ color: colors.primary, fontSize: 13 }}>{table ? "Show chart" : "Show as table"}</Text>
      </Pressable>
    </View>
  );
}

/** Single-series bar chart (e.g. weekly volume). Tap a bar for its value. */
export function BarChart({
  data,
  height = 150,
  unit,
  summary,
  color = chartColors.series1,
  formatLabel,
}: {
  data: { label: string; value: number }[];
  height?: number;
  unit: string;
  summary: string;
  color?: string;
  formatLabel?: (l: string) => string;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const plotH = height - 22;
  const gap = 2;
  const bw = data.length ? Math.max(4, (width - gap * (data.length - 1)) / data.length) : 0;
  const a = active !== null ? data[active] : null;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[styles.text, { minHeight: 18 }]}>
        {a ? `${formatLabel ? formatLabel(a.label) : a.label}: ${Math.round(a.value).toLocaleString()} ${unit}` : " "}
      </Text>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }} accessible accessibilityRole="image" accessibilityLabel={summary}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={plotH} y2={plotH} stroke={chartColors.grid} strokeWidth={1} />
            {data.map((d, i) => {
              const h = d.value > 0 ? Math.max(2, (d.value / max) * (plotH - 4)) : 0;
              const x = i * (bw + gap);
              const r = Math.min(4, bw / 2, h);
              // Rounded top (data end), square at the baseline.
              const path = h
                ? `M${x},${plotH} L${x},${plotH - h + r} Q${x},${plotH - h} ${x + r},${plotH - h} L${x + bw - r},${plotH - h} Q${x + bw},${plotH - h} ${x + bw},${plotH - h + r} L${x + bw},${plotH} Z`
                : "";
              return (
                <G key={d.label}>
                  {h > 0 && <Path d={path} fill={color} opacity={active === null || active === i ? 1 : 0.45} />}
                  <Rect x={x} y={0} width={bw + gap} height={plotH} fill="transparent" onPress={() => setActive(active === i ? null : i)} />
                </G>
              );
            })}
            {data.length > 0 && (
              <>
                <SvgText fontFamily={FONT} x={0} y={height - 6} fontSize={10} fill={chartColors.axis}>{formatLabel ? formatLabel(data[0]!.label) : data[0]!.label}</SvgText>
                <SvgText fontFamily={FONT} x={width} y={height - 6} fontSize={10} fill={chartColors.axis} textAnchor="end">
                  {formatLabel ? formatLabel(data[data.length - 1]!.label) : data[data.length - 1]!.label}
                </SvgText>
              </>
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}
