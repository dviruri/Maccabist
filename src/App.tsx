import { GamePage } from './pages/GamePage';
import { NewCareerPage } from './pages/NewCareerPage';
import { RetirementPage } from './pages/RetirementPage';
import { WelcomePage } from './pages/WelcomePage';
import { Gallery, isGalleryRequested } from './dev/Gallery';
import { useGame } from './state/useGame';

export function App(): JSX.Element {
  const { career, meta, screen, legacySaveDropped, actions } = useGame();

  /*
   * Dev-only component gallery (v0.4.5).
   *
   * The game has no routes, so there is no way to point a headless browser at "the season
   * summary" without playing thirty seasons in it. `?gallery=1` renders each screen from an
   * engine-built fixture instead, which is what makes the visual work checkable. Not linked from
   * anywhere; a player cannot reach it by accident.
   */
  if (isGalleryRequested()) return <Gallery />;

  return (
    <div className="app">
      {screen === 'create' && (
        <NewCareerPage onCreate={actions.startCareer} onBack={actions.backToWelcome} />
      )}

      {screen === 'game' && career && (
        <GamePage career={career} actions={actions} onExit={actions.backToWelcome} />
      )}

      {screen === 'retired' && career?.retired && (
        <RetirementPage
          career={career}
          isBest={(career.legend?.score ?? 0) >= meta.bestLegendScore}
          onNewCareer={actions.openCreate}
        />
      )}

      {(screen === 'welcome' || (screen === 'game' && !career)) && (
        <WelcomePage
          meta={meta}
          savedCareer={career}
          legacySaveDropped={legacySaveDropped}
          onStart={actions.openCreate}
          onResume={actions.resumeCareer}
          onDiscard={actions.abandonCareer}
          onDismissLegacyNotice={actions.dismissLegacyNotice}
        />
      )}
    </div>
  );
}
