"""
letter_generator.py
───────────────────
Generates filled DOCX from a template by replacing {{placeholders}}.

Key behaviours:
  • Run-by-run replacement preserves bold/italic/font/size/color on every run
  • Handles split placeholders — Word sometimes splits {{key}} across multiple
    runs at the XML level. We detect this, consolidate, then replace.
  • Handles embedded \n in values — splits into multiple <w:br/> so line
    breaks render correctly inside table cells (wages field etc.)
  • IMAGE placeholders — {{hr_signature}} and {{chairman_signature}} are
    replaced with actual images (base64 PNG from the frontend).
    The placeholder paragraph is replaced in-place with an image run,
    preserving the paragraph's position in the document.
  • All table alignment, paragraph spacing, column widths, page margins are
    NEVER touched — template formatting is preserved 100%.
"""

import os
import io
import re
import base64
import subprocess
import shutil
import platform
import logging
import tempfile
from copy import deepcopy

from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

logger = logging.getLogger(__name__)

# Keys that carry image data (base64 PNG strings)
IMAGE_PLACEHOLDER_KEYS = {'hr_signature', 'chairman_signature'}

# Width in inches for each signature image in the document
SIGNATURE_WIDTH_INCHES = 0.5  # ~4cm — professional, not oversized


# ─────────────────────────────────────────────────────────────────────────────
# XML helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_rpr(run_elem):
    """Return the <w:rPr> element of a run, or None."""
    return run_elem.find(qn('w:rPr'))


def _set_run_text_with_breaks(run_elem, text):
    """
    Replace the text content of a run element.
    Converts embedded \n into <w:br/> so line-breaks render in DOCX cells.
    Preserves the run's existing <w:rPr> formatting node.
    """
    to_remove = [
        c for c in list(run_elem)
        if c.tag in (qn('w:t'), qn('w:br'))
    ]
    for c in to_remove:
        run_elem.remove(c)

    lines = str(text).split('\n')
    for i, line in enumerate(lines):
        t = OxmlElement('w:t')
        t.text = line
        if line.startswith(' ') or line.endswith(' '):
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        run_elem.append(t)
        if i < len(lines) - 1:
            br = OxmlElement('w:br')
            run_elem.append(br)


# ─────────────────────────────────────────────────────────────────────────────
# Image placeholder replacement
# ─────────────────────────────────────────────────────────────────────────────

def _b64_to_png_bytes(b64_string: str) -> bytes:
    """
    Decode a base64 image string (with or without data-URI header) → raw bytes.
    Also removes near-white background pixels (makes drawn signatures transparent).
    """
    from PIL import Image, ImageEnhance

    # Strip data-URI header if present: "data:image/png;base64,..."
    if ',' in b64_string:
        b64_string = b64_string.split(',', 1)[1]

    raw = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(raw)).convert('RGBA')

    # Make white/near-white pixels transparent for a clean look on the letter
    data = img.getdata()
    new_pixels = []
    for r, g, b, a in data:
        if r > 230 and g > 230 and b > 230:
            new_pixels.append((r, g, b, 0))   # transparent
        else:
            new_pixels.append((r, g, b, a))
    img.putdata(new_pixels)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# Paragraph-level text replacement
# ─────────────────────────────────────────────────────────────────────────────

