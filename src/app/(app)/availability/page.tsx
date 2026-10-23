import Link from "next/link";
import { AvailabilityEditor } from "@/components/features/availability/availability-editor";
import { PageHeader } from "@/components/ui/page-header";
import { getMyAvailability } from "@/server/services/availability/service";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "My availability" };

export default async function AvailabilityPage() {
  const user = await requirePageUser();
  const availability = await getMyAvailability(user.id);
  return (
    <>
      <PageHeader
        title="My availability"
        description={
          <>
            Times are in your time zone: {availability.timezone.replaceAll("_", " ")} ·{" "}
            <Link href="/profile" className="text-brand-700 font-medium hover:underline">
              Change in Profile
            </Link>
          </>
        }
      />
      <AvailabilityEditor initial={availability} />
    </>
  );
}
