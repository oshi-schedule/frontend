import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next dev resources to load when the app is opened from another device
  // on the local network, e.g. http://192.168.100.28:3000 during phone testing.
  allowedDevOrigins: ["192.168.100.28"],
};

export default nextConfig;
