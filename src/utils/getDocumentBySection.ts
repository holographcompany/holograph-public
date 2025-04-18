// /src/utils/getDocumentBySection.ts

import { prisma } from "@/lib/db";
import { debugLog } from "./debug";

export async function getDocumentBySection(
  section: string,
  holographId: string,
  filePath: string
): Promise<any | null> {
  switch (section) {
    case "vital-documents":
      return prisma.vitalDocument.findUnique({
        where: { holographId_filePath: { holographId, filePath } },
        select: {
          id: true,
          holographId: true,
          uploadedBy: true,
          holograph: {
            select: {
              principals: { select: { userId: true } },
              delegates: { select: { userId: true } },
            },
          },
        },
      });

    case "financial-accounts":
      return prisma.financialAccount.findUnique({
        where: { holographId_filePath: { holographId, filePath } },
        select: {
          id: true,
          holographId: true,
          uploadedBy: true,
          holograph: {
            select: {
              principals: { select: { userId: true } },
              delegates: { select: { userId: true } },
            },
          },
        },
      });

      case "insurance-accounts":
      return prisma.insuranceAccount.findUnique({
        where: { holographId_filePath: { holographId, filePath } },
        select: {
          id: true,
          holographId: true,
          uploadedBy: true,
          holograph: {
            select: {
              principals: { select: { userId: true } },
              delegates: { select: { userId: true } },
            },
          },
        },
      });

      case "properties":
      return prisma.property.findUnique({
        where: { holographId_filePath: { holographId, filePath } },
        select: {
          id: true,
          holographId: true,
          uploadedBy: true,
          holograph: {
            select: {
              principals: { select: { userId: true } },
              delegates: { select: { userId: true } },
            },
          },
        },
      });

      case "personal-properties":
      return prisma.personalProperty.findUnique({
        where: { holographId_filePath: { holographId, filePath } },
        select: {
          id: true,
          holographId: true,
          uploadedBy: true,
          holograph: {
            select: {
              principals: { select: { userId: true } },
              delegates: { select: { userId: true } },
            },
          },
        },
      });

      case "utilities":
      return prisma.utility.findUnique({
        where: { holographId_filePath: { holographId, filePath } },
        select: {
          id: true,
          holographId: true,
          uploadedBy: true,
          holograph: {
            select: {
              principals: { select: { userId: true } },
              delegates: { select: { userId: true } },
            },
          },
        },
      });

    // Add more sections here as needed (legal-documents, digital-assets, etc.)

    default:
      throw new Error(`Unsupported section: ${section}`);
  }
}
