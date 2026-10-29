export const TITLE_CREDIT = 'Implemented with Codex';
export const TITLE_SCREEN_SECONDS = 3.5;

/** A steady two-second reading hold before the title moves to its rule card. */
export const CHAPTER_TIMING = {
  start: .12,
  hold: 2.05,
  exit: .8,
  rulesAt: 2.55
} as const;
