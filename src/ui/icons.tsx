/** Значки палитры и истории — те же, что в прототипе. */
export const SUPPORT_ICONS = {
  fixed: (
    <svg viewBox="0 0 36 26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 3v20M10 13h24" />
      <path d="M10 5l-5 5M10 11l-5 5M10 17l-5 5" strokeWidth="1.1" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 36 26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M18 4l-8 14h16z" />
      <path d="M6 18h24" />
      <path d="M10 18l-3 5M16 18l-3 5M22 18l-3 5M28 18l-3 5" strokeWidth="1.1" />
    </svg>
  ),
  roller: (
    <svg viewBox="0 0 36 26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M18 3l-7 12h14z" />
      <circle cx="14" cy="18" r="2.4" />
      <circle cx="22" cy="18" r="2.4" />
      <path d="M6 22h24" />
    </svg>
  ),
  rod: (
    <svg viewBox="0 0 36 26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 4l12 16" />
      <circle cx="12" cy="4" r="2.4" />
      <circle cx="24" cy="20" r="2.4" />
      <path d="M18 24h12" />
    </svg>
  ),
};

export const LOAD_ICONS = {
  force: (
    <svg viewBox="0 0 36 26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 4l16 16" />
      <path d="M24 20l-7-1.5M24 20l-1.5-7" />
    </svg>
  ),
  weight: (
    <svg viewBox="0 0 36 26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M18 2v10" />
      <rect x="12" y="12" width="12" height="11" />
    </svg>
  ),
  moment: (
    <svg viewBox="0 0 36 26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M11 18a8 8 0 1 1 14 0" />
      <path d="M11 18l0-6M11 18l6-1" />
    </svg>
  ),
  dist: (
    <svg viewBox="0 0 36 26" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 4h26M5 4v18M31 4v18" />
      <path d="M12 6v14M18 6v14M24 6v14" strokeWidth="1.1" />
      <path d="M5 22h26" />
    </svg>
  ),
};

export const UndoIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M7 5L3 9l4 4M3.5 9H12a5 5 0 0 1 0 10h-2" />
  </svg>
);
export const RedoIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M13 5l4 4-4 4M16.5 9H8a5 5 0 0 0 0 10h2" />
  </svg>
);
