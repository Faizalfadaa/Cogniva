import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CognivaBridge } from './CognivaBridge';
import { MockCognivaBridge } from './MockCognivaBridge';

const BridgeContext = createContext<CognivaBridge | null>(null);

interface BridgeProviderProps {
  children: ReactNode;
  bridge?: CognivaBridge;
}

export function BridgeProvider({ children, bridge }: BridgeProviderProps) {
  const resolved = useMemo<CognivaBridge>(() => {
    if (bridge) return bridge;
    // Ganti baris ini saat RealCognivaBridge sudah tersedia
    return new MockCognivaBridge();
  }, [bridge]);

  return <BridgeContext.Provider value={resolved}>{children}</BridgeContext.Provider>;
}

export function useBridge(): CognivaBridge {
  const ctx = useContext(BridgeContext);
  if (!ctx) throw new Error('useBridge() dipanggil di luar <BridgeProvider>.');
  return ctx;
}