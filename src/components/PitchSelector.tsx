import { POSITIONS } from '../game/balance';
import type { Position } from '../types';

/**
 * Position selection on a football pitch rather than a row of buttons.
 *
 * Six markers, not eleven - the game models six roles and cluttering the pitch with a full
 * XI would imply a tactical depth that does not exist. Percentage positioning keeps it
 * responsive down to 360px without media queries, and the whole thing is a radiogroup so it
 * works by keyboard as well as by thumb.
 */

interface Marker {
  id: Position;
  /** Percent from the bottom of the pitch (own goal at the bottom). */
  bottom: number;
  /** Percent from the left. */
  left: number;
}

/*
 * Laid out as a real formation seen from behind your own goal:
 *
 *              ST
 *        WG          (WG mirrored)
 *              CM
 *        FB     CB
 *              GK
 */
const MARKERS: readonly Marker[] = [
  /*
    GK sits at 13% rather than 7%. A marker is anchored by its `bottom` and then translated down
    half its own height, so it hangs below its anchor by roughly 31px - which fitted inside the
    old 3/4 pitch and clipped the שוער label off the bottom edge once v0.4.5.1 squared it up.
  */
  { id: 'GK', bottom: 13, left: 50 },
  { id: 'CB', bottom: 27, left: 62 },
  { id: 'FB', bottom: 27, left: 24 },
  { id: 'CM', bottom: 50, left: 50 },
  { id: 'WG', bottom: 70, left: 20 },
  { id: 'ST', bottom: 84, left: 50 },
];

export function PitchSelector({
  value,
  onChange,
}: {
  value: Position;
  onChange: (position: Position) => void;
}): JSX.Element {
  const selected = POSITIONS[value];

  return (
    <div className="pitch-wrap">
      <div className="pitch" role="radiogroup" aria-label="בחירת עמדה">
        {/* Pitch markings - decorative only. */}
        <div className="pitch-lines" aria-hidden>
          <span className="pitch-halfway" />
          <span className="pitch-circle" />
          <span className="pitch-box pitch-box-near" />
          <span className="pitch-box pitch-box-far" />
          <span className="pitch-goal pitch-goal-near" />
          <span className="pitch-goal pitch-goal-far" />
        </div>

        {MARKERS.map((marker) => {
          const config = POSITIONS[marker.id];
          const isSelected = marker.id === value;
          return (
            <button
              key={marker.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={config.label}
              className={`pitch-marker${isSelected ? ' is-selected' : ''}`}
              style={{ bottom: `${marker.bottom}%`, left: `${marker.left}%` }}
              onClick={() => onChange(marker.id)}
            >
              <span className="pitch-marker-dot" aria-hidden>
                {config.icon}
              </span>
              <span className="pitch-marker-label">{config.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pitch-readout" aria-live="polite">
        <div className="pitch-readout-name">
          <span aria-hidden>{selected.icon}</span> {selected.label}
        </div>
        <p className="pitch-readout-desc">{selected.description}</p>
      </div>
    </div>
  );
}
