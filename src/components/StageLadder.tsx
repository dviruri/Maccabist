import { stageBand, stageLabel, stageOrder, STAGE_LADDER } from '../data/academy';
import type { AcademyStage } from '../types';

/**
 * The academy ladder, with the step he just took marked on it (v0.4.5.1).
 *
 * An age-group transition used to be a sentence - "עלית לנערים ב׳" - which tells the player the
 * name of his new group and nothing about what it means. The thing a nine year old at טרום ב׳
 * actually wants to know is how far the first team is, and the thing a נוער player wants to know
 * is that it is one rung away.
 *
 * So: every rung, in order, with the ones behind him filled. The step itself is drawn as
 * from → to, which is what makes an early promotion legible as a *jump* - two segments light up
 * at once instead of one, and you can see it without reading the title.
 *
 * The ladder runs in reading order, so in RTL it fills from the right. That is deliberate: "up"
 * in this game means "towards בוגרים", and the arrow of travel should match the arrow of reading.
 */
/**
 * What a single rung is, given the step being drawn.
 *
 *   behind   road already covered, including the rung he started this season on
 *   gained   covered this season - one rung normally, two on an early promotion
 *   ahead    still to come
 *
 * Exported so the classification can be tested without a DOM. `here` is tracked separately
 * because the rung he landed on is both gained and the current position.
 */
export type RungState = 'behind' | 'gained' | 'ahead';

export function rungState(rung: AcademyStage, from: AcademyStage, to: AcademyStage): RungState {
  const index = stageOrder(rung);
  /* Inclusive of `from`: leaving it out put a grey gap between the covered rungs and the new one. */
  if (index <= stageOrder(from)) return 'behind';
  return index <= stageOrder(to) ? 'gained' : 'ahead';
}

export function StageLadder({
  from,
  to,
}: {
  from: AcademyStage;
  to: AcademyStage;
}): JSX.Element {
  const toIndex = stageOrder(to);

  return (
    <div
      className="ladder"
      role="img"
      aria-label={`${stageLabel(from)} לְ${stageLabel(to)}, שלב ${toIndex + 1} מתוך ${STAGE_LADDER.length}`}
    >
      <div className="ladder-rungs" aria-hidden>
        {STAGE_LADDER.map((stage) => (
          <span
            key={stage}
            className={[
              'ladder-rung',
              `is-${rungState(stage, from, to)}`,
              stageOrder(stage) === toIndex ? 'is-here' : '',
              stage === 'senior' ? 'is-senior' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>

      <div className="ladder-ends" aria-hidden>
        <span className="ladder-from">{stageLabel(from)}</span>
        <span className="ladder-arrow">→</span>
        <span className="ladder-to">{stageLabel(to)}</span>
      </div>

      {/*
        How far the first team still is. Said in rungs rather than years, because the ladder is
        the thing on screen - and because a boy playing up is not the same number of years away
        as he is rungs away.
      */}
      {to !== 'senior' && <Remaining rungs={stageOrder('senior') - toIndex} />}

      {stageBand(from) !== stageBand(to) && (
        <div className="ladder-band">מחלקה חדשה · {stageLabel(to)}</div>
      )}
    </div>
  );
}

/**
 * How far בוגרים still is.
 *
 * Hebrew does not take a bare numeral for one or two the way English does - "עוד 1 שלבים" is
 * simply wrong, and "עוד 2 שלבים" is what a form generates rather than what a person says. One
 * and two get words; three and up get the numeral, which is also where the number starts being
 * the interesting part.
 */
function Remaining({ rungs }: { rungs: number }): JSX.Element {
  if (rungs === 1) return <div className="ladder-remaining">עוד שלב אחד לבוגרים</div>;
  if (rungs === 2) return <div className="ladder-remaining">עוד שני שלבים לבוגרים</div>;
  return (
    <div className="ladder-remaining">
      עוד <span className="ladder-remaining-n">{rungs}</span> שלבים לבוגרים
    </div>
  );
}
