import { getClub } from '../data/clubs';
import {
  AGENT_ARCHETYPES,
  COACH_SPECIALTIES,
  MANAGER_ARCHETYPES,
} from '../data/people';
import type {
  AgentArchetypeId,
  Career,
  CoachSpecialtyId,
  ManagerArchetypeId,
  PersonIdentity,
} from '../types';

/**
 * האנשים שלי (v0.5, Phases 27-29).
 *
 * The compact people screen: the manager, the agent, the personal coach - who they are, what
 * kind of person each is, and where the relationship stands. Lives inside a Sheet, one tap from
 * the gameplay screen, per the v0.4.7 density rules: nothing here ever renders above the active
 * event.
 *
 * Numbers are shown as words wherever a number would be an internal coefficient. Coach Trust is
 * already a first-class visible stat, so it appears as itself; the agent relationship appears as
 * a phrase, because the brief is explicit about not exposing another giant progress bar.
 */
export function PeopleCard({ career }: { career: Career }): JSX.Element {
  const people = career.people;
  const manager = people?.manager ?? null;
  const agent = people?.agent ?? null;
  const coach = people?.personalCoach ?? null;

  return (
    <div className="stack" data-testid="people-card">
      {/* ---------------- המאמן ---------------- */}
      <section className="card-flat people-section">
        <div className="kicker">המאמן</div>
        {manager ? (
          <PersonRow
            person={manager.person}
            line1={clubNameOf(manager.clubId)}
            line2={managerStyle(manager.person)}
            line3={`אמון המאמן: ${Math.round(career.coachTrust)}`}
            note={managerDescription(manager.person)}
            badge={manager.gaveDebut ? 'נתן לך את הבכורה' : undefined}
          />
        ) : (
          <div className="people-empty">אין מאמן נוכחי</div>
        )}
      </section>

      {/* ---------------- הסוכן ---------------- */}
      <section className="card-flat people-section">
        <div className="kicker">הסוכן</div>
        {agent ? (
          <PersonRow
            person={agent.person}
            line1={agentStyle(agent.person)}
            line2={`שווקים: ${agentMarkets(agent.person)}`}
            line3={`הקשר: ${relationshipWord(agent.relationship)} · מאז ${agent.sinceSeason}`}
            note={agentDescription(agent.person)}
          />
        ) : (
          <div className="people-empty">אין סוכן כרגע</div>
        )}
      </section>

      {/* ---------------- מאמן אישי ---------------- */}
      <section className="card-flat people-section">
        <div className="kicker">מאמן אישי</div>
        {coach ? (
          <PersonRow
            person={coach.person}
            line1={specialtyLabel(coach.specialty)}
            line2={`עובדים יחד מאז ${coach.sinceSeason}`}
            note={specialtyDescription(coach.specialty)}
          />
        ) : (
          <div className="people-empty">אין מאמן אישי</div>
        )}
      </section>

      {/* ---------------- היו בדרך ---------------- */}
      <FormerPeople career={career} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One person, one row                                                 */
/* ------------------------------------------------------------------ */

function PersonRow({
  person,
  line1,
  line2,
  line3,
  note,
  badge,
}: {
  person: PersonIdentity;
  line1?: string;
  line2?: string;
  line3?: string;
  note?: string;
  badge?: string;
}): JSX.Element {
  return (
    <div className="people-row">
      <PersonAvatar person={person} />
      <div className="people-row-body">
        <div className="people-name">
          {person.name}
          {badge && <span className="people-badge">{badge}</span>}
        </div>
        {line1 && <div className="people-line">{line1}</div>}
        {line2 && <div className="people-line">{line2}</div>}
        {line3 && <div className="people-line">{line3}</div>}
        {note && <div className="people-note">{note}</div>}
      </div>
    </div>
  );
}

/** Initials avatar (Phase 29) - lightweight identity, no photos, no generated portraits. */
export function PersonAvatar({ person }: { person: PersonIdentity }): JSX.Element {
  const initials = person.name
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('');
  return (
    <span className={`people-avatar people-avatar-${person.type}`} aria-hidden="true">
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Former relationships                                                */
/* ------------------------------------------------------------------ */

/**
 * The people who were part of the road (Phase 20). Shown compactly - a name, a spell, one fact -
 * because history read at a glance is what makes the current people feel like they will matter.
 */
function FormerPeople({ career }: { career: Career }): JSX.Element | null {
  const people = career.people;
  if (!people) return null;

  const managers = people.managerHistory.slice(-4).reverse();
  const agents = people.agentHistory.slice(-2).reverse();
  if (managers.length === 0 && agents.length === 0) return null;

  return (
    <section className="card-flat people-section">
      <div className="kicker">היו בדרך</div>
      {managers.map((tenure, i) => (
        <div key={`${tenure.person.id}-${tenure.fromSeason}-${i}`} className="people-former">
          <span className="people-former-name">{tenure.person.name}</span>
          {' · '}
          {clubNameOf(tenure.clubId)}
          {' · '}
          {tenure.fromSeason}–{tenure.toSeason ?? ''}
          {tenure.gaveDebut ? ' · נתן לך את הבכורה' : ''}
        </div>
      ))}
      {agents.map((bond, i) => (
        <div key={`${bond.person.id}-${i}`} className="people-former">
          <span className="people-former-name">{bond.person.name}</span>
          {' · '}
          {agentStyle(bond.person)}
          {' · '}
          {bond.sinceSeason}–{bond.endedSeason ?? ''}
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

function clubNameOf(clubId: string): string {
  try {
    return getClub(clubId).name;
  } catch {
    return clubId;
  }
}

function managerStyle(person: PersonIdentity): string {
  return MANAGER_ARCHETYPES[person.archetypeId as ManagerArchetypeId]?.label ?? '';
}

function managerDescription(person: PersonIdentity): string {
  return MANAGER_ARCHETYPES[person.archetypeId as ManagerArchetypeId]?.description ?? '';
}

function agentStyle(person: PersonIdentity): string {
  return AGENT_ARCHETYPES[person.archetypeId as AgentArchetypeId]?.label ?? '';
}

function agentDescription(person: PersonIdentity): string {
  return AGENT_ARCHETYPES[person.archetypeId as AgentArchetypeId]?.description ?? '';
}

function agentMarkets(person: PersonIdentity): string {
  return AGENT_ARCHETYPES[person.archetypeId as AgentArchetypeId]?.markets.join(', ') ?? '';
}

function specialtyLabel(id: CoachSpecialtyId): string {
  return COACH_SPECIALTIES[id]?.label ?? '';
}

function specialtyDescription(id: CoachSpecialtyId): string {
  return COACH_SPECIALTIES[id]?.description ?? '';
}

/** The agent relationship as a phrase - deliberately not another progress bar (Phase 5). */
export function relationshipWord(value: number): string {
  if (value >= 80) return 'ברזל';
  if (value >= 62) return 'קרוב';
  if (value >= 45) return 'תקין';
  if (value >= 30) return 'מתוח';
  return 'על סף פיצוץ';
}
