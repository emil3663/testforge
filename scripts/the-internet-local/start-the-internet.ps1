<#
.SYNOPSIS
  Phase 39 (TFP-158, Decision 13): start a local copy of the-internet (Sauce Labs, Apache-2.0) under Docker.

.DESCRIPTION
  Builds the image straight from the-internet's git repository at the pinned commit, with its own Dockerfile, and runs
  it on http://localhost:7080. Docker fetches the source inside Docker Desktop's WSL Linux VM and copies it into the
  image, so there is no Windows checkout and nothing is mounted from Windows at run time: the register's standing rule
  (Emil, 2026-10-19) that a locally hosted site's code lives in WSL's Linux filesystem, met without installing a WSL
  distribution (Emil, 2026-10-21). The first start builds the image (a few minutes); later starts reuse it.

  A local development host, so a run gets the machine's worker limit and no request cap (Decision 10).

  Docker Desktop must be running.

.EXAMPLE
  .\scripts\the-internet-local\start-the-internet.ps1
#>

# "Continue", not "Stop": docker writes progress to stderr, which Windows PowerShell 5.1 would otherwise treat as a
# failure. Each native command's exit code is checked instead.
$ErrorActionPreference = "Continue"

# The upstream commit the local copy runs, recorded so runs are reproducible.
$PinnedCommit = "92ce1d11f7f78b3c86665f64a238b19aab29d7aa"
$Upstream = "https://github.com/saucelabs/the-internet.git"
$Image = "testforge/the-internet:$($PinnedCommit.Substring(0, 7))"
$Container = "testforge-the-internet"
$AppUrl = "http://localhost:7080"

docker info --format "{{.ServerVersion}}" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker isn't answering. Start Docker Desktop first." }

docker image inspect $Image 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Building $Image from $Upstream at $PinnedCommit (the first start: a few minutes)"
    docker build -t $Image "$Upstream#$PinnedCommit"
    if ($LASTEXITCODE -ne 0) { throw "building $Image failed" }
}

docker rm -f $Container 2>$null | Out-Null
$StartedUtc = [DateTime]::UtcNow
docker run -d --name $Container -p 127.0.0.1:7080:5000 $Image | Out-Null
if ($LASTEXITCODE -ne 0) { throw "starting $Container failed" }

$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -Uri "$AppUrl/" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -lt 400) {
            $seconds = [int]([DateTime]::UtcNow - $StartedUtc).TotalSeconds
            Write-Host "the-internet ($PinnedCommit) answers on $AppUrl after $seconds s"
            exit 0
        }
    } catch { Start-Sleep -Seconds 2 }
}
docker logs --tail 40 $Container
throw "the-internet did not answer on $AppUrl within 120 s"
