import { ArtifactLinkList } from "@/app/_components/ArtifactLinkList";
import { EmptyState } from "@/app/_components/EmptyState";
import type { ReportArtifactItem } from "@/lib/report/types";

export function SessionEvidenceList({ items }: { items: ReportArtifactItem[] }) {
    return items.length > 0 ? (
        <ArtifactLinkList items={items} />
    ) : (
        <EmptyState message="No session evidence artifacts were captured for this run." />
    );
}

