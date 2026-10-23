/** PB-02 · FR-01 — read and update the signed-in user's own profile. Writes only profile fields on `user`. */
import type { ProfileDTO, UpdateProfileInput } from "@/contracts/profile";
import { db } from "@/server/db";
import { errors } from "@/server/errors";
import { iso } from "@/server/mappers";
import { dedupeCourses, dedupeSkills } from "./normalize";

const profileSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  timezone: true,
  courses: true,
  skills: true,
  bio: true,
  createdAt: true,
} as const;

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
  courses: string[];
  skills: string[];
  bio: string | null;
  createdAt: Date;
};

function toProfileDTO(u: ProfileRow): ProfileDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    timezone: u.timezone,
    courses: u.courses,
    skills: u.skills,
    bio: u.bio,
    createdAt: iso(u.createdAt),
  };
}

export async function getProfile(userId: string): Promise<ProfileDTO> {
  const user = await db.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw errors.notFound("Your profile");
  return toProfileDTO(user);
}

/**
 * Partial update: only the fields present in `input` change. Courses are normalized and de-duplicated, skills are
 * de-duplicated case-insensitively, both keep the user's order. An empty bio is stored as null. Email is not editable.
 */
export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileDTO> {
  await getProfile(userId); // 404 before writing if the user is gone
  const bio = input.bio === undefined ? undefined : input.bio?.trim() || null;
  const user = await db.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      timezone: input.timezone,
      courses: input.courses === undefined ? undefined : dedupeCourses(input.courses),
      skills: input.skills === undefined ? undefined : dedupeSkills(input.skills),
      bio,
    },
    select: profileSelect,
  });
  return toProfileDTO(user);
}
