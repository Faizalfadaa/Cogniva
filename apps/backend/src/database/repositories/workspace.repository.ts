import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";

export function createWorkspace(data: Prisma.workspaceUncheckedCreateInput) {
  return prisma.workspace.create({ data });
}

export function getWorkspaces() {
  return prisma.workspace.findMany({
    orderBy: { title: "asc" },
  });
}

export function getWorkspaceById(id_workspace: string) {
  return prisma.workspace.findUnique({
    where: { id_workspace },
  });
}

export function getWorkspaceWithDetails(id_workspace: string) {
  return prisma.workspace.findUnique({
    where: { id_workspace },
    include: {
      users: true,
      checkpoint: true,
      chat_message: true,
      report: {
        include: {
          learned: true,
          confused: true,
        },
      },
    },
  });
}

export function getWorkspacesByUserId(id_user: string) {
  return prisma.workspace.findMany({
    where: { id_user },
    orderBy: { title: "asc" },
  });
}

export function updateWorkspace(
  id_workspace: string,
  data: Prisma.workspaceUncheckedUpdateInput,
) {
  return prisma.workspace.update({
    where: { id_workspace },
    data,
  });
}

export function deleteWorkspace(id_workspace: string) {
  return prisma.workspace.delete({
    where: { id_workspace },
  });
}
