// Cookies are used ONLY for a couple of trivial flags (never bulk data).
// Bulk state lives in localStorage / IndexedDB.

export const cookies = {
  set(name: string, value: string, days = 365): void {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  },

  get(name: string): string | null {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(encodeURIComponent(name) + '='));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
  },

  remove(name: string): void {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  },
};

// Trivial flag: which committee is active. Data itself stays in localStorage/IDB.
export const ACTIVE_EVENT_COOKIE = 'activeMunEventId';
