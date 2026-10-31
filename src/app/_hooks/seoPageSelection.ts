/**
 * The SEO tab's page: the one chosen while it's still in the report, otherwise the first. Derived rather than kept in
 * step by an effect (5a93ecc), so a chosen page that isn't in this report simply isn't shown, and comes back selected
 * if a later report has it.
 */
export function selectSeoPageGroup<Group extends { pageKey: string }>(groups: Group[], selectedKey: string | null): Group | null {
    return groups.find((group) => group.pageKey === selectedKey) ?? groups[0] ?? null;
}
