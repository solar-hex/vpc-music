# ── deploy-router.ps1 — Route deploy commands by target ───────
#
# Usage:
#   pnpm run deploy prd        # deploy to production (SSH → Droplet)
#   pnpm run deploy staging    # deploy to staging
#   pnpm run deploy prd -- -SkipTests
#
param(
    [Parameter(Position = 0)]
    [string]$Target = 'staging',
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)
$ErrorActionPreference = 'Stop'
$targetName = $Target.ToLowerInvariant()
switch ($targetName) {
    { $_ -in @('prd', 'prod', 'production', 'main') } {
        & "$PSScriptRoot\..\apps\api\deploy.ps1" -Env production @RemainingArgs
        exit $LASTEXITCODE
    }
    { $_ -in @('stg', 'stage', 'staging') } {
        & "$PSScriptRoot\..\apps\api\deploy.ps1" -Env staging @RemainingArgs
        exit $LASTEXITCODE
    }
    default {
        Write-Host "ERROR: Unknown deploy target '$Target'. Use 'prd' or 'staging'." -ForegroundColor Red
        exit 1
    }
}
