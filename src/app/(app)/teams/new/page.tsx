import { CreateTeamForm } from "@/components/features/teams/create-team-form";
import { PageHeader } from "@/components/ui/page-header";
import { normalizeCourseCode } from "@/contracts/common";
import { myCourses } from "@/server/services/teams/service";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "Create a team" };

export default async function NewTeamPage({ searchParams }: PageProps<"/teams/new">) {
  const user = await requirePageUser();
  const { course } = await searchParams;
  const fromLink = typeof course === "string" && course.trim() ? normalizeCourseCode(course) : null;
  const defaultCourse = fromLink ?? (await myCourses(user.id))[0] ?? "";
  return (
    <>
      <PageHeader
        title="Create a team"
        description="You'll be the team's leader. Next you'll get an invite link to share with your teammates."
      />
      <CreateTeamForm defaultCourse={defaultCourse} />
    </>
  );
}
