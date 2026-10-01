// Phase 35 (TFP-133): helpers the passive security checks share, written
// once at the top of a Comprehensive security suite. Kept as a raw string so
// the regular expressions reach the generated file exactly as written here:
// String.raw keeps every backslash, and the block avoids "${" and backticks
// (\x60 stands for a backtick inside a pattern).

export const PASSIVE_SECURITY_HELPERS = String.raw`// Query parameters that carry a password, token or session id.
const TF_SENSITIVE_PARAM = /^(password|passwd|pwd|pass|token|access_token|auth_token|id_token|refresh_token|api_key|apikey|secret|session|sessionid|session_id|sid|jsessionid|phpsessid|jwt)$/i;

function tfSensitiveParams(url: string): string[] {
  try {
    return [...new URL(url).searchParams.entries()].filter(([name, value]) => TF_SENSITIVE_PARAM.test(name) && value !== '').map(([name]) => name);
  } catch {
    return [];
  }
}

// A host only the person running the site can reach: the browser's own
// "potentially trustworthy" loopback names.
function tfIsLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host);
}

// What an error page must not show (ASVS 16.5.1): stack traces and server file paths.
const TF_ERROR_LEAKS: Array<[string, RegExp]> = [
  ['a Python traceback', /Traceback \(most recent call last\)/],
  ['a JavaScript stack trace', /\n\s*at [^\s()]+ \([^()\n]+:\d+:\d+\)/],
  ['a Java stack trace', /\bat [\w$.]+\([\w$]+\.java:\d+\)/],
  ['a .NET stack trace', /\bat [\w.<>]+\([^)\n]*\) in [^\n]+:line \d+/],
  ['a PHP error', /\b(Fatal error|Parse error|Warning|Notice)(<\/b>)?:[^\n]{0,300}? in (<b>)?[^<\s]+\.php(<\/b>)? on line/],
  ['a Ruby stack trace', /\.rb:\d+:in \x60/],
  ['a Go panic', /goroutine \d+ \[running\]/],
  ['a server file path', /[A-Za-z]:\\(?:[\w .-]+\\)+[\w.-]+\.(?:js|mjs|cjs|ts|py|rb|php|java|cs|go)\b|\/(?:home|var|usr|srv|opt|app|Users|www)\/[\w.\/-]+\.(?:js|mjs|cjs|ts|py|rb|php|java|cs|go)\b/],
];
`;
