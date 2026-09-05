import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";

type ReportDetailInput = {
  id_report: string;
  id_workspace: string;
  letter: string;
  reflection: string;
  created_at?: Date | string;
  learned?: Array<{
    id_learner: string;
    content: string;
  }>;
  confused?: Array<{
    id_confused: string;
    content: string;
  }>;
};

export function createReport(data: Prisma.reportUncheckedCreateInput) {
  return prisma.report.create({ data });
}

export async function createReportWithDetails(data: ReportDetailInput) {
  const report = await prisma.report.create({
    data: {
      id_report: data.id_report,
      id_workspace: data.id_workspace,
      letter: data.letter,
      reflection: data.reflection,
      created_at: data.created_at,
    },
  });

  if (data.learned !== undefined && data.learned.length > 0) {
    await prisma.learned.createMany({
      data: data.learned.map((item) => ({
        id_learner: item.id_learner,
        id_report: report.id_report,
        content: item.content,
      })),
    });
  }

  if (data.confused !== undefined && data.confused.length > 0) {
    await prisma.confused.createMany({
      data: data.confused.map((item) => ({
        id_confused: item.id_confused,
        id_report: report.id_report,
        content: item.content,
      })),
    });
  }

  return getReportWithDetails(report.id_report);
}

export function getReportById(id_report: string) {
  return prisma.report.findUnique({
    where: { id_report },
  });
}

export function getReportWithDetails(id_report: string) {
  return prisma.report.findUnique({
    where: { id_report },
    include: {
      learned: true,
      confused: true,
    },
  });
}

export function getReportsByWorkspaceId(id_workspace: string) {
  return prisma.report.findMany({
    where: { id_workspace },
    orderBy: { created_at: "desc" },
    include: {
      learned: true,
      confused: true,
    },
  });
}

export function updateReport(
  id_report: string,
  data: Prisma.reportUncheckedUpdateInput,
) {
  return prisma.report.update({
    where: { id_report },
    data,
  });
}

export function deleteReport(id_report: string) {
  return prisma.report.delete({
    where: { id_report },
  });
}

export function addLearnedItem(data: Prisma.learnedUncheckedCreateInput) {
  return prisma.learned.create({ data });
}

export function getLearnedByReportId(id_report: string) {
  return prisma.learned.findMany({
    where: { id_report },
    orderBy: { id_learner: "asc" },
  });
}

export function updateLearnedItem(
  id_learner: string,
  id_report: string,
  data: Prisma.learnedUncheckedUpdateInput,
) {
  return prisma.learned.update({
    where: {
      id_learner_id_report: {
        id_learner,
        id_report,
      },
    },
    data,
  });
}

export function deleteLearnedItem(id_learner: string, id_report: string) {
  return prisma.learned.delete({
    where: {
      id_learner_id_report: {
        id_learner,
        id_report,
      },
    },
  });
}

export function addConfusedItem(data: Prisma.confusedUncheckedCreateInput) {
  return prisma.confused.create({ data });
}

export function getConfusedByReportId(id_report: string) {
  return prisma.confused.findMany({
    where: { id_report },
    orderBy: { id_confused: "asc" },
  });
}

export function updateConfusedItem(
  id_confused: string,
  id_report: string,
  data: Prisma.confusedUncheckedUpdateInput,
) {
  return prisma.confused.update({
    where: {
      id_confused_id_report: {
        id_confused,
        id_report,
      },
    },
    data,
  });
}

export function deleteConfusedItem(id_confused: string, id_report: string) {
  return prisma.confused.delete({
    where: {
      id_confused_id_report: {
        id_confused,
        id_report,
      },
    },
  });
}
