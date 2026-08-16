export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

export function text(value) {
  return String(value ?? "").trim();
}

export function cloneParameters(value) {
  return structuredClone(value);
}

export function requireCount(items, minimum, maximum, label) {
  if (!Array.isArray(items) || items.length < minimum || items.length > maximum) {
    throw new Error(`${label}支持 ${minimum}–${maximum} 项`);
  }
  return items;
}

export function itemText(value) {
  if (typeof value === "string") return { title: text(value), body: "" };
  return { title: text(value?.title ?? value?.label ?? value?.body), body: text(value?.body) };
}
