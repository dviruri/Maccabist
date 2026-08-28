import { useEffect, useRef } from 'react';

/**
 * A bottom sheet (v0.4.7).
 *
 * v0.4.6 put the league table, the career timeline and the season history in the vertical
 * gameplay flow, so on a 390px phone the active decision began 1,155px down the page and the
 * first button a player could press was at 1,454px — more than one and a half viewports of
 * scrolling to reach the thing he opened the game to do.
 *
 * None of that information is unwanted; it is just not what you need in order to answer the
 * question in front of you. So it moves in here, one tap away.
 *
 * Deliberately a modal sheet rather than a gesture-driven one. A drag-to-dismiss implementation
 * that fights the browser's own scrolling is a reliability problem on Android, and the brief is
 * explicit that a simple sheet beats a fragile clever one. What this does provide:
 *
 *   - scrolling inside the sheet, with the page behind it locked
 *   - Escape, backdrop tap, and a real close button
 *   - focus moved in on open and restored on close
 *   - `env(safe-area-inset-bottom)` respected, so nothing sits under the home indicator
 *   - `role="dialog"` + `aria-modal`, labelled by its own title
 */
export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}): JSX.Element | null {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    /*
     * Lock the page behind the sheet. Without this, scrolling past the end of the sheet's content
     * scrolls the gameplay screen underneath it, which on a phone reads as the app losing its
     * place.
     */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // Move focus into the sheet so a keyboard or screen-reader user is actually taken there.
    panel.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  /*
   * Nothing is rendered while closed, which is the point of moving it here (Phase 39): a
   * fourteen-row table and a full career timeline are not mounted during ordinary play.
   */
  if (!open) return null;

  return (
    <div className="sheet-root">
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
      >
        <header className="sheet-head">
          <span className="sheet-grip" aria-hidden />
          <div className="sheet-titles">
            <h2 className="sheet-title">{title}</h2>
            {subtitle && <div className="sheet-subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="סגירה">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
