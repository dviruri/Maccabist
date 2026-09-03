import { useState } from 'react';

import { needsConsentDecision, setConsent } from '../analytics/analytics';

/**
 * The first-run analytics question (v0.9.6.4).
 *
 * Deliberately the smallest thing that can be honest. The game had no settings or preferences
 * surface, and adding one for a single boolean would have been a bigger change than the analytics
 * itself - so this is a one-time bar, not a new system.
 *
 * Behaviour, in order of what matters:
 *
 *   - Nothing is sent before an answer. `needsConsentDecision()` is only true when the
 *     environment would emit at all AND the player has not chosen, so this never appears in dev,
 *     in the gallery or during a browser audit.
 *   - Either answer dismisses it permanently. There is no nagging: the choice is stored under
 *     `maccabist.analytics.consent` and the bar is gone from the next load onwards.
 *   - Declining changes nothing about the game. No event is sent and every screen behaves
 *     identically.
 *
 * Rendered last in the app tree and fixed to the bottom, above the safe area, so it cannot push
 * a screen's layout around - the one-screen work in v0.9.3-v0.9.4 is measured with this absent,
 * and it must not become a new reason for a primary button to fall off the fold.
 */
export function AnalyticsConsent(): JSX.Element | null {
  const [asking, setAsking] = useState(() => needsConsentDecision());
  if (!asking) return null;

  const answer = (choice: 'granted' | 'denied'): void => {
    setConsent(choice);
    setAsking(false);
  };

  return (
    <div className="consent-bar" role="dialog" aria-label="נתוני שימוש אנונימיים">
      <p className="consent-title">עזרו לנו לשפר את מכביסט</p>
      <p className="consent-body">
        אנחנו אוספים נתוני שימוש אנונימיים בלבד, למשל כמה קריירות התחילו וכמה עונות שוחקו. לא
        נשלחים שמות או מידע אישי.
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-primary consent-btn" onClick={() => answer('granted')}>
          אישור
        </button>
        <button type="button" className="btn consent-btn consent-btn-quiet" onClick={() => answer('denied')}>
          לא עכשיו
        </button>
      </div>
    </div>
  );
}
