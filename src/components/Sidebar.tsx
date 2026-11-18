import { TagChip } from "@/components/TagChip";

export function Sidebar({
  popularTags,
  followedTags,
  signedIn,
}: {
  popularTags: { tag: string; project_count: number }[];
  followedTags: string[];
  signedIn: boolean;
}) {
  return (
    <aside className="flex flex-col gap-4">
      {signedIn && (
        <section className="card p-4">
          <h3 className="eyebrow mb-3">Tags you follow</h3>
          {followedTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {followedTags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Open any tag and hit Follow to build your feed.</p>
          )}
        </section>
      )}

      <section className="card p-4">
        <h3 className="eyebrow mb-3">Popular tags</h3>
        {popularTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {popularTags.map((t) => (
              <TagChip key={t.tag} tag={t.tag} count={Number(t.project_count)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No tags yet. Be the first to post.</p>
        )}
      </section>
    </aside>
  );
}
