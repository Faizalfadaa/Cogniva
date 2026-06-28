import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CognivaBridge } from './CognivaBridge';
import { MockCognivaBridge } from './MockCognivaBridge';
import { RealCognivaBridge } from './RealCognivaBridge';

const BridgeContext = createContext<CognivaBridge | null>(null);

interface BridgeProviderProps {
  children: ReactNode;
  bridge?: CognivaBridge;
}

// Default to the real backend bridge. Set VITE_USE_MOCK=true to run the UI fully
// offline against the in-memory MockCognivaBridge (no backend needed).
const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export function BridgeProvider({ children, bridge }: BridgeProviderProps) {
  const resolved = useMemo<CognivaBridge>(() => {
    if (bridge) return bridge;
    return useMock ? new MockCognivaBridge() : new RealCognivaBridge();
  }, [bridge]);

  return <BridgeContext.Provider value={resolved}>{children}</BridgeContext.Provider>;
}

export function useBridge(): CognivaBridge {
  const ctx = useContext(BridgeContext);
  if (!ctx) throw new Error('useBridge() dipanggil di luar <BridgeProvider>.');
  return ctx;
}