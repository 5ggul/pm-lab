# -*- coding: utf-8 -*-
"""
로컬 워처 데이터를 10분마다 GitHub(data/*_local.jsonl)로 동기화.
사이트 대시보드가 클라우드 수집분과 로컬 수집분을 합쳐 보이게 한다.
키·실거래 파일은 .gitignore로 차단되어 있어 절대 올라가지 않는다.

실행: python local_sync.py
"""

import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PAIRS = [
    ("updown_trades.jsonl", "data/updown_trades_local.jsonl"),
    ("updown_windows.jsonl", "data/updown_windows_local.jsonl"),
]
INTERVAL = 600


def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True).returncode


def main():
    last = {}
    print(f"로컬 동기화 시작 (간격 {INTERVAL}s)")
    while True:
        try:
            changed = False
            for src, dst in PAIRS:
                try:
                    with open(src, "rb") as f:
                        data = f.read()
                except FileNotFoundError:
                    continue
                if last.get(src) != len(data):
                    shutil.copyfile(src, dst)
                    last[src] = len(data)
                    changed = True
            if changed:
                ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
                run("git", "add", "data/updown_trades_local.jsonl",
                    "data/updown_windows_local.jsonl")
                if run("git", "commit", "-q", "-m", f"data: local sync {ts}") == 0:
                    for _ in range(3):
                        if run("git", "push", "-q") == 0:
                            print(f"[{ts}] 동기화 푸시 완료")
                            break
                        run("git", "pull", "-q", "--rebase", "--autostash")
        except Exception as e:
            print(f"동기화 오류(다음 주기 재시도): {e}")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
