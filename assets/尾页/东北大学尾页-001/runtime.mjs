import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export function mapPageContent(content, intent) {
  const conclusion = content.items.find((item) => item.emphasis) ?? content.items.at(-1);
  const mission = content.items.find((item) => item !== conclusion);
  return renderPayload(intent, "northeastern-university-closing-001", {
    text: [
      mission ? [mission.title, mission.body].filter(Boolean).join("：") : "",
      conclusion?.body || conclusion?.title,
    ].filter(Boolean).join("\n"),
  }, [
    ...(mission ? [mapping(mission.id, "text")] : []),
    ...(conclusion ? [mapping(conclusion.id, "text")] : []),
  ]);
}
