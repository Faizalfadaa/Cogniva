import type { LearnerDTO } from '../dto/LearnerDTO';

// 3 learner characters, hardcoded "for fun".
// firstMessages is an array of bubbles shown one at a time, with the {userName}
// placeholder replaced at runtime before being displayed.
export interface LearnerCharacter extends Omit<LearnerDTO, 'firstMessage' | 'introVideoUrl'> {
  firstMessages: string[];
  introImageUrl: string;
}

const LEARNERS: LearnerCharacter[] = [
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

/**
 * Resolve firstMessages into the final string array with userName substituted in.
 * This is what the component uses directly to display the bubbles one by one.
 */
export function resolveFirstMessages(learner: LearnerCharacter, userName: string): string[] {
  return learner.firstMessages.map((msg) => msg.replace(/\{userName\}/g, userName));
}