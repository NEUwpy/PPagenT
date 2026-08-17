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
  const approvalPath = path.join(assetDir, "user-approval.json");
  const [intent, approval] = await Promise.all([
    fs.readFile(intentPath, "utf8").catch((error) => error.code === "ENOENT" ? null : Promise.reject(error)),
    readJsonIfPresent(approvalPath),
  ]);
  const hasVisualIntent = Boolean(intent?.trim());
  const userApproved = Boolean(
    approval
    && approval.schemaVersion === "1.0"
    && approval.assetId === assetId
    && approval.decision === "approved"
    && approval.scope === "html-golden-and-native",
  );
  return {
    eligible: hasVisualIntent && userApproved,
    hasVisualIntent,
    userApproved,
    stage: !hasVisualIntent ? "requires-redistillation" : userApproved ? "user-approved" : "awaiting-user-review",
  };
}
