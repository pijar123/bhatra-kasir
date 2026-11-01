#!/bin/bash
# Satu perintah: nyalakan Postgres, siapkan DB + PostgREST, jalankan server uji, jalankan semua uji browser.
cd "$(dirname "$0")"
pg_isready -q -h /tmp/pg -p 5433 || su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pg/data -l /tmp/pg/log -o '-p 5433 -k /tmp/pg' -w start" >/dev/null 2>&1
./setup.sh >/dev/null 2>&1
node server.js > /tmp/e2e-server.log 2>&1 & SRV=$!
sleep 1; node uji.js; R=$?; kill $SRV; exit $R
