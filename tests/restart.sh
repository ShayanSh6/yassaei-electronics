#!/bin/bash
# راه‌اندازی مجدد سرور با دیتابیس تمیز (برای تست)
cd "$(dirname "$0")/.."
PID=$(ss -ltnp 2>/dev/null | grep ':3000' | grep -oP 'pid=\K[0-9]+' | head -1)
[ -n "$PID" ] && kill -9 $PID
sleep 1
if [ "$1" = "clean" ]; then rm -f data/db.json data/db.tmp.json; fi
BM_RATE_SCALE=${BM_RATE_SCALE:-6} nohup env PORT=3000 node server/main.mjs > /tmp/srv.log 2>&1 &
sleep 3
