export interface LearnerDTO {
  id: string;
  name: string;
  avatarUrl: string;
  introVideoUrl: string;
  /**
   * The learner's opening messages when the workspace is first opened, hardcoded per character.
   */
  firstMessages: string[];
}