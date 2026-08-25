import { GamePage } from './pages/GamePage';
import { NewCareerPage } from './pages/NewCareerPage';
import { RetirementPage } from './pages/RetirementPage';
import { WelcomePage } from './pages/WelcomePage';
import { useGame } from './state/useGame';

export function App(): JSX.Element {
  const { career, meta, screen, legacySaveDropped, actions } = useGame();

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
