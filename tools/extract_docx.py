# -*- coding: utf-8 -*-
"""Extract full text (paragraphs + tables) from the manual docx into a txt file."""
import sys
from docx import Document

src = r"F:\Project-Astra\医院管理系统_Astra分阶段开发指导手册.docx"
out = r"F:\Project-Astra\tools\manual_text.txt"

doc = Document(src)
lines = []

# iterate document body in order: paragraphs and tables
from docx.document import Document as _Doc
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

def iter_block_items(parent):
    parent_elm = parent.element.body
    for child in parent_elm.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)

def table_to_lines(tbl):
    rows = []
    for r in tbl.rows:
        cells = []
        for c in r.cells:
            cells.append(' / '.join(p.text for p in c.paragraphs).strip())
        rows.append(' | '.join(cells))
    return rows

for block in iter_block_items(doc):
    if isinstance(block, Paragraph):
        style = block.style.name if block.style else ''
        text = block.text
        if text.strip():
            lines.append(f"[{style}] {text}")
        else:
            lines.append("")
    else:
        lines.append("[TABLE]")
        lines.extend(table_to_lines(block))
        lines.append("[/TABLE]")

with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"lines: {len(lines)}, chars: {sum(len(l) for l in lines)}")
print(f"written: {out}")
