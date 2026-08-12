import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export function mapPageContent(content, intent) {
  const presenter = content.items.find((item) => item.id === "presenter");
  const organization = content.items.find((item) => item.id === "organization");
  const date = content.items.find((item) => item.id === "date");
  const subtitle = content.items.find((item) => !["presenter", "organization", "date"].includes(item.id));
  return renderPayload(intent, "northeastern-university-cover-001", {
    title: content.title,
    presenter: presenter ? presenter.body || presenter.title : "",
    organization: organization ? organization.body || organization.title : "",
    date: date ? date.body || date.title : "",
    subtitle: subtitle ? subtitle.body || subtitle.title : "",
  }, [
    ...(presenter ? [mapping(presenter.id, "presenter")] : []),
    ...(organization ? [mapping(organization.id, "organization")] : []),
    ...(date ? [mapping(date.id, "date")] : []),
    ...(subtitle ? [mapping(subtitle.id, "subtitle")] : []),
  ]);
}
