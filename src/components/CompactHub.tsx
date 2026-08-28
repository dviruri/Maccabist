import { currentTeamDisplay } from '../game/identity';
import { clubDisplayName } from '../game/identity';
import { hasLegacy, LEGACY_ICONS, LEGACY_LABELS, legacyStatus } from '../game/legacyEngine';
import type { Career } from '../types';
import { positionLabel, roleText } from '../ui/format';
import { ClubCrest } from './ClubCrest';
import { Ltr } from './primitives';

/**
 * Who am I, in one block (v0.4.7).
 *
 * The v0.4.5 Player Hub is a good screen and the wrong module for the top of a gameplay loop: a
 * 44px name, an isolated ability panel and three progress rings came to about 330px, and it sat
 * above a full league table, a timeline and a season history. The active decision started 1,155px
 * down a 390px phone.
 *
 * This is the same information, arranged so the answer to "who am I and where do I play" fits in
 * roughly a third of the height. **Dense, not small** — nothing here is below 11px, the name is
 * still the largest thing in it, and ability is still the one number that gets weight. What
 * changed is that ability sits *beside* the identity instead of under it, and the three secondary
 * metrics are a single row of numbers rather than three rings.
 *
 * The full hub is not deleted. It opens from the career sheet, where a player who wants to study
 * himself can, and where its height costs nothing.
 */
export function CompactHub({
  career,
  onOpenCareer,
}: {
  career: Career;
  onOpenCareer: () => void;
}): JSX.Element {
  const team = currentTeamDisplay(career);
  const legacy = legacyStatus(career);
  const onLoan = career.parentClubId !== null;

  return (
    <button type="button" className="chub" onClick={onOpenCareer} aria-label="פרטי הקריירה">
      <ClubCrest clubId={career.currentClubId} size="medium" className="chub-crest" />

      <div className="chub-identity">
        <div className="chub-name">{career.playerName}</div>
        <div className="chub-where">
          {positionLabel(career.position)}
          <span className="chub-dot" aria-hidden>
            {' · '}
          </span>
          {/*
            Through the identity module, so an academy player reads "מכבי חיפה — נערים א׳" and a
            first-team player reads "מכבי חיפה". The UI never assembles team wording itself.
          */}
          {team.team ? `${team.club} — ${team.team}` : team.club}
        </div>

        <div className="chub-tags">
          <span className="chub-role">{roleText(career)}</span>
          {career.captain && <span className="chub-tag is-captain">קפטן</span>}
          {hasLegacy(legacy) && (
            <span className="chub-tag is-legacy">
              {LEGACY_ICONS[legacy]} {LEGACY_LABELS[legacy]}
            </span>
          )}
          {/*
            A loan is two clubs, and the old hub needed a whole extra line for it. Here it is a
            tag: whose player he is, and where he is playing.
          */}
          {onLoan && career.parentClubId && (
            <span className="chub-tag is-loan">
              בהשאלה מ{clubDisplayName(career.parentClubId)}
            </span>
          )}
        </div>
      </div>

      <div className="chub-ability">
        <span className="chub-ability-value">
          <Ltr>{Math.round(career.ability)}</Ltr>
        </span>
        <span className="chub-ability-label">יכולת</span>
      </div>

      {/*
        Context, not headline. One row of three, labelled, so the numbers are still legible without
        three separate ring widgets. Hidden Potential is not here and never will be.
      */}
      <dl className="chub-metrics">
        <Metric label="אמון" value={career.coachTrust} />
        <Metric label="מכביסטיות" value={career.maccabism} />
        <Metric label="מוניטין" value={career.reputation} />
      </dl>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="chub-metric">
      <dt>{label}</dt>
      <dd>
        <Ltr>{Math.round(value)}</Ltr>
      </dd>
    </div>
  );
}
