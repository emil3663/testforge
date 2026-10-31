<#
.SYNOPSIS
  Phase 41 (TFP-179, Decision 7): start one version of Testsmith's Toolshop
  (practice-software-testing) locally, under Docker.

.DESCRIPTION
  Clones Testsmith's repository into the WSL distribution's own Linux
  filesystem (D26: ~/practice-software-testing in Ubuntu, so Docker's bind
  mounts of its code never cross the Windows mount), checks out the pinned
  commit, and starts the chosen version with
  `docker compose up -d` on Testsmith's docker-compose.yml with TestForge's
  overrides (compose.local.yml, compose.loopback.yml, and compose.with-bugs.yml
  for with-bugs: run by hand without them, its ports open to the network; the optional cron,
  phpMyAdmin and MailCatcher services are left out). Then it waits for the
  app and the API's documentation page to answer, and seeds the database
  for that version. Each step inside the distribution is a command of
  toolshop.sh, beside this script.

  One version at a time: both versions' apps call their API at
  http://localhost:8091 (src/environments/environment.ts), and running both
  would mean editing Testsmith's source, which the local copies are meant to
  show as it is. Starting the other version stops this one first.

  Docker Desktop must be running, with its WSL integration on for the
  distribution.

.PARAMETER Sprint
  sprint5 (the clean version) or sprint5-with-bugs.

.EXAMPLE
  .\scripts\toolshop-local\start-toolshop.ps1 -Sprint sprint5-with-bugs
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("sprint5", "sprint5-with-bugs")]
    [string]$Sprint
)

# "Continue", not "Stop": docker and git write progress to stderr, which Windows PowerShell 5.1 would
# otherwise treat as a failure. Each native command's exit code is checked instead.
$ErrorActionPreference = "Continue"
$ScriptStarted = Get-Date

# The upstream commit the local copies run, recorded so runs are reproducible (TFP-179).
$PinnedCommit = "5a6ccc26"
$Upstream = "https://github.com/testsmith-io/practice-software-testing.git"
# D26: the WSL distribution that holds Testsmith's checkout (stop-toolshop.ps1 has the same).
$Distro = "Ubuntu"

$AppUrl = "http://localhost:4200"
$ApiDocsUrl = "http://localhost:8091/api/documentation"
$LogUrl = "http://localhost:8091/logs/laravel.log"

# One of toolshop.sh's commands, inside the distribution.
function Invoke-Toolshop { wsl -d $Distro --cd $PSScriptRoot -e bash ./toolshop.sh @args }
function Invoke-Compose { Invoke-Toolshop compose $Sprint @args }

docker info --format "{{.ServerVersion}}" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker isn't answering. Start Docker Desktop first." }
wsl -d $Distro -e true
if ($LASTEXITCODE -ne 0) { throw "The WSL distribution $Distro isn't there. See scripts\toolshop-local\README.md." }

$head = Invoke-Toolshop checkout $Upstream $PinnedCommit
if ($LASTEXITCODE -ne 0) { throw "checking out $PinnedCommit failed" }
Write-Host "Testsmith's repository at $head (pinned $PinnedCommit), in $Distro"

# One version at a time: stop whatever runs now, then start the one asked for.
Invoke-Compose down | Out-Null
Write-Host "Starting $Sprint (the first start builds images and installs the app: several minutes)"
Invoke-Compose up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }
$StartedUtc = [DateTime]::UtcNow
function Wait-Answer([string]$Url, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -lt 400) { return $true }
        } catch { }
        Start-Sleep -Seconds 5
    }
    return $false
}
# Testsmith's composer service mounts the API's code (volumes_from) and ends with chown -R www-data /var/www,
# which in the composer image is uid 82, while php-fpm runs as uid 1000. In the Linux filesystem (D26) that
# ownership holds: Laravel can't write its compiled views, so the API answers 500 ("tempnam(): file created
# in the system's temporary directory", measured 2026-10-27). With-bugs' log volume (bug 80) is under storage/ and
# needs the same. So once composer has exited, storage/ and bootstrap/cache go to the user php-fpm runs as
# (process 1), not to a name: giving them away before composer's own chown has run is undone by it.
$composerLogs = "wsl -d $Distro --cd `"$PSScriptRoot`" -e bash ./toolshop.sh compose $Sprint logs composer"
$waited = 0
while ($true) {
    $composer = Invoke-Compose ps -a --format "{{.State}} {{.ExitCode}}" composer 2>$null
    if ($composer -match "exited") { break }
    if (-not $composer -and $waited -ge 60) { throw "Testsmith's composer service wasn't created; see $composerLogs" }
    if ($waited -ge 1800) { throw "Testsmith's composer service was still running after 30 minutes; the API's storage can't be given to php-fpm before it ends" }
    Start-Sleep -Seconds 5
    $waited += 5
}
# D26: in WSL a first install takes about 15 s, so the reinstall without Composer's 300 s process timeout, needed on
# the Windows folder (up to 20 minutes), is gone. A composer that fails, on any start, or exits without installing
# stops the start instead: a vendor/ left by an earlier start would otherwise hide a failed install.
if ($composer -notmatch "exited 0$") { throw "Testsmith's composer service failed ($composer); see $composerLogs" }
Invoke-Toolshop has-autoload $Sprint
if ($LASTEXITCODE -ne 0) { throw "Testsmith's composer service exited without installing the API's packages; see $composerLogs" }
Invoke-Toolshop give-storage $Sprint
if ($LASTEXITCODE -ne 0) { throw "giving the API's storage to php-fpm's user failed" }

if (-not (Wait-Answer $ApiDocsUrl 600)) { throw "The API's documentation page didn't answer at $ApiDocsUrl" }
Write-Host "Seeding the database for $Sprint"
Invoke-Compose exec -T laravel-api php artisan migrate:fresh --seed --force
if ($LASTEXITCODE -ne 0) { throw "seeding the database failed" }
if (-not (Wait-Answer $AppUrl 900)) { throw "The app didn't answer at $AppUrl" }

if ($Sprint -eq "sprint5-with-bugs") {
    # Bug 80 must be there to be found: one request to the API writes a line, and the
    # log route must serve a line written since this start (a stale log doesn't count).
    Invoke-WebRequest -Uri "http://localhost:8091/products?page=1" -UseBasicParsing -TimeoutSec 30 | Out-Null
    $log = Invoke-WebRequest -Uri $LogUrl -UseBasicParsing -TimeoutSec 30
    $stamps = [regex]::Matches($log.Content, '\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]') | ForEach-Object {
        [DateTime]::ParseExact($_.Groups[1].Value, "yyyy-MM-dd HH:mm:ss", [Globalization.CultureInfo]::InvariantCulture)
    }
    $newest = $stamps | Sort-Object | Select-Object -Last 1
    # Laravel stamps in UTC (config/app.php); a minute's slack for the clocks.
    if ($log.StatusCode -ne 200 -or -not $newest -or $newest -lt $StartedUtc.AddMinutes(-1)) {
        throw "Bug 80 isn't reachable: $LogUrl answered $($log.StatusCode) with no line written since $($StartedUtc.ToString('u'))"
    }
    Write-Host "Bug 80: $LogUrl answers 200; its newest line is $($newest.ToString('u'))"
}

Write-Host ""
Write-Host "$Sprint is running (started in $([int]((Get-Date) - $ScriptStarted).TotalSeconds) s):"
Write-Host "  app  $AppUrl"
Write-Host "  API  http://localhost:8091  (documentation: $ApiDocsUrl)"
