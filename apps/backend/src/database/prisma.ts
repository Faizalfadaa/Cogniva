import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (connectionString === undefined) {
    throw new Error("DATABASE_URL belum diisi");
}

const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });