import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkTenderPage } from "@/lib/tender-check";
import { compareTenderText } from "@/lib/tender-diff";

type TenderInput = {
  id: string;
  title: string;
  sourceUrl: string;
};

export async function runTenderCheck(tender: TenderInput) {
  const result = await checkTenderPage(tender.sourceUrl);

  const persisted = await prisma.$transaction(
    async (tx) => {
      const previous = await tx.tenderSnapshot.findFirst({
        where: { tenderId: tender.id },
        orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          fingerprint: true,
          contentText: true,
        },
      });

      const snapshot = await tx.tenderSnapshot.create({
        data: {
          tenderId: tender.id,
          fingerprint: result.fingerprint,
          pageTitle: result.title,
          contentText: result.contentText,
          preview: result.preview,
          checkedAt: new Date(result.checkedAt),
        },
        select: {
          id: true,
          fingerprint: true,
          pageTitle: true,
          preview: true,
          checkedAt: true,
        },
      });

      let change = null;

      const comparison = previous
        ? compareTenderText(previous.contentText ?? "", result.contentText)
        : null;

      if (previous && previous.fingerprint !== result.fingerprint) {
        change = await tx.tenderChange.create({
          data: {
            tenderId: tender.id,
            previousSnapshotId: previous.id,
            currentSnapshotId: snapshot.id,
            changeType: "PAGE_TEXT_CHANGED",
            summary:
              comparison?.summary ??
              "The monitored page text differs from the previous successful snapshot. Review the page to determine whether this represents a tender amendment.",
            evidence: {
              previousFingerprint: previous.fingerprint,
              currentFingerprint: result.fingerprint,
              detectionMethod:
                "SHA-256 normalized page-text comparison with segment-level comparison",
              addedCount: comparison?.addedCount ?? 0,
              removedCount: comparison?.removedCount ?? 0,
              addedSamples: comparison?.addedSamples ?? [],
              removedSamples: comparison?.removedSamples ?? [],
            },
          },
          select: {
            id: true,
            changeType: true,
            summary: true,
            detectedAt: true,
          },
        });
      }

      return {
        snapshot,
        change,
        isBaseline: previous === null,
        changeDetected: change !== null,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );

  return { result, persisted };
}