/** TFP-257: a Mr Onion version and the commit it ran from (null where git couldn't say). */
export interface ProducedBy {
    version: string;
    commit: string | null;
}
