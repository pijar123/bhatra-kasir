#!/bin/bash
# Siapkan database e2e (port 5433, socket /tmp/pg) dan jalankan PostgREST di :3001.
set -e
D="$(cd "$(dirname "$0")" && pwd)"; T="$D/../supabase/tests"
P="psql -h /tmp/pg -p 5433 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists e2e with (force)" -c "create database e2e" >/dev/null
for f in "$T/00_shim.sql" "$T/01_v1_snapshot.sql" "$D"/../supabase/migrations/*.sql "$D/setup.sql"; do $P -d e2e -f "$f" >/dev/null; done
pkill -f "postgrest $D/pgrst.conf" 2>/dev/null || true
cat > "$D/pgrst.conf" <<C
db-uri = "postgres://postgres@/e2e?host=/tmp/pg&port=5433"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "rahasia-e2e-yang-panjang-sekali-minimal-32"
server-port = 3001
C
nohup "${PGRST:-/home/claude/e2e/postgrest}" "$D/pgrst.conf" > /tmp/pgrst.log 2>&1 &
sleep 1.5; curl -s localhost:3001/ -o /dev/null -w "postgrest %{http_code}\n"
