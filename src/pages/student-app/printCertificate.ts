import type { Certificate } from '../../api/studentApp';
import { LEVEL_LABEL } from '../../api/studentApp';

/** Text made safe to put inside HTML. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const longDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/**
 * Opens one certificate on its own page, laid out for paper - A4 landscape -
 * and asks the browser to print it, where "Save as PDF" gives a clean file.
 *
 * It is its own small document rather than the app page printed, so nothing
 * from the app's layout (menus, panels, sticky bars) can spill onto it.
 * Must be called from a click, or the browser may block the new tab.
 */
export function printCertificate(c: Certificate, studentName: string) {
  const w = window.open('', '_blank');
  if (!w) return false;

  const company = c.simulation.company.name;
  const initials = company
    .split(/\s+/)
    .filter((x) => /[A-Za-z]/.test(x))
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join('');
  const code = c.certificateCode ?? '';
  const verify = `${window.location.origin}/certificates/${code}`;
  const skills = c.simulation.skills.slice(0, 5);
  const logo = c.simulation.company.logoUrl
    ? `<img src="${esc(c.simulation.company.logoUrl)}" alt="" />`
    : `<span>${esc(initials)}</span>`;

  w.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Certificate - ${esc(c.simulation.title)} - ${esc(studentName)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 297mm; height: 210mm; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
    color: #0d1b3e;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    position: relative;
    width: 297mm;
    height: 210mm;
    padding: 12mm;
    background:
      radial-gradient(ellipse 55% 45% at 100% 0%, #e6ecff 0%, transparent 70%),
      radial-gradient(ellipse 45% 40% at 0% 100%, #dbf4ea 0%, transparent 70%),
      #ffffff;
  }
  .frame {
    position: relative;
    height: 100%;
    border: 2.5px solid #2453ff;
    border-radius: 6mm;
    padding: 4mm;
  }
  .inner {
    height: 100%;
    border: 1px solid #b9c7ff;
    border-radius: 4mm;
    padding: 12mm 18mm 10mm;
    display: flex;
    flex-direction: column;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand {
    font-size: 22pt;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0d1b3e;
  }
  .brand b { color: #2453ff; }
  .company {
    display: flex;
    align-items: center;
    gap: 4mm;
    font-size: 12pt;
    font-weight: 700;
  }
  .tile {
    display: grid;
    place-items: center;
    width: 14mm;
    height: 14mm;
    border-radius: 3mm;
    background: #2453ff;
    color: #fff;
    font-size: 13pt;
    font-weight: 800;
    overflow: hidden;
  }
  .tile img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .middle {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .kind {
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: #2453ff;
  }
  .rule {
    width: 60mm;
    height: 0;
    margin: 4mm auto 6mm;
    border-top: 1.5px solid #2453ff;
  }
  .lead { font-size: 12pt; color: #4a5878; }
  .name {
    margin: 4mm 0 5mm;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 36pt;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #0d1b3e;
  }
  .what {
    max-width: 200mm;
    font-size: 13pt;
    line-height: 1.55;
    color: #4a5878;
  }
  .what b { color: #0d1b3e; }
  .facts {
    display: flex;
    gap: 3mm;
    margin-top: 6mm;
    flex-wrap: wrap;
    justify-content: center;
  }
  .facts span {
    padding: 1.5mm 4mm;
    border-radius: 99mm;
    background: #f3f6fc;
    border: 1px solid #e3e8f2;
    font-size: 9.5pt;
    font-weight: 600;
    color: #4a5878;
  }
  .skills { margin-top: 3mm; font-size: 9.5pt; color: #8591ad; }
  .bottom {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    gap: 10mm;
  }
  .sign { text-align: center; }
  .sign .line { border-top: 1px solid #0d1b3e; margin-bottom: 2mm; }
  .sign b { display: block; font-size: 11pt; }
  .sign i { font-style: normal; font-size: 9pt; color: #8591ad; }
  .seal {
    display: grid;
    place-items: center;
    width: 28mm;
    height: 28mm;
    border-radius: 50%;
    background: #0f9a6d;
    color: #fff;
    box-shadow: 0 0 0 2mm #dbf4ea, 0 0 0 3mm #0f9a6d;
    text-align: center;
    font-weight: 800;
    line-height: 1.1;
  }
  .seal big { display: block; font-size: 18pt; }
  .seal small { display: block; font-size: 6.5pt; letter-spacing: 0.12em; text-transform: uppercase; }
  .verify {
    margin-top: 6mm;
    padding-top: 3mm;
    border-top: 1px dashed #cfd7e6;
    display: flex;
    justify-content: space-between;
    font-size: 8.5pt;
    color: #8591ad;
  }
  .verify b { color: #2453ff; font-family: Consolas, 'Courier New', monospace; font-size: 10pt; }
  .hint {
    position: fixed;
    top: 6mm;
    left: 50%;
    transform: translateX(-50%);
    padding: 3mm 6mm;
    border-radius: 99mm;
    background: #0d1b3e;
    color: #fff;
    font-size: 10pt;
  }
  @media print { .hint { display: none; } }
  @media screen {
    html, body { width: auto; height: auto; }
    body { background: #e9edf5; padding: 16mm 0; }
    .page { margin: 0 auto; box-shadow: 0 10px 40px rgba(13, 27, 62, 0.18); }
  }
</style>
</head>
<body>
  <div class="hint">Choose "Save as PDF" as the printer to keep a copy</div>
  <div class="page">
    <div class="frame"><div class="inner">
      <div class="top">
        <div class="brand">Apli<b>.ai</b></div>
        <div class="company"><span class="tile">${logo}</span>${esc(company)}</div>
      </div>

      <div class="middle">
        <div class="kind">Certificate of completion</div>
        <div class="rule"></div>
        <div class="lead">This certifies that</div>
        <div class="name">${esc(studentName)}</div>
        <div class="what">
          has completed the <b>${esc(c.simulation.title)}</b> work simulation with <b>${esc(company)}</b>,
          and the company reviewed and approved the work.
        </div>
        <div class="facts">
          <span>${esc(c.simulation.field)}</span>
          <span>${esc(LEVEL_LABEL[c.simulation.level])}</span>
          <span>${c.simulation.tasks} task${c.simulation.tasks === 1 ? '' : 's'}</span>
          <span>About ${c.simulation.hours} hours</span>
        </div>
        ${skills.length ? `<div class="skills">Skills: ${skills.map(esc).join(' · ')}</div>` : ''}
      </div>

      <div class="bottom">
        <div class="sign">
          <div class="line"></div>
          <b>${esc(company)}</b>
          <i>Reviewed and approved the work</i>
        </div>
        <div class="seal"><span><big>✓</big><small>Verified</small></span></div>
        <div class="sign">
          <div class="line"></div>
          <b>${esc(longDate(c.completedAt))}</b>
          <i>Date issued</i>
        </div>
      </div>

      <div class="verify">
        <span>Certificate code <b>${esc(code)}</b></span>
        <span>Check it is real: ${esc(verify)}</span>
      </div>
    </div></div>
  </div>
  <script>
    window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });
  </script>
</body>
</html>`);
  w.document.close();
  return true;
}
