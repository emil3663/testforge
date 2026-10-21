<#
.SYNOPSIS
  Phase 39 (TFP-158): stop the local copy of the-internet (start-the-internet.ps1). The image is kept for the next start.
#>
$ErrorActionPreference = "Continue"
docker rm -f testforge-the-internet 2>$null | Out-Null
Write-Host "the-internet's local copy stopped"
