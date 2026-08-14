import { resolveCatalogLayout } from "./layout-contract.mjs";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
})[character]);

export function renderCatalogAgenda(host, { items, activeIndex = null }) {
  const layout = resolveCatalogLayout(items.length);
  host.replaceChildren();
  host.className = "catalog-agenda";
  items.forEach((item, index) => {
    const frame = layout.frames[index];
    const card = document.createElement("article");
    card.className = `catalog-card${activeIndex === index ? " is-active" : ""}${frame.height < 300 ? " is-compact" : ""}`;
    card.style.cssText = `left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px`;
    card.innerHTML = `
      <span class="catalog-number">${String(index + 1).padStart(2, "0")}</span>
      <strong class="catalog-label">${escapeHtml(item.title)}</strong>
      ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
    `;
    host.append(card);
  });
  return layout;
}
