// Getting the article text: PDF (read in the browser with pdf.js), text/markdown
// files, pasted text, or a URL (best effort: most sites block cross-site reads).
import * as pdfjs from './vendor/pdfjs/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

export const MAX_CHARS = 60_000;

export async function readFile(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => it.str).join(' '));
    }
    return pages.join('\n\n');
  }
  return file.text();
}

export async function readUrl(url) {
  let res;
  try {
    res = await fetch(url, { mode: 'cors' });
  } catch {
    throw new Error('This site does not let other pages read it. Open the article, copy the text, and paste it here.');
  }
  if (!res.ok) throw new Error(`Could not load the page (${res.status}). Paste the text instead.`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,nav,header,footer,aside,noscript,form').forEach((n) => n.remove());
  const main = doc.querySelector('article, main') || doc.body;
  return (doc.title ? doc.title + '\n\n' : '') + main.innerText.replace(/\n{3,}/g, '\n\n').trim();
}

/** Trim very long articles, and say so. */
export function prepare(text) {
  const clean = String(text || '').replace(/\u0000/g, '').trim();
  if (clean.length <= MAX_CHARS) return { text: clean, trimmed: false };
  return { text: clean.slice(0, MAX_CHARS), trimmed: true };
}
