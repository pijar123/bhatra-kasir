#!/bin/bash
# Jalankan uji migrasi di Postgres lokal (port 5433, socket /tmp/pg).
set -e
# Nyalakan Postgres lokal kalau mati (data di /tmp/pg/data).
pg_isready -q -h /tmp/pg -p 5433 || su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pg/data -l /tmp/pg/log -o '-p 5433 -k /tmp/pg' -w start" >/dev/null
P="psql -h /tmp/pg -p 5433 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists uji" -c "create database uji" >/dev/null 2>&1
cd "$(dirname "$0")"
for f in 00_shim.sql 01_v1_snapshot.sql ../migrations/*.sql; do $P -d uji -f "$f" >/dev/null 2>&1 || { echo "migrasi gagal di $f"; $P -d uji -f "$f" 2>&1 | grep -i error | head; exit 1; }; done
$P -d uji -f 10_uji.sql 2>&1 | grep -E "lulus|GAGAL|ERROR|SEMUA" | sed 's/^psql:[^ ]* //'
