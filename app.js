// app.js — logic ng frontend
const $ = (id) => document.getElementById(id);
let records = [];
let today = '';

// ---------- API ----------
// Kapag may PHP server (XAMPP, php -S, hosting), si api.php ang gagamitin at sa data.json ise-save.
// Kapag wala (hal. GitHub Pages), awtomatikong gagamit ng localStorage sa browser na ito.
const KEY = 'attendance-records';
let mode = 'server';

const manila = () => ({
  date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
  time: new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour12: false }),
});

function localApi(action, data) {
  let db = {};
  try { db = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const { date: d, time: t } = manila();
  let ok = true, message = '';
  const fail = (m) => { ok = false; message = m; };

  if (action === 'timein') {
    if (db[d]?.in) fail('Naka-time in ka na ngayong araw.');
    else { db[d] = { in: t, out: null, note: (data.note || '').trim(), loc: data.lat ? { lat: +data.lat, lng: +data.lng, acc: +data.acc || 0, place: data.place || '' } : null }; message = 'Time in: ' + fmtTime(t); }
  } else if (action === 'timeout') {
    if (!db[d]?.in) fail('Mag-time in ka muna.');
    else if (db[d].out) fail('Naka-time out ka na ngayong araw.');
    else { db[d].out = t; db[d].loc_out = data.lat ? { lat: +data.lat, lng: +data.lng, acc: +data.acc || 0, place: data.place || '' } : null; message = 'Time out: ' + fmtTime(t); }
  } else if (action === 'note') {
    if (!db[data.date]) fail('Walang record sa petsang iyon.');
    else { db[data.date].note = (data.note || '').trim(); message = 'Na-save ang note.'; }
  } else if (action === 'delete') {
    if (!db[data.date]) fail('Walang record sa petsang iyon.');
    else { delete db[data.date]; message = 'Nabura ang record.'; }
  } else if (action === 'reset') {
    db = {}; message = 'Na-restart na. Wala nang record.';
  }

  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { fail('Hindi ma-save sa browser.'); }
  const records = Object.keys(db).sort().reverse().map((k) => ({ date: k, ...db[k] }));
  return { ok, message, today: d, records };
}

async function api(action, data = {}) {
  let json;
  if (mode === 'server') {
    try {
      const res = await fetch('api.php', { method: 'POST', body: new URLSearchParams({ action, ...data }) });
      json = await res.json();
    } catch (e) {
      mode = 'local'; // walang PHP, lumipat sa localStorage
    }
  }
  if (mode === 'local') json = localApi(action, data);

  records = json.records || records;
  today = json.today || today;
  if (json.message) toast(json.message, json.ok);
  if ($('storage')) $('storage').textContent = mode === 'server'
    ? 'Naka-save sa data.json (PHP server).'
    : 'Naka-save sa browser na ito (localStorage). Hindi ito makikita sa ibang device.';
  render();
  return json;
}

// ---------- Lokasyon ----------
function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: 'Hindi supported ng browser ang location.' });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }),
      (e) => resolve({ error: e.code === 1 ? 'Hindi pinayagan ang location access.' : 'Hindi makuha ang lokasyon.' }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

// Reverse geocoding gamit ang OpenStreetMap Nominatim (libre). Kung pumalya, coordinates na lang ang itatabi.
async function getPlace(lat, lng) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=en&lat=${lat}&lon=${lng}`, { signal: ctl.signal });
    clearTimeout(timer);
    const j = await res.json();
    return j.display_name || '';
  } catch (e) {
    return '';
  }
}

const mapUrl = (l) => `https://www.google.com/maps?q=${l.lat},${l.lng}`;
const placeText = (l) => l.place || `${l.lat}, ${l.lng}`;
const locLink = (l) => `<a href="${mapUrl(l)}" target="_blank" rel="noopener" title="${esc(placeText(l))} (±${l.acc || '?'} m)">${esc(placeText(l))}</a>`;
const locCell = (l, show = true) => (show && l ? locLink(l) : '—');

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
    ? `Naka-time in ka mula ${fmtTime(rec.in)}${rec.loc ? ' sa ' + placeText(rec.loc) : ' (walang lokasyon)'}.`
    : `Tapos na: ${fmtTime(rec.in)} – ${fmtTime(rec.out)} (${fmtDur(secs(rec))})${rec.loc_out ? '. Time out sa ' + placeText(rec.loc_out) : ''}`;

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
        <td class="loc">${locCell(r.loc, r.in)}</td>
        <td class="loc">${locCell(r.loc_out, r.out)}</td>
        <td><input class="inline" value="${esc(r.note)}" data-date="${r.date}" placeholder="Magdagdag ng note" aria-label="Note"></td>
        <td><button class="del" data-del="${r.date}" aria-label="Burahin ang record">Burahin</button></td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="empty">Wala pang record sa buwang ito. Pindutin ang Time In para magsimula.</td></tr>';
}

// ---------- Events ----------
async function stamp(btn, label, action, extra = {}) {
  btn.disabled = true;
  btn.textContent = 'Kinukuha ang lokasyon…';
  const pos = await getPosition();
  const data = { ...extra };
  if (!pos.error) {
    Object.assign(data, pos);
    data.place = await getPlace(pos.lat, pos.lng);
  }
  btn.textContent = label;
  const json = await api(action, data);
  if (pos.error && json && json.ok) toast(pos.error + ' Walang lokasyon ang record na ito.', false);
}
$('btnIn').addEventListener('click', () => stamp($('btnIn'), 'Time In', 'timein', { note: $('note').value }));
$('btnOut').addEventListener('click', () => stamp($('btnOut'), 'Time Out', 'timeout'));
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
  const csv = ['Date,Time In,Time Out,Hours,In Location,In Latitude,In Longitude,Out Location,Out Latitude,Out Longitude,Note']
    .concat(rows.map((r) => [r.date, r.in || '', r.out || '', (secs(r) / 3600).toFixed(2), `"${(r.loc?.place || '').replace(/"/g, '""')}"`, r.loc?.lat ?? '', r.loc?.lng ?? '', `"${(r.loc_out?.place || '').replace(/"/g, '""')}"`, r.loc_out?.lat ?? '', r.loc_out?.lng ?? '', `"${(r.note || '').replace(/"/g, '""')}"`].join(',')))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `attendance-${$('month').value}.csv`;
  a.click();
});

// ---------- Simula ----------
$('month').value = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 7);
api('list');
