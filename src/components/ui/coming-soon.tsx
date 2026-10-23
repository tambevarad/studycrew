import { EmptyState } from "./empty-state";

/** Placeholder for a page whose backlog item is not merged yet. The owner replaces the whole page file. */
export function ComingSoon({ item, title, owner }: { item: string; title: string; owner: string }) {
  return (
    <EmptyState
      title={`${title} is on the way`}
      description={`This screen is being built in ${item} (owner: ${owner}). See docs/tasks/${item}.md.`}
    />
  );
}
