/** TFP-257: a TestForge version and the commit it ran from (null where git couldn't say). */
export interface ProducedBy {
    version: string;
    commit: string | null;
}
