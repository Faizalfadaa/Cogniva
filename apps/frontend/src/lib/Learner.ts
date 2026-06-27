import type { LearnerDTO } from '../dto/LearnerDTO';

// 3 karakter learner, hardcoded "for fun".
// firstMessages adalah array bubble yang ditampilkan satu per satu,
// dengan placeholder {userName} diganti runtime sebelum ditampilkan.
export interface LearnerCharacter extends Omit<LearnerDTO, 'firstMessage'> {
  firstMessages: string[];
}

const LEARNERS: LearnerCharacter[] = [
  {
    id: 'ellen',
    name: 'Ellen Joe',
    avatarUrl: '/assets/avatars/ellen.png',
    introVideoUrl: '/intro/ellen.mp4',
    firstMessages: [
      'E-Etto...',
      '...{userName}-sensei?',
      'Finally... I get to meet you.',
      '...Hehe.',
      "Mulai hari ini... please don't look at anyone else more than you look at me, okay?",
    ],
  },
  {
    id: 'nanally',
    name: 'Nanally Coluccis',
    avatarUrl: '/assets/avatars/nanally.png',
    introVideoUrl: '/intro/nanally.mp4',
    firstMessages: [
      'Eh?',
      'A-Are you really...',
      '{userName}-sensei?',
      'KYAA—!',
      'Finally!! Aku ketemu juga!',
      "...Don't disappear on me, okay?",
      '...Promise?',
    ],
  },
  {
    id: 'rhen',
    name: 'Rhen',
    avatarUrl: '/assets/avatars/rhen.png',
    introVideoUrl: '/intro/rhen.mp4',
    firstMessages: [
      "...You're late.",
      '...Hm?',
      'Oh.',
      "So you're {userName}-sensei.",
      "...I'm Rhen.",
      'Remember my name.',
      "...You're going to hear it a lot from now on.",
    ],
  },
];

/**
 * Pilih learner secara deterministik berdasarkan workspaceId supaya learner
 * yang sama selalu muncul lagi tiap kali workspace yang sama dibuka,
 * tanpa backend perlu menyimpan apa pun soal "siapa learner-nya".
 */
export function deriveLearner(workspaceId: string): LearnerCharacter {
  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    hash = (hash * 31 + workspaceId.charCodeAt(i)) >>> 0;
  }
  return LEARNERS[hash % LEARNERS.length];
}

/**
 * Resolve firstMessages ke array string final dengan userName sudah disubstitusi.
 * Ini yang langsung dipakai komponen untuk ditampilkan bubble per bubble.
 */
export function resolveFirstMessages(learner: LearnerCharacter, userName: string): string[] {
  return learner.firstMessages.map((msg) => msg.replace(/\{userName\}/g, userName));
}