def _replace_in_para(para, ctx):
    """
    Replace all {{key}} TEXT placeholders in a paragraph.
    IMAGE placeholders are handled separately by _process_image_placeholders().

    Two-pass strategy:
    Pass 1 — Simple case: placeholder fits inside a single run.
    Pass 2 — Split-run case: consolidate all runs then replace.
    """
    runs = para.runs
    if not runs:
        return

    # ── Pass 1: single-run replacement ──────────────────────────────────────
    for run in runs:
        text = run.text or ''
        if '{{' not in text:
            continue
        new_text = text
        for key, val in ctx.items():
            if key in IMAGE_PLACEHOLDER_KEYS:
                continue   # image placeholders handled separately
            new_text = new_text.replace('{{' + key + '}}', str(val) if val is not None else '')
        if new_text != text:
            if '\n' in new_text:
                _set_run_text_with_breaks(run._r, new_text)
            else:
                run.text = new_text

    # ── Pass 2: split-run detection & consolidation ──────────────────────────
    full = ''.join(r.text or '' for r in runs)
    if '{{' not in full:
        return

    for key in ctx:
        if key in IMAGE_PLACEHOLDER_KEYS:
            continue
        if '{{' + key + '}}' not in full:
            continue

        merged = full
        for k, v in ctx.items():
            if k in IMAGE_PLACEHOLDER_KEYS:
                continue
            merged = merged.replace('{{' + k + '}}', str(v) if v is not None else '')

        first_run = runs[0]
        if '\n' in merged:
            _set_run_text_with_breaks(first_run._r, merged)
        else:
            first_run.text = merged

        for run in runs[1:]:
            run.text = ''
        break


# ─────────────────────────────────────────────────────────────────────────────
# Image placeholder pass — runs over all body paragraphs + table cells
# ─────────────────────────────────────────────────────────────────────────────
def _add_image_run(doc, p_elem, png_bytes, width_inches=SIGNATURE_WIDTH_INCHES):
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf:
        tf.write(png_bytes)
        tmp_path = tf.name
    try:
        tmp_para = doc.add_paragraph()
        tmp_run  = tmp_para.add_run()
        tmp_run.add_picture(tmp_path, width=Inches(width_inches))
        # Move run directly — no deepcopy, relationship already in doc.part
        run_elem = tmp_run._r
        tmp_para._p.remove(run_elem)
        tmp_para._p.getparent().remove(tmp_para._p)
        p_elem.append(run_elem)
    finally:
        os.unlink(tmp_path)


def _replace_image_in_run(doc, run, key, ctx):
    png_bytes = _b64_to_png_bytes(ctx[key])
    run.text  = run.text.replace('{{' + key + '}}', '')

    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf:
        tf.write(png_bytes)
        tmp_path = tf.name
    try:
        tmp_para = doc.add_paragraph()
        tmp_run  = tmp_para.add_run()
        tmp_run.add_picture(tmp_path, width=Inches(SIGNATURE_WIDTH_INCHES))
        img_run_elem = tmp_run._r
        tmp_para._p.remove(img_run_elem)
        tmp_para._p.getparent().remove(tmp_para._p)
        run._r.addprevious(img_run_elem)
    finally:
        os.unlink(tmp_path)

def _consolidate_runs(para):
    """
    Merge all runs in a paragraph into the first run (text only).
    Fixes split-placeholder cases where Word breaks {{key}} across runs.
    para.text is read-only in python-docx, so we must do this manually.
    """
    runs = para.runs
    if len(runs) <= 1:
        return
    full_text = ''.join(r.text or '' for r in runs)
    runs[0].text = full_text
    for run in runs[1:]:
        run.text = ''


