import type { ReactNode } from 'react';

import type { AttributeDelta } from '../types';

/** Isolates digits, years and scorelines from the surrounding RTL text. */
export function Ltr({ children }: { children: ReactNode }): JSX.Element {
  return <span className="ltr">{children}</span>;
}

/**
 * The supplied crest artwork. Lives in /public, so the path has to be built from Vite's
 * BASE_URL - a bare "/mark.png" would 404 on GitHub Pages, where the app is served
 * from /Maccabist/ rather than the domain root.
 */
export function Logo({
  variant = 'full',
  className,
  width,
}: {
  variant?: 'full' | 'mark';
  className?: string;
  width?: number | string;
}): JSX.Element {
  const src = `${import.meta.env.BASE_URL}${variant === 'mark' ? 'mark.png' : 'logo.png'}`;
  return (
    <img
      src={src}
      alt="מכביסט"
      className={className}
      style={width ? { width } : undefined}
      draggable={false}
    />
  );
}

export function BrandRule(): JSX.Element {
  return (
    <div className="brand-rule" aria-hidden>
      <span />
      <span />
      <span />
    </div>
  );
}

const CHIP_TONES = {
  green: 'chip',
  plain: 'chip chip-plain',
  gold: 'chip chip-gold',
  warn: 'chip chip-warn',
} as const;

export function Chip({
  children,
  tone = 'green',
}: {
  children: ReactNode;
  tone?: keyof typeof CHIP_TONES;
}): JSX.Element {
  return <span className={CHIP_TONES[tone]}>{children}</span>;
}

/**
 * "68 ← 72" — in RTL the old value sits on the right and the arrow points at the new one,
 * so the pill reads naturally right-to-left.
 */
export function DeltaPill({ delta, index = 0 }: { delta: AttributeDelta; index?: number }): JSX.Element {
  const up = delta.to > delta.from;
  return (
    <span
      className={`delta ${up ? 'delta-up' : 'delta-down'}`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <span className="delta-label">{delta.label}</span>
      <span className="delta-values">
        {delta.from} ← {delta.to}
      </span>
      <span aria-hidden>{up ? '▲' : '▼'}</span>
    </span>
  );
}

export function DeltaList({ deltas }: { deltas: AttributeDelta[] }): JSX.Element | null {
  if (deltas.length === 0) return null;
  return (
    <div className="delta-list">
      {deltas.map((delta, i) => (
        <DeltaPill key={delta.key} delta={delta} index={i} />
      ))}
    </div>
  );
}

export function NumberBox({ value, label }: { value: number | string; label: string }): JSX.Element {
  return (
    <div className="number-box">
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}
