import { esc } from './helpers.js';

/* ---------- Rich text (markdown-lite): **fett**, - Liste, 1. Liste, [Text](url), ==nicht übersetzen== ---------- */
const mdInline = s => s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/==([^=]+)==/g, '<span class="keep">$1</span>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (m, p, u) => p + '<a href="'+u+'" target="_blank" rel="noopener">'+u+'</a>');

function mdToHtml(src){
  const lines = String(src||'').split(/\r?\n/); let out = '', list = null; const closeList = () => { if(list){ out += `</${list}>`; list = null; } };
  for(const raw of lines){ const line = esc(raw); let m;
    if((m = /^\s*[-*•]\s+(.*)$/.exec(line))){ if(list!=='ul'){ closeList(); out += '<ul>'; list='ul'; } out += `<li>${mdInline(m[1])}</li>`; }
    else if((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))){ if(list!=='ol'){ closeList(); out += '<ol>'; list='ol'; } out += `<li>${mdInline(m[1])}</li>`; }
    else { closeList(); if(line.trim()!=='') out += `<p>${mdInline(line)}</p>`; } }
  closeList(); return out;
}

const titleHtml = s => mdInline(esc(String(s||'')));

const mdToPlain = src => String(src||'').split(/\r?\n/).map(l => l.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/==([^=]+)==/g,'$1').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'$1 ($2)').replace(/^\s*[-*•]\s+/, '• ')).join('\n');

export { mdInline, mdToHtml, titleHtml, mdToPlain };
