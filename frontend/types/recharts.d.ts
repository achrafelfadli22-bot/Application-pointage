/**
 * Recharts v2 ships React 17 class component types.
 * React 19 tightened the JSX class component contract, causing TS2786/TS2607.
 * This declaration re-exports the affected components as functional (FC) types
 * so TypeScript accepts them in JSX without upgrading to Recharts v3.
 */
import type * as React from 'react';

declare module 'recharts' {
  // ── Chart containers ────────────────────────────────────────────────────────
  export const PieChart: React.FC<React.ComponentProps<'svg'> & Record<string, unknown>>;
  export const BarChart: React.FC<React.ComponentProps<'svg'> & Record<string, unknown>>;
  export const LineChart: React.FC<React.ComponentProps<'svg'> & Record<string, unknown>>;
  export const AreaChart: React.FC<React.ComponentProps<'svg'> & Record<string, unknown>>;
  export const ComposedChart: React.FC<React.ComponentProps<'svg'> & Record<string, unknown>>;
  export const RadarChart: React.FC<React.ComponentProps<'svg'> & Record<string, unknown>>;
  export const ResponsiveContainer: React.FC<Record<string, unknown>>;

  // ── Series / shapes ─────────────────────────────────────────────────────────
  export const Pie: React.FC<Record<string, unknown>>;
  export const Bar: React.FC<Record<string, unknown>>;
  export const Line: React.FC<Record<string, unknown>>;
  export const Area: React.FC<Record<string, unknown>>;
  export const Radar: React.FC<Record<string, unknown>>;
  export const Scatter: React.FC<Record<string, unknown>>;

  // ── Axes & grid ─────────────────────────────────────────────────────────────
  export const XAxis: React.FC<Record<string, unknown>>;
  export const YAxis: React.FC<Record<string, unknown>>;
  export const ZAxis: React.FC<Record<string, unknown>>;
  export const CartesianGrid: React.FC<Record<string, unknown>>;
  export const PolarGrid: React.FC<Record<string, unknown>>;
  export const PolarAngleAxis: React.FC<Record<string, unknown>>;
  export const PolarRadiusAxis: React.FC<Record<string, unknown>>;

  // ── Overlays ─────────────────────────────────────────────────────────────────
  export const Tooltip: React.FC<Record<string, unknown>>;
  export const Legend: React.FC<Record<string, unknown>>;
  export const ReferenceLine: React.FC<Record<string, unknown>>;
  export const ReferenceDot: React.FC<Record<string, unknown>>;
  export const ReferenceArea: React.FC<Record<string, unknown>>;
  export const Label: React.FC<Record<string, unknown>>;
  export const LabelList: React.FC<Record<string, unknown>>;

  // ── Primitives ───────────────────────────────────────────────────────────────
  export const Cell: React.FC<Record<string, unknown>>;
  export const Sector: React.FC<Record<string, unknown>>;
  export const Curve: React.FC<Record<string, unknown>>;
  export const Rectangle: React.FC<Record<string, unknown>>;

  // ── Brush / customization ────────────────────────────────────────────────────
  export const Brush: React.FC<Record<string, unknown>>;
  export const ErrorBar: React.FC<Record<string, unknown>>;
  export const Funnel: React.FC<Record<string, unknown>>;
  export const FunnelChart: React.FC<Record<string, unknown>>;
  export const Sankey: React.FC<Record<string, unknown>>;
  export const Treemap: React.FC<Record<string, unknown>>;
}
