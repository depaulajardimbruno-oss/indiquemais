#!/usr/bin/env bash
# Roda migrações + testes num Postgres local de teste (nunca no Supabase de verdade).
# Uso: supabase/tests/run_local.sh   (precisa de postgres 16 e do usuário "postgres")
set -u
PGB=$(ls -d /usr/lib/postgresql/*/bin | head -1)
D=/tmp/pg/data; SOCK=/tmp/pg; PORT=5544
su postgres -c "$PGB/pg_ctl -D $D status" >/dev/null 2>&1 || su postgres -c "$PGB/pg_ctl -D $D -o '-p $PORT -k $SOCK' -l /tmp/pg/log start" >/dev/null
sleep 2
P="psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=0 -q"
$P -d postgres -c "drop database if exists t" -c "create database t" >/dev/null 2>&1
R=$(cd "$(dirname "$0")/.." && pwd)
$P -d t -f "$R/tests/supabase_stub.sql" >/tmp/pg/stub.err 2>&1
for f in "$R"/migrations/*.sql; do echo "== $(basename $f)"; $P -d t -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -i "error" ; done
for f in "$R"/tests/security_smoke.sql "$R"/tests/plans_seals.sql "$R"/tests/groups_ranking.sql "$R"/tests/billing_tax.sql "$R"/tests/rule_snapshot.sql "$R"/tests/indicator_signup.sql "$R"/tests/company_panel.sql; do [ -f "$f" ] && { echo "== $(basename $f)"; $P -d t -f "$f" 2>&1 | grep -v '^$'; }; done
