# Deploy remoto: migrations Supabase + Edge Functions + Vercel
# Pré-requisito: npx supabase login  (uma vez)
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$ProjectRef = 'olliryjrhhyihjmoxaoa'

Write-Host '==> Link Supabase' -ForegroundColor Cyan
npx supabase link --project-ref $ProjectRef --yes

Write-Host '==> Migrations (db push)' -ForegroundColor Cyan
npx supabase db push --yes

Write-Host '==> Edge Functions' -ForegroundColor Cyan
$funcs = @('brain-scan', 'close-month', 'generate-followup-draft', 'import-fx-rates', 'score-quote')
foreach ($f in $funcs) {
  npx supabase functions deploy $f --no-verify-jwt
}

Write-Host '==> Vercel production' -ForegroundColor Cyan
vercel --prod --yes

Write-Host 'Deploy concluído.' -ForegroundColor Green
Write-Host 'App: https://crm-plp.vercel.app'
