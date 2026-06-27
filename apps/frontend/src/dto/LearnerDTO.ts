export interface LearnerDTO {
  id: string;
  name: string;
  avatarUrl: string;
  introVideoUrl: string;
  /**
   * Pesan pembuka learner saat workspace pertama dibuka, hardcoded per karakter.
   */
  firstMessages: string[];
}