import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { answer, areaFor, GUIDES, onThisPage, type Area, type GuideEntry } from './guideContent';
import './AppGuide.css';

const read = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    // A browser that refuses storage just sees the tour again.
  }
};

/**
 * The Guide, on every portal: a button at the bottom right that opens a
 * panel to ask "where is…?" or "how do I…?" and be taken there, with what
 * the current page is for. The first time someone signs in to a portal it
 * walks them through where things are; the tour can be replayed any time.
 */
export default function AppGuide({ area: forced }: { area?: Area }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const area = forced ?? areaFor(pathname);
  const [open, setOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const tourKey = user && area ? `guide.tour.${area}.${user.id}` : null;

  // First visit to this portal by this person: the tour.
  useEffect(() => {
    if (tourKey && !read(tourKey)) {
      const t = window.setTimeout(() => setTouring(true), 700);
      return () => window.clearTimeout(t);
    }
  }, [tourKey]);

  if (!user || !area) return null;
  const guide = GUIDES[area];

  return (
    <>
      {/* In the top bar, beside the bell: nothing pinned to the bottom of a page can cover it. */}
      <button
        type="button"
        className={`gd-fab ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open the guide"
        title="Ask the guide where things are"
      >
        <span className="gd-fab-icon" aria-hidden="true">
          ?
        </span>
        <span className="gd-fab-text">Guide</span>
      </button>
      {open && (
        <GuidePanel
          area={area}
          pathname={pathname}
          onClose={() => setOpen(false)}
          onTour={() => {
            setOpen(false);
            setTouring(true);
          }}
        />
      )}
      {touring && (
        <Tour
          name={guide.name}
          welcome={guide.welcome}
          steps={guide.tour}
          // "Dr. Meera Kulkarni" is greeted as Meera, not "Dr.".
          firstName={user.fullName.split(/\s+/).find((w) => !/^(dr|prof|mr|mrs|ms|shri|smt)\.?$/i.test(w)) ?? ''}
          onDone={() => {
            if (tourKey) write(tourKey, '1');
            setTouring(false);
          }}
        />
      )}
    </>
  );
}

function GuidePanel({ area, pathname, onClose, onTour }: { area: Area; pathname: string; onClose: () => void; onTour: () => void }) {
  const navigate = useNavigate();
  const guide = GUIDES[area];
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const here = useMemo(() => onThisPage(area, pathname), [area, pathname]);
  const results = useMemo(() => (asked ? answer(area, asked) : []), [area, asked]);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!box.current?.contains(t) && !t.closest('.gd-fab')) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const go = (link?: string) => {
    if (!link) return;
    onClose();
    navigate(link);
  };
  const ask = (text: string) => {
    setQ(text);
    setAsked(text);
  };

  return (
    <div className="gd-panel" role="dialog" aria-label="Guide" ref={box}>
      <header className="gd-head">
        <div>
          <b>Guide</b>
          <span>{guide.name} portal</span>
        </div>
        <button type="button" className="gd-x" onClick={onClose} aria-label="Close the guide">
          ×
        </button>
      </header>

      <form
        className="gd-ask"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(q.trim());
        }}
      >
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value.trim()) setAsked('');
          }}
          placeholder="Ask: where are my certificates?"
          aria-label="Ask the guide"
        />
        <button type="submit" className="gd-ask-go" disabled={!q.trim()}>
          Ask
        </button>
      </form>

      <div className="gd-body">
        {asked ? (
          results.length ? (
            <>
              <p className="gd-label">Here is what I found</p>
              {results.map((r) => (
                <Answer key={r.title} entry={r} onGo={go} />
              ))}
            </>
          ) : (
            <div className="gd-none">
              <p>
                I could not find that. Try other words, or pick a place below - every section of the {guide.name.toLowerCase()} portal:
              </p>
              <ul className="gd-sections">
                {guide.tour
                  .filter((s) => s.link)
                  .map((s) => (
                    <li key={s.title}>
                      <button type="button" onClick={() => go(s.link)}>
                        <b>{s.title}</b>
                        <span>{s.text}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )
        ) : (
          <>
            {here && (
              <>
                <p className="gd-label">On this page</p>
                <Answer entry={here} onGo={go} current />
              </>
            )}
            <p className="gd-label">People often ask</p>
            <div className="gd-chips">
              {guide.suggestions.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="gd-foot">
        <button type="button" className="gd-tour" onClick={onTour}>
          ▶ Take the tour again
        </button>
      </footer>
    </div>
  );
}

function Answer({ entry, onGo, current }: { entry: GuideEntry; onGo: (link?: string) => void; current?: boolean }) {
  return (
    <div className="gd-answer">
      <b>{entry.title}</b>
      <p>{entry.answer}</p>
      {entry.link && !current && (
        <button type="button" className="gd-go" onClick={() => onGo(entry.link)}>
          Take me there →
        </button>
      )}
    </div>
  );
}

/** The walkthrough: a welcome, one step per place, and where the Guide lives. */
function Tour({
  name,
  welcome,
  steps,
  firstName,
  onDone,
}: {
  name: string;
  welcome: string;
  steps: { title: string; text: string; link?: string }[];
  firstName: string;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const all = [{ title: `Welcome${firstName ? `, ${firstName}` : ''}`, text: welcome }, ...steps, { title: 'Stuck? Ask the Guide', text: 'The Guide button at the bottom right answers "where is…" and "how do I…" questions and takes you there. You can replay this tour from it any time.' }];
  const [at, setAt] = useState(0);
  const step = all[at]!;
  const last = at === all.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      if (e.key === 'ArrowRight' && !last) setAt((a) => a + 1);
      if (e.key === 'ArrowLeft' && at > 0) setAt((a) => a - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, last, onDone]);

  return (
    <div className="gd-tour-backdrop" role="dialog" aria-modal="true" aria-label={`${name} portal tour`}>
      <div className="gd-tour-card">
        <div className="gd-tour-top">
          <span className="gd-tour-kicker">
            {at === 0 ? `${name} portal` : at === all.length - 1 ? 'Last step' : `Where things are · ${at} of ${steps.length}`}
          </span>
          <button type="button" className="gd-x" onClick={onDone} aria-label="Skip the tour">
            ×
          </button>
        </div>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
        {'link' in step && step.link && (
          <button
            type="button"
            className="gd-show"
            onClick={() => {
              navigate(step.link!);
            }}
          >
            Show me {step.title} →
          </button>
        )}
        <div className="gd-tour-dots" aria-hidden="true">
          {all.map((s, i) => (
            <span key={s.title} className={i === at ? 'is-on' : i < at ? 'is-done' : ''} />
          ))}
        </div>
        <div className="gd-tour-foot">
          <button type="button" className="gd-skip" onClick={onDone}>
            Skip tour
          </button>
          <span>
            {at > 0 && (
              <button type="button" className="gd-back" onClick={() => setAt(at - 1)}>
                ← Back
              </button>
            )}
            <button type="button" className="gd-next" onClick={() => (last ? onDone() : setAt(at + 1))}>
              {last ? 'Done' : at === 0 ? 'Show me around →' : 'Next →'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
