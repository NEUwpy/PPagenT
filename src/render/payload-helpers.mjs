export function mapping(sourceItemId, parameterPath) {
  return { sourceItemId, parameterPath };
}

export function renderPayload(intent, assetId, parameters, mappings, omissions = []) {
  return {
    schemaVersion: "1.0",
    intentId: intent.intentId,
    assetId,
    parameters,
    mappings,
    omissions,
  };
}
