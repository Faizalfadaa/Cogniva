import { create } from 'zustand';
import type { SessionStatus, DialogMessage, EvaluationResult } from '../contracts/dto';

interface SessionStore {
  sessionId: string | null;
  status: SessionStatus | null;
  turnCount: number;
  topicId: string | null;
  topicTitle: string | null;
  messages: DialogMessage[];
  isSending: boolean;
  evaluationResult: EvaluationResult | null;
  confirmationRequest: { snapshotId: string; hint: string } | null;

  setSession: (id: string, topicId: string, topicTitle: string) => void;
  setStatus: (status: SessionStatus) => void;
  incrementTurn: () => void;
  addMessage: (msg: DialogMessage) => void;
  setIsSending: (v: boolean) => void;
  setEvaluationResult: (r: EvaluationResult) => void;
  setConfirmationRequest: (req: { snapshotId: string; hint: string } | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionId: null,
  status: null,
  turnCount: 0,
  topicId: null,
  topicTitle: null,
  messages: [],
  isSending: false,
  evaluationResult: null,
  confirmationRequest: null,

  setSession: (id, topicId, topicTitle) =>
    set({ sessionId: id, topicId, topicTitle, status: 'PERSIAPAN', turnCount: 0, messages: [] }),
  setStatus: (status) => set({ status }),
  incrementTurn: () => set((s) => ({ turnCount: s.turnCount + 1 })),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setIsSending: (v) => set({ isSending: v }),
  setEvaluationResult: (r) => set({ evaluationResult: r }),
  setConfirmationRequest: (req) => set({ confirmationRequest: req }),
  reset: () =>
    set({
      sessionId: null, status: null, turnCount: 0, topicId: null,
      topicTitle: null, messages: [], isSending: false,
      evaluationResult: null, confirmationRequest: null,
    }),
}));
