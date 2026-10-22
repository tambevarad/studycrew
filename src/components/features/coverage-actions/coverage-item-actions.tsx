/**
 * SLOT COMPONENT — owned by PB-11 (AI suggestion → task, rating). PB-10's report page renders
 * <CoverageItemActions teamId={…} item={…} /> in each requirement row. PB-11 replaces the body
 * ("Create task" + helpful/not helpful); keep the export name and props.
 */
import type { CoverageItemDTO } from "@/contracts/coverage";

export function CoverageItemActions(props: { teamId: string; item: CoverageItemDTO }) {
  void props;
  return null;
}
