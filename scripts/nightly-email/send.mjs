// TFP-217: the summary, sent through Gmail. A send that can't happen throws with the reason, so the notify job fails
// and a missing email shows on GitHub, not as silence. The password goes only to the transport: it's never logged,
// and it's taken out of any error before that error is passed on.

// Phase 48 (TFP-279): the mailbox stays (Decision 4); the email says who sent it under the new name.
const SENDER = "testforgeapp@gmail.com";
const FROM = `"Mr Onion nightly" <${SENDER}>`;
const TIMEOUT_MS = 30_000;

export async function sendSummary({ message, password, to, createTransport }) {
    if (!password) throw new Error("TESTFORGE_SMTP_PASSWORD is not set");
    if (!to?.trim()) throw new Error("CI_REPORT_TO is not set");
    const transport = createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: SENDER, pass: password },
        connectionTimeout: TIMEOUT_MS,
        greetingTimeout: TIMEOUT_MS,
        socketTimeout: TIMEOUT_MS,
    });
    try {
        return await transport.sendMail({ from: FROM, to: to.trim(), subject: message.subject, text: message.body });
    } catch (error) {
        throw new Error(`the send failed (${error.code ?? "no code"}): ${String(error.message).replaceAll(password, "***")}`);
    }
}
