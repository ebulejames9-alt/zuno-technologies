#!/usr/bin/env bash
# End-to-end smoke test against a running ZUNO instance (Postgres-backed).
# Usage: BASE=http://localhost:3001 bash tools/e2e-pg.sh
set -u
BASE="${BASE:-http://localhost:3001}"
J=/tmp/zuno-e2e; mkdir -p $J
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "  ok   $1 ($2)"; pass=$((pass+1)); else echo "  FAIL $1 (got $2, want $3)"; fail=$((fail+1)); fi; }

echo "== health =="
check "health" "$(curl -s $BASE/api/health | jq -r .ok)" "true"

echo "== public content =="
check "content care_email" "$(curl -s $BASE/api/content | jq -r .settings.care_email)" "zunocustomerscare@gmail.com"
check "products >= 3" "$(curl -s $BASE/api/products | jq 'length >= 3')" "true"
check "faqs >= 6" "$(curl -s $BASE/api/faqs | jq 'length >= 6')" "true"
check "home 200" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/)" "200"
check "about 200" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/about)" "200"
check "products page 200" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/products)" "200"
check "admin page 200" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/admin)" "200"
check "portal page 200" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/portal)" "200"

echo "== contact form =="
check "contact invalid email rejected" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/contact -H 'Content-Type: application/json' -d '{"name":"A B","email":"bad","message":"hello there friend"}')" "400"
check "contact valid accepted" "$(curl -s -X POST $BASE/api/contact -H 'Content-Type: application/json' -d '{"name":"Ada Test","email":"ada@example.com","subject":"Hi","message":"This is a genuine enquiry about your products."}' | jq -r .ok)" "true"

echo "== admin auth =="
check "admin bad login 401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/admin/login -H 'Content-Type: application/json' -d '{"email":"ebulejames9@gmail.com","password":"wrong"}')" "401"
curl -s -c $J/admin.txt -X POST $BASE/api/admin/login -H 'Content-Type: application/json' -d '{"email":"ebulejames9@gmail.com","password":"JuiceWrld999.@52"}' > $J/adminlogin.json
check "admin login ok" "$(jq -r .ok $J/adminlogin.json)" "true"
check "admin me" "$(curl -s -b $J/admin.txt $BASE/api/admin/me | jq -r .admin.email)" "ebulejames9@gmail.com"
check "admin overview" "$(curl -s -b $J/admin.txt $BASE/api/admin/overview | jq 'has("stats") or has("counts") or (.products != null) or (.customers != null)')" "true"
check "admin messages" "$(curl -s -b $J/admin.txt $BASE/api/admin/messages | jq 'length >= 1')" "true"
check "admin protected without cookie 401" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/admin/overview)" "401"

echo "== customer portal =="
R1=$(curl -s -X POST $BASE/api/portal/register -H 'Content-Type: application/json' -d '{"name":"Jane Tester","email":"jane.t@example.com","password":"Passw0rd123"}' | jq -r .ok)
check "register jane" "$R1" "true"
curl -s -c $J/jane.txt -X POST $BASE/api/portal/login -H 'Content-Type: application/json' -d '{"email":"jane.t@example.com","password":"Passw0rd123"}' >/dev/null
check "jane me" "$(curl -s -b $J/jane.txt $BASE/api/portal/me | jq -r .customer.email)" "jane.t@example.com"
TID=$(curl -s -b $J/jane.txt -X POST $BASE/api/portal/tickets -H 'Content-Type: application/json' -d '{"category":"Technical","subject":"App issue","description":"I cannot log in to LINKUP."}' | jq -r .id)
check "jane created ticket" "$([ -n "$TID" ] && [ "$TID" != "null" ] && echo yes)" "yes"
check "jane sees own ticket" "$(curl -s -b $J/jane.txt $BASE/api/portal/tickets/$TID | jq -r .ticket.id)" "$TID"

echo "== isolation (IDOR) =="
curl -s -X POST $BASE/api/portal/register -H 'Content-Type: application/json' -d '{"name":"Bob Other","email":"bob.o@example.com","password":"Passw0rd123"}' >/dev/null
curl -s -c $J/bob.txt -X POST $BASE/api/portal/login -H 'Content-Type: application/json' -d '{"email":"bob.o@example.com","password":"Passw0rd123"}' >/dev/null
check "bob blocked from jane ticket" "$(curl -s -o /dev/null -w '%{http_code}' -b $J/bob.txt $BASE/api/portal/tickets/$TID)" "404"

echo "== admin replies, customer sees it =="
check "admin reply" "$(curl -s -b $J/admin.txt -X POST $BASE/api/admin/tickets/$TID/reply -H 'Content-Type: application/json' -d '{"message":"Thanks, we are looking into this."}' | jq -r .ok)" "true"
check "jane sees reply" "$(curl -s -b $J/jane.txt $BASE/api/portal/tickets/$TID | jq '[.replies[] | select(.author_type=="admin")] | length >= 1')" "true"

echo
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ] && echo "E2E: PASS" || echo "E2E: FAIL"
exit $fail
