import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export function mapPageContent(content, intent) {
  const presenter = content.items.find((item) => item.id === "presenter");
  const date = content.items.find((item) => item.id === "date");
  const subtitle = content.items.find((item) => !["presenter", "date"].includes(item.id));
  return renderPayload(intent, "northeastern-university-cover-001", {
    title: content.title,
    presenter: presenter ? presenter.body || presenter.title : "",
    date: date ? date.body || date.title : "",
    subtitle: subtitle ? subtitle.body || subtitle.title : "",
  }, [
    ...(presenter ? [mapping(presenter.id, "presenter")] : []),
    ...(date ? [mapping(date.id, "date")] : []),
    ...(subtitle ? [mapping(subtitle.id, "subtitle")] : []),
  ]);
}
