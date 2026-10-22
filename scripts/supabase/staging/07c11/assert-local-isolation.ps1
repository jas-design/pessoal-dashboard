param(
  [string]$Workdir = ".local/supabase/staging/07c11",
  [switch]$RequireBaseline
)

$repositoryRoot = (Resolve-Path -LiteralPath ".").Path
$expectedWorkdir = Join-Path $repositoryRoot ".local\supabase\staging\07c11"
$resolvedWorkdir = (Resolve-Path -LiteralPath $Workdir).Path

if ($resolvedWorkdir -ne $expectedWorkdir) {
  throw "Workdir inesperado: $resolvedWorkdir"
}

$configPath = Join-Path $resolvedWorkdir "supabase\config.toml"
$config = Get-Content -LiteralPath $configPath -Raw

if ($config -notmatch 'project_id\s*=\s*"kawana-07c11-staging"') {
  throw "project_id isolado nao confirmado"
}

if ($config -notmatch '(?s)\[db\.migrations\].*?enabled\s*=\s*false') {
  throw "migrations automaticas nao estao desativadas"
}

if ($config -notmatch '(?s)\[db\.seed\].*?enabled\s*=\s*false') {
  throw "seed automatico nao esta desativado"
}

$linkedProjectPath = Join-Path $resolvedWorkdir "supabase\.temp\project-ref"
if (Test-Path -LiteralPath $linkedProjectPath) {
  throw "Projeto local possui project-ref vinculado; remova o vinculo antes de continuar"
}

$baselinePath = Join-Path $resolvedWorkdir "baseline\kawana-schema-only-2026-10-20.sql"
if ($RequireBaseline) {
  if (-not (Test-Path -LiteralPath $baselinePath)) {
    throw "Baseline nova nao encontrada: $baselinePath"
  }

  $dataStatements = Select-String -LiteralPath $baselinePath -Pattern '^(COPY|INSERT INTO) '
  if ($dataStatements) {
    throw "Baseline contem comandos de dados COPY/INSERT"
  }
}

Write-Output "OK: staging 07C.11 isolado; migrations/seed automaticos desativados."

