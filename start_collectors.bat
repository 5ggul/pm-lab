@echo off
rem start Polymarket collectors (use watchdog.ps1 to avoid duplicates)
cd /d "%~dp0"
start "pm-watcher" /min cmd /c "python -u updown_watcher.py --assets btc,eth,sol --windows 300,900 --poll 4 >> watcher_log.txt 2>&1"
start "pm-sync" /min cmd /c "python -u local_sync.py >> sync_log.txt 2>&1"
