# syntax=docker/dockerfile:1
# Phase 47 (TFP-247, Decision 8): Mr Onion's CLI as a pinned image, so "the same site gives the same suite" holds
# between machines. Every version that decides a suite or a result is fixed here:
# - the OS: Ubuntu 26.04, the runner image CI is pinned to (TFP-284 moved both together from 24.04);
# - Node: the exact release, copied from the official image (.nvmrc names the major; the build checks they agree);
# - Playwright: the lockfile's, through `npm ci`;
# - Chromium: the build that Playwright version installs (its headless shell: every launch in src/ is headless).
# Base images are pinned by digest as well as tag, so a re-pushed tag can't change a rebuild. Not pinned: the system
# libraries and fonts `playwright install --with-deps` takes from Ubuntu's archive, which are whatever 26.04 has at
# build time. A published image is fixed once built; a rebuild can differ there, and its verification is the check.
#
#   docker build -t mr-onion --build-arg MRONION_BUILD_VERSION=0.3.0 --build-arg MRONION_BUILD_COMMIT=$(git rev-parse --short HEAD) .
#   docker run --rm --init --ipc=host --network host --user "$(id -u):$(id -g)" -v "$PWD:/work" mr-onion run --url http://localhost:4200 --out out
#
# Moving a pin: change it here, rebuild, and run scripts/image/verify-image.mjs; the release workflow does the same.
ARG NODE_IMAGE=node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c
ARG BASE_IMAGE=ubuntu:26.04@sha256:065aa8626841f16057b78b027b464cd59c4fac36c204c72dcbf48d66f5fa8a96

FROM ${NODE_IMAGE} AS node

FROM ${BASE_IMAGE}
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_ENV=production
WORKDIR /opt/mr-onion

# Dependencies first, so a source change doesn't reinstall them. Production only: the run uses no dev dependency.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npx playwright install --with-deps --only-shell chromium \
    && rm -rf /root/.npm /var/lib/apt/lists/*

COPY .nvmrc tsconfig.json playwright.config.ts ./
COPY bin ./bin
COPY src ./src
COPY scripts ./scripts

# What the image says it is: a report's "made by" line and /api/health's fields (TFP-257). Given by the build, as the
# image holds no .git; empty, the version comes from package.json and the commit is null.
ARG MRONION_BUILD_VERSION=""
ARG MRONION_BUILD_COMMIT=""
ENV MRONION_BUILD_VERSION=${MRONION_BUILD_VERSION} \
    MRONION_BUILD_COMMIT=${MRONION_BUILD_COMMIT}
RUN node scripts/image/check-pins.mjs

# TFP-248: any user can run the image (`docker run --user "$(id -u):$(id -g)"`), so what it writes into a mounted
# workspace is owned by that user, not root. The folders a run writes outside the workspace are open to every user and
# sticky, like /tmp: the run folders, the runs folder used without --data-dir, and a home for the default data folder.
RUN mkdir -p .playwright-runs runs /home/mr-onion && chmod 1777 .playwright-runs runs /home/mr-onion
ENV HOME=/home/mr-onion

# Paths on the command line (--out, --config, --data-dir) resolve against the folder the command runs in: mount the
# workspace there. The run itself works in /opt/mr-onion, where Playwright and its run folders are.
WORKDIR /work
ENTRYPOINT ["node", "/opt/mr-onion/bin/mr-onion.mjs"]
CMD ["--help"]

LABEL org.opencontainers.image.title="Mr Onion" \
      org.opencontainers.image.description="Crawl, generate and run a Playwright suite against a site, with exit codes and JUnit for CI" \
      org.opencontainers.image.source="https://github.com/emil3663/mr-onion" \
      org.opencontainers.image.licenses="MIT"
