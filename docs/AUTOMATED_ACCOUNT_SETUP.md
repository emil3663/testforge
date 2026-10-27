# Setting up an automation account for authenticated TestForge runs

TestForge can log in once at the start of a run and then start every test in
that run already signed in, so the parts of your site that sit behind a login
get tested too. It does that with **an account you provision for the purpose**
— an *automation account* — not with anyone's real account. This page covers
what that account should look like, why it needs four specific exemptions, and
how to point TestForge at it.

It is deliberately generic. Every identity provider and every site does these
things differently, and TestForge cannot maintain steps for all of them. What
follows says **what the account has to be allowed to do**; how you configure
that on your platform is yours to look up.

> **Not covered:** TestForge does not discover how to log in. You tell it the
> login page and the form's selectors once, and it drives that form. See
> [What TestForge can and cannot log in to](#what-testforge-can-and-cannot-log-in-to).

---

## What an automation account is

A separate account, used only by TestForge, that exists so automated runs never
need a person's credentials. The same pattern is used for Selenium and other
test-automation accounts.

- **Dedicated.** Never a personal account and never an administrator. If a run
  misbehaves, or its credentials leak, the blast radius is that one account.
- **Least privilege.** Give it only the role and data the tests need to reach.
  If the tests only read, give it a read-only role.
- **Preferably on a non-production environment**, with test data. A run
  drives real pages and (when interactive tests are enabled) submits real
  forms, so point it at staging where you can.
- **Its own strong, unique password**, held in an environment variable (see
  below) — not reused anywhere, not in a file you commit.
- **Attributable.** Give it an obviously automated name and email address so
  its activity is easy to spot in your logs, and easy to disable.

---

## The four exemptions it needs

Login protections exist to stop attackers and are exactly right for people. An
automation account behaves like an unattended script, so left un-exempted each
of them will make authenticated runs fail — usually intermittently, which is
worse than failing outright. Exempt **this account only**, and compensate
where the section says to.

### 1. Account lockout

**The problem.** Most sites lock an account after several failed sign-ins.
TestForge signs in once per run, but if the selectors, the password, or the
post-login check are wrong, *every run is another failed attempt* on the same
account. A few misconfigured runs can lock it, and then every later run fails
for a reason that has nothing to do with the config.

**What to set up.** Exempt the account from failed-attempt lockout (or set the
threshold high enough that a handful of configuration mistakes cannot reach
it), and make sure an unlock does not require a human clicking an emailed link.

**Compensate.** Keep the password long and random, since the account will not
be protected by lockout. Restrict where it can sign in from if your platform
allows it.

### 2. Rate limiting

**The problem.** A run is not one request. Tests run in parallel (on a local
host, half the machine's cores and at most three; on any other site, up to
three workers sharing at most five requests per second) and a single run can
load many pages, follow links, and check responses. Per-account or
per-address rate limits will start returning "too many requests" partway through, and tests fail on pages that
are fine.

**What to set up.** Exempt the account — or the address the runs come from —
from rate limiting, or raise the limit for it. Allow-listing the machine that
runs TestForge is usually the simplest form of this.

**Compensate.** Because TestForge is a local tool, the source address is one
you control; an allow-list scoped to it is a small exemption.

### 3. MFA interruption

**The problem.** Multi-factor authentication puts a second step — a code, a
push approval, a security key — between the password and the signed-in page.
TestForge drives only a single username-and-password form and has no way to
complete a second factor. With MFA on, the login lands on the challenge page
instead of the signed-in page and the run stops with a named error (see
[When the login fails](#when-the-login-fails)).

**What to set up.** Exempt the account from MFA, or use an environment where
MFA is not enforced for it. This is the exemption with the largest security
cost, so do not skip the compensations.

**Compensate.** Least privilege (above), a non-production environment, a
strong unique password, network restrictions on where the account can sign in
from, and disable the account when it is not in use.

### 4. New-sign-in alerts

**The problem.** Every run signs in from a brand-new browser with no history.
To the site that looks like a new device, so it may send "new sign-in"
notifications to the account's owner, or — worse — put the sign-in behind a
"confirm it's you" step that blocks it.

**What to set up.** Exempt the account from new-device and new-location
challenges. Send its notifications to a shared or monitored mailbox (or
suppress them for this account) so they neither reach a person's inbox nor
sit unread while blocking a step.

**Compensate.** Keep the alerts *visible to someone* if you can — an alert
about an automation account signing in from somewhere unexpected is still
useful, as long as it does not block the run.

---

## Pointing TestForge at the account

### 1. Put the credentials in environment variables

Credentials are **never** typed into a request, a config file, or generated
code. You give TestForge the **names** of two environment variables, and it
reads the values from its own environment when a run starts.

Set them for the TestForge server process — in your local `.env` (see
[`.env.example`](../.env.example)) or in the shell that starts it. Names are
upper-case letters, digits and underscores:

```
MYAPP_TEST_USER=automation@example.test
MYAPP_TEST_PASS=<a long random password>
```

Environment variables are the only credential source TestForge supports today.
There is no integration with a secret manager; that is a deliberate deferral,
not an oversight.

### 2. Configure the login

**In the app**, open the **Authenticated Run** section (above the generated
suite) and fill it in; leave it blank to run signed out. It applies to the next
run you start, including reruns and continued runs. It is the same block a
direct `POST /api/run` request would carry as its `login` field — the app just
builds it for you. The fields are:

| Field | In the app | Required | What it is |
|---|---|---|---|
| `loginUrl` | Login URL | yes | The login page. A full URL, or a path resolved against the run's `baseUrl`. **Must be on the same origin as `baseUrl`** — the credentials are typed into this page. |
| `usernameSelector` | Username field selector | yes | CSS selector for the username (or email) field. |
| `passwordSelector` | Password field selector | yes | CSS selector for the password field. |
| `submitSelector` | Submit button selector | yes | CSS selector for the submit button. |
| `usernameEnv` | Username environment variable name | yes | The **name** of the environment variable holding the username. |
| `passwordEnv` | Password environment variable name | yes | The **name** of the environment variable holding the password. |
| `postLoginPath` | Signed-in page path | one of these two | A path that is only reached once signed in (e.g. `/dashboard`). |
| `postLoginSelector` | Signed-in element selector | one of these two | A selector for an element that is only visible once signed in (e.g. a "Log out" link). |

The section has no password field, and it will not become one: the two
credential fields take a variable **name**. If what you type in them does not
look like a name (upper case, digits, underscores), the run is blocked in the
app and nothing is sent — so a password pasted there never leaves your browser.
If you fill in some of the login settings but not all, the run is not started
signed out: the missing field is reported by name.

At least one of `postLoginPath` / `postLoginSelector` is required. Without a
signal that only exists when signed in, TestForge could not tell a failed login
from a successful one, and every test would silently run signed out. Use both
for a stricter check.

No other field is accepted. In particular there is no `username` or
`password` field: an inline credential is rejected, whatever it is called.

If you call the API directly instead, this is the `login` part of the request body:

```json
{
  "loginUrl": "/login",
  "usernameSelector": "#username",
  "passwordSelector": "#password",
  "submitSelector": "button[type=submit]",
  "usernameEnv": "MYAPP_TEST_USER",
  "passwordEnv": "MYAPP_TEST_PASS",
  "postLoginPath": "/dashboard",
  "postLoginSelector": "a[href='/logout']"
}
```

### 3. What happens during the run

TestForge opens the login page in a fresh browser, fills the two fields,
submits, and waits for your post-login check. If it passes, the resulting
session is used by every test in that run; each test starts signed in without
logging in itself. The login runs in the same kind of browser context the tests
use, because some sites tie a session to the browser that created it.

---

## When the login fails

A failed login **stops the run before it starts**. No test runs signed out by
accident. The response says why:

| You see | It means |
|---|---|
| `Login config: "<field>" is required.` / `…unrecognized field "<field>"…` / `…must be the NAME of an environment variable in upper case…` / `…must be on the same origin…` / `Login config needs "postLoginPath" or "postLoginSelector"…` | The `login` block is malformed (HTTP 400). Nothing was attempted. |
| `Login credentials are not available: environment variable <NAME> is not set (or is empty)…` | The variable you named is not set for the TestForge server (HTTP 422). Set it and restart the server. |
| `Login failed: could not open the login page <url>…` | The login page could not be reached (HTTP 422). |
| `Login failed: the <username field / password field / submit button> (selector "<selector>") was not found on <url>. Check the login selectors.` | A selector matches nothing visible on the login page (HTTP 422). |
| `Login failed: after submitting the login form the page ended on <path>, and … never appeared. Check the credentials (<VAR> / <VAR>) and the post-login settings.` | The form was submitted but the signed-in signal never showed up (HTTP 422). Wrong credentials, or an exemption above is missing — a locked account, a rate limit, an MFA challenge or a new-device check all look like this. The path it ended on is the clue: `/login` usually means bad credentials; a path like `/verify` or `/mfa` means a challenge. |

Error messages name the variables and selectors. They never contain a
credential value.

---

## What TestForge does with the credentials and the session

- The values are read from the environment when the run starts and used only
  to fill the login form.
- The session the login produces is written to a per-run working directory that
  is deleted when the run ends. It is never stored between runs, and a run that
  is interrupted leaves nothing that survives the next run starting.
- Everything a run hands back — the report, the console output, the saved
  evidence, downloaded traces — is scrubbed of the credentials and of every
  value in the session before it leaves the run. A trace is kept, with the
  values replaced by `[redacted]`.
- The saved run record names the environment variables, never their values.

Two things to know:

- **Screenshots and videos are not scrubbed.** They are images, and they show
  whatever the signed-in page showed. Do not point an automation account at
  pages that display secrets.
- The scrubbing removes what TestForge *knows* is secret — the credentials and
  the session. It cannot know that a page displays something else sensitive.
  That is another reason for a least-privilege account and test data.

---

## What TestForge can and cannot log in to

Supported: a login form **on the site under test** with a username (or email)
field, a password field and a submit button, all on one page.

Not supported:

- **Multi-step logins** (username on one screen, password on the next).
- **MFA, CAPTCHA, and "confirm it's you" challenges.** This is why the
  exemptions above are needed.
- **Single sign-on through another site.** `loginUrl` must be on the same
  origin as the site under test, so a redirect to an identity provider's own
  domain cannot be driven. If your site delegates login that way, you need a
  local sign-in path for the automation account.

TestForge does not try to work out a login flow on its own; if a login does not
fit the above, that is a limit of the config-driven design.

---

## Checklist

- [ ] A dedicated account, not a person's, with the least privilege the tests need.
- [ ] Preferably on a non-production environment, with test data.
- [ ] Exempt from **account lockout**.
- [ ] Exempt from **rate limiting** (or the runner's address is allow-listed).
- [ ] Exempt from **MFA** — with the compensations above.
- [ ] Exempt from **new-sign-in alerts and challenges**, with notifications going somewhere monitored.
- [ ] Username and password set as environment variables for the TestForge server, under upper-case names.
- [ ] A `login` block with the URL, the three selectors, the two variable *names*, and a `postLoginPath` or `postLoginSelector`.
- [ ] Nothing about the account's credentials committed to the repo.
