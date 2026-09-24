import { useEffect, useRef } from 'react';
import './RichText.css';

/**
 * The one rich-text box on this platform.
 *
 * Shared rather than copied: a company post and a campus post are both
 * somebody's HTML put in front of somebody else's browser, and two editors
 * would mean two sets of tags to keep the server's allowlist in step with.
 *
 * What it produces is never trusted. The server sanitises on the way in
 * against a tight allowlist, so the worst a strange browser can do here is
 * produce markup that gets thrown away before it is stored.
 */

/** The toolbar, in the order they are reached for. */
const TOOLS: { cmd: string; label: string; title: string; value?: string }[] = [
  { cmd: 'bold', label: 'B', title: 'Bold' },
  { cmd: 'italic', label: 'I', title: 'Italic' },
  { cmd: 'underline', label: 'U', title: 'Underline' },
  { cmd: 'formatBlock', value: 'h3', label: 'H', title: 'Heading' },
  { cmd: 'insertUnorderedList', label: '•', title: 'Bulleted list' },
  { cmd: 'insertOrderedList', label: '1.', title: 'Numbered list' },
];

/**
 * A small rich-text box, built on contentEditable.
 *
 * `document.execCommand` is deprecated and still the only formatting API every
 * browser implements; the alternative is a third-party editor, and this client
 * deliberately carries no UI libraries. What it produces is never trusted
 * anyway - the server sanitises the HTML on the way in, so the worst a strange
 * browser can do here is produce markup that is thrown away.
 */
export default function RichText({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled: boolean;
  /** What the empty box says. Different on every screen that uses it. */
  placeholder: string;
}) {
  const box = useRef<HTMLDivElement>(null);

  /*
   * Written once, on the way in. After that the element owns its contents:
   * setting innerHTML on every keystroke would put the caret back at the
   * start of the box after each letter.
   */
  useEffect(() => {
    if (box.current && box.current.innerHTML !== value) box.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run(cmd: string, arg?: string) {
    if (disabled) return;
    box.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(box.current?.innerHTML ?? '');
  }

  return (
    <div className={`cpost-editor ${disabled ? 'is-off' : ''}`}>
      <div className="cpost-tools" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            aria-label={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.cmd, t.value)}
            disabled={disabled}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          title="Link"
          aria-label="Link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const href = window.prompt('Link to (https only)');
            if (!href) return;
            // Checked again on the server. Asked here so the answer is
            // immediate, rather than a refusal after they press Post.
            if (!/^https:\/\//i.test(href)) {
              window.alert('Links must start with https://');
              return;
            }
            run('createLink', href);
          }}
          disabled={disabled}
        >
          Link
        </button>
        <button
          type="button"
          title="Clear formatting"
          aria-label="Clear formatting"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('removeFormat')}
          disabled={disabled}
        >
          Clear
        </button>
      </div>

      <div
        ref={box}
        className="cpost-input"
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onPaste={(e) => {
          /*
           * Pasting from a website brings its markup with it - colours, spans,
           * tracking links - and every bit of that is stripped on the way in
           * anyway. Plain text is what survives, so plain text is what is
           * pasted, and what appears is what will be stored.
           */
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
          onChange(box.current?.innerHTML ?? '');
        }}
      />
    </div>
  );
}
