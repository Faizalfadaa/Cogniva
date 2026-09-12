import type { TourStep } from './ProductTour'

/**
 * The walkthrough runs in two parts, in the order someone actually meets the
 * product after the landing page:
 *
 *   /home       what a workspace is, and how to start one
 *   /workspace  the board, the mic, and handing the work to your student
 *
 * Copy is held as message keys and translated by ProductTour, so the tour is in
 * whichever language the rest of the interface is in.
 *
 * Steps whose target is missing are skipped by ProductTour, so the ones that
 * only exist sometimes — the workspace list is empty on a first visit, the mic
 * disappears when permission is denied — need no guard here.
 */

export const HOME_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="workspace-list"]',
    title: 'tour.listTitle',
    body: 'tour.listBody',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="workspace-filters"]',
    title: 'tour.filtersTitle',
    body: 'tour.filtersBody',
    placement: 'right',
  },
  {
    selector: '[data-tour="profile"]',
    title: 'tour.profileTitle',
    body: 'tour.profileBody',
    placement: 'right',
  },
  {
    selector: '[data-tour="new-workspace"]',
    title: 'tour.newTitle',
    body: 'tour.newBody',
    placement: 'right',
  },
]

export const WORKSPACE_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="whiteboard-area"]',
    title: 'tour.boardTitle',
    body: 'tour.boardBody',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="mic-button"]',
    title: 'tour.micTitle',
    body: 'tour.micBody',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="teach-button"]',
    title: 'tour.teachTitle',
    body: 'tour.teachBody',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="chat-launcher"]',
    title: 'tour.chatTitle',
    body: 'tour.chatBody',
    placement: 'left',
  },
  {
    selector: '[data-tour="pdf-upload"]',
    title: 'tour.pdfTitle',
    body: 'tour.pdfBody',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="finish-button"]',
    title: 'tour.finishTitle',
    body: 'tour.finishBody',
    placement: 'bottom',
  },
]
