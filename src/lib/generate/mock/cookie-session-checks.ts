// Phase 36 (TFP-125, Decision 3). The cookie/session test asserted only that
// the browser's cookie list is an array - it could not fail. It is replaced,
// not kept beside the new one, by a check on the site's own session cookies
// after the landing page loads:
//
// - Expiry: a session cookie that stays valid for more than 30 days lets a
//   session outlive any reasonable idle or absolute timeout.
// - Scope: a session cookie set for a parent domain is sent to every sibling
//   subdomain, so a weaker neighbour can read or overwrite it.
//
// "Session cookie" is decided by name (session, sess, sid, auth, token, jwt,
// and the common framework names). TestForge cannot tell a session cookie
// from an analytics one for certain (Phase 34 Decision 3), so the rule is
// stated, not guessed at per site. A site with no such cookie on its landing
// page skips the test with that reason (reported as Not run), rather than
// passing having checked nothing.
//
// Read-only. Generated code avoids template literals so it needs no second
// escaping.

/** A session cookie valid for longer than this fails. */
export const MAX_SESSION_COOKIE_DAYS = 30;

/** Cookie names treated as session cookies. */
export const SESSION_COOKIE_NAME = /(^|[._-])(session|sess|sid|auth|token|jwt)([._-]|$)|^(jsessionid|phpsessid|asp\.net_sessionid|connect\.sid|rack\.session|laravel_session)$/i;

export function buildCookieSessionTests(): string[] {
    return [
        `  test('session cookies set by the site expire and stay scoped to it', async ({ page, context }) => {
    await page.goto('/', { waitUntil: 'load' });
    const host = new URL(page.url()).hostname;
    const sessionName = ${SESSION_COOKIE_NAME.toString()};
    const own = (await context.cookies()).filter((cookie) => {
      const domain = cookie.domain.replace(/^\\./, '');
      return host === domain || host.endsWith('.' + domain);
    });
    const sessionCookies = own.filter((cookie) => sessionName.test(cookie.name));
    test.skip(sessionCookies.length === 0, 'no session cookie on the landing page (' + own.length + ' cookie(s) set by the site, none named like a session), so there is nothing to check');

    const problems: string[] = [];
    const maxDays = ${MAX_SESSION_COOKIE_DAYS};
    for (const cookie of sessionCookies) {
      // expires is -1 for a cookie that ends with the browser session.
      if (cookie.expires > 0) {
        const days = (cookie.expires * 1000 - Date.now()) / 86400000;
        if (days > maxDays) problems.push('"' + cookie.name + '" stays valid for ' + Math.round(days) + ' days (more than ' + maxDays + ')');
      }
      const domain = cookie.domain.replace(/^\\./, '');
      if (domain !== host) problems.push('"' + cookie.name + '" is set for ' + cookie.domain + ', so every subdomain of ' + domain + ' receives it, not only ' + host);
    }
    expect(problems, 'session cookies that break expiry or scope: ' + problems.join('; ')).toEqual([]);
  });`,
    ];
}
