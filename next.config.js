/**
 * @type {import('next').NextConfig}
 */
module.exports = {
  images: {
    domains: [
      "res.cloudinary.com",
      "abs.twimg.com",
      "pbs.twimg.com",
      "avatars.githubusercontent.com",
      "lh3.googleusercontent.com"
    ],
  },
  reactStrictMode: true,
  swcMinify: false, // Required to fix: https://nextjs.org/docs/messages/failed-loading-swc
};
