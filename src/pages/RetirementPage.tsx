import { countLabel } from '../game/hebrew';
import { CinematicBackdrop } from '../components/gamefeel';
import { PlayerRender } from '../components/PlayerRender';
import { CareerTimeline } from '../components/CareerTimeline';
import { HonorIcon, TrophyKindIcon, trophyIconKind } from '../components/honorIcons';
import { Timeline } from '../components/Timeline';
import { buildArchivedCareer } from '../game/archive';
import { HONOR_LABELS } from '../game/honorsEngine';
import { downloadCareerPoster } from '../services/posterRenderer';
import { appearanceBreakdown, trophySummary } from '../game/truth';
import {
  globalCareerScore,
  historicalStanding,
  LEGACY_ARCHETYPE_ICONS,
  LEGACY_RANK_ICONS,
  LEGACY_RANK_LABELS,
  maccabiArchetypes,
  maccabiLegacyComponents,
  maccabiLegacyRank,
  maccabiLegacyScore,
} from '../game/maccabiLegacy';
import { Chip, Logo, Ltr, NumberBox } from '../components/primitives';
import { TRAITS_BY_ID } from '../data/traits';
import { careerStory } from '../game/storyEngine';
import type { Career } from '../types';
import { careerYears, positionLabel } from '../ui/format';

/**
 * The archetypes that describe a career as legendary. The poster's gold treatment follows these.
 *
 * These are `careerArchetype` ids from storyEngine, which is what actually populates
 * `legend.ending` — not the ids in data/endings.ts, which only supply a fallback description. I
 * used the wrong set first and the poster stayed green under a title that said "אגדה ירוקה";
 * a test now pins both ids against the archetype table.
 */
export const LEGENDARY_ENDINGS: readonly string[] = ['legend', 'one_club_icon'];
/** Aligned with the engine's own top Legend Score band. */

interface Props {
  career: Career;
  onNewCareer: () => void;
  /** חדר הגביעים - where this career now permanently lives (v0.7). */
  onOpenMeta: () => void;
  isBest: boolean;
}

