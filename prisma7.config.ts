import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

import { defineConfig } from "prisma/config";

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  throw new Error("DIRECT_URL is not defined in .env.local");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
  },
});