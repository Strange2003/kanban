import { betterAuth } from "better-auth";
import { authPlugins } from "../lib/auth-plugins";

/**
 * Only for `npm run auth:generate` (db/auth-schema.ts). The Better Auth CLI
 * can't resolve the "@/" path alias lib/auth.ts uses, so it reads this
 * alias-free config instead: the same plugins (lib/auth-plugins.ts) and the
 * same core features that add tables or columns. Never imported by the app.
 */
export const auth = betterAuth({
  emailAndPassword: { enabled: true },
  plugins: authPlugins,
});
