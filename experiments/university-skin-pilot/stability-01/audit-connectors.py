#!/usr/bin/env python3
"""Read-only PPTX connector contract audit.

The checker deliberately reads the package XML and the artifact-tool layout
JSON.  It does not render slides and it never edits the input deck.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable


NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
EMU_PER_PX = 9525.0
SLIDE_RE = re.compile(r"ppt/slides/slide(\d+)\.xml$")
LAYOUT_NAME_RE = re.compile(r"^(?:slide|page)-?0*(\d+)\.layout\.json$")


def _number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _bool(value: Any) -> bool:
    return str(value).lower() in {"1", "true", "yes"}


def _id_value(value: Any) -> str | None:
    return None if value is None else str(value)


def _bbox_from_xfrm(xfrm: ET.Element | None) -> list[float] | None:
    if xfrm is None:
        return None
    values = [_number(xfrm.attrib.get(key)) for key in ("off_x", "off_y", "ext_cx", "ext_cy")]
    # This branch is only for callers that pass an already-normalized element.
    if all(v is not None for v in values):
        return [v / EMU_PER_PX for v in values]  # type: ignore[operator]
    off = xfrm.find("./a:off", NS)
    ext = xfrm.find("./a:ext", NS)
    if off is None or ext is None:
        return None
    values = [_number(off.attrib.get("x")), _number(off.attrib.get("y")),
              _number(ext.attrib.get("cx")), _number(ext.attrib.get("cy"))]
    if any(v is None for v in values):
        return None
    return [v / EMU_PER_PX for v in values]  # type: ignore[operator]


def _close_bbox(left: Iterable[float] | None, right: Iterable[float] | None, tolerance: float = 1.1) -> bool:
    if left is None or right is None:
        return False
    a, b = list(left), list(right)
    return len(a) == 4 and len(b) == 4 and all(abs(float(x) - float(y)) <= tolerance for x, y in zip(a, b))


def _text_of(element: ET.Element) -> str:
    return "".join(element.itertext()).strip()


def _layout_path(layout_dir: Path, slide_number: int) -> Path | None:
    candidates = [
        layout_dir / f"slide-{slide_number}.layout.json",
        layout_dir / f"slide-{slide_number:02d}.layout.json",
        layout_dir / f"page-{slide_number}.layout.json",
        layout_dir / f"page-{slide_number:02d}.layout.json",
        layout_dir / f"slide{slide_number}.layout.json",
    ]
    for path in candidates:
        if path.is_file():
            return path
    # Keep this tolerant of a future naming convention, while only accepting
    # a file whose numeric stem unambiguously names the requested slide.
    for path in sorted(layout_dir.glob("*.layout.json")):
        match = LAYOUT_NAME_RE.match(path.name)
        if match and int(match.group(1)) == slide_number:
            return path
    return None


def _layout_elements(layout: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    elements: list[dict[str, Any]] = []
    for item in layout.get("elements", []):
        if isinstance(item, dict):
            elements.append(item)
    for layer in layout.get("inheritedLayers", []):
        if isinstance(layer, dict):
            for item in layer.get("elements", []):
                if isinstance(item, dict):
                    elements.append(item)
    by_id = {_id_value(item.get("id")): item for item in elements if item.get("id") is not None}
    return by_id, elements


def _shape_inventory(root: ET.Element) -> dict[str, dict[str, Any]]:
    inventory: dict[str, dict[str, Any]] = {}
    tree = root.find("./p:cSld/p:spTree", NS)
    if tree is None:
        return inventory
    for item in list(tree):
        cpr = item.find("./p:nvSpPr/p:cNvPr", NS)
        if cpr is None:
            cpr = item.find("./p:nvCxnSpPr/p:cNvPr", NS)
        if cpr is None:
            continue
        item_id = _id_value(cpr.attrib.get("id"))
        if item_id is None:
            continue
        inventory[item_id] = {"id": item_id, "name": cpr.attrib.get("name") or None}
    return inventory


def _find_layout_connector(elements: list[dict[str, Any]], geometry: str | None, bbox: list[float] | None) -> dict[str, Any] | None:
    matches = [item for item in elements if item.get("geometry") == geometry and _close_bbox(item.get("bbox"), bbox)]
    # Geometry alone is not an identity.  A 0-match or >1-match result must not
    # borrow another line's bbox and turn an unverified route into a false clear.
    return matches[0] if len(matches) == 1 else None


def _endpoint(root: ET.Element, path: str) -> dict[str, str] | None:
    item = root.find(path, NS)
    if item is None:
        return None
    return {"id": _id_value(item.attrib.get("id")) or "", "idx": _id_value(item.attrib.get("idx")) or ""}


def _line_points(bbox: list[float] | None, flip_h: bool, flip_v: bool) -> tuple[list[float], list[float]] | None:
    if bbox is None or len(bbox) != 4:
        return None
    x, y, width, height = [float(v) for v in bbox]
    start = [x + (width if flip_h else 0.0), y + (height if flip_v else 0.0)]
    end = [x + (0.0 if flip_h else width), y + (0.0 if flip_v else height)]
    return start, end


def _segment_rect_interval(start: list[float], end: list[float], bbox: list[Any], padding: float) -> tuple[float, float] | None:
    if len(bbox) != 4:
        return None
    x, y, width, height = [float(v) for v in bbox]
    left, top = x + padding, y + padding
    right, bottom = x + width - padding, y + height - padding
    if right <= left or bottom <= top:
        return None
    dx, dy = end[0] - start[0], end[1] - start[1]
    lo, hi = 0.0, 1.0
    for p, q in ((-dx, start[0] - left), (dx, right - start[0]),
                 (-dy, start[1] - top), (dy, bottom - start[1])):
        if abs(p) < 1e-12:
            if q < 0:
                return None
            continue
        t = q / p
        if p < 0:
            lo = max(lo, t)
        else:
            hi = min(hi, t)
        if hi <= lo:
            return None
    # Touching a node at t=0/1 is its connection boundary, not a text crossing.
    lo, hi = max(lo, 1e-7), min(hi, 1.0 - 1e-7)
    return (lo, hi) if hi > lo else None


def _text_intersections(connector: dict[str, Any], elements: list[dict[str, Any]], source_id: str | None,
                        target_id: str | None, padding_px: float) -> dict[str, Any]:
    geometry = connector.get("geometry")
    if connector.get("rotationUnsupported"):
        return {"status": "unsupported-transform", "geometry": geometry, "candidates": []}
    if geometry != "straightConnector1":
        return {"status": "unsupported-geometry", "geometry": geometry, "candidates": []}
    points = connector.get("linePoints")
    if not points:
        return {"status": "layout-missing", "geometry": geometry, "candidates": []}
    candidates: list[dict[str, Any]] = []
    start, end = points
    for item in elements:
        text = item.get("text")
        bbox = item.get("bbox")
        item_id = _id_value(item.get("id"))
        if not isinstance(text, str) or not text.strip() or not isinstance(bbox, list):
            continue
        interval = _segment_rect_interval(start, end, bbox, padding_px)
        if interval is None:
            continue
        candidates.append({
            "id": item_id,
            "name": item.get("name"),
            "textPreview": " ".join(text.split())[:100],
            "isEndpointNode": item_id in {source_id, target_id},
            "t": [round(interval[0], 6), round(interval[1], 6)],
        })
    return {"status": "intersects" if candidates else "clear", "geometry": geometry, "candidates": candidates}


def _arrow_end(element: ET.Element | None, name: str) -> dict[str, str] | None:
    if element is None:
        return None
    return {key: value for key, value in element.attrib.items()} if element.attrib else {"type": "none"}


def _arrow_at(head: dict[str, str] | None, tail: dict[str, str] | None) -> str:
    directional_types = {"arrow", "triangle", "stealth"}
    has_head = bool(head and head.get("type") in directional_types)
    has_tail = bool(tail and tail.get("type") in directional_types)
    if has_head and has_tail:
        return "both"
    if has_head:
        return "source"
    if has_tail:
        return "target"
    return "none"


def _actual_direction(arrow_at: str) -> str:
    return {"source": "target-to-source", "target": "source-to-target", "both": "bidirectional", "none": "none"}.get(arrow_at, "unknown")


def _parse_slide(xml_bytes: bytes, slide_number: int, layout_path: Path | None, padding_px: float) -> dict[str, Any]:
    root = ET.fromstring(xml_bytes)
    inventory = _shape_inventory(root)
    layout: dict[str, Any] = {}
    elements_by_id: dict[str, dict[str, Any]] = {}
    elements: list[dict[str, Any]] = []
    if layout_path is not None:
        layout = json.loads(layout_path.read_text(encoding="utf-8"))
        elements_by_id, elements = _layout_elements(layout)
    records: list[dict[str, Any]] = []
    tree = root.find("./p:cSld/p:spTree", NS)
    for item in [] if tree is None else list(tree):
        if item.tag != f"{{{NS['p']}}}cxnSp":
            continue
        cpr = item.find("./p:nvCxnSpPr/p:cNvPr", NS)
        links = item.find("./p:nvCxnSpPr/p:cNvCxnSpPr", NS)
        xfrm = item.find("./p:spPr/a:xfrm", NS)
        geom_element = item.find("./p:spPr/a:prstGeom", NS)
        geometry = geom_element.attrib.get("prst") if geom_element is not None else None
        xml_bbox = _bbox_from_xfrm(xfrm)
        layout_connector = _find_layout_connector(elements, geometry, xml_bbox)
        bbox = layout_connector.get("bbox") if layout_connector else xml_bbox
        source_binding = _endpoint(item, "./p:nvCxnSpPr/p:cNvCxnSpPr/a:stCxn")
        target_binding = _endpoint(item, "./p:nvCxnSpPr/p:cNvCxnSpPr/a:endCxn")
        source_id = source_binding.get("id") if source_binding else None
        target_id = target_binding.get("id") if target_binding else None
        source_xml = inventory.get(source_id or "")
        target_xml = inventory.get(target_id or "")
        source_layout = elements_by_id.get(source_id or "")
        target_layout = elements_by_id.get(target_id or "")
        # Layout ids and package ids are different namespaces after export.
        # Bound names must come from the package inventory, never a coincident
        # numeric layout id.
        source_info = {"id": source_id, "name": (source_xml or {}).get("name")}
        target_info = {"id": target_id, "name": (target_xml or {}).get("name")}
        line = item.find("./p:spPr/a:ln", NS)
        head = _arrow_end(line.find("./a:headEnd", NS) if line is not None else None, "head")
        tail = _arrow_end(line.find("./a:tailEnd", NS) if line is not None else None, "tail")
        flip_h = _bool((layout_connector or {}).get("horizontalFlip")) or _bool(xfrm.attrib.get("flipH") if xfrm is not None else None)
        flip_v = _bool((layout_connector or {}).get("verticalFlip")) or _bool(xfrm.attrib.get("flipV") if xfrm is not None else None)
        # Text-route checks require the uniquely matched artifact-tool layout
        # bbox.  XML xfrm is retained as evidence in `bbox`, but is not used to
        # claim text clearance without that layout association.
        points = _line_points(bbox, flip_h, flip_v) if layout_connector else None
        binding_status = "bound" if source_binding and target_binding else (
            "unbound" if not source_binding and not target_binding else
            "missing-start-binding" if not source_binding else "missing-end-binding"
        )
        line_id = _id_value(cpr.attrib.get("id")) if cpr is not None else None
        connector = {
            "lineId": {"xml": line_id, "layout": _id_value(layout_connector.get("id")) if layout_connector else None},
            "geometry": geometry,
            "rotationUnsupported": bool(_number(xfrm.attrib.get("rot", 0)) if xfrm is not None else 0)
                or bool((layout_connector or {}).get("rotation", 0)),
            "layoutAssociation": "matched" if layout_connector else "missing-or-ambiguous",
            "bindingStatus": binding_status,
            "source": source_info if binding_status == "bound" else None,
            "target": target_info if binding_status == "bound" else None,
            "sourceBinding": source_binding,
            "targetBinding": target_binding,
            "head": head,
            "tail": tail,
            "arrowAt": _arrow_at(head, tail),
            "actualArrowDirection": _actual_direction(_arrow_at(head, tail)),
            "bbox": bbox,
            "flip": {"horizontal": flip_h, "vertical": flip_v},
            "linePoints": points,
        }
        connector["textIntersection"] = _text_intersections(connector, elements, source_id, target_id, padding_px)
        # Keep the raw line points useful for computation, but report a compact
        # copy to remain easy to consume from a text-only agent.
        records.append(connector)
    for connector in records:
        connector.pop("linePoints", None)
    return {
        "slide": slide_number,
        "layout": str(layout_path) if layout_path else None,
        "connectors": records,
        "uninspectedGroupedConnectors": len(root.findall(".//p:grpSp//p:cxnSp", NS)),
    }


def _slide_entries(package: zipfile.ZipFile) -> list[tuple[int, str]]:
    entries = []
    for name in package.namelist():
        match = SLIDE_RE.fullmatch(name)
        if match:
            entries.append((int(match.group(1)), name))
    return sorted(entries)


def audit_package_bytes(data: bytes, layout_dir: str | Path | None = None, padding_px: float = 2.0,
                        source_label: str = "<memory>") -> dict[str, Any]:
    layout_root = Path(layout_dir) if layout_dir is not None else None
    with zipfile.ZipFile(io.BytesIO(data)) as package:
        slides = []
        for number, entry in _slide_entries(package):
            layout_path = _layout_path(layout_root, number) if layout_root is not None else None
            slides.append(_parse_slide(package.read(entry), number, layout_path, padding_px))
    connectors = [connector for slide in slides for connector in slide["connectors"]]
    return {
        "schema": "ppagent.connector-contract/v1",
        "source": source_label,
        "layoutDir": str(layout_root) if layout_root else None,
        "scope": "Top-level native p:cxnSp only. Ordinary line shapes and grouped connectors are not route-audited; non-straight or rotated paths are explicitly unsupported.",
        "slides": slides,
        "summary": {
            "slideCount": len(slides),
            "connectorCount": len(connectors),
            "boundCount": sum(c["bindingStatus"] == "bound" for c in connectors),
            "unknownBindingCount": sum(c["bindingStatus"] != "bound" for c in connectors),
            "reverseArrowCount": sum(c["actualArrowDirection"] == "target-to-source" for c in connectors),
            "unsupportedGeometryCount": sum(c["textIntersection"]["status"] == "unsupported-geometry" for c in connectors),
            "unsupportedTransformCount": sum(c["textIntersection"]["status"] == "unsupported-transform" for c in connectors),
            "uninspectedGroupedConnectors": sum(s["uninspectedGroupedConnectors"] for s in slides),
            "uninspectedRouteCount": sum(c["textIntersection"]["status"] not in {"clear", "intersects"} for c in connectors),
            "textIntersectionCount": sum(c["textIntersection"]["status"] == "intersects" for c in connectors),
        },
    }


def audit_deck(pptx_path: str | Path, layout_dir: str | Path | None = None, padding_px: float = 2.0) -> dict[str, Any]:
    path = Path(pptx_path)
    return audit_package_bytes(path.read_bytes(), layout_dir=layout_dir, padding_px=padding_px, source_label=str(path))


def _declared_endpoint_matches(actual: dict[str, Any] | None, expected: Any) -> bool:
    if actual is None:
        return False
    value = str(expected)
    return value in {str(actual.get("id")), str(actual.get("name"))}


def apply_manifest(report: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
    """Add declaration checks to a report; declarations never replace XML facts."""
    declarations = manifest.get("connections", []) if isinstance(manifest, dict) else []
    by_slide: dict[int, list[dict[str, Any]]] = {}
    for slide in report.get("slides", []):
        by_slide[int(slide["slide"])] = slide.get("connectors", [])
    checks = []
    for declaration in declarations:
        if not isinstance(declaration, dict):
            continue
        slide_no = int(declaration.get("slide", 0))
        candidates = by_slide.get(slide_no, [])
        matches = [c for c in candidates if c.get("bindingStatus") == "bound"
                   and _declared_endpoint_matches(c.get("source"), declaration.get("source"))
                   and _declared_endpoint_matches(c.get("target"), declaration.get("target"))]
        expected_arrow = declaration.get("arrowAt")
        if expected_arrow is None:
            expected_arrow = "source" if declaration.get("direction") == "target-to-source" else "target"
        if len(matches) != 1:
            checks.append({"slide": slide_no, "source": declaration.get("source"), "target": declaration.get("target"),
                           "status": "missing-declared-connection" if not matches else "ambiguous-declared-connection",
                           "candidateCount": len(matches)})
            continue
        actual = matches[0]
        checks.append({"slide": slide_no, "source": declaration.get("source"), "target": declaration.get("target"),
                       "lineId": actual.get("lineId"), "status": "ok" if actual.get("arrowAt") == expected_arrow else "arrow-direction-mismatch",
                       "expectedArrowAt": expected_arrow, "actualArrowAt": actual.get("arrowAt"),
                       "textIntersection": actual.get("textIntersection")})
    report["declarationChecks"] = checks
    report["summary"]["declarationFailureCount"] = sum(item["status"] != "ok" for item in checks)
    return report


def _cli() -> int:
    parser = argparse.ArgumentParser(description="Audit native PPTX connector bindings, arrow ends, and straight-line text crossings.")
    parser.add_argument("pptx", help="input PPTX; it is opened read-only")
    parser.add_argument("--layout-dir", help="directory containing slide-N.layout.json files")
    parser.add_argument("--manifest", help="optional JSON declaration manifest")
    parser.add_argument("--padding-px", type=float, default=2.0, help="inward text-box padding used for open-interior intersection checks")
    args = parser.parse_args()
    report = audit_deck(args.pptx, args.layout_dir, args.padding_px)
    if args.manifest:
        manifest_path = Path(args.manifest)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        report = apply_manifest(report, manifest)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
