import { GamePage } from './pages/GamePage';
import { MetaPage } from './pages/MetaPage';
import { NewCareerPage } from './pages/NewCareerPage';
import { RetirementPage } from './pages/RetirementPage';
import { WelcomePage } from './pages/WelcomePage';
import { AnalyticsConsent } from './components/AnalyticsConsent';
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

      {screen === 'meta' && <MetaPage onBack={actions.backToWelcome} />}

      {screen === 'retired' && career?.retired && (
        <RetirementPage
          career={career}
          isBest={(career.legend?.score ?? 0) >= meta.bestLegendScore}
          onNewCareer={actions.openCreate}
          onOpenMeta={actions.openMeta}
        />
      )}

      {(screen === 'welcome' || (screen === 'game' && !career)) && (
        <WelcomePage
          meta={meta}
          savedCareer={career}
          onOpenMeta={actions.openMeta}
          legacySaveDropped={legacySaveDropped}
          onStart={actions.openCreate}
          onResume={actions.resumeCareer}
          onDiscard={actions.abandonCareer}
          onDismissLegacyNotice={actions.dismissLegacyNotice}
        />
      )}

      {/*
        Last in the tree and fixed to the bottom, so a one-time question cannot reflow a screen
        whose fit is measured without it. Renders nothing at all unless this environment would
        emit analytics and the player has not yet answered.
      */}
      <AnalyticsConsent />
    </div>
  );
}
