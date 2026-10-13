<#
.SYNOPSIS
  Phase 41 (TFP-179, Decision 7): start one version of Testsmith's Toolshop
  (practice-software-testing) locally, under Docker.

.DESCRIPTION
  Clones Testsmith's repository next to TestForge (never inside it), checks
  out the pinned commit, and starts the chosen version with
  `docker compose -f docker-compose.yml up -d` (with TestForge's compose.with-bugs.yml
  for with-bugs; the optional cron,
  phpMyAdmin and MailCatcher services are left out). Then it waits for the
  app and the API's documentation page to answer, and seeds the database
  for that version.

  One version at a time: both versions' apps call their API at
  http://localhost:8091 (src/environments/environment.ts), and running both
  would mean editing Testsmith's source, which the local copies are meant to
  show as it is. Starting the other version stops this one first.

  Docker Desktop must be running.

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

# The upstream commit the local copies run, recorded so runs are reproducible (TFP-179).
$PinnedCommit = "5a6ccc26"
$Upstream = "https://github.com/testsmith-io/practice-software-testing.git"
# Next to the TestForge repository (scripts\toolshop-local -> scripts -> repo -> its folder), never inside it.
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Checkout = Join-Path (Split-Path $RepoRoot -Parent) "practice-software-testing"

# The compose files: Testsmith's, plus TestForge's override for with-bugs, whose app has no set-version.js.
$ComposeFiles = @("-f", "docker-compose.yml", "-f", (Join-Path $PSScriptRoot "compose.local.yml"))
if ($Sprint -eq "sprint5-with-bugs") { $ComposeFiles += @("-f", (Join-Path $PSScriptRoot "compose.with-bugs.yml")) }

$AppUrl = "http://localhost:4200"
$ApiDocsUrl = "http://localhost:8091/api/documentation"
$LogUrl = "http://localhost:8091/logs/laravel.log"

docker info --format "{{.ServerVersion}}" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker isn't answering. Start Docker Desktop first." }

if (-not (Test-Path (Join-Path $Checkout ".git"))) {
    Write-Host "Cloning Testsmith's repository into $Checkout"
    git clone $Upstream $Checkout
    if ($LASTEXITCODE -ne 0) { throw "cloning $Upstream failed" }
}
Push-Location $Checkout
try {
    git fetch --quiet origin
    git checkout --quiet $PinnedCommit
    if ($LASTEXITCODE -ne 0) { throw "checking out $PinnedCommit failed" }
    Write-Host "Testsmith's repository at $(git rev-parse --short HEAD) (pinned $PinnedCommit)"

    # One version at a time: stop whatever runs now, then start the one asked for.
    $env:SPRINT = $Sprint
    docker compose @ComposeFiles down | Out-Null
    Write-Host "Starting $Sprint (the first start builds images and installs the app: several minutes)"
    docker compose @ComposeFiles up -d
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

    # The API's PHP packages: compose's own composer service gives up after Composer's 300 s process timeout,
    # which a first install on a Windows folder mounted into Docker can exceed. Installed again, without it.
    $Autoload = Join-Path $Checkout "$Sprint\API\vendor\autoload.php"
    $waited = 0
    while (-not (Test-Path $Autoload) -and $waited -lt 600) {
        $composer = docker compose @ComposeFiles ps -a --format "{{.State}}" composer 2>$null
        if ($composer -match "exited") { break }
        Start-Sleep -Seconds 10
        $waited += 10
    }
    if (-not (Test-Path $Autoload)) {
        Write-Host "Installing the API's packages for $Sprint (no Composer timeout; the first time takes a while)"
        docker compose @ComposeFiles run --rm -e COMPOSER_PROCESS_TIMEOUT=0 composer
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Autoload)) { throw "installing the API's packages failed" }
    }

    if ($Sprint -eq "sprint5-with-bugs") {
        # Bug 80 (compose.with-bugs.yml): the log lives in a Docker volume. Testsmith's composer service
        # mounts the API's volumes (volumes_from) and ends with chown -R www-data /var/www, which in the
        # composer image is uid 82, while php-fpm runs as uid 1000: Laravel then can't write its log and
        # every request that logs answers 500. So once composer has exited, the folder goes to the user
        # php-fpm runs as (process 1), not to a name.
        # As long as composer takes: one start took 10.5 minutes (2026-10-13), and giving the folder away
        # before composer's own chown has run is undone by it, so every request that logs answers 500.
        $waited = 0
        while (-not ((docker compose @ComposeFiles ps -a --format "{{.State}}" composer 2>$null) -match "exited")) {
            if ($waited -ge 1800) { throw "Testsmith's composer service was still running after 30 minutes; the API's log folder can't be given to php-fpm before it ends" }
            Start-Sleep -Seconds 5
            $waited += 5
        }
        docker compose @ComposeFiles exec -T -u root laravel-api sh -c 'chown -R $(stat -c %u:%g /proc/1) /var/www/storage/logs'
        if ($LASTEXITCODE -ne 0) { throw "giving the API's log folder to php-fpm's user failed" }
    }

    if (-not (Wait-Answer $ApiDocsUrl 600)) { throw "The API's documentation page didn't answer at $ApiDocsUrl" }
    Write-Host "Seeding the database for $Sprint"
    docker compose @ComposeFiles exec -T laravel-api php artisan migrate:fresh --seed --force
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
    Write-Host "$Sprint is running:"
    Write-Host "  app  $AppUrl"
    Write-Host "  API  http://localhost:8091  (documentation: $ApiDocsUrl)"
} finally {
    Pop-Location
}
