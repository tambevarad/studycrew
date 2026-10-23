import { CalendarClock } from "lucide-react";
import { ProfileForm } from "@/components/features/profile/profile-form";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getProfile } from "@/server/services/profile/service";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "Your profile" };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const user = await requirePageUser();
  const [profile, { welcome }] = await Promise.all([getProfile(user.id), searchParams]);
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Your courses and skills help teammates find you. Your time zone sets how every time is shown."
        actions={
          <LinkButton href="/availability" variant="outline">
            <CalendarClock aria-hidden />
            Edit my availability
          </LinkButton>
        }
      />
      {welcome === "1" ? (
        <Alert tone="success" className="mb-6">
          Welcome! Add your courses so teammates can find you.
        </Alert>
      ) : null}
      <ProfileForm profile={profile} timeZones={Intl.supportedValuesOf("timeZone")} />
    </>
  );
}
