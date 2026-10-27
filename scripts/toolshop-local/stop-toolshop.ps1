<#
.SYNOPSIS
  Phase 41 (TFP-179): stop the local Toolshop started by start-toolshop.ps1.

.DESCRIPTION
  `docker compose -f docker-compose.yml down` in Testsmith's checkout in the
  WSL distribution's Linux filesystem (D26), through toolshop.sh. The images
  and the API's code volume stay, so the next start is quicker; the database
  is seeded again on every start.
#>
# "Continue", not "Stop": docker and git write progress to stderr, which Windows PowerShell 5.1 would
# otherwise treat as a failure. Each native command's exit code is checked instead.
$ErrorActionPreference = "Continue"
# D26: the WSL distribution that holds Testsmith's checkout (start-toolshop.ps1 has the same).
$Distro = "Ubuntu"

wsl -d $Distro --cd $PSScriptRoot -e bash ./toolshop.sh stop
if ($LASTEXITCODE -ne 0) { throw "stopping the local Toolshop failed" }
Write-Host "The local Toolshop is stopped."
