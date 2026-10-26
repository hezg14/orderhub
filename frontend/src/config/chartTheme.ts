import type { OrderStatus } from '@/types';

/**
 * ECharts renders to canvas — it cannot read CSS variables, so the palette is
 * mirrored here and keyed off the theme. Every chart option is a computed that
 * depends on the theme, so flipping the theme redraws all charts.
 */
export interface ChartInk {
  axis: string;
  grid: string;
  label: string;
  labelDim: string;
  title: string;
  border: string;
}

export type ThemeName = 'dark' | 'light';

export function chartInk(theme: ThemeName): ChartInk {
  return theme === 'dark'
    ? {
        axis: '#333a55',
        grid: '#232840',
        label: '#9aa3bd',
        labelDim: '#626b85',
        title: '#e8eaf2',
        border: '#151827',
      }
    : {
        axis: '#e2e8f0',
        grid: '#eef0f6',
        label: '#94a3b8',
        labelDim: '#64748b',
        title: '#14161f',
        border: '#ffffff',
      };
}

export function brandColor(theme: ThemeName): string {
  return theme === 'dark' ? '#818cf8' : '#4f46e5';
}

/**
 * Status colors as a single-hue pipeline ramp: light → dark indigo tracks an
 * order from pending to completion, cancelled drops out to neutral gray.
 * Rainbow palettes on a pipeline chart are the fastest way to look noisy.
 */
export function statusPalette(theme: ThemeName): Record<OrderStatus, string> {
  return theme === 'dark'
    ? {
        pending: '#4f46e5',
        paid: '#6366f1',
        shipped: '#818cf8',
        completed: '#a5b4fc',
        cancelled: '#3d4257',
      }
    : {
        pending: '#c7d2fe',
        paid: '#818cf8',
        shipped: '#4f46e5',
        completed: '#312e81',
        cancelled: '#cbd5e1',
      };
}
