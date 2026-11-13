#!/usr/bin/env bash
# D26: the local Toolshop's commands, run inside the WSL distribution by start-toolshop.ps1 and stop-toolshop.ps1
# (`wsl -d Ubuntu --cd <this folder> -e bash ./toolshop.sh ...`). Testsmith's checkout lives in the distribution's
# own Linux filesystem, so Docker's bind mounts of its code never cross the Windows mount; only Mr Onion's
# small compose overrides are read from this folder.
#   checkout <upstream> <commit>      clone if missing, check out the commit, print it
#   compose <sprint> <args...>        docker compose with Testsmith's file and Mr Onion's overrides
#   has-autoload <sprint>             exit 0 when the API's vendor/autoload.php exists
#   give-storage <sprint>             the API's storage/ and bootstrap/cache to the user php-fpm runs as
#   start <sprint>                    start-toolshop.ps1's whole start, on Linux without WSL (CI; TFP-248)
#   stop                              docker compose down
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
checkout="$HOME/practice-software-testing"
command=${1:?command}
shift

files_for() {
    files=(-f docker-compose.yml -f "$here/compose.local.yml" -f "$here/compose.loopback.yml")
    if [ "$1" = sprint5-with-bugs ]; then files+=(-f "$here/compose.with-bugs.yml"); fi
}

case $command in
    checkout)
        if [ ! -d "$checkout/.git" ]; then git clone --quiet "$1" "$checkout"; fi
        cd "$checkout"
        git fetch --quiet origin
        git checkout --quiet "$2"
        git rev-parse --short HEAD
        ;;
    compose)
        sprint=$1
        shift
        files_for "$sprint"
        cd "$checkout"
        SPRINT=$sprint exec docker compose "${files[@]}" "$@"
        ;;
    has-autoload)
        test -f "$checkout/$1/API/vendor/autoload.php"
        ;;
    give-storage)
        files_for "$1"
        cd "$checkout"
        SPRINT=$1 exec docker compose "${files[@]}" exec -T -u root laravel-api sh -c 'chown -R $(stat -c %u:%g /proc/1) /var/www/storage /var/www/bootstrap/cache'
        ;;
    start)
        # TFP-248: start-toolshop.ps1's start, for a Linux machine with Docker and no WSL (CI's runner, for the
        # action's Gate A). The same steps in the same order; the commit and upstream are read from that script, so
        # both start the same Toolshop. Its comments say why each step is there.
        sprint=${1:?sprint5 or sprint5-with-bugs}
        case $sprint in sprint5 | sprint5-with-bugs) ;; *) echo "unknown sprint: $sprint" >&2; exit 2 ;; esac
        pinned() { sed -n "s/^\$$1 = \"\(.*\)\"\r\?$/\1/p" "$here/start-toolshop.ps1"; }
        started=$(date +%s)
        echo "Testsmith's repository at $(bash "$here/toolshop.sh" checkout "$(pinned Upstream)" "$(pinned PinnedCommit)") (pinned $(pinned PinnedCommit))"
        compose() { bash "$here/toolshop.sh" compose "$sprint" "$@"; }
        answers() {
            local deadline=$(($(date +%s) + $2))
            while [ "$(date +%s)" -lt "$deadline" ]; do
                curl -fsS -o /dev/null --max-time 10 "$1" && return 0
                sleep 5
            done
            return 1
        }
        compose down > /dev/null 2>&1 || true
        echo "Starting $sprint"
        compose up -d
        started_utc=$(date -u +%s)
        waited=0
        while true; do
            composer=$(compose ps -a --format "{{.State}} {{.ExitCode}}" composer 2> /dev/null || true)
            [[ $composer == *exited* ]] && break
            if [ -z "$composer" ] && [ "$waited" -ge 60 ]; then echo "Testsmith's composer service wasn't created" >&2; exit 1; fi
            if [ "$waited" -ge 1800 ]; then echo "Testsmith's composer service was still running after 30 minutes" >&2; exit 1; fi
            sleep 5
            waited=$((waited + 5))
        done
        if [[ $composer != *"exited 0" ]]; then echo "Testsmith's composer service failed ($composer)" >&2; compose logs composer >&2; exit 1; fi
        bash "$here/toolshop.sh" has-autoload "$sprint" || { echo "Testsmith's composer service exited without installing the API's packages" >&2; exit 1; }
        bash "$here/toolshop.sh" give-storage "$sprint"
        answers http://localhost:8091/api/documentation 600 || { echo "The API's documentation page didn't answer" >&2; exit 1; }
        echo "Seeding the database for $sprint"
        compose exec -T laravel-api php artisan migrate:fresh --seed --force
        answers http://localhost:4200 900 || { echo "The app didn't answer at http://localhost:4200" >&2; exit 1; }
        if [ "$sprint" = sprint5-with-bugs ]; then
            curl -fsS -o /dev/null --max-time 30 "http://localhost:8091/products?page=1"
            newest=$(curl -fsS --max-time 30 http://localhost:8091/logs/laravel.log | grep -oE '^\[[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\]' | tr -d '[]' | sort | tail -1 || true)
            # Laravel stamps in UTC; a minute's slack for the clocks.
            if [ -z "$newest" ] || [ "$(date -u -d "$newest" +%s)" -lt $((started_utc - 60)) ]; then
                echo "Bug 80 isn't reachable: /logs/laravel.log has no line written since this start" >&2
                exit 1
            fi
            echo "Bug 80: /logs/laravel.log answers 200; its newest line is $newest UTC"
        fi
        echo "$sprint is running (started in $(($(date +%s) - started)) s): app http://localhost:4200, API http://localhost:8091"
        ;;
    stop)
        if [ ! -f "$checkout/docker-compose.yml" ]; then echo "No Toolshop checkout at $checkout" >&2; exit 1; fi
        cd "$checkout"
        exec docker compose -f docker-compose.yml down
        ;;
    *)
        echo "unknown command: $command" >&2
        exit 2
        ;;
esac
