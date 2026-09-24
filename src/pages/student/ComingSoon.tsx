import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import './ComingSoon.css';

/**
 * A section that is on the menu but not built yet.
 *
 * On the menu deliberately: a student planning their final year should be
 * able to see what the portal will do for them, and a menu that grows one
 * item at a time never shows the shape of the thing. What it must not do is
 * pretend - so each one says plainly that it is not here yet, what it will
 * do, and where to go in the meantime.
 */
export default function ComingSoon({
  title,
  what,
  soon,
  instead,
}: {
  title: string;
  /** One line on what this will be for. */
  what: string;
  /** The two or three things it will actually do. */
  soon: string[];
  /** Somewhere useful to be in the meantime. */
  instead?: { to: string; label: string };
}) {
  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Student</p>
          <h1>{title}</h1>
          <p className="page-lede">{what}</p>
        </div>
      </header>

      <section className="soon">
        <span className="soon-badge">Not here yet</span>
        <h2>We are still building this</h2>
        <p className="soon-lede">
          It is on the menu so you can see where the portal is going. Nothing on this page works
          yet, and you will not miss anything by ignoring it until it does.
        </p>

        <p className="soon-label">What it will do</p>
        <ul className="soon-list">
          {soon.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {instead && (
          <p className="soon-instead">
            In the meantime: <Link to={instead.to}>{instead.label}</Link>
          </p>
        )}
      </section>
    </StudentLayout>
  );
}
