import type { LearnerDTO } from '../dto/LearnerDTO';

// 3 learner characters, hardcoded "for fun".
// firstMessages is an array of bubbles shown one at a time, with the {userName}
// placeholder replaced at runtime before being displayed.
export interface LearnerCharacter extends Omit<LearnerDTO, 'firstMessage' | 'introVideoUrl'> {
  firstMessages: string[];
  introImageUrl: string;
}

export const LEARNERS: readonly LearnerCharacter[] = [
  {
    id: 'yuzuki',
    name: 'Yuzuki Akatsuki',
    avatarUrl: '/assets/avatars/yuzuki.png',
    introImageUrl: '/intro/yuzuki_full.png',
    firstMessages: [
      'E-Etto...',
      '...{userName}-sensei?',
      'Finally... I get to meet you.',
      'Lets learn something new today, sensei...'
    ],
  },
  {
    id: 'reina',
    name: 'Reina Kisaragi',
    avatarUrl: '/assets/avatars/reina.png',
    introImageUrl: '/intro/reina_full.png',
    firstMessages: [
      'Eh?',
      'A-Are you really...',
      '{userName}-sensei?',
      'KYAA—!',
      'Finally!! I found you!',
      "...Don't disappear on me, okay?",
      '...Promise?',
    ],
  },
  {
    id: 'akira',
    name: 'Akira Kagetsu',
    avatarUrl: '/assets/avatars/akira.png',
    introImageUrl: '/intro/akira_full.png',
    firstMessages: [
      "...You're late.",
      '...Hm?',
      'Oh.',
      "So you're {userName}-sensei.",
      "...I'm Akira.",
      'Remember my name.',
      "...You're going to hear it a lot from now on.",
    ],
  },
];

/**
 * Pick a learner deterministically from the workspaceId so the same learner
 * always shows up again whenever the same workspace is reopened, without the
 * backend needing to store anything about "who the learner is".
 */
export function deriveLearner(workspaceId: string): LearnerCharacter {
  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    hash = (hash * 31 + workspaceId.charCodeAt(i)) >>> 0;
  }
  return LEARNERS[hash % LEARNERS.length];
}

// ── Chosen character, per workspace ────────────────────────────────────────
// Stored per browser like the intro flag (see useIntroSeen) rather than on the
// backend: no contract carries "who the learner is", and the choice is a UI
// preference, not session data the Evaluator or orchestrator ever reads.

function storageKey(workspaceId: string): string {
  return `cogniva:learner:${workspaceId}`;
}

/** The learner the user picked for this workspace, or null if they never did. */
export function getStoredLearnerId(workspaceId: string): string | null {
  if (!workspaceId) return null;
  try {
    return localStorage.getItem(storageKey(workspaceId));
  } catch {
    // Private mode / storage disabled — treated as "no choice recorded", which
    // falls back to deriveLearner below rather than breaking anything.
    return null;
  }
}

export function setStoredLearnerId(workspaceId: string, learnerId: string): void {
  if (!workspaceId) return;
  try {
    localStorage.setItem(storageKey(workspaceId), learnerId);
  } catch {
    // Losing the preference is a cosmetic regression, not worth interrupting.
  }
}

/**
 * The learner to show for a workspace: the user's pick when there is one,
 * otherwise the original hash-derived character.
 *
 * The fallback is what keeps existing workspaces stable — every workspace
 * opened before this feature has no stored id, and must keep the character it
 * has always shown. An unknown stored id (a character since removed) falls
 * back the same way rather than throwing.
 */
export function resolveLearner(workspaceId: string): LearnerCharacter {
  const storedId = getStoredLearnerId(workspaceId);
  const chosen = storedId ? LEARNERS.find((l) => l.id === storedId) : undefined;
  return chosen ?? deriveLearner(workspaceId);
}

/**
 * Resolve firstMessages into the final string array with userName substituted in.
 * This is what the component uses directly to display the bubbles one by one.
 */
export function resolveFirstMessages(learner: LearnerCharacter, userName: string): string[] {
  return learner.firstMessages.map((msg) => msg.replace(/\{userName\}/g, userName));
}