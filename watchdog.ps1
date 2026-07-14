# Polymarket 수집기 워치독 — 죽어 있으면 재시작 (Windows 작업 스케줄러가 10분마다 실행)
$proj = 'C:\Users\dhkim\Documents\클코\폴리마켓'

function Ensure($pattern, $cmdline, $log) {
    $running = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.CommandLine -like "*$pattern*" }
    if (-not $running) {
        Start-Process -FilePath cmd -ArgumentList "/c cd /d `"$proj`" && python -u $cmdline >> $log 2>&1" -WindowStyle Hidden
    }
}

Ensure 'updown_watcher.py' 'updown_watcher.py --assets btc,eth,sol --windows 300,900 --poll 4' 'watcher_log.txt'
Ensure 'local_sync.py' 'local_sync.py' 'sync_log.txt'
