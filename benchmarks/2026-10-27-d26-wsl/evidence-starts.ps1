<#
  D26: the start evidence, re-taken so every figure in README.md has a log (the first measurements were read from
  command output, not saved). Writes logs/environment.txt and logs/evidence-<sprint>.txt.
  For each version, from a pristine checkout (git clean -xdf as root: composer leaves files owned by uid 82):
  - Testsmith's compose up without TestForge's start script, so the API answers as composer leaves it: the API's
    answer and Laravel's log before the storage is given to php-fpm's user (with-bugs logs to its volume, clean to
    the container's stderr);
  - composer's and Angular's first-install times from the containers themselves;
  - then start-toolshop.ps1 (a later start: packages installed), its time and its bug-80 line.
  Run from the repo root with Docker Desktop up and no Toolshop running.
#>
$ErrorActionPreference = "Continue"
$here = $PSScriptRoot
$scripts = Join-Path (Split-Path (Split-Path $here -Parent) -Parent) "scripts\toolshop-local"
$logs = Join-Path $here "logs"
$env:WSL_UTF8 = "1"
function Toolshop { wsl -d Ubuntu --cd $scripts -e bash ./toolshop.sh @args 2>&1 | Where-Object { "$_" -notmatch "attribute .version. is obsolete" } | ForEach-Object { "$_" } }

$envFile = Join-Path $logs "environment.txt"
& {
    "taken $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    "--- wsl --version"; wsl --version
    "--- wsl -l -v"; wsl -l -v
    "--- Ubuntu"; wsl -d Ubuntu -e sh -c 'grep PRETTY_NAME /etc/os-release; id -un; nproc; free -g | sed -n 2p'
    "--- Docker"; docker version --format "client {{.Client.Version}}, server {{.Server.Platform.Name}} engine {{.Server.Version}}"
    "--- the WSL checkout"
    wsl -d Ubuntu --cd /home/testforge/practice-software-testing -e git rev-parse HEAD
    "status lines: $(@(wsl -d Ubuntu --cd /home/testforge/practice-software-testing -e git status --short).Count)"
    wsl -d Ubuntu --cd /home/testforge/practice-software-testing -e du -sh .
    wsl -d Ubuntu --cd /home/testforge/practice-software-testing -e git ls-files --eol _docker/api.docker sprint5/API/artisan
    "--- the old Windows checkout"; git -C (Join-Path (Split-Path (Split-Path (Split-Path $here -Parent) -Parent) -Parent) "practice-software-testing") ls-files --eol _docker/api.docker sprint5/API/artisan
} *>&1 | ForEach-Object { "$_" } | Out-File $envFile -Encoding utf8

foreach ($sprint in "sprint5-with-bugs", "sprint5") {
    $out = Join-Path $logs "evidence-$sprint.txt"
    & {
        "=== $sprint, $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        Toolshop stop | Out-Null
        wsl -d Ubuntu -u root --cd /home/testforge/practice-software-testing -e git -c safe.directory=* clean -xdfq
        $status = @(wsl -d Ubuntu --cd /home/testforge/practice-software-testing -e git status --short).Count
        wsl -d Ubuntu --cd /home/testforge/practice-software-testing -e test -d "$sprint/API/vendor"; $vendor = if ($LASTEXITCODE -eq 0) { "present" } else { "absent" }
        wsl -d Ubuntu --cd /home/testforge/practice-software-testing -e test -d "$sprint/UI/node_modules"; $modules = if ($LASTEXITCODE -eq 0) { "present" } else { "absent" }
        "pristine: status lines $status, vendor $vendor, node_modules $modules"
        "--- compose up, without the start script"
        Toolshop compose $sprint up -d | Out-Null
        $waited = 0
        while (-not ((Toolshop compose $sprint ps -a --format "{{.State}}" composer) -match "exited") -and $waited -lt 600) { Start-Sleep 5; $waited += 5 }
        docker inspect pst-composer-1 --format "composer started {{.State.StartedAt}} finished {{.State.FinishedAt}} exit {{.State.ExitCode}}"
        "--- ownership as composer leaves it"
        docker exec pst-laravel-api-1 sh -c 'id; ls -ldn /var/www/storage /var/www/storage/framework/views /var/www/bootstrap/cache'
        # The documentation page needs no database (nothing is migrated yet), so its answer is the storage's alone.
        "--- the API's documentation page before the storage is given to php-fpm's user"
        foreach ($i in 1..3) { curl.exe -s -o NUL -w "GET /api/documentation -> %{http_code}`n" "http://localhost:8091/api/documentation"; Start-Sleep 2 }
        "Laravel's last error:"
        $errors = if ($sprint -eq "sprint5-with-bugs") { docker exec pst-laravel-api-1 tail -c 200000 /var/www/storage/logs/laravel.log 2>&1 } else { docker logs --tail 200 pst-laravel-api-1 2>&1 }
        $errors | ForEach-Object { "$_" } | Select-String -Pattern '"message":"[^"]*' -AllMatches | Select-Object -Last 1 | ForEach-Object { $_.Matches[0].Value }
        "--- Angular's first install"
        $waited = 0
        while (-not ((docker logs pst-angular-ui-1 2>&1 | Out-String) -match "Local:") -and $waited -lt 600) { Start-Sleep 5; $waited += 5 }
        docker inspect pst-angular-ui-1 --format "angular-ui started {{.State.StartedAt}}"
        docker logs -t pst-angular-ui-1 2>&1 | Select-String "added \d+ packages|Local:" | ForEach-Object { "$_" }
        "--- start-toolshop.ps1 (a later start)"
        $s = Get-Date
        try { & (Join-Path $scripts "start-toolshop.ps1") -Sprint $sprint 2>$null 6>&1 | Where-Object { "$_" -match "Bug 80|running|Testsmith" }; $r = "ok" } catch { $r = "FAILED: $($_.Exception.Message)" }
        "result=$r; wall $([int]((Get-Date) - $s).TotalSeconds) s"
        curl.exe -s -o NUL -w "GET /products?page=1 -> %{http_code}`n" "http://localhost:8091/products?page=1"
        "checkout status lines after the start: $(@(wsl -d Ubuntu --cd /home/testforge/practice-software-testing -e git status --short).Count)"
    } *>&1 | ForEach-Object { "$_" } | Out-File $out -Encoding utf8
}
Toolshop stop | Out-Null
