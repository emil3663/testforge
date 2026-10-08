<#
.SYNOPSIS
  Phase 41 (TFP-179): stop the local Toolshop started by start-toolshop.ps1.

.DESCRIPTION
  `docker compose -f docker-compose.yml down` in Testsmith's checkout next to
  TestForge. The images and the API's code volume stay, so the next start
  takes seconds; the database is seeded again on every start.
#>
# "Continue", not "Stop": docker and git write progress to stderr, which Windows PowerShell 5.1 would
# otherwise treat as a failure. Each native command's exit code is checked instead.
$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Checkout = Join-Path (Split-Path $RepoRoot -Parent) "practice-software-testing"
if (-not (Test-Path (Join-Path $Checkout "docker-compose.yml"))) { throw "No Toolshop checkout at $Checkout" }

Push-Location $Checkout
try {
    docker compose -f docker-compose.yml down
    Write-Host "The local Toolshop is stopped."
} finally {
    Pop-Location
}
