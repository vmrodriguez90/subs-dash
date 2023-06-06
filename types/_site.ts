import type { Plan, Site, User } from "@prisma/client";

export interface AdjacentPlan
  extends Pick<
    Plan,
    "createdAt" | "description" | "image" | "imageBlurhash" | "slug" | "title"
  > {}

export interface _SiteData extends Site {
  user: User | null;
  font: "font-cal" | "font-lora" | "font-work";
  plans: Array<Plan>;
}

export interface _SiteSlugData extends Plan {
  site: _SiteSite | null;
}

interface _SiteSite extends Site {
  user: User | null;
}
