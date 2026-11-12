// app.js — logic ng frontend
const $ = (id) => document.getElementById(id);
let records = [];
let today = '';

// ---------- API ----------
async function api(action, data = {}) {
  const body = new URLSearchParams({ action, ...data });
  try {
    const res = await fetch('api.php', { method: 'POST', body });
    const json = await res.json();
    records = json.records || records;
    today = json.today || today;
    if (json.message) toast(json.message, json.ok);
    render();
  } catch (e) {
    toast('Hindi maabot ang server. Tiyaking tumatakbo ang PHP.', false);
  }
}

// ---------- Orasan ----------
function tick() {
  const d = new Date();
  $('clock').textContent = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('date').textContent = d.toLocaleDateString('fil-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(tick, 1000);
tick();

// ---------- Helpers ----------
const fmtTime = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const toSec = (t) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };
const secs = (r) => (r.in && r.out ? Math.max(0, toSec(r.out) - toSec(r.in)) : 0);
const fmtDur = (s) => (s ? `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m` : '—');
const fmtDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('fil-PH', { weekday: 'short', month: 'short', day: 'numeric' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
function toast(msg, ok = true) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'show ' + (ok ? 'ok' : 'err');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 2800);
}

// ---------- Render ----------
function render() {
  const rec = records.find((r) => r.date === today);
  const hasIn = rec && rec.in, hasOut = rec && rec.out;

  $('btnIn').disabled = !!hasIn;
  $('btnOut').disabled = !hasIn || !!hasOut;
  $('note').disabled = !!hasIn;
  $('status').textContent = !hasIn
    ? 'Hindi ka pa naka-time in ngayon.'
    : !hasOut
    ? `Naka-time in ka mula ${fmtTime(rec.in)}.`
    : `Tapos na: ${fmtTime(rec.in)} – ${fmtTime(rec.out)} (${fmtDur(secs(rec))})`;

  const month = $('month').value;
  const rows = records.filter((r) => r.date.startsWith(month));
  const total = rows.reduce((a, r) => a + secs(r), 0);
  $('days').textContent = rows.length;
  $('hours').textContent = fmtDur(total);
  $('avg').textContent = fmtDur(rows.filter((r) => r.out).length ? total / rows.filter((r) => r.out).length : 0);

  $('rows').innerHTML = rows.length
    ? rows.map((r) => `
      <tr>
        <td>${fmtDay(r.date)}</td>
        <td>${fmtTime(r.in)}</td>
        <td>${fmtTime(r.out)}</td>
        <td>${r.out ? fmtDur(secs(r)) : r.in ? 'Ongoing' : '—'}</td>
        <td><input class="inline" value="${esc(r.note)}" data-date="${r.date}" placeholder="Magdagdag ng note" aria-label="Note"></td>
        <td><button class="del" data-del="${r.date}" aria-label="Burahin ang record">Burahin</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty">Wala pang record sa buwang ito. Pindutin ang Time In para magsimula.</td></tr>';
}

// ---------- Events ----------
$('btnIn').addEventListener('click', () => api('timein', { note: $('note').value }));
$('btnOut').addEventListener('click', () => api('timeout'));
$('month').addEventListener('change', render);

$('rows').addEventListener('click', (e) => {
  const d = e.target.dataset.del;
  if (d && confirm(`Burahin ang record ng ${fmtDay(d)}?`)) api('delete', { date: d });
});
$('rows').addEventListener('change', (e) => {
  if (e.target.classList.contains('inline')) api('note', { date: e.target.dataset.date, note: e.target.value });
});

$('restart').addEventListener('click', () => {
  if (confirm('I-restart ang attendance? Mabubura ang LAHAT ng record at hindi na ito maibabalik.')) api('reset');
});

$('export').addEventListener('click', () => {
  const rows = records.filter((r) => r.date.startsWith($('month').value));
  const csv = ['Date,Time In,Time Out,Hours,Note']
    .concat(rows.map((r) => [r.date, r.in || '', r.out || '', (secs(r) / 3600).toFixed(2), `"${(r.note || '').replace(/"/g, '""')}"`].join(',')))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `attendance-${$('month').value}.csv`;
  a.click();
});

// ---------- Simula ----------
$('month').value = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 7);
api('list');
