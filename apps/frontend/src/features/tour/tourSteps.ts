import type { TourStep } from './ProductTour'

/**
 * The walkthrough runs in two parts, in the order someone actually meets the
 * product after the landing page:
 *
 *   /home       what a workspace is, and how to start one
 *   /workspace  the board, the mic, and handing the work to your student
 *
 * Copy is in English to match the rest of the UI ("Teach", "Record",
 * "Finish Session", "New workspace").
 *
 * Steps whose target is missing are skipped by ProductTour, so the ones that
 * only exist sometimes — the workspace list is empty on a first visit, the mic
 * disappears when permission is denied — need no guard here.
 */

export const HOME_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="workspace-list"]',
    title: 'Your topics live here',
    body: 'Each thing you teach gets its own workspace, with its own board, its own student and its own report. Reopen one any time to teach it again.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="workspace-filters"]',
    title: 'Find your way around',
    body: 'Active workspaces are the ones you are still teaching. Completed ones have a finished report waiting for you.',
    placement: 'right',
  },
  {
    selector: '[data-tour="profile"]',
    title: 'This is you',
    body: 'The name your student calls you by. Change it here whenever you like.',
    placement: 'right',
  },
  {
    selector: '[data-tour="new-workspace"]',
    title: 'Start a topic',
    body: 'Open a new workspace to begin teaching. The tour picks up again once you are inside, right at the board.',
    placement: 'right',
  },
]

export const WORKSPACE_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="whiteboard-area"]',
    title: 'This is your board',
    body: 'Write, draw, or sketch your explanation here — the same way you would on a real whiteboard. Everything you put down is saved as you go.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="mic-button"]',
    title: 'Explain out loud',
    body: 'Recording is on while you teach, so you can talk through the board instead of writing every word. Tap to pause or resume it.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="teach-button"]',
    title: 'Hand it to your student',
    body: 'Press Teach when you want her to look at the board. She reads what you drew, listens to what you said, and reacts.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="chat-launcher"]',
    title: 'Talk it through',
    body: 'She asks questions here, and you can answer or ask your own without pressing Teach again. Unread replies show up as a badge.',
    placement: 'left',
  },
  {
    selector: '[data-tour="pdf-upload"]',
    title: 'Attach a reference (optional)',
    body: 'Add a PDF of the source material to ground your evaluation. Your student never sees it — only the evaluator does.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="finish-button"]',
    title: 'End the round',
    body: 'Finish the session when you are done. She writes you a letter about what she understood, what confused her, and what to try next.',
    placement: 'bottom',
  },
]
