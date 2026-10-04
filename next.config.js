/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    // read-excel-file pulls in unzipper, which has optional requires webpack cannot resolve
    serverComponentsExternalPackages: ["read-excel-file", "unzipper"],
  },
};
