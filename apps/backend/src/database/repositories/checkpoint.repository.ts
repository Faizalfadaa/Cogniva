import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";

export function createCheckpoint(data: Prisma.checkpointUncheckedCreateInput) {
  return prisma.checkpoint.create({ data });
}

export function getCheckpointById(id_checkpoint: string) {
  return prisma.checkpoint.findUnique({
    where: { id_checkpoint },
  });
}

export function getCheckpointsByWorkspaceId(id_workspace: string) {
  return prisma.checkpoint.findMany({
    where: { id_workspace },
    orderBy: { id_checkpoint: "asc" },
  });
}

export function updateCheckpoint(
  id_checkpoint: string,
  data: Prisma.checkpointUncheckedUpdateInput,
) {
  return prisma.checkpoint.update({
    where: { id_checkpoint },
    data,
  });
}

export function deleteCheckpoint(id_checkpoint: string) {
  return prisma.checkpoint.delete({
    where: { id_checkpoint },
  });
}

export function deleteCheckpointsByWorkspaceId(id_workspace: string) {
  return prisma.checkpoint.deleteMany({
    where: { id_workspace },
  });
}
