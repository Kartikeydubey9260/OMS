#!/usr/bin/env bash
# Cheap repo-wide checks that catch common AI-generated mistakes. Exit 1 on any finding.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"
bad=0
FRONTEND="packages/OMS/Admin/src/Resources/assets"
[[ -d "$FRONTEND" ]] || { echo "✘ required frontend directory missing: $FRONTEND" >&2; exit 2; }

check() {
  local desc="$1" pattern="$2"; shift 2
  local out
  out=$(grep -rnE "$pattern" "$@" 2>/dev/null | head -20 || true)
  if [[ -n "$out" ]]; then echo "✘ $desc"; echo "$out"; bad=1; else echo "✔ $desc"; fi
}
PHP_PATHS=(app packages)
for d in "${PHP_PATHS[@]}"; do [[ -d "$d" ]] || { echo "✘ required PHP scan path missing: $d" >&2; exit 2; }; done
check "no debug helpers in PHP" '\b(dd|dump|var_dump|ray)\(' "${PHP_PATHS[@]}" --include=*.php
check "no raw SQL with interpolated vars" '(DB::(select|statement|raw|unprepared)|whereRaw|orderByRaw|selectRaw)\([^;]*\$' "${PHP_PATHS[@]}" --include=*.php
check "no request->all() into models" '(create|update|fill|forceFill)\(\$request->all\(\)\)' "${PHP_PATHS[@]}" --include=*.php
check "no float casts for money" "'(price|total|subtotal|tax_amount|discount_amount|unit_price|line_total)' *=> *'(float|double)'" "${PHP_PATHS[@]}" --include=*.php
check "models never set guarded = []" 'guarded *= *\[\]' "${PHP_PATHS[@]}" --include=*.php
check "no console.log/debug in frontend" 'console\.(log|debug)\(' "$FRONTEND" --include=*.ts --include=*.tsx
check "no dangerouslySetInnerHTML" 'dangerouslySetInnerHTML' "$FRONTEND"
check "no localStorage access outside store" 'localStorage\.(get|set)Item' "$FRONTEND" --include=*.ts --include=*.tsx --exclude-dir=store --exclude-dir=stores --exclude-dir=tests
check "no focused/skipped tests" '\.(only|skip|fixme)\(|->(only|skip)\(|\bxit\(|\bxdescribe\(' qa-kit/e2e qa-kit/tests packages/OMS tests "$FRONTEND" --include=*.ts --include=*.tsx --include=*.php
check "no hard waits in e2e" 'waitForTimeout\(|page\.pause\(' qa-kit/e2e
check "no committed secrets/passwords in code" '(DB_PASSWORD|APP_KEY|SECRET|API_KEY)=[^ ]{6,}' app config "$FRONTEND" README.md
if [[ ! -f package-lock.json || ! -f composer.lock ]]; then echo "✘ package-lock.json and composer.lock must be committed"; bad=1; else echo "✔ lockfiles present"; fi
nested_composer=$(find . -name composer.json -not -path './vendor/*' -not -path './.git/*' | grep -v '^./composer.json$' || true)
if [[ -n "$nested_composer" ]]; then echo "✘ nested composer.json found (use the single root composer.json):"; echo "$nested_composer"; bad=1; else echo "✔ single root composer.json"; fi
nested=$(find . -name package.json -not -path './node_modules/*' -not -path './vendor/*' -not -path './public/*' -not -path './.git/*' | grep -v '^./package.json$' || true)
if [[ -n "$nested" ]]; then echo "✘ nested package.json found (use the single root package.json):"; echo "$nested"; bad=1; else echo "✔ single root package.json"; fi
if git rev-parse --git-dir >/dev/null 2>&1; then
  built=$(git ls-files public/build | head -3)
  if [[ -n "$built" ]]; then echo "✘ public/build is tracked in git"; echo "$built"; bad=1; else echo "✔ build output not tracked"; fi
  tracked=$(git ls-files | grep -E '(^|/)\.env(\.e2e)?$' || true)
  if [[ -n "$tracked" ]]; then echo "✘ env files tracked in git:"; echo "$tracked"; bad=1; else echo "✔ no .env tracked"; fi
fi
if [[ -f artisan ]] && command -v php >/dev/null && command -v python3 >/dev/null; then
  routes=$(php artisan route:list --path=api --json 2>/dev/null || true)
  if [[ -n "$routes" ]]; then
    out=$(printf '%s' "$routes" | python3 -I -c 'import json,sys; public=("api/login","api/health","api/forgot-password","api/reset-password"); bad=[]
for r in json.load(sys.stdin):
 uri=r["uri"]; mw=" ".join(r.get("middleware") or [])
 if uri.startswith(public) or uri.startswith("api/up"): continue
 if "sanctum" not in mw and "auth" not in mw: bad.append(r["method"]+" "+uri)
print("\n".join(bad))')
    if [[ -n "$out" ]]; then echo "✘ API routes without auth middleware:"; echo "$out"; bad=1; else echo "✔ all non-public API routes are protected"; fi
  fi
fi
exit "$bad"
