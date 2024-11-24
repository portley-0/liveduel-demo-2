/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard/markets',
        permanent: true, 
      },
    ];
  },
};

module.exports = nextConfig;
