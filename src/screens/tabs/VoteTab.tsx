import { useState } from 'react';
import type { Session, Delegate, Vote, VotingType, RequiredMajority, BallotChoice } from '../../types';
import { actions } from '../../store/store';
import { Flag } from '../../components/Flag';
import { Modal } from '../../components/Modal';
import { classNames } from '../../lib/util';
import { IconGear, IconEye, IconEyeOff, IconCheck } from '../../components/icons';

const MAJORITIES: { value: RequiredMajority; label: string }[] = [
  { value: 'simple', label: 'Simple Majority' },
  { value: 'twoThirds', label: 'Two Thirds Majority' },
  { value: 'securityCouncil9', label: 'Security Council (9)' },
  { value: 'consensus', label: 'Consensus Vote' },
];

function tally(v: Vote) {
  let favor = 0, against = 0, abstain = 0;
  for (const c of Object.values(v.ballots)) {
    if (c === 'favor') favor++;
    else if (c === 'against') against++;
    else abstain++;
  }
  return { favor, against, abstain, cast: favor + against + abstain };
}

function computeOutcome(v: Vote): 'passed' | 'failed' {
  const { favor, against } = tally(v);
  switch (v.requiredMajority) {
    case 'simple': return favor > against ? 'passed' : 'failed';
    case 'twoThirds': return favor + against > 0 && favor >= (2 / 3) * (favor + against) ? 'passed' : 'failed';
    case 'securityCouncil9': return favor >= 9 ? 'passed' : 'failed';
    case 'consensus': return against === 0 && favor > 0 ? 'passed' : 'failed';
  }
}

export function VoteTab({ session, delegates, readOnly }: { session: Session; delegates: Delegate[]; readOnly: boolean }) {
  const [configOpen, setConfigOpen] = useState(false);
  const active = session.votes.find((v) => !v.outcome);
  const past = session.votes.filter((v) => v.outcome);

  return (
    <>
      {active ? (
        <VoteDashboard session={session} vote={active} delegates={delegates} readOnly={readOnly} />
      ) : (
        <div className="panel" style={{ textAlign: 'center' }}>
          <h3 style={{ justifyContent: 'center' }}>No vote in progress</h3>
          <p className="muted">Configure a vote to open the floor for recording ballots.</p>
          {!readOnly && (
            <button className="btn btn-primary" onClick={() => setConfigOpen(true)}>
              <IconGear size={18} /> Configure Voting
            </button>
          )}
        </div>
      )}

      {past.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>Vote history</h3>
          {past.map((v) => {
            const t = tally(v);
            return (
              <div key={v.id} className={classNames('motion-card', v.outcome)}>
                <div className="row" style={{ gap: 10 }}>
                  <strong>{v.label || (v.votingType === 'procedural' ? 'Procedural vote' : 'Substantive vote')}</strong>
                  <span className="spacer" />
                  <span className={`result-pill result-${v.outcome}`}>{v.outcome}</span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {MAJORITIES.find((m) => m.value === v.requiredMajority)?.label} · {t.favor} for · {t.against} against · {t.abstain} abstain
                </div>
              </div>
            );
          })}
        </div>
      )}

      {configOpen && (
        <ConfigureVotingModal session={session} delegates={delegates} onClose={() => setConfigOpen(false)} />
      )}
    </>
  );
}

