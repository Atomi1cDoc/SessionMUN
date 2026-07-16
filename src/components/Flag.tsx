import type { Delegate } from '../types';
import { flagEmojiFromCode } from '../data/countries';

// Colored initials badge for custom delegations (no flag emoji available).
const PALETTE = ['#2f7fd1', '#2e9e6b', '#e39f3c', '#8b5cf6', '#d0453f', '#0ea5a3', '#db2777'];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Flag({ delegate, size }: { delegate: Delegate; size?: number }) {
  const style = size ? { fontSize: size } : undefined;
  if (delegate.flagEmoji) return <span className="flag" style={style}>{delegate.flagEmoji}</span>;
  if (!delegate.isCustom && /^[A-Za-z]{2}$/.test(delegate.countryCode)) {
    return <span className="flag" style={style}>{flagEmojiFromCode(delegate.countryCode)}</span>;
  }
  const initials = delegate.countryName.slice(0, 2).toUpperCase();
  return (
    <span
      className="badge-initials"
      style={{ background: colorFor(delegate.countryName), fontSize: size ? size * 0.9 : undefined }}
    >
      {initials}
    </span>
  );
}
