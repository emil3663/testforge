import { devices } from "@playwright/test";

// The browser context a run's tests execute in - and the one the run's login
// (auth.ts) executes in. One object, imported by both playwright.config.ts and
// the login, so they cannot drift apart.
//
// That matters because a site can bind a session to the client that logged
// in. Found live against the-internet.herokuapp.com (a Rack app, whose
// session is tied to the User-Agent and Accept-Language it was issued to): a
// login run in a default browser context left every test unauthenticated even
// though the login "succeeded", first because of the User-Agent, then because
// of Accept-Language (a script-launched browser sends the machine's locale;
// the test runner sends en-US). locale is therefore pinned here rather than
// left to differ by machine.
export const RUN_CONTEXT_OPTIONS = {
    ...devices["Desktop Chrome"],
    locale: "en-US",
};
