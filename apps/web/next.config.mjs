/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // @rpc/engine is a workspace TS package consumed via its built dist.
  transpilePackages: ["@rpc/engine"],
  experimental: {
    // Ensure the engine (ESM) and prisma are treated as server externals cleanly.
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
