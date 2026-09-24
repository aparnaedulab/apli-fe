import { useCallback, useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { communityApi, type Story, type StoryStatus } from '../../api/community';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StoryCard } from '../student/Stories';
import '../student/Stories.css';
import './Stories.css';

const TABS: { key: StoryStatus; label: string }[] = [
  { key: 'PENDING', label: 'Waiting' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'HIDDEN', label: 'Hidden' },
];

/**
 * The placement cell reading students' stories before juniors do.
 *
 * The college sees who wrote each story, anonymous or not, because it is
 * answerable for what it publishes. Hiding a story needs a reason, and the
 * student is told it - a story turned down with no word is one never written
 * again.
 */
export default function CampusStories() {
  const { hasModule, can } = useAuth();
  const enabled = hasModule('showcase.stories');
  const mayDecide = can('posting:decide');
  const [tab, setTab] = useState<StoryStatus>('PENDING');
  const [data, setData] = useState<{ stories: Story[]; counts: Partial<Record<StoryStatus, number>> } | null>(null);
  const [hiding, setHiding] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    communityApi
      .collegeStories(tab)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load stories.'));
  }, [tab]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  async function decide(id: string, status: 'PUBLISHED' | 'HIDDEN', why?: string) {
    setError(null);
    try {
      await communityApi.decide(id, status, why);
      setHiding(null);
      setReason('');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that decision.');
    }
  }

  if (!enabled) {
    return (
      <CampusLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Campus stories</p>
            <h1>Stories</h1>
            <p className="page-lede">Your institution has not switched on campus stories.</p>
          </div>
        </header>
      </CampusLayout>
    );
  }

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Campus stories</p>
          <h1>Stories from your students</h1>
          <p className="page-lede">Read each one before your juniors do. Publish it, or hide it and say why.</p>
        </div>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? 'is-current' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="tab-count">{data?.counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      {data && data.stories.length === 0 && (
        <p className="muted cs-empty">{tab === 'PENDING' ? 'Nothing waiting for you.' : 'None here.'}</p>
      )}

      <ul className="st-list">
        {data?.stories.map((s) => (
          <li key={s.id} className="cs-item">
            <StoryCard story={s} />
            <p className="cs-author">
              Written by <strong>{s.author}</strong>
              {s.anonymous && ' · shown to students as “a senior from your college”'}
            </p>
            {mayDecide && (
              <div className="cs-actions">
                {hiding === s.id ? (
                  <>
                    <input
                      className="st-input"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why - the student is shown this"
                      autoFocus
                    />
                    <button type="button" className="btn btn-ghost" onClick={() => setHiding(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-danger" disabled={!reason.trim()} onClick={() => decide(s.id, 'HIDDEN', reason.trim())}>
                      Hide story
                    </button>
                  </>
                ) : (
                  <>
                    {s.status !== 'PUBLISHED' && (
                      <button type="button" className="btn btn-primary" onClick={() => decide(s.id, 'PUBLISHED')}>
                        Publish
                      </button>
                    )}
                    {s.status !== 'HIDDEN' && (
                      <button type="button" className="btn btn-secondary" onClick={() => setHiding(s.id)}>
                        Hide
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </CampusLayout>
  );
}
