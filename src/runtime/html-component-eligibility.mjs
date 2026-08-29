import fs from "node:fs/promises";
import path from "node:path";

async function readJsonIfPresent(target) {
  try {
    return JSON.parse(await fs.readFile(target, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function inspectHtmlComponentEligibility(assetDir, assetId) {
  const intentPath = path.join(assetDir, "visual-intent.md");
  const htmlApprovalPath = path.join(assetDir, "html-approval.json");
  const approvalPath = path.join(assetDir, "user-approval.json");
  const [intent, htmlApproval, approval] = await Promise.all([
    fs.readFile(intentPath, "utf8").catch((error) => error.code === "ENOENT" ? null : Promise.reject(error)),
    readJsonIfPresent(htmlApprovalPath),
    readJsonIfPresent(approvalPath),
  ]);
  const hasVisualIntent = Boolean(intent?.trim());
  const finalApproved = Boolean(
    approval
    && approval.schemaVersion === "1.0"
    && approval.assetId === assetId
    && approval.decision === "approved"
    && approval.scope === "html-golden-and-native",
  );
  const htmlApproved = finalApproved || Boolean(
    htmlApproval
    && htmlApproval.schemaVersion === "1.0"
    && htmlApproval.assetId === assetId
    && htmlApproval.decision === "approved"
    && htmlApproval.scope === "html-golden",
  );
  return {
    eligible: hasVisualIntent && finalApproved,
    hasVisualIntent,
    htmlApproved,
    userApproved: finalApproved,
    stage: !hasVisualIntent
      ? "requires-redistillation"
      : finalApproved
        ? "user-approved"
        : htmlApproved
          ? "awaiting-native-review"
          : "awaiting-html-review",
  };
}
