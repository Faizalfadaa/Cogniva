import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../database/prisma.js";

const SESSION_COOKIE = "cogniva_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const scryptAsync = promisify(scrypt);

export interface AuthUser {
  id: string;
  username: string;
}

interface SessionPayload {
  sub: string;
  username: string;
  exp: number;
}

export async function registerUser(input: {
  username: string;
  password: string;
}): Promise<AuthUser> {
  const username = normalizeUsername(input.username);
  assertPassword(input.password);

  const user = await prisma.users.create({
    data: {
      id_user: `usr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      username,
      password_hash: await hashPassword(input.password),
      email: `${username}@local.cogniva`,
      profile_photo: null,
    },
  });

  return { id: user.id_user, username: user.username };
}

export async function loginUser(input: {
  username: string;
  password: string;
}): Promise<AuthUser | undefined> {
  const username = normalizeUsername(input.username);
  const user = await prisma.users.findUnique({ where: { username } });
  if (!user?.password_hash) return undefined;
  if (!(await verifyPassword(input.password, user.password_hash))) return undefined;
  return { id: user.id_user, username: user.username };
}

export async function getCurrentUser(req: FastifyRequest): Promise<AuthUser | undefined> {
  const token = cookiesOf(req)[SESSION_COOKIE];
  if (!token) return undefined;
  const payload = verifyJwt(token);
  if (!payload) return undefined;
  const user = await prisma.users.findUnique({ where: { id_user: payload.sub } });
  if (!user) return undefined;
  return { id: user.id_user, username: user.username };
}

export function setSessionCookie(reply: FastifyReply, user: AuthUser): void {
  const token = signJwt({
    sub: user.id,
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
  reply.header("Set-Cookie", cookie(SESSION_COOKIE, token, SESSION_MAX_AGE_SECONDS));
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.header("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
}

export function normalizeUsername(username: string): string {
  const value = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(value)) {
    throw new Error("Username harus 3-24 karakter: huruf kecil, angka, atau underscore");
  }
  return value;
}

function assertPassword(password: string): void {
  if (password.length < 8) throw new Error("Password minimal 8 karakter");
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "base64url");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

function signJwt(payload: SessionPayload): string {
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson(payload);
  const signature = hmac(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token: string): SessionPayload | undefined {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return undefined;
  const expected = hmac(`${header}.${body}`);
  if (!safeEqual(signature, expected)) return undefined;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return undefined;
  return payload;
}

function hmac(value: string): string {
  return createHmac("sha256", requiredEnv("JWT_SECRET")).update(value).digest("base64url");
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum diisi`);
  return value;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function cookiesOf(req: FastifyRequest): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return [name, decodeURIComponent(rest.join("="))];
    }),
  );
}

function cookie(name: string, value: string, maxAge: number): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return attrs.join("; ");
}
