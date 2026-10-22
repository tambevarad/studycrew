/**
 * SLOT COMPONENT — owned by PB-09 (activity history). PB-12's dashboard renders
 * <RecentActivity teamId limit={5} />. PB-09 replaces the body with a Server Component
 * that lists the latest events; keep the export name and props.
 */
export async function RecentActivity(props: { teamId: string; limit?: number }) {
  void props;
  return null;
}
