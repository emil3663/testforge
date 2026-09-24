import { CollapsibleSection } from "@/app/_components/CollapsibleSection";
import { EMPTY_LOGIN_INPUTS } from "@/app/_lib/derive";
import type { LoginInputs } from "@/app/_lib/derive";
import { LOGIN_FIELD_LABELS } from "@/lib/run/login-fields";
import type { LoginConfigField } from "@/lib/run/login-fields";

interface LoginConfigSectionProps {
    loginInputs: LoginInputs;
    setLoginInputs: (inputs: LoginInputs) => void;
    // Why the run is blocked, if the login settings are unusable as typed.
    loginProblem: string;
    isCollapsed: boolean;
    setIsCollapsed: (updater: (value: boolean) => boolean) => void;
}

const FIELD_HINTS: Record<LoginConfigField, { placeholder: string; help?: string }> = {
    loginUrl: { placeholder: "/login", help: "A path on the site under test, or a full URL on the same origin." },
    usernameSelector: { placeholder: "#username" },
    passwordSelector: { placeholder: "#password" },
    submitSelector: { placeholder: "button[type=submit]" },
    usernameEnv: { placeholder: "MYAPP_TEST_USER" },
    passwordEnv: { placeholder: "MYAPP_TEST_PASS" },
    postLoginPath: { placeholder: "/dashboard", help: "A page only reached once signed in." },
    postLoginSelector: { placeholder: "a[href='/logout']", help: "An element only visible once signed in. Give this or the page above (or both)." },
};

const GROUPS: { title: string; fields: LoginConfigField[] }[] = [
    { title: "The login page", fields: ["loginUrl", "usernameSelector", "passwordSelector", "submitSelector"] },
    { title: "The credentials — variable names only", fields: ["usernameEnv", "passwordEnv"] },
    { title: "How to tell it worked", fields: ["postLoginPath", "postLoginSelector"] },
];

// TFP-097: enter the run's login (TFP-092) in the UI. It carries the same
// fields, under the same rules, as the `login` block of POST /api/run - and
// nothing else. In particular it has no username or password field: the two
// credential fields take the NAME of an environment variable set for the
// TestForge server (Decision 3), never a value, so this section cannot become
// a place to type a real password.
export function LoginConfigSection({ loginInputs, setLoginInputs, loginProblem, isCollapsed, setIsCollapsed }: LoginConfigSectionProps) {
    const isConfigured = Object.values(loginInputs).some((value) => value.trim().length > 0);

    return (
        <CollapsibleSection
            title="Authenticated Run"
            subtitle="Optional. Log in once at the start of a run so every test starts signed in, using a dedicated automation account. Leave everything blank to run signed out."
            collapsed={isCollapsed}
            onToggle={() => setIsCollapsed((value) => !value)}
        >
            <div className="space-y-5">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs leading-6 text-indigo-900">
                    <strong>Never type a password here.</strong> The credentials are read from environment variables
                    set for the TestForge server (a local <span className="font-mono">.env</span>, or the shell that starts it); you
                    only give their <em>names</em>. Use a dedicated automation account with the four exemptions
                    (lockout, rate limiting, MFA, new-sign-in alerts) — see{" "}
                    <span className="font-mono">docs/AUTOMATED_ACCOUNT_SETUP.md</span> before configuring a login.
                </div>

                {GROUPS.map((group) => (
                    <fieldset key={group.title} className="space-y-3">
                        <legend className="text-sm font-medium text-zinc-700">{group.title}</legend>
                        <div className="grid gap-3 md:grid-cols-2">
                            {group.fields.map((field) => {
                                const id = `login-${field}-input`;
                                const hint = FIELD_HINTS[field];

                                return (
                                    <div key={field} className="space-y-1.5">
                                        <label htmlFor={id} className="block text-xs font-medium text-zinc-600">
                                            {LOGIN_FIELD_LABELS[field]}
                                        </label>
                                        {/* Always a plain text input, never a masked one: no field here holds a secret. */}
                                        <input
                                            id={id}
                                            type="text"
                                            autoComplete="off"
                                            spellCheck={false}
                                            aria-label={LOGIN_FIELD_LABELS[field]}
                                            value={loginInputs[field]}
                                            onChange={(event) => setLoginInputs({ ...loginInputs, [field]: event.target.value })}
                                            placeholder={hint.placeholder}
                                            className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                        {hint.help && <p className="text-xs leading-5 text-zinc-500">{hint.help}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </fieldset>
                ))}

                {loginProblem && (
                    <div role="alert" data-testid="login-config-problem" className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                        {loginProblem} Running is blocked until this is fixed, so a run never quietly goes ahead signed out.
                    </div>
                )}

                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500" data-testid="login-config-state">
                        {isConfigured ? "This run will log in first." : "No login configured - runs are signed out."}
                    </span>
                    <button
                        type="button"
                        onClick={() => setLoginInputs({ ...EMPTY_LOGIN_INPUTS })}
                        disabled={!isConfigured}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 disabled:opacity-50"
                    >
                        Clear login settings
                    </button>
                </div>
            </div>
        </CollapsibleSection>
    );
}
