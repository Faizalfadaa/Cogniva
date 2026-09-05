import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";

export function createUser(data: Prisma.usersUncheckedCreateInput) {
  return prisma.users.create({ data });
}

export function getUsers() {
  return prisma.users.findMany({
    orderBy: { username: "asc" },
  });
}

export function getUserById(id_user: string) {
  return prisma.users.findUnique({
    where: { id_user },
  });
}

export function getUserByEmail(email: string) {
  return prisma.users.findUnique({
    where: { email },
  });
}

export function getUserByUsername(username: string) {
  return prisma.users.findUnique({
    where: { username },
  });
}

export function updateUser(
  id_user: string,
  data: Prisma.usersUncheckedUpdateInput,
) {
  return prisma.users.update({
    where: { id_user },
    data,
  });
}

export function deleteUser(id_user: string) {
  return prisma.users.delete({
    where: { id_user },
  });
}
