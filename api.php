<?php
// api.php — backend ng attendance. Naka-save sa data.json (walang database na kailangan).
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Manila');

$file = __DIR__ . '/data.json';
if (!file_exists($file)) file_put_contents($file, '{}');

function load($file) {
    $d = json_decode(file_get_contents($file), true);
    return is_array($d) ? $d : [];
}
function save($file, $d) {
    file_put_contents($file, json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}
function reply($ok, $msg, $records, $code = 200) {
    http_response_code($code);
    krsort($records);
    echo json_encode([
        'ok' => $ok,
        'message' => $msg,
        'today' => date('Y-m-d'),
        'records' => array_values(array_map(fn($d, $r) => ['date' => $d] + $r, array_keys($records), $records)),
    ]);
    exit;
}

$records = load($file);
$action  = $_POST['action'] ?? 'list';
$today   = date('Y-m-d');
$now     = date('H:i:s');

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $action !== 'list') {
    reply(false, 'POST lang ang pinapayagan.', $records, 405);
}

switch ($action) {
    case 'timein':
        if (!empty($records[$today]['in'])) {
            reply(false, 'Naka-time in ka na ngayong araw.', $records, 409);
        }
        $records[$today] = ['in' => $now, 'out' => null, 'note' => trim($_POST['note'] ?? '')];
        save($file, $records);
        reply(true, "Time in: " . date('h:i A'), $records);

    case 'timeout':
        if (empty($records[$today]['in'])) {
            reply(false, 'Mag-time in ka muna.', $records, 409);
        }
        if (!empty($records[$today]['out'])) {
            reply(false, 'Naka-time out ka na ngayong araw.', $records, 409);
        }
        $records[$today]['out'] = $now;
        save($file, $records);
        reply(true, "Time out: " . date('h:i A'), $records);

    case 'note':
        $d = $_POST['date'] ?? '';
        if (!isset($records[$d])) reply(false, 'Walang record sa petsang iyon.', $records, 404);
        $records[$d]['note'] = trim($_POST['note'] ?? '');
        save($file, $records);
        reply(true, 'Na-save ang note.', $records);

    case 'delete':
        $d = $_POST['date'] ?? '';
        if (!isset($records[$d])) reply(false, 'Walang record sa petsang iyon.', $records, 404);
        unset($records[$d]);
        save($file, $records);
        reply(true, 'Nabura ang record.', $records);

    case 'reset':
        $records = [];
        save($file, $records);
        reply(true, 'Na-restart na. Wala nang record.', $records);

    default:
        reply(true, '', $records);
}