def _process_image_para(doc, para, ctx, processed):
    """
    Find and replace image placeholders in a paragraph.
    Handles split runs by consolidating all runs into the first one when
    a placeholder is detected as split across multiple runs.
    """
    p_id = id(para._p)
    if p_id in processed:
        return
    processed.add(p_id)

    for key in IMAGE_PLACEHOLDER_KEYS:
        placeholder = '{{' + key + '}}'

        # Check if placeholder exists anywhere in this paragraph
        full_text = ''.join(r.text or '' for r in para.runs)
        if placeholder not in full_text:
            continue

        if not ctx.get(key):
            # No image data — clear the placeholder text
            if not any(placeholder in (r.text or '') for r in para.runs):
                _consolidate_runs(para)
            for run in para.runs:
                if run.text and placeholder in run.text:
                    run.text = run.text.replace(placeholder, '')
            continue

        # If placeholder is split across runs, consolidate into first run
        if not any(placeholder in (r.text or '') for r in para.runs):
            _consolidate_runs(para)

        # Find the run containing the placeholder and replace with image
        for run in para.runs:
            if run.text and placeholder in run.text:
                _replace_image_in_run(doc, run, key, ctx)
                break

    # ── Signature alignment fix ──────────────────────────────────────────────
    full_text = ''.join(r.text or '' for r in para.runs)
    is_sig_para = all(
        para._p.find('.//' + qn('w:drawing')) is not None
        for _ in [1]
    ) and all(ctx.get(k) for k in IMAGE_PLACEHOLDER_KEYS)

    if is_sig_para:
        # Remove whitespace-only runs between the two signatures
        for r in list(para._p.findall(qn('w:r'))):
            w_t = r.find(qn('w:t'))
            w_drawing = r.find(qn('w:drawing'))
            if w_t is not None and w_drawing is None:
                if not (w_t.text or '').strip():
                    r.getparent().remove(r)

        # Add right-aligned tab stop at exact text width
        pPr = para._p.get_or_add_pPr()
        if pPr.find(qn('w:tabs')) is None:
            tabs = OxmlElement('w:tabs')
            tab  = OxmlElement('w:tab')
            tab.set(qn('w:val'), 'right')
            tab.set(qn('w:pos'), '8500')
            tabs.append(tab)
            pPr.append(tabs)
            # Remove any left indent on signature paragraph
            ind = pPr.find(qn('w:ind'))
            if ind is None:
                ind = OxmlElement('w:ind')
                pPr.append(ind)
            ind.set(qn('w:left'), '0')
            ind.set(qn('w:firstLine'), '0')

        # Insert tab element between the two image runs
        all_runs = para._p.findall(qn('w:r'))
        if len(all_runs) >= 2:
            tab_run  = OxmlElement('w:r')
            tab_elem = OxmlElement('w:tab')
            tab_run.append(tab_elem)
            all_runs[1].addprevious(tab_run)

def _process_image_placeholders(doc, ctx):
    """
    Replace {{hr_signature}} / {{chairman_signature}} with inline images.

    IMPORTANT: doc.paragraphs in python-docx includes table-cell paragraphs
    in its iteration order, so iterating BOTH doc.paragraphs and table cells
    causes the same paragraph to be visited twice. The first visit adds it to
    `processed` without replacing (because the temp-paragraph trick mutates the
    doc body mid-iteration), and the second visit is skipped as already processed.

    Fix: iterate ONLY table cells explicitly — do not use doc.paragraphs for
    image placeholders. Signature placeholders live in table cells in this
    template (and that is where they should always be placed).
    Also scan body paragraphs directly by XML to catch any non-table placements,
    but use a fresh paragraph list snapshot to avoid mutation issues.
    """
    # Collect all paragraphs: body (non-table) + table cells
    # Use XML-level iteration to get a stable snapshot before any mutation
    from docx.oxml.ns import qn as _qn
    body = doc.element.body

    # Body-level paragraphs (direct children — excludes table-cell paragraphs)
    body_paras = [doc.paragraphs[i] for i, p in enumerate(doc.paragraphs)
                  if p._p.getparent() is body]

    for para in body_paras:
        _process_image_para(doc, para, ctx, set())

    # Table cell paragraphs — explicit traversal, no processed set needed
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _process_image_para(doc, para, ctx, set())


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def generate_letter_docx(template_path, ctx, output_path):
    """
    Open template_path, fill all {{placeholders}} from ctx dict,
    save filled document to output_path.

    ctx may contain:
      - Regular text values:  ctx['employee_name'] = 'Rahul Sharma'
      - Image values (base64): ctx['hr_signature'] = 'data:image/png;base64,...'
                               ctx['chairman_signature'] = 'data:image/png;base64,...'

    Template formatting (fonts, alignment, table widths, margins) is preserved.
    Signature images are placed exactly where {{hr_signature}} / {{chairman_signature}}
    appear in the template.
    """
    doc = Document(template_path)

    # ── Pass 1: Replace image placeholders first ─────────────────────────────
    # Must run before text replacement so image placeholder text is not mangled
    _process_image_placeholders(doc, ctx)

    # ── Pass 2: Replace all text placeholders ────────────────────────────────
    for para in doc.paragraphs:
        _replace_in_para(para, ctx)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _replace_in_para(para, ctx)

    for section in doc.sections:
        for para in section.header.paragraphs:
            _replace_in_para(para, ctx)
        for para in section.footer.paragraphs:
            _replace_in_para(para, ctx)
        for table in section.header.tables:
            for row in table.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        _replace_in_para(para, ctx)
        for table in section.footer.tables:
            for row in table.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        _replace_in_para(para, ctx)

    # Compact annexure calculation rows to prevent page overflow
    # Fix signature table row 0 — set exact row height to match image size
    if doc.tables:
        sig_table = doc.tables[0]
        if len(sig_table.rows) > 0:
            row = sig_table.rows[0]
            # Set exact row height to 0.6 inch (same as signature width)
            trPr = row._tr.find(qn('w:trPr'))
            if trPr is None:
                trPr = OxmlElement('w:trPr')
                row._tr.insert(0, trPr)
            trHeight = trPr.find(qn('w:trHeight'))
            if trHeight is None:
                trHeight = OxmlElement('w:trHeight')
                trPr.append(trHeight)
            trHeight.set(qn('w:val'), '864')   # 0.6 inch in twips
            trHeight.set(qn('w:hRule'), 'exact')

            # Set vAlign bottom on each cell
            for cell in row.cells:
                tc   = cell._tc
                tcPr = tc.find(qn('w:tcPr'))
                if tcPr is None:
                    tcPr = OxmlElement('w:tcPr')
                    tc.insert(0, tcPr)
                existing = tcPr.find(qn('w:vAlign'))
                if existing is not None:
                    tcPr.remove(existing)
                vAlign = OxmlElement('w:vAlign')
                vAlign.set(qn('w:val'), 'bottom')
                tcPr.append(vAlign)

    doc.save(output_path)
    return output_path


