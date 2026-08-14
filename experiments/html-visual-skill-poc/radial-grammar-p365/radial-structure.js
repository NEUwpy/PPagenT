(function attachRadialStructure(global) {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));

  function normalizeItems(props) {
    const source = Array.isArray(props.items) ? props.items : [];
    const requested = Array.isArray(props.visibleItems)
      ? source.filter((item) => props.visibleItems.includes(item.id || item.title))
      : source.slice(0, Math.max(0, Number(props.count ?? source.length)));
    return requested;
  }

  function allocationForCount(count) {
    const odd = count % 2 === 1;
    const leftCount = Math.floor(count / 2);
    const rightCount = Math.ceil(count / 2);
    let leftRow = 0;
    let rightRow = 0;
    return Array.from({ length: count }, (_, index) => {
      const side = odd && index === count - 1 ? "right" : (index % 2 === 0 ? "left" : "right");
      const row = side === "left" ? leftRow++ : rightRow++;
      return { index, side, row };
    }).concat([{ leftCount, rightCount }]);
  }

  function mountRadialStructure(container, initialProps = {}) {
    if (!(container instanceof HTMLElement)) throw new TypeError("mountRadialStructure requires an HTMLElement");
    const state = { ...initialProps };
    let root = null;
    let observer = null;
    let resizeQueued = false;
    let layoutState = { width: 0, height: 0, count: 0, leftCount: 0, rightCount: 0, density: "regular" };

    function currentItems() {
      return normalizeItems(state);
    }

    function markerMarkup(item) {
      if (item.icon) return `<img src="${escapeHtml(item.icon)}" alt="" />`;
      return `<span class="rs-icon-mark">${escapeHtml(item.slotLabel || item.mark || "标识")}</span>`;
    }

    function centerMarkup(centerVisual = {}) {
      if (centerVisual.src) {
        return `<img src="${escapeHtml(centerVisual.src)}" alt="${escapeHtml(centerVisual.alt || "")}" />`;
      }
      return `<div class="rs-center-placeholder"><strong>${escapeHtml(centerVisual.placeholderLabel || "中心图片槽")}</strong><span>必填</span></div>`;
    }

    function render() {
      const visible = currentItems();
      const allocation = allocationForCount(visible.length);
      const sideInfo = allocation[allocation.length - 1];
      const placements = allocation.slice(0, -1).map((placement) => ({ ...placement, item: visible[placement.index] }));
      const left = placements.filter((placement) => placement.side === "left");
      const right = placements.filter((placement) => placement.side === "right");
      root = document.createElement("div");
      root.className = "rs-root";
      root.dataset.count = String(visible.length);
      root.innerHTML = `
        <div class="rs-dot-field" aria-hidden="true"></div>
        <div class="rs-center">${centerMarkup(state.centerVisual)}</div>
        <div class="rs-side rs-side-left" data-side="left">${left.map(renderItem).join("")}</div>
        <div class="rs-side rs-side-right" data-side="right">${right.map(renderItem).join("")}</div>`;
      container.replaceChildren(root);
      root.dataset.leftCount = String(sideInfo.leftCount);
      root.dataset.rightCount = String(sideInfo.rightCount);
      scheduleReflow();
    }

    function renderItem(placement) {
      const item = placement.item || {};
      return `<article class="rs-item" data-side="${placement.side}" data-row="${placement.row}">
        <div class="rs-icon">${markerMarkup(item)}</div>
        <div class="rs-copy"><h3>${escapeHtml(item.title || "")}</h3><p>${escapeHtml(item.body || "")}</p></div>
      </article>`;
    }

    function resolveDensity(width, height, count) {
      if (count >= 7 || width < 520 || height < 260) return "compact";
      if (count >= 6) return "dense";
      return "regular";
    }

    function measureSide(side) {
      return Array.from(side.querySelectorAll(".rs-item"), (item) => item.offsetHeight);
    }

    function placeSide(side, rowGap, height) {
      const itemsInSide = Array.from(side.querySelectorAll(".rs-item"));
      const itemHeights = measureSide(side);
      const totalHeight = itemHeights.reduce((sum, itemHeight) => sum + itemHeight, 0) + rowGap * Math.max(0, itemsInSide.length - 1);
      let cursor = (height - totalHeight) / 2;
      itemsInSide.forEach((item, index) => {
        item.style.top = `${cursor + itemHeights[index] / 2}px`;
        cursor += itemHeights[index] + rowGap;
      });
      return { itemHeights, totalHeight };
    }

    function reflow() {
      if (!root) return;
      const width = root.clientWidth;
      const height = root.clientHeight;
      const count = currentItems().length;
      const density = resolveDensity(width, height, count);
      root.dataset.density = density;
      const maxRows = Math.max(root.querySelectorAll(".rs-side-left .rs-item").length, root.querySelectorAll(".rs-side-right .rs-item").length);
      const rowGap = maxRows <= 1 ? 0 : Math.max(8, Math.min(28, height * (count >= 7 ? 0.065 : 0.055)));
      const leftPlacement = placeSide(root.querySelector(".rs-side-left"), rowGap, height);
      const rightPlacement = placeSide(root.querySelector(".rs-side-right"), rowGap, height);
      root.style.setProperty("--rs-row-gap", `${rowGap}px`);
      layoutState = {
        width: Math.round(width), height: Math.round(height), count,
        leftCount: root.querySelectorAll(".rs-side-left .rs-item").length,
        rightCount: root.querySelectorAll(".rs-side-right .rs-item").length,
        density,
        rowGap: Math.round(rowGap),
        leftHeight: Math.round(leftPlacement.totalHeight),
        rightHeight: Math.round(rightPlacement.totalHeight),
      };
      resizeQueued = false;
    }

    function scheduleReflow() {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(reflow);
    }

    function update(nextProps = {}) {
      Object.assign(state, nextProps);
      render();
      return api;
    }

    function destroy() {
      if (observer) observer.disconnect();
      container.replaceChildren();
    }

    const api = { update, destroy, getState: () => ({ ...layoutState }) };
    render();
    observer = new ResizeObserver(scheduleReflow);
    observer.observe(container);
    return api;
  }

  global.mountRadialStructure = mountRadialStructure;
}(window));
