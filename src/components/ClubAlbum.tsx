import type { ArchivedCareer, ArchivedClubSpell } from '../types';
import { ClubCrest } from './ClubCrest';
import { Ltr } from './primitives';

/**
 * The Club Album (v0.7, Checkpoint F3).
 *
 * A visual record of career exploration: every club actually PLAYED FOR, across every archived
 * career, with the crest doing the talking. Emphatically not a grind currency (F4) - no reward,
 * no bonus, no "collect all 200". A club appears once however many careers touched it; the
 * chips say what happened there.
 */

export interface AlbumEntry extends ArchivedClubSpell {
  careers: number;
}

/** Merges the club journeys of many careers into one album, keeping first-seen order. */
export function buildAlbum(archives: readonly ArchivedCareer[]): AlbumEntry[] {
  const order: string[] = [];
  const byClub = new Map<string, AlbumEntry>();
  for (const archive of archives) {
    const seen = new Set<string>();
    for (const spell of archive.clubs) {
      let entry = byClub.get(spell.clubId);
      if (!entry) {
        entry = { ...spell, careers: 0 };
        byClub.set(spell.clubId, entry);
        order.push(spell.clubId);
      } else {
        entry.spells += spell.spells;
        entry.seasons += spell.seasons;
        entry.appearances += spell.appearances;
        entry.goals += spell.goals;
        entry.assists += spell.assists;
        entry.cleanSheets += spell.cleanSheets;
        entry.wonTrophy = entry.wonTrophy || spell.wonTrophy;
        entry.wasCaptain = entry.wasCaptain || spell.wasCaptain;
      }
      if (!seen.has(spell.clubId)) {
        entry.careers += 1;
        seen.add(spell.clubId);
      }
    }
  }
  return order.map((id) => byClub.get(id)!);
}

export function ClubAlbum({ entries }: { entries: readonly AlbumEntry[] }): JSX.Element {
  if (entries.length === 0) {
    return <p className="card-body">עוד לא שיחקת בשום מועדון. הדרך מתחילה בקריירה הראשונה.</p>;
  }
  return (
    <div className="album-grid">
      {entries.map((club) => (
        <div key={club.clubId} className="album-cell">
          <ClubCrest clubId={club.clubId} name={club.clubName} size="large" />
          <div className="album-name">{club.clubName}</div>
          <div className="album-sub">{club.country}</div>
          <div className="album-stats">
            <Ltr>{club.seasons}</Ltr> עונות · <Ltr>{club.appearances}</Ltr> הופעות
          </div>
          <div className="album-chips">
            {club.wonTrophy && <span className="album-chip album-chip-gold">תואר</span>}
            {club.wasCaptain && <span className="album-chip">קפטן</span>}
            {club.spells > 1 && <span className="album-chip">חזרת</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
