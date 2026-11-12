import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { runableManagedAuth } from "@runablehq/managed-auth/server";
import { db } from "./database";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "clerk", input: true },
      companyName: { type: "string", required: false, input: true },
      phone: { type: "string", required: false, input: true },
      disabled: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    return origin ? [origin] : ["*"];
  },
  plugins: [
    ...runableManagedAuth({
      applicationId: process.env.APPLICATION_ID!,
      issuer: process.env.VITE_RUNABLE_AUTH_ISSUER!,
    }),
    expo(),
  ],
});
