import type { LearnerDTO } from '../dto/LearnerDTO';
import type { Locale } from '../i18n/messages';

// 3 learner characters, hardcoded "for fun".
// firstMessages is an array of bubbles shown one at a time, with the {userName}
// placeholder replaced at runtime before being displayed.
export interface LearnerCharacter extends Omit<LearnerDTO, 'firstMessage' | 'introVideoUrl'> {
  firstMessages: string[];
  introImageUrl: string;
  /** Short temperament label, e.g. "Anxious, thorough". Rendered uppercase by
   *  CSS rather than stored that way, so it stays readable in code. */
  traits: string;
  /** One or two sentences on how this student behaves while being taught. */
  description: string;
  /** A line they might actually say, used as flavour on cards. */
  catchphrase: string;
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
    traits: 'Anxious, thorough',
    description:
      "Apologises before every question, then asks the sharpest one in the session. She'll admit when she only copied your diagram.",
    catchphrase: '“E-Etto… sensei, sorry, one more thing?”',
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
      'KYAA...!',
      'Finally!! I found you!',
      "...Don't disappear on me, okay?",
      '...Promise?',
    ],
    traits: 'Loud, delighted',
    description:
      'Enthusiastic to the point of chaos. Jumps three steps ahead, which is exactly how you find out your explanation had no step two.',
    catchphrase: '“KYAA...! Wait, so does that mean...”',
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
    traits: 'Blunt, unimpressed',
    description:
      'Says the quiet part out loud. If a section of your explanation was filler, his letter will name it. The most useful one to draw.',
    catchphrase: '“…You’re late. And that part made no sense.”',
  },
];

/** The part of a character that is written prose, and so has to be translated. */
export interface LearnerCopy {
  firstMessages: string[];
  traits: string;
  description: string;
  catchphrase: string;
}

/**
 * The three students in Indonesian.
 *
 * Not a literal translation: each one is rewritten so the character survives.
 * Akira is blunt in Indonesian the way he is blunt in English, which means
 * different words rather than the same words. "-sensei" stays — it is how these
 * students address the user, in either language.
 */
const ID_COPY: Record<string, LearnerCopy> = {
  yuzuki: {
    firstMessages: [
      'E-Etto...',
      '...{userName}-sensei?',
      'Akhirnya... aku bisa bertemu denganmu.',
      'Ayo belajar sesuatu yang baru hari ini, sensei...',
    ],
    traits: 'Cemas, teliti',
    description:
      'Minta maaf dulu sebelum bertanya, lalu melontarkan pertanyaan paling tajam di sesi itu. Dia mau mengaku kalau dia cuma menyalin diagrammu.',
    catchphrase: '“E-Etto… sensei, maaf, satu lagi boleh?”',
  },
  reina: {
    firstMessages: [
      'Eh?',
      'K-Kamu benar-benar...',
      '{userName}-sensei?',
      'KYAA...!',
      'Akhirnya!! Aku menemukanmu!',
      '...Jangan menghilang lagi, ya?',
      '...Janji?',
    ],
    traits: 'Ribut, girang',
    description:
      'Semangatnya sampai bikin kacau. Melompat tiga langkah ke depan — dan justru dari situ kamu tahu penjelasanmu tidak punya langkah kedua.',
    catchphrase: '“KYAA...! Tunggu, jadi itu artinya...”',
  },
  akira: {
    firstMessages: [
      '...Kamu terlambat.',
      '...Hm?',
      'Oh.',
      'Jadi kamu {userName}-sensei.',
      '...Aku Akira.',
      'Ingat namaku.',
      '...Mulai sekarang kamu akan sering mendengarnya.',
    ],
    traits: 'Blak-blakan, datar',
    description:
      'Mengucapkan bagian yang orang lain cuma pikirkan. Kalau ada bagian penjelasanmu yang sekadar pengisi, suratnya akan menyebut bagian itu. Paling berguna untuk dipilih.',
    catchphrase: '“…Kamu terlambat. Dan bagian itu tidak masuk akal.”',
  },
};

/**
 * A character's written lines in one language.
 *
 * The English text lives on the character itself, so a language with no
 * translation yet falls back to it rather than to an empty card.
 */
export function learnerCopy(learner: LearnerCharacter, locale: Locale): LearnerCopy {
  const translated = locale === 'en' ? undefined : ID_COPY[learner.id];
  return (
    translated ?? {
      firstMessages: learner.firstMessages,
      traits: learner.traits,
      description: learner.description,
      catchphrase: learner.catchphrase,
    }
  );
}

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
export function resolveLearner(
  workspaceId: string,
  serverLearnerId?: string,
): LearnerCharacter {
  // This browser's pick first, then the one recorded on the workspace, then the
  // id-derived default. The server value is what makes the choice survive a
  // cleared localStorage or a different device — and it is the same value the
  // backend synthesizes speech from, so face and voice cannot disagree.
  const storedId = getStoredLearnerId(workspaceId) ?? serverLearnerId;
  const chosen = storedId ? LEARNERS.find((l) => l.id === storedId) : undefined;
  return chosen ?? deriveLearner(workspaceId);
}

/**
 * Resolve firstMessages into the final string array with userName substituted in.
 * This is what the component uses directly to display the bubbles one by one.
 */
export function resolveFirstMessages(
  learner: LearnerCharacter,
  userName: string,
  locale: Locale = 'en',
): string[] {
  return learnerCopy(learner, locale).firstMessages.map((msg) =>
    msg.replace(/\{userName\}/g, userName),
  );
}