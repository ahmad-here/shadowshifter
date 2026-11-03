import { useEffect, useRef, useState } from 'react';
import { DEBUG, debugOptions } from '../app/debug';
import { GameController, type GameApi } from '../app/GameController';
import { ErrorBoundary } from './ErrorBoundary';
import { reportError, subscribeErrors } from './errors';
import { Screens } from './Screens';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [api, setApi] = useState<GameApi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeErrors(setError), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let controller: GameController;
    try {
      controller = new GameController(canvas, debugOptions());
    } catch (e) {
      reportError(
        `Could not start the 3D renderer. Your browser or device may not support WebGL2. (${String(e)})`,
      );
      return;
    }
    // React only ever holds the frozen API, never the controller or the simulation.
    setApi(controller.api);
    if (DEBUG) {
      (window as unknown as { __shadowShift?: unknown }).__shadowShift = {
        state: () => controller.debugState?.(),
        setAutopilot: (on: boolean) => controller.setAutopilot?.(on),
      };
    }
    return () => {
      controller.dispose();
      setApi(null);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" data-testid="canvas" />
      {api && (
        <ErrorBoundary>
          <Screens api={api} />
        </ErrorBoundary>
      )}
      {error && (
        <div className="error" role="alert" data-testid="error">
          <strong>Something went wrong</strong>
          <p>{error}</p>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
    </>
  );
}
