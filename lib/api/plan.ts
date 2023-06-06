import prisma from "@/lib/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { unstable_getServerSession } from "next-auth/next";
import { authOptions } from "pages/api/auth/[...nextauth]";
import type { Plan, Site } from ".prisma/client";
import type { Session } from "next-auth";
import { revalidate } from "@/lib/revalidate";
import { getBlurDataURL, placeholderBlurhash } from "@/lib/utils";

import type { WithSitePlan } from "@/types";

interface AllPlans {
  plans: Array<Plan>;
  site: Site | null;
}

/**
 * Get Plans
 *
 * Fetches & returns either a single or all plans available depending on
 * whether a `planId` query parameter is provided. If not all plans are
 * returned in descending order.
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function getPlan(
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session
): Promise<void | NextApiResponse<AllPlans | (WithSitePlan | null)>> {
  const { planId, siteId, published } = req.query;

  if (
    Array.isArray(planId) ||
    Array.isArray(siteId) ||
    Array.isArray(published) ||
    !session.user.id
  )
    return res.status(400).end("Bad request. Query parameters are not valid.");

  try {
    if (planId) {
      const plan = await prisma.plan.findFirst({
        where: {
          id: planId,
          site: {
            user: {
              id: session.user.id,
            },
          },
        },
        include: {
          site: true,
        },
      });

      return res.status(200).json(plan);
    }

    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        user: {
          id: session.user.id,
        },
      },
    });

    const plans = !site
      ? []
      : await prisma.plan.findMany({
          where: {
            site: {
              id: siteId,
            },
            published: JSON.parse(published || "true"),
          },
          orderBy: {
            createdAt: "desc",
          },
        });

    return res.status(200).json({
      plans,
      site,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}

/**
 * Create Plan
 *
 * Creates a new plan from a provided `siteId` query parameter.
 *
 * Once created, the sites new `planId` will be returned.
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function createPlan(
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session
): Promise<void | NextApiResponse<{
  planId: string;
}>> {
  const { siteId } = req.query;

  if (!siteId || typeof siteId !== "string" || !session?.user?.id) {
    return res
      .status(400)
      .json({ error: "Missing or misconfigured site ID or session ID" });
  }

  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      user: {
        id: session.user.id,
      },
    },
  });
  if (!site) return res.status(404).end("Site not found");

  try {
    const response = await prisma.plan.create({
      data: {
        image: `/placeholder.png`,
        imageBlurhash: placeholderBlurhash,
        site: {
          connect: {
            id: siteId,
          },
        },
      },
    });

    return res.status(201).json({
      planId: response.id,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}

/**
 * Delete Plan
 *
 * Deletes a plan from the database using a provided `planId` query
 * parameter.
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function deletePlan(
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session
): Promise<void | NextApiResponse> {
  const { planId } = req.query;

  if (!planId || typeof planId !== "string" || !session?.user?.id) {
    return res
      .status(400)
      .json({ error: "Missing or misconfigured site ID or session ID" });
  }

  const site = await prisma.site.findFirst({
    where: {
      plans: {
        some: {
          id: planId,
        },
      },
      user: {
        id: session.user.id,
      },
    },
  });
  if (!site) return res.status(404).end("Site not found");

  try {
    const response = await prisma.plan.delete({
      where: {
        id: planId,
      },
      include: {
        site: {
          select: { subdomain: true, customDomain: true },
        },
      },
    });
    if (response?.site?.subdomain) {
      // revalidate for subdomain
      await revalidate(
        `https://${response.site?.subdomain}.vercel.pub`, // hostname to be revalidated
        response.site.subdomain, // siteId
        response.slug // slugname for the plan
      );
    }
    if (response?.site?.customDomain)
      // revalidate for custom domain
      await revalidate(
        `https://${response.site.customDomain}`, // hostname to be revalidated
        response.site.customDomain, // siteId
        response.slug // slugname for the plan
      );

    return res.status(200).end();
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}

/**
 * Update Plan
 *
 * Updates a plan & all of its data using a collection of provided
 * query parameters. These include the following:
 *  - id
 *  - title
 *  - description
 *  - content
 *  - slug
 *  - image
 *  - imageBlurhash
 *  - published
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function updatePlan(
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session
): Promise<void | NextApiResponse<Plan>> {
  const {
    id,
    title,
    description,
    content,
    slug,
    image,
    published,
    subdomain,
    customDomain,
  } = req.body;

  if (!id || typeof id !== "string" || !session?.user?.id) {
    return res
      .status(400)
      .json({ error: "Missing or misconfigured site ID or session ID" });
  }

  const site = await prisma.site.findFirst({
    where: {
      plans: {
        some: {
          id,
        },
      },
      user: {
        id: session.user.id,
      },
    },
  });
  if (!site) return res.status(404).end("Site not found");

  try {
    const plan = await prisma.plan.update({
      where: {
        id: id,
      },
      data: {
        title,
        description,
        content,
        slug,
        image,
        imageBlurhash: (await getBlurDataURL(image)) ?? undefined,
        published,
      },
    });
    if (subdomain) {
      // revalidate for subdomain
      await revalidate(
        `https://${subdomain}.vercel.pub`, // hostname to be revalidated
        subdomain, // siteId
        slug // slugname for the plan
      );
    }
    if (customDomain)
      // revalidate for custom domain
      await revalidate(
        `https://${customDomain}`, // hostname to be revalidated
        customDomain, // siteId
        slug // slugname for the plan
      );

    return res.status(200).json(plan);
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}
