import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  users: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  workspace: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  chat_message: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  checkpoint: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  report: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  learned: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  confused: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../prisma", () => ({
  prisma: prismaMock,
}));

import {
  addConfusedItem,
  addLearnedItem,
  createChatMessage,
  createCheckpoint,
  createReportWithDetails,
  createUser,
  createWorkspace,
  deleteChatMessagesByWorkspaceId,
  deleteConfusedItem,
  deleteLearnedItem,
  getReportWithDetails,
  getWorkspaceWithDetails,
  updateUser,
} from "../../index";

describe("database repositories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wraps users CRUD with the expected Prisma calls", async () => {
    const user = {
      id_user: "user-1",
      username: "nara",
      password_hash: "hash",
      email: "nara@example.com",
      profile_photo: "photo.png",
    };

    prismaMock.users.create.mockResolvedValue(user);
    prismaMock.users.update.mockResolvedValue({ ...user, username: "ara" });

    await expect(createUser(user)).resolves.toEqual(user);
    expect(prismaMock.users.create).toHaveBeenCalledWith({ data: user });

    await updateUser("user-1", { username: "ara" });
    expect(prismaMock.users.update).toHaveBeenCalledWith({
      where: { id_user: "user-1" },
      data: { username: "ara" },
    });
  });

  it("creates workspace, chat message, and checkpoint records", async () => {
    const workspace = {
      id_workspace: "workspace-1",
      id_user: "user-1",
      title: "Physics",
      state: "active",
      whiteboard_snapshot: "{}",
    };
    const chatMessage = {
      id_chat: "chat-1",
      id_workspace: "workspace-1",
      sender: "user",
      content: "hello",
    };
    const checkpoint = {
      id_checkpoint: "checkpoint-1",
      id_workspace: "workspace-1",
      snapshot_image: "image.png",
      whiteboard_snapshot: "{}",
      audio_text: "audio",
    };

    await createWorkspace(workspace);
    await createChatMessage(chatMessage);
    await createCheckpoint(checkpoint);

    expect(prismaMock.workspace.create).toHaveBeenCalledWith({ data: workspace });
    expect(prismaMock.chat_message.create).toHaveBeenCalledWith({
      data: chatMessage,
    });
    expect(prismaMock.checkpoint.create).toHaveBeenCalledWith({
      data: checkpoint,
    });
  });

  it("fetches workspace details with related records", async () => {
    await getWorkspaceWithDetails("workspace-1");

    expect(prismaMock.workspace.findUnique).toHaveBeenCalledWith({
      where: { id_workspace: "workspace-1" },
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
  });

  it("creates a report with learned and confused details", async () => {
    prismaMock.report.create.mockResolvedValue({ id_report: "report-1" });

    await createReportWithDetails({
      id_report: "report-1",
      id_workspace: "workspace-1",
      letter: "Good progress",
      reflection: "Needs clearer examples",
      learned: [{ id_learner: "learned-1", content: "Newton law" }],
      confused: [{ id_confused: "confused-1", content: "Friction" }],
    });

    expect(prismaMock.report.create).toHaveBeenCalledWith({
      data: {
        id_report: "report-1",
        id_workspace: "workspace-1",
        letter: "Good progress",
        reflection: "Needs clearer examples",
        created_at: undefined,
      },
    });
    expect(prismaMock.learned.createMany).toHaveBeenCalledWith({
      data: [
        {
          id_learner: "learned-1",
          id_report: "report-1",
          content: "Newton law",
        },
      ],
    });
    expect(prismaMock.confused.createMany).toHaveBeenCalledWith({
      data: [
        {
          id_confused: "confused-1",
          id_report: "report-1",
          content: "Friction",
        },
      ],
    });
    expect(prismaMock.report.findUnique).toHaveBeenCalledWith({
      where: { id_report: "report-1" },
      include: {
        learned: true,
        confused: true,
      },
    });
  });

  it("uses composite keys for learned and confused updates/deletes", async () => {
    await deleteLearnedItem("learned-1", "report-1");
    await deleteConfusedItem("confused-1", "report-1");

    expect(prismaMock.learned.delete).toHaveBeenCalledWith({
      where: {
        id_learner_id_report: {
          id_learner: "learned-1",
          id_report: "report-1",
        },
      },
    });
    expect(prismaMock.confused.delete).toHaveBeenCalledWith({
      where: {
        id_confused_id_report: {
          id_confused: "confused-1",
          id_report: "report-1",
        },
      },
    });
  });

  it("keeps report and workspace scoped helper queries available", async () => {
    await getReportWithDetails("report-1");
    await deleteChatMessagesByWorkspaceId("workspace-1");
    await addLearnedItem({
      id_learner: "learned-1",
      id_report: "report-1",
      content: "Clear topic",
    });
    await addConfusedItem({
      id_confused: "confused-1",
      id_report: "report-1",
      content: "Needs review",
    });

    expect(prismaMock.report.findUnique).toHaveBeenCalledWith({
      where: { id_report: "report-1" },
      include: {
        learned: true,
        confused: true,
      },
    });
    expect(prismaMock.chat_message.deleteMany).toHaveBeenCalledWith({
      where: { id_workspace: "workspace-1" },
    });
    expect(prismaMock.learned.create).toHaveBeenCalled();
    expect(prismaMock.confused.create).toHaveBeenCalled();
  });
});
