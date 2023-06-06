import { cache } from "react";
import type { _SiteData } from "@/types";
import prisma from "@/lib/prisma";
import remarkMdx from "remark-mdx";
import { remark } from "remark";
import { serialize } from "next-mdx-remote/serialize";
import { replaceExamples, replaceTweets } from "@/lib/remark-plugins";

export const getSiteData = cache(async (site: string): Promise<_SiteData> => {
  let filter: {
    subdomain?: string;
    customDomain?: string;
  } = {
    subdomain: site,
  };

  if (site.includes(".")) {
    filter = {
      customDomain: site,
    };
  }

  const data = (await prisma.site.findUnique({
    where: filter,
    include: {
      user: true,
      plans: {
        where: {
          published: true,
        },
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
      },
    },
  })) as _SiteData;

  return data;
});

export const getPlanData = cache(async (site: string, slug: string) => {
  let filter: {
    subdomain?: string;
    customDomain?: string;
  } = {
    subdomain: site,
  };

  if (site.includes(".")) {
    filter = {
      customDomain: site,
    };
  }

  const data = await prisma.plan.findFirst({
    where: {
      site: {
        ...filter,
      },
      slug,
    },
    include: {
      site: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!data) return { notFound: true, revalidate: 10 };

  const [mdxSource, adjacentPlans] = await Promise.all([
    getMdxSource(data.content!),
    prisma.plan.findMany({
      where: {
        site: {
          ...filter,
        },
        published: true,
        NOT: {
          id: data.id,
        },
      },
      select: {
        slug: true,
        title: true,
        createdAt: true,
        description: true,
        image: true,
        imageBlurhash: true,
      },
    }),
  ]);

  return {
    data: {
      ...data,
      mdxSource,
    },
    adjacentPlans,
  };
});

async function getMdxSource(planContents: string) {
  // Serialize the content string into MDX
  const mdxSource = await serialize(planContents, {
    mdxOptions: {
      remarkPlugins: [replaceTweets, () => replaceExamples(prisma)],
    },
  });

  return mdxSource;
}