export function RetirementPage({ career, onNewCareer, onOpenMeta, isBest }: Props): JSX.Element {
  const m = career.maccabi;
  const isKeeper = career.position === 'GK';
  /*
   * v0.4.8: through the domain, not through a string comparison.
   *
   * This was `s.league !== 'ליגת העל' && s.league !== 'ליגה לאומית'`, which is football logic
   * living in a React component and expressed as a test on a Hebrew display name. It had two
   * bugs at once: every academy season failed the comparison and was counted as European
   * football, and so did every second-division season, because the filter said 'ליגה לאומית'
   * and the league is called 'הליגה הלאומית'. A career that never left Israel finished with
   * "עונות באירופה".
   *
   * `appearanceBreakdown` reads the club's country, which is data. The UI does not decide what
   * counts as abroad.
   */
  const breakdown = appearanceBreakdown(career);
  const europeSeasonCount = breakdown.foreignSeasonsPlayed;
  const europeApps = breakdown.foreign;

  /*
   * v0.6.2: `legend.score` is no longer read here. It remains on the career for save
   * compatibility, the endings prose and existing tests - it simply has no user-facing surface
   * on this screen any more. See §Compatibility in V062_REPORT.md.
   *
   * Gold follows the *ending*, not the raw score.
   *
   * The two can disagree - the engine awarded "אגדה ירוקה" to a career scoring 61 - and a poster
   * whose headline says legend while its treatment says ordinary is incoherent. The title is what
   * the player reads, so the title is what the colour answers to. The score threshold stays as a
   * second route in, aligned with the engine's own top band.
   */
  /*
   * Gold trim follows the Maccabi Legacy rank (v0.6.1). It used to key off storyEngine ending
   * ids, which is the same duplicated authority the headline just lost.
   */
  const legacyRank = maccabiLegacyRank(career);
  const legendary = legacyRank === 'symbol' || legacyRank === 'green_legend';

  /* v0.6: the other three reads - global career, Maccabi legacy, and the standing. */
  const globalScore = globalCareerScore(career);
  const legacyScore = maccabiLegacyScore(career);
  const archetypes = maccabiArchetypes(career);
  const trophyGroups = trophySummary(career);
  const legacyComponents = maccabiLegacyComponents(career);
  const appearanceStanding = historicalStanding(career, 'appearances');

  return (
    <div className="shell narrow retirement">
      {/*
       * v0.9: retirement opens as the end of a career - the pack's retirement art under the
       * ceremony lights, before the poster and the numbers. Same facts, given their weight.
       */}
      {/*
        The retiring player is HIM (v0.9.3, finished v0.9.4).

        The pack's retirement art is a scene with a generic footballer in it, so a career's last
        screen was showing somebody else. v0.9.3 dimmed and blurred it behind the career player,
        which was still two footballers; v0.9.4 drops it and composes the scene from the empty
        trophy-ceremony stadium instead, with the career player - his real retirement age, his
        position, his last club's colours - as the only person in the frame.
      */}
      <CinematicBackdrop backdrop="trophy-ceremony" className="gf-retire-scene gf-moment-with-player">
        <div className="gf-moment-stage">
          <PlayerRender
            className="gf-moment-player"
            age={career.retirementAge ?? career.age}
            position={career.position}
            clubId={career.currentClubId}
            seed={career.seed}
            season={career.currentSeason}
          />
        </div>
        <div className="gf-moment-text">
          <div className="gf-kicker">
            {/* years are an LTR run - unwrapped they render 2055-2039 in RTL */}
            <Ltr>{careerYears(career)}</Ltr>
          </div>
          <h1 className="gf-moment-title">{career.playerName} פורש מכדורגל</h1>
          <p className="gf-moment-sub">{positionLabel(career.position)} · הקריירה כולה למטה.</p>
        </div>
      </CinematicBackdrop>

      {/*
        The career poster (v0.4.5).
        
        Deliberately built from flow layout and CSS only, with no measured or browser-dependent
        positioning, so it can later be rendered to a share image without being rebuilt. That is
        the whole of Phase 19 tonight: no export, but nothing in the way of one.
      */}
      <section className={`poster${legendary ? ' poster-legend' : ''}`}>
        <div className="poster-glow" aria-hidden />

        <Logo className="poster-logo" />

        <h1 className="poster-name">{career.playerName}</h1>
        <p className="poster-sub">
          {positionLabel(career.position)} · <Ltr>{careerYears(career)}</Ltr> · פרש בגיל{' '}
          <Ltr>{career.retirementAge}</Ltr>
        </p>

        {/*
          v0.6.1, Checkpoint B: ONE authority for the headline.

          Until now the poster's title came from `storyEngine`'s ARCHETYPES, which could award
          "הסמל" or "אגדה ירוקה" on its own rules while `maccabiLegacy` - the system built to
          own exactly those words - reached a different verdict. Two live formulas for one
          prestige title is the defect this version exists to remove.

          The headline is now the Maccabi Legacy career archetype, always. It covers non-Maccabi
          careers too (הכוכב האירופי, אורח לרגע, קריירה בחוץ), so no career is forced into
          Maccabi prestige language it did not earn. The old ending survives only as narrative
          prose further down - it no longer names a rank.
        */}
        <div className="poster-ending">
          <div className="poster-ending-icon" aria-hidden>
            {LEGACY_ARCHETYPE_ICONS[archetypes.primary.id]}
          </div>
          <h2 className="poster-ending-title">{archetypes.primary.label}</h2>
          <div className="poster-ending-sub">{archetypes.primary.line}</div>
        </div>

        {/*
          v0.6.2: TWO greatness axes, and only two.

          (v0.6 Phase 35 introduced this block as "two numbers, honestly" - the global career read
          joining the Legend Score. The principle held; it was the third score that had to go.)

          The poster carried three overlapping scores - מדד אגדה, קריירה עולמית and (further
          down) מורשת מכבי - and two of them mostly answered the same question. A player should
          not have to work out the difference between מדד אגדה and מורשת מכבי when both are
          largely "how big were you at Maccabi".

          So the retirement screen now asks exactly two questions: how great was the career, and
          what did it mean to Maccabi. `legendScore` survives internally (see §Compatibility in
          V062_REPORT) but is no longer a user-facing score.
        */}
        <div className="poster-scores">
          <div className="poster-score">
            <div className="poster-score-value">
              <Ltr>{globalScore}</Ltr>
            </div>
            <div className="poster-score-label">קריירה עולמית</div>
          </div>
          <div className="poster-score">
            <div className="poster-score-value">
              <Ltr>{legacyScore}</Ltr>
            </div>
            <div className="poster-score-label">מורשת מכבי</div>
          </div>
        </div>

        {/* The headline of the whole career, in the poster rather than buried in a stat grid. */}
        <div className="poster-lines">
          {m.appearances > 0 && (
            <div>
              <Ltr>{m.appearances}</Ltr> הופעות במכבי חיפה
            </div>
          )}
          {m.championships > 0 && (
            <div>
              <Ltr>{m.championships}</Ltr> {m.championships === 1 ? 'אליפות' : 'אליפויות'}
            </div>
          )}
          {m.cups > 0 && (
            <div>
              <Ltr>{m.cups}</Ltr> {m.cups === 1 ? 'גביע' : 'גביעים'}
            </div>
          )}
          {m.captainSeasons > 0 && (
            <div>
              <Ltr>{m.captainSeasons}</Ltr> עונות כקפטן
            </div>
          )}
          {europeApps > 0 && (
            <div>
              <Ltr>{europeSeasonCount}</Ltr> עונות באירופה
            </div>
          )}
          {/* Never leave the poster empty: a career that never reached Maccabi still had one. */}
          {m.appearances === 0 && (
            <div>
              <Ltr>{career.stats.appearances}</Ltr> הופעות בקריירה
            </div>
          )}
        </div>

        {isBest && <Chip tone="gold">⭐ השיא האישי החדש שלך</Chip>}
      </section>

      {/* --- the career, told as a story --- */}
      <section className="card retirement-block">
        <div className="stack-sm">
          {/*
            "במילים שלהם", not "סיפור הקריירה" (v0.4.5.1). The CareerTimeline directly below is
            also titled סיפור הקריירה, so the retirement screen carried the same heading twice
            over two different things - prose here, the moment list there.
          */}
          <div className="kicker">במילים שלהם</div>
          {careerStory(career).map((line) => (
            <p key={line} className="card-body story-line">
              {line}
            </p>
          ))}
          <div className="row row-wrap">
            {career.traits.map((trait) => (
              <Chip key={trait.id} tone="plain">
                {TRAITS_BY_ID[trait.id].icon} {TRAITS_BY_ID[trait.id].label}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      {/* --- מורשת מכבי (v0.6, Phase 33) --- */}
      <section className="card retirement-block">
        <div className="stack-sm">
          <div className="kicker">מורשת מכבי</div>
          <div className="legacy-head">
            <div className="legacy-score" aria-label={`מדד מורשת ${legacyScore}`}>
              <Ltr>{legacyScore}</Ltr>
            </div>
            <div className="legacy-head-body">
              <div className="legacy-rank">
                <span aria-hidden>{LEGACY_RANK_ICONS[legacyRank]}</span>{' '}
                {LEGACY_RANK_LABELS[legacyRank]}
              </div>
              <div className="legacy-archetype">{archetypes.primary.label}</div>
              <div className="legacy-line">{archetypes.primary.line}</div>
              {archetypes.secondary.length > 0 && (
                <div className="legacy-tags">
                  {archetypes.secondary.map((tag) => (
                    <span key={tag.id} className="legacy-tag">
                      {tag.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/*
            v0.6.2, 3.4: a career written mostly outside the green gets an honest sentence
            rather than an empty card. Low Maccabi Legacy is a true fact about a career that may
            have been excellent; the screen says so plainly instead of leaving a blank.
          */}
          {appearanceStanding.playerValue === 0 && (
            <div className="legacy-line">הקריירה שלך נכתבה בעיקר מחוץ לירוק.</div>
          )}
          {appearanceStanding.playerValue > 0 && (
            <div className="legacy-line">
              {appearanceStanding.brokeRecord
                ? 'שיא ההופעות של המועדון שייך לך.'
                : appearanceStanding.rank <= 10
                  ? `מקום ${appearanceStanding.rank} בהופעות בכל הזמנים של מכבי.`
                  : `${countLabel(appearanceStanding.playerValue, 'הופעה אחת רשמית', 'הופעות רשמיות')} בירוק.`}
            </div>
          )}
        </div>
      </section>

      {/* --- every moment that mattered --- */}
      <div className="retirement-block">
        <CareerTimeline career={career} defaultOpen />
      </div>

      {/* --- headline numbers --- */}
      <section className="card retirement-block">
        <div className="stack">
          <div className="kicker">במדים של מכבי חיפה</div>
          <div className="numbers">
            <NumberBox value={m.appearances} label="הופעות" />
            <NumberBox value={isKeeper ? m.cleanSheets : m.goals} label={isKeeper ? 'נקיים' : 'שערים'} />
            <NumberBox value={m.assists} label="בישולים" />
            <NumberBox value={m.seasons} label="עונות" />
            <NumberBox value={m.championships} label="אליפויות" />
            <NumberBox value={m.cups} label="גביעים" />
            <NumberBox value={m.captainSeasons} label="עונות כקפטן" />
            <NumberBox value={career.trophies.length} label="תארים בקריירה" />
          </div>
        </div>
      </section>

      {/*
        התארים שלך (v0.6.1, C2). The count above answers "how many"; only this answers "which".
        A State Cup won at Hapoel Kfar Saba lived in the trophy list, the season record and the
        timeline, and then disappeared at retirement behind the number 1 - so the one screen
        that sums a career up never said גביע המדינה. Every competition is now named, with the
        club it was won at, because a cup won away from Maccabi is still a cup this player won.
      */}
      {trophyGroups.length > 0 && (
        <section className="card retirement-block">
          <div className="stack-sm">
            <div className="kicker">התארים שלך</div>
            {trophyGroups.map((group) => (
              <div key={group.id} className="trophy-summary-line">
                {/* v0.7 (E1/E7): the SVG mark, with correct semantics - a title is a PLATE,
                    a cup is a CUP - instead of an OS emoji. */}
                <span className="trophy-summary-icon" aria-hidden>
                  <TrophyKindIcon kind={trophyIconKind(group.id)} size={18} />
                </span>{' '}
                <b>{group.name}</b>
                {group.count > 1 && (
                  <>
                    {' '}
                    ×<Ltr>{group.count}</Ltr>
                  </>
                )}
                <span className="trophy-summary-clubs">{group.clubs.join(' · ')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/*
        תארים אישיים (v0.7, G5). The honors are stored facts from the honors engine - each one
        was won against a simulated league field in its own season, and this is the career-level
        roll call. Position-aware by construction: a keeper's line here says שוער העונה.
      */}
      {career.honors.length > 0 && (
        <section className="card retirement-block">
          <div className="stack-sm">
            <div className="kicker">
              תארים אישיים — <Ltr>{career.honors.length}</Ltr>
            </div>
            {(['player_of_season', 'top_scorer', 'assists_leader', 'goalkeeper_of_season', 'young_player_of_season'] as const)
              .map((type) => ({ type, wins: career.honors.filter((h) => h.type === type) }))
              .filter((g) => g.wins.length > 0)
              .map((g) => (
                <div key={g.type} className="trophy-summary-line">
                  <span className="trophy-summary-icon" aria-hidden>
                    <HonorIcon type={g.type} size={18} />
                  </span>{' '}
                  {g.wins.length > 1 && (
                    <>
                      ×<Ltr>{g.wins.length}</Ltr>{' '}
                    </>
                  )}
                  <b>{HONOR_LABELS[g.type]}</b>
                  <span className="trophy-summary-clubs">
                    {[...new Set(g.wins.map((h) => h.league))].join(' · ')}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* --- the shape of the career, in chips --- */}
      <section className="card retirement-block">
        <div className="stack-sm">
          <div className="row row-wrap">
            {m.academyGraduate && <Chip>🌱 בוגר האקדמיה</Chip>}
            {m.returned && (
              <Chip>
                🏠 חזרת בגיל <Ltr>{m.returnAge}</Ltr>
              </Chip>
            )}
            {m.everLeft && !m.returned && <Chip tone="plain">✈️ עזבת ולא חזרת</Chip>}
            {europeApps > 0 && (
              <Chip tone="plain">
                🌍 <Ltr>{europeApps}</Ltr> הופעות בחו״ל
              </Chip>
            )}
            <Chip tone="plain">
              שיא יכולת <Ltr>{Math.round(career.peakAbility)}</Ltr>
            </Chip>
          </div>
        </div>
      </section>

      {/*
        v0.6.2: the breakdown now explains מורשת מכבי rather than the retired מדד אגדה. Showing
        the anatomy of a score the player can no longer see would be the third axis returning
        through the back door.
      */}
      <section className="card retirement-block">
        <div className="stack-sm">
          <div className="kicker">ממה מורכבת מורשת מכבי</div>
          {legacyComponents.map((component) => (
            <div key={component.key} className="component-row">
              <span className="component-name">{component.label}</span>
              <span className="component-bar">
                <span
                  style={{ width: `${Math.round((component.points / component.max) * 100)}%` }}
                />
              </span>
              <span className="component-points">
                <Ltr>
                  {component.points.toFixed(1)}/{component.max}
                </Ltr>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* --- career timeline --- */}
      <section className="card retirement-block">
        <div className="kicker kicker-spaced">
          ציר הקריירה
        </div>
        <Timeline history={career.seasonHistory} />
      </section>

      {/* --- achievements --- */}
      {career.achievements.length > 0 && (
        <section className="card retirement-block">
          <div className="kicker kicker-spaced">
            רגעים בקריירה
          </div>
          <div className="row row-wrap">
            {career.achievements.map((achievement) => (
              <Chip key={achievement.id} tone="plain">
                {achievement.icon} {achievement.name}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {/* v0.7 (H): the poster, drawn from the same archived snapshot חדר הגביעים keeps. */}
      <section className="card retirement-block">
        <div className="stack-sm">
          <div className="kicker">לשתף את הקריירה</div>
          <div className="archive-poster-buttons">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void downloadCareerPoster(buildArchivedCareer(career), 'story')}
            >
              פוסטר לסטורי (9:16)
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void downloadCareerPoster(buildArchivedCareer(career), 'square')}
            >
              פוסטר מרובע (1:1)
            </button>
          </div>
        </div>
      </section>

      <button
        type="button"
        className="btn btn-primary retirement-cta"
        onClick={onNewCareer}
      >
        קריירה חדשה
      </button>
      <button type="button" className="btn btn-ghost" style={{ width: '100%' }} onClick={onOpenMeta}>
        🏆 הקריירה נשמרה בחדר הגביעים
      </button>
      <p className="faint retirement-footnote">
        יאללה, עוד קריירה אחת.
      </p>
    </div>
  );
}
