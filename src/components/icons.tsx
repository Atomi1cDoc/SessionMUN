// Minimal inline SVG icon set (stroke-based, currentColor).
import type { JSX } from 'react';

type P = { size?: number; className?: string };
const svg = (size: number, className: string | undefined, children: JSX.Element) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const IconMenu = ({ size = 22, className }: P) =>
  svg(size, className, <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>);

export const IconFullscreen = ({ size = 20, className }: P) =>
  svg(size, className, <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>);

export const IconExternal = ({ size = 20, className }: P) =>
  svg(size, className, <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>);

export const IconTrophy = ({ size = 20, className }: P) =>
  svg(size, className, <><path d="M6 9a6 6 0 0 0 12 0V4H6z" /><path d="M6 5H3v2a3 3 0 0 0 3 3" /><path d="M18 5h3v2a3 3 0 0 1-3 3" /><line x1="12" y1="15" x2="12" y2="19" /><path d="M8 21h8" /><path d="M10 19h4" /></>);

export const IconChevronDown = ({ size = 20, className }: P) =>
  svg(size, className, <polyline points="6 9 12 15 18 9" />);
export const IconChevronUp = ({ size = 20, className }: P) =>
  svg(size, className, <polyline points="18 15 12 9 6 15" />);
export const IconChevronRight = ({ size = 20, className }: P) =>
  svg(size, className, <polyline points="9 18 15 12 9 6" />);
export const IconChevronLeft = ({ size = 20, className }: P) =>
  svg(size, className, <polyline points="15 18 9 12 15 6" />);

export const IconPeople = ({ size = 22, className }: P) =>
  svg(size, className, <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);

export const IconGear = ({ size = 22, className }: P) =>
  svg(size, className, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>);

export const IconRefresh = ({ size = 22, className }: P) =>
  svg(size, className, <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>);

export const IconPlay = ({ size = 22, className }: P) =>
  svg(size, className, <polygon points="6 4 20 12 6 20 6 4" />);
export const IconPause = ({ size = 22, className }: P) =>
  svg(size, className, <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>);

export const IconPlus = ({ size = 20, className }: P) =>
  svg(size, className, <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>);
export const IconMinus = ({ size = 20, className }: P) =>
  svg(size, className, <line x1="5" y1="12" x2="19" y2="12" />);
export const IconClose = ({ size = 22, className }: P) =>
  svg(size, className, <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
export const IconCheck = ({ size = 20, className }: P) =>
  svg(size, className, <polyline points="20 6 9 17 4 12" />);
export const IconTrash = ({ size = 18, className }: P) =>
  svg(size, className, <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>);
export const IconEdit = ({ size = 18, className }: P) =>
  svg(size, className, <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" /></>);

export const IconMic = ({ size = 22, className }: P) =>
  svg(size, className, <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>);
export const IconGavel = ({ size = 22, className }: P) =>
  svg(size, className, <><path d="m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10" /><path d="m16 16 6-6" /><path d="m8 8 6-6" /><path d="m9 7 8 8" /><path d="m21 11-8-8" /></>);
export const IconClock = ({ size = 22, className }: P) =>
  svg(size, className, <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>);
export const IconGrid = ({ size = 22, className }: P) =>
  svg(size, className, <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>);
export const IconVote = ({ size = 22, className }: P) =>
  svg(size, className, <><path d="m9 12 2 2 4-4" /><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" /></>);
export const IconUser = ({ size = 22, className }: P) =>
  svg(size, className, <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
export const IconDownload = ({ size = 18, className }: P) =>
  svg(size, className, <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>);
export const IconUpload = ({ size = 18, className }: P) =>
  svg(size, className, <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>);
export const IconEye = ({ size = 20, className }: P) =>
  svg(size, className, <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>);
export const IconEyeOff = ({ size = 20, className }: P) =>
  svg(size, className, <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>);
