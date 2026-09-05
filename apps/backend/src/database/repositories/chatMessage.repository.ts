import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";

export function createChatMessage(data: Prisma.chat_messageUncheckedCreateInput) {
  return prisma.chat_message.create({ data });
}

export function getChatMessagesByWorkspaceId(id_workspace: string) {
  return prisma.chat_message.findMany({
    where: { id_workspace },
    orderBy: { id_chat: "asc" },
  });
}

export function getChatMessageById(id_chat: string) {
  return prisma.chat_message.findUnique({
    where: { id_chat },
  });
}

export function updateChatMessage(
  id_chat: string,
  data: Prisma.chat_messageUncheckedUpdateInput,
) {
  return prisma.chat_message.update({
    where: { id_chat },
    data,
  });
}

export function deleteChatMessage(id_chat: string) {
  return prisma.chat_message.delete({
    where: { id_chat },
  });
}

export function deleteChatMessagesByWorkspaceId(id_workspace: string) {
  return prisma.chat_message.deleteMany({
    where: { id_workspace },
  });
}
