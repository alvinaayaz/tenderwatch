import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  clearRateLimit,
  consumeRateLimit,
  getClientIp,
  rateLimitKey,
} from "@/lib/security/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";

        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!email || !password || password.length > 128) {
          return null;
        }

        const key = rateLimitKey(
          "login",
          `${getClientIp(request)}:${email}`
        );

        const rate = await consumeRateLimit(key, {
          limit: 10,
          windowSeconds: 900,
          blockSeconds: 900,
        });

        if (!rate.allowed) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
          },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const valid = await compare(password, user.passwordHash);

        if (!valid) {
          return null;
        }

        await clearRateLimit(key);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});