function VoteDashboard({ session, vote, delegates, readOnly }: { session: Session; vote: Vote; delegates: Delegate[]; readOnly: boolean }) {
  const t = tally(vote);
  // Only present/present-voting delegates may record a ballot.
  const eligible = delegates.filter((d) => {
    const st = session.rollCall[d.id];
    return st === 'present' || st === 'presentVoting';
  });
  const voters = eligible.length > 0 ? eligible : delegates;
  const max = Math.max(1, t.favor, t.against, t.abstain);
  const outcome = computeOutcome(vote);

  return (
    <>
      <div className="panel">
        <div className="row">
          <h3>{vote.label || (vote.votingType === 'procedural' ? 'Procedural Vote' : 'Substantive Vote')}</h3>
          <span className="chip" style={{ marginLeft: 8 }}>{MAJORITIES.find((m) => m.value === vote.requiredMajority)?.label}</span>
          <div className="spacer" />
          <button className="btn btn-ghost btn-sm" onClick={() => actions.toggleVoteHidden(session.id, vote.id)}>
            {vote.resultsHidden ? <><IconEye size={16} /> Show</> : <><IconEyeOff size={16} /> Hide</>} Results
          </button>
        </div>

        {vote.resultsHidden ? (
          <div className="gate-msg" style={{ marginTop: 14 }}>Results hidden · {t.cast} ballot(s) recorded</div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <Bar label="In Favor" n={t.favor} max={max} cls="fill-favor" />
            <Bar label="Against" n={t.against} max={max} cls="fill-against" />
            <Bar label="Abstaining" n={t.abstain} max={max} cls="fill-abstain" />
            <div className="row" style={{ marginTop: 8, gap: 12 }}>
              <span className="muted">{t.cast} cast</span>
              <span className="spacer" />
              <span className="chip" style={{ background: outcome === 'passed' ? '#e3f5ec' : '#fbe9e8', color: outcome === 'passed' ? 'var(--green)' : 'var(--red)' }}>
                Would {outcome === 'passed' ? 'PASS' : 'FAIL'}
              </span>
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="row" style={{ gap: 8, marginTop: 16 }}>
            <button className="btn btn-blue" onClick={() => actions.closeVote(session.id, vote.id, outcome)}>
              <IconCheck size={16} /> Close vote ({outcome})
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => actions.closeVote(session.id, vote.id, 'passed')}>Force pass</button>
            <button className="btn btn-outline btn-sm" onClick={() => actions.closeVote(session.id, vote.id, 'failed')}>Force fail</button>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Record Ballots</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          {eligible.length > 0 ? 'Present & present-voting delegates only.' : 'Roll call not taken — all delegates shown.'}
        </p>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {voters.map((d) => (
            <div key={d.id} className="ballot-row">
              <Flag delegate={d} size={18} />
              <span>{d.countryName}</span>
              <div className="ballot-btns">
                {(['favor', 'against', 'abstain'] as BallotChoice[]).map((c) => (
                  <button
                    key={c}
                    disabled={readOnly}
                    className={classNames('ballot-btn', vote.ballots[d.id] === c && `on-${c}`)}
                    onClick={() => actions.setBallot(session.id, vote.id, d.id, c)}
                  >
                    {c === 'favor' ? 'For' : c === 'against' ? 'Against' : 'Abstain'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Bar({ label, n, max, cls }: { label: string; n: number; max: number; cls: string }) {
  return (
    <div className="vote-bar-wrap">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <strong>{label}</strong>
        <strong>{n}</strong>
      </div>
      <div className="vote-bar-track">
        <div className={`vote-bar-fill ${cls}`} style={{ width: `${(n / max) * 100}%` }} />
      </div>
    </div>
  );
}

function ConfigureVotingModal({ session, delegates, onClose }: { session: Session; delegates: Delegate[]; onClose: () => void }) {
  const [votingType, setVotingType] = useState<VotingType>('substantive');
  const [majority, setMajority] = useState<RequiredMajority>('simple');
  const [label, setLabel] = useState('');
  const [subjectKind, setSubjectKind] = useState<Vote['subjectKind']>(undefined);
  const [sponsors, setSponsors] = useState<string[]>([]);

  const toggleSponsor = (id: string) =>
    setSponsors((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    actions.createVote(session.id, {
      votingType,
      requiredMajority: majority,
      label: label.trim() || undefined,
      subjectKind: votingType === 'substantive' ? subjectKind : 'procedural',
      sponsors,
    });
    onClose();
  };

  return (
    <Modal title="Configure Voting" onClose={onClose}>
      <label className="field-label">Label (optional)</label>
      <input className="input" placeholder="e.g. Draft Resolution 1.1" value={label} onChange={(e) => setLabel(e.target.value)} style={{ marginBottom: 16 }} />

      <label className="field-label">Voting Type</label>
      <div className="radio-grid" style={{ marginBottom: 16 }}>
        {(['procedural', 'substantive'] as VotingType[]).map((v) => (
          <button key={v} className={classNames('radio-card', votingType === v && 'on')} onClick={() => setVotingType(v)}>
            <span style={{ textTransform: 'capitalize' }}>{v}</span>
          </button>
        ))}
      </div>

      <label className="field-label">Required Majority</label>
      <div className="radio-grid" style={{ marginBottom: votingType === 'substantive' ? 16 : 0 }}>
        {MAJORITIES.map((m) => (
          <button key={m.value} className={classNames('radio-card', majority === m.value && 'on')} onClick={() => setMajority(m.value)}>
            {m.label}
          </button>
        ))}
      </div>

      {votingType === 'substantive' && (
        <>
          <label className="field-label">Adopts (credits sponsors on pass)</label>
          <div className="radio-grid" style={{ marginBottom: 12 }}>
            {([
              [undefined, 'None'],
              ['workingPaper', 'Working Paper (WP)'],
              ['draftResolution', 'Draft Resolution (DR)'],
            ] as [Vote['subjectKind'], string][]).map(([k, l]) => (
              <button key={String(k)} className={classNames('radio-card', subjectKind === k && 'on')} onClick={() => setSubjectKind(k)}>{l}</button>
            ))}
          </div>
          {subjectKind && (
            <div style={{ marginBottom: 8 }}>
              <label className="field-label">Sponsors</label>
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1.5px solid var(--line)', borderRadius: 10 }}>
                {delegates.map((d) => (
                  <div key={d.id} className={classNames('add-row', sponsors.includes(d.id) && 'selected')} onClick={() => toggleSponsor(d.id)} style={{ background: sponsors.includes(d.id) ? '#fbf4e6' : undefined }}>
                    <input type="checkbox" checked={sponsors.includes(d.id)} readOnly />
                    <Flag delegate={d} size={16} />
                    <span>{d.countryName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <button className="submit-dark" style={{ marginTop: 14 }} onClick={submit}>SUBMIT</button>
    </Modal>
  );
}
