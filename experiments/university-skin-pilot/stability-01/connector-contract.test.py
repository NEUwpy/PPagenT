#!/usr/bin/env python3
"""Meaningful stdlib-only connector contract fixtures.

The source decks are read only.  The forward-arrow fixture mutates package XML
in memory and never writes a PPTX beside the real artifact.
"""

from __future__ import annotations

import io
import importlib.util
import pathlib
import unittest
import zipfile
import xml.etree.ElementTree as ET


HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "audit-connectors.py"
SPEC = importlib.util.spec_from_file_location("audit_connectors", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(AUDIT)


PRODUCT_B = HERE / "product-b" / "round-01"
RED_B = HERE / "red-b" / "round-01"


def _replace_p2_head_with_tail(pptx: pathlib.Path) -> bytes:
    """Return a memory-only copy with every slide-2 arrow moved to tailEnd."""
    output = io.BytesIO()
    with zipfile.ZipFile(pptx) as source, zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
        for info in source.infolist():
            data = source.read(info.filename)
            if info.filename == "ppt/slides/slide2.xml":
                text = data.decode("utf-8")
                text = text.replace("<a:headEnd type=\"arrow\" w=\"sm\" len=\"sm\" />", "<a:tailEnd type=\"arrow\" w=\"sm\" len=\"sm\" />")
                data = text.encode("utf-8")
            target.writestr(info, data)
    return output.getvalue()


class ConnectorContractTests(unittest.TestCase):
    def test_rotated_connector_does_not_claim_untransformed_clearance(self) -> None:
        with zipfile.ZipFile(PRODUCT_B / "deck.pptx") as source:
            root = ET.fromstring(source.read("ppt/slides/slide2.xml"))
        root.find(".//p:cxnSp/p:spPr/a:xfrm", AUDIT.NS).set("rot", "5400000")
        slide = AUDIT._parse_slide(ET.tostring(root), 2, PRODUCT_B / "slide-2.layout.json", 2)
        self.assertEqual(slide["connectors"][0]["textIntersection"]["status"], "unsupported-transform")

    def test_missing_or_ambiguous_layout_does_not_guess_another_line(self) -> None:
        line = {"geometry":"straightConnector1", "bbox":[10,20,30,40]}
        self.assertIsNone(AUDIT._find_layout_connector([line], "straightConnector1", [50,60,70,80]))
        self.assertIsNone(AUDIT._find_layout_connector([line,dict(line)], "straightConnector1", [10,20,30,40]))

    def test_product_b_p2_finds_reverse_arrow_and_text_penetration(self) -> None:
        report = AUDIT.audit_deck(PRODUCT_B / "deck.pptx", PRODUCT_B)
        slide = next(item for item in report["slides"] if item["slide"] == 2)
        self.assertEqual(len(slide["connectors"]), 2)
        for connector in slide["connectors"]:
            self.assertEqual(connector["bindingStatus"], "bound")
            self.assertEqual(connector["arrowAt"], "source")
            self.assertEqual(connector["actualArrowDirection"], "target-to-source")
            self.assertEqual(connector["textIntersection"]["status"], "intersects")
        names = {candidate["name"] for connector in slide["connectors"] for candidate in connector["textIntersection"]["candidates"]}
        self.assertIn("p2-narrative-detail", names)
        self.assertIn("p2-visual-detail", names)

    def test_memory_only_tail_arrow_fixture_is_forward(self) -> None:
        data = _replace_p2_head_with_tail(PRODUCT_B / "deck.pptx")
        report = AUDIT.audit_package_bytes(data, PRODUCT_B)
        slide = next(item for item in report["slides"] if item["slide"] == 2)
        self.assertEqual({connector["arrowAt"] for connector in slide["connectors"]}, {"target"})
        # The semantic line crossing remains independently visible; changing
        # arrow XML must not hide a layout collision.
        self.assertEqual({connector["textIntersection"]["status"] for connector in slide["connectors"]}, {"intersects"})

    def test_missing_xml_binding_is_reported_unknown(self) -> None:
        with zipfile.ZipFile(PRODUCT_B / "deck.pptx") as source:
            output = io.BytesIO()
            with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
                for info in source.infolist():
                    data = source.read(info.filename)
                    if info.filename == "ppt/slides/slide2.xml":
                        text = data.decode("utf-8")
                        start = text.find("<a:stCxn")
                        end = text.find("/>", start) + 2
                        self.assertGreaterEqual(start, 0)
                        text = text[:start] + text[end:]
                        data = text.encode("utf-8")
                    target.writestr(info, data)
        report = AUDIT.audit_package_bytes(output.getvalue(), PRODUCT_B)
        slide = next(item for item in report["slides"] if item["slide"] == 2)
        self.assertEqual(slide["connectors"][0]["bindingStatus"], "missing-start-binding")
        self.assertIsNone(slide["connectors"][0]["source"])

    def test_manifest_is_compared_to_xml_facts(self) -> None:
        report = AUDIT.audit_deck(PRODUCT_B / "deck.pptx", PRODUCT_B)
        AUDIT.apply_manifest(report, {"connections": [{"slide": 2, "source": "p2-narrative", "target": "p2-output"}]})
        self.assertEqual(report["declarationChecks"][0]["status"], "arrow-direction-mismatch")

    def test_non_straight_geometry_is_explicitly_unsupported(self) -> None:
        report = AUDIT.audit_deck(RED_B / "deck.pptx", RED_B)
        connectors = [connector for slide in report["slides"] for connector in slide["connectors"]]
        unsupported = [connector for connector in connectors if connector["geometry"] in {"bentConnector4", "curvedConnector2"}]
        self.assertTrue(unsupported)
        self.assertTrue(all(connector["textIntersection"]["status"] == "unsupported-geometry" for connector in unsupported))


if __name__ == "__main__":
    unittest.main()
