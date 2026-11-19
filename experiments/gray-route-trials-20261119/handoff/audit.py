import json
import re
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from zipfile import ZipFile


OUT = Path(__file__).parent / "output"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"


def read_json(name):
    return json.loads((OUT / name).read_text(encoding="utf-8-sig"))


def without_layout_whitespace(value):
    return re.sub(r"\s+", "", value)


def inspect_slide(deck, index, stem, source):
    with ZipFile(OUT / f"{deck}.pptx") as package:
        tree = ET.fromstring(package.read(f"ppt/slides/slide{index}.xml"))
    shapes = tree.find(f".//{P}spTree")
    xml_objects = {
        shape.find(f".//{P}cNvPr").get("name"): shape
        for shape in shapes
        if shape.tag in (P + "sp", P + "pic", P + "cxnSp")
    }
    native = read_json(f"{stem}-powerpoint.json")
    powerpoint_objects = {item["name"]: item for item in native["objects"]}
    expected = {item["objectName"] for item in source}
    assert len(expected) == len(source)
    assert expected == xml_objects.keys() == powerpoint_objects.keys()
    max_geometry_error = 0
    max_text_overrun = 0
    line_results = []
    path_results = []
    for item in source:
        name = item["objectName"]
        shape = xml_objects[name]
        native_shape = powerpoint_objects[name]
        transform = shape.find(f".//{A}xfrm")
        placement = transform.find(A + "off")
        extent = transform.find(A + "ext")
        from_xml = [int(placement.get(k)) / 9525 for k in ("x", "y")]
        from_xml += [int(extent.get(k)) / 9525 for k in ("cx", "cy")]
        from_layout = [item["frame"][k] for k in ("left", "top", "width", "height")]
        max_geometry_error = max(max_geometry_error, *(abs(a - b) for a, b in zip(from_layout, from_xml)))

        if item["kind"] == "path":
            native_path = shape.find(f".//{A}custGeom/{A}pathLst/{A}path")
            assert native_path is not None
            points = native_path.findall(f".//{A}pt")
            first, last = points[0], points[-1]
            anchors = [
                [float(point.get("x")) / 9525 + from_xml[0], float(point.get("y")) / 9525 + from_xml[1]]
                for point in (first, last)
            ]
            measured = [item["pathControlPoints"][i] for i in (0, -1)]
            endpoint_delta = [
                round(max(abs(placed[0] - origin["x"]), abs(placed[1] - origin["y"])), 6)
                for placed, origin in zip(anchors, measured)
            ]
            path_results.append({
                "name": name,
                "segments": Counter(child.tag.split("}")[-1] for child in native_path),
                "endpointMaxAbsDeltaPx": endpoint_delta,
                "nativeConnector": shape.tag == P + "cxnSp",
            })
        if item["kind"] not in ("text", "shape-text"):
            continue

        xml_text = "".join(part.text or "" for part in shape.findall(".//" + A + "t"))
        assert without_layout_whitespace(item["text"]) == without_layout_whitespace(xml_text), name
        assert without_layout_whitespace(item["text"]) == without_layout_whitespace(native_shape["text"]), name
        browser_lines = [line["value"] for line in item.get("browserLines", ())]
        browser_count = len(browser_lines) if browser_lines else len(item["browserLineBounds"])
        native_lines = [line["text"] for line in native_shape["lines"]]
        text_left, text_top, text_width, text_height = (value / 0.75 for value in native_shape["textBoundPt"])
        frame_left, frame_top, frame_width, frame_height = from_layout
        overrun = [frame_left - text_left, frame_top - text_top,
                   text_left + text_width - frame_left - frame_width, text_top + text_height - frame_top - frame_height]
        max_text_overrun = max(max_text_overrun, *overrun)
        line_results.append({
            "name": name,
            "browserCount": browser_count,
            "powerPointCount": len(native_lines),
            "browserLines": browser_lines or None,
            "powerPointLines": native_lines,
            "linesExactlyMatchIgnoringWhitespace": (
                list(map(without_layout_whitespace, browser_lines)) == list(map(without_layout_whitespace, native_lines))
                if browser_lines else None
            ),
            "xmlTextExactlyMatches": item["text"] == xml_text,
            "explicitSoftBreaks": len(shape.findall(".//" + A + "br")),
            "powerPointTextBoundsOverrunPx": [round(max(value, 0), 4) for value in overrun],
            "widthOffset": item.get("widthOffset"),
        })
    assert max_geometry_error <= 0.001
    return {
        "slide": index, "deck": deck, "powerPointVersion": native["powerPointVersion"],
        "counts": Counter(item["kind"] for item in source),
        "xmlBoundsMaxAbsDeltaPx": round(max_geometry_error, 8),
        "nativeTextBoundsMaxOverrunPx": round(max_text_overrun, 4),
        "textObjsWithLineCountChange": sum(item["browserCount"] != item["powerPointCount"] for item in line_results),
        "textObjsWithLineContentChange": sum(item["linesExactlyMatchIgnoringWhitespace"] is False for item in line_results),
        "browserLineTextAvailable": any(item["browserLines"] for item in line_results),
        "xmlBreakCount": sum(item["explicitSoftBreaks"] for item in line_results),
        "paths": path_results,
        "text": line_results,
    }


inputs = read_json("inputs.json")
results = []
for mode in ("natural", "preserve-lines"):
    results += [
        inspect_slide(mode, 1, mode, inputs["objects"]),
        inspect_slide(mode, 2, mode + "-stress", inputs["stress"]),
    ]
results.append(inspect_slide("bridge-duty", 1, "bridge-duty", inputs["bridge"]["objects"]))
(OUT / "audit.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
for result in results:
    print(result["deck"], result["slide"],
          "frames", result["xmlBoundsMaxAbsDeltaPx"],
          "line count changes", result["textObjsWithLineCountChange"],
          "line content changes", result["textObjsWithLineContentChange"] if result["browserLineTextAvailable"] else "N/A",
          "max text overrun", result["nativeTextBoundsMaxOverrunPx"])