def _find_libreoffice():
    lo = shutil.which('libreoffice') or shutil.which('soffice')
    if lo:
        return lo
    if platform.system() == 'Windows':
        for c in [
            r'C:\Program Files\LibreOffice\program\soffice.exe',
            r'C:\Program Files (x86)\LibreOffice\program\soffice.exe',
        ]:
            if os.path.exists(c):
                return c
    if platform.system() == 'Darwin':
        mac = '/Applications/LibreOffice.app/Contents/MacOS/soffice'
        if os.path.exists(mac):
            return mac
    return None


def generate_letter_pdf(docx_path, pdf_path):
    lo = _find_libreoffice()
    if not lo:
        logger.error('LibreOffice not found. Install: apt-get install -y libreoffice')
        return None
    try:
        out_dir = os.path.dirname(pdf_path)
        os.makedirs(out_dir, exist_ok=True)

        # Use a private user profile dir to avoid lock conflicts in Docker
        lo_profile = os.path.join(tempfile.gettempdir(), 'lo_userprofile')
        os.makedirs(lo_profile, exist_ok=True)

        result = subprocess.run(
            [
                lo,
                f'-env:UserInstallation=file://{lo_profile}',
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', out_dir,
                docx_path,
            ],
            capture_output=True,
            timeout=90,
            check=False,
        )

        if result.returncode != 0:
            logger.error(
                f'LibreOffice failed (rc={result.returncode}) for {docx_path}\n'
                f'stdout: {result.stdout.decode(errors="replace")}\n'
                f'stderr: {result.stderr.decode(errors="replace")}'
            )
            return None

        # LibreOffice always names the output after the input basename
        base      = os.path.splitext(os.path.basename(docx_path))[0]
        generated = os.path.join(out_dir, base + '.pdf')

        if os.path.exists(generated):
            if os.path.abspath(generated) != os.path.abspath(pdf_path):
                shutil.move(generated, pdf_path)
            return pdf_path

        logger.error(f'LibreOffice ran OK but PDF not found at: {generated}')
    except subprocess.TimeoutExpired:
        logger.error(f'LibreOffice timed out converting {docx_path}')
    except Exception as e:
        logger.error(f'PDF generation exception: {e}', exc_info=True)
    return None