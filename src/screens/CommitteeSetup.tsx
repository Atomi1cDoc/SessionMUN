import { useMemo, useState } from 'react';
import { UN_MEMBER_STATES, flagEmojiFromCode } from '../data/countries';
import type { Delegate } from '../types';
import { uid, classNames } from '../lib/util';
import { actions } from '../store/store';
import { IconTrash, IconPlus, IconCheck } from '../components/icons';

type Tab = 'all' | 'custom';

export function CommitteeSetup() {
  const [tab, setTab] = useState<Tab>('all');
  const [committeeName, setCommitteeName] = useState('');
  const [logoEmoji, setLogoEmoji] = useState('🌐');
  const [search, setSearch] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [customs, setCustoms] = useState<Delegate[]>([]);

  // custom form
  const [cName, setCName] = useState('');
  const [cEmoji, setCEmoji] = useState('');
  const [cCode, setCCode] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return UN_MEMBER_STATES;
    return UN_MEMBER_STATES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [search]);

  const toggle = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAll = () => setSelectedCodes(new Set(filtered.map((c) => c.code)));
  const selectNone = () => setSelectedCodes(new Set());

  const addCustom = () => {
    const name = cName.trim();
    if (!name) return;
    setCustoms((prev) => [
      ...prev,
      {
        id: uid('del'),
        countryName: name,
        countryCode: (cCode.trim() || name.slice(0, 3)).toUpperCase(),
        isCustom: true,
        flagEmoji: cEmoji.trim() || undefined,
      },
    ]);
    setCName('');
    setCEmoji('');
    setCCode('');
  };

  const removeCustom = (id: string) => setCustoms((prev) => prev.filter((c) => c.id !== id));

  const rosterCount = selectedCodes.size + customs.length;

  const create = () => {
    const unDelegates: Delegate[] = UN_MEMBER_STATES.filter((c) => selectedCodes.has(c.code)).map(
      (c) => ({
        id: uid('del'),
        countryName: c.name,
        countryCode: c.code,
        isCustom: false,
        flagEmoji: flagEmojiFromCode(c.code),
      }),
    );
    const roster = [...unDelegates, ...customs].sort((a, b) =>
      a.countryName.localeCompare(b.countryName),
    );
    actions.createEvent({
      name: committeeName.trim() || 'Your Committee',
      logoEmoji: logoEmoji.trim() || '🌐',
      roster,
    });
  };

  return (
    <div className="app-root setup">
      <h1>Create a Committee</h1>
      <p className="muted">Set up your committee roster to begin chairing sessions.</p>

      <div className="row" style={{ gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <label className="field-label">Committee name</label>
          <input
            className="input"
            placeholder="e.g. UN Security Council"
            value={committeeName}
            onChange={(e) => setCommitteeName(e.target.value)}
          />
        </div>
        <div style={{ width: 120 }}>
          <label className="field-label">Logo</label>
          <input
            className="input"
            style={{ textAlign: 'center', fontSize: 22 }}
            value={logoEmoji}
            maxLength={2}
            onChange={(e) => setLogoEmoji(e.target.value)}
          />
        </div>
      </div>

      <div className="tabs-bar">
        <button className={classNames('tab-btn', tab === 'all' && 'active')} onClick={() => setTab('all')}>
          All Countries
        </button>
        <button className={classNames('tab-btn', tab === 'custom' && 'active')} onClick={() => setTab('custom')}>
          Custom Countries {customs.length > 0 && <span className="chip">{customs.length}</span>}
        </button>
      </div>

      {tab === 'all' ? (
        <>
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <input
              className="input"
              placeholder="Search countries…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-outline btn-sm" onClick={selectAll}>Select all</button>
            <button className="btn btn-outline btn-sm" onClick={selectNone}>Clear</button>
          </div>
          <div className="country-list">
            {filtered.map((c) => {
              const on = selectedCodes.has(c.code);
              return (
                <div
                  key={c.code}
                  className={classNames('country-row', on && 'selected')}
                  onClick={() => toggle(c.code)}
                >
                  <input type="checkbox" checked={on} readOnly />
                  <span className="flag">{flagEmojiFromCode(c.code)}</span>
                  <span>{c.name}</span>
                  <span className="code">{c.code}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 220px' }}>
                <label className="field-label">Delegation name</label>
                <input className="input" placeholder="e.g. African Union" value={cName} onChange={(e) => setCName(e.target.value)} />
              </div>
              <div style={{ width: 90 }}>
                <label className="field-label">Emoji</label>
                <input className="input" style={{ textAlign: 'center' }} placeholder="🏳️" value={cEmoji} maxLength={2} onChange={(e) => setCEmoji(e.target.value)} />
              </div>
              <div style={{ width: 100 }}>
                <label className="field-label">Code</label>
                <input className="input" placeholder="AU" value={cCode} maxLength={4} onChange={(e) => setCCode(e.target.value)} />
              </div>
              <button className="btn btn-navy" style={{ alignSelf: 'flex-end' }} onClick={addCustom}>
                <IconPlus size={18} /> Add
              </button>
            </div>
          </div>
          {customs.length === 0 ? (
            <div className="gate-msg">No custom delegations yet. Add non-UN bodies, observers, or NGOs above.</div>
          ) : (
            <div className="country-list">
              {customs.map((c) => (
                <div key={c.id} className="country-row">
                  <span className="flag">{c.flagEmoji ?? '🏳️'}</span>
                  <span>{c.countryName}</span>
                  <span className="code">{c.countryCode}</span>
                  <button className="icon-btn" onClick={() => removeCustom(c.id)} aria-label="Remove">
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="setup-footer">
        <div className="muted"><strong>{rosterCount}</strong> delegation{rosterCount === 1 ? '' : 's'} in roster</div>
        <div className="spacer" />
        <button className="btn btn-primary" disabled={rosterCount === 0} onClick={create}>
          <IconCheck size={18} /> Create Committee
        </button>
      </div>
    </div>
  );
}
