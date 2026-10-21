/**
 * Phase 39 (TFP-157, Decision 10's ownership row): whether a site has a valid ownership confirmation covering a host,
 * which lifts the worker cap and the request cap.
 *
 * A stub until Phase 43 (TFP-220 replaces it with the site's saved confirmation, Phase 43 Decision 14): no host
 * carries a confirmation yet, so every remote host gets the capped row. Tests set a stub lookup to prove the row;
 * nothing in the app can.
 */
export type OwnershipLookup = (baseUrl: string | undefined) => boolean | Promise<boolean>;

const noConfirmation: OwnershipLookup = () => false;
let lookup: OwnershipLookup = noConfirmation;

export async function hasOwnershipConfirmation(baseUrl: string | undefined): Promise<boolean> {
    return Boolean(await lookup(baseUrl));
}

/** Tests only: a stub confirmation lookup, or null for the app's (none). */
export function setOwnershipLookupForTests(stub: OwnershipLookup | null) {
    lookup = stub ?? noConfirmation;
}
