import type { Plan } from "@prisma/client";

export interface MdxCardData
  extends Pick<Plan, "description" | "image" | "imageBlurhash"> {
  name: string | null;
  url: string | null;
}
