#!/usr/bin/env bash
# D26: the local Toolshop's commands, run inside the WSL distribution by start-toolshop.ps1 and stop-toolshop.ps1
# (`wsl -d Ubuntu --cd <this folder> -e bash ./toolshop.sh ...`). Testsmith's checkout lives in the distribution's
# own Linux filesystem, so Docker's bind mounts of its code never cross the Windows mount; only TestForge's two
# small compose overrides are read from this folder.
#   checkout <upstream> <commit>      clone if missing, check out the commit, print it
#   compose <sprint> <args...>        docker compose with Testsmith's file and TestForge's overrides
#   has-autoload <sprint>             exit 0 when the API's vendor/autoload.php exists
#   give-storage <sprint>             the API's storage/ and bootstrap/cache to the user php-fpm runs as
#   stop                              docker compose down
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
checkout="$HOME/practice-software-testing"
command=${1:?command}
shift

files_for() {
    files=(-f docker-compose.yml -f "$here/compose.local.yml")
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
