import os, subprocess, shutil, platform, logging
from docx import Document

logger = logging.getLogger(__name__)


def _replace_in_paragraph(para, ctx):
    """
    Replaces {{placeholders}} even when Word has split them across multiple runs.

    Word's XML editor frequently breaks a single typed word into several <w:r>
    runs with identical formatting. A placeholder like {{candidate_name}} may
    be stored as ["{{cand", "idate_", "name}}"] — three separate runs — so a
    per-run search never finds the full token.

    Fix: join all run texts → replace in the combined string → put the result
    in run[0] and blank the rest. Run[0]'s character formatting (bold, font,
    size, colour) is preserved for the whole paragraph's replaced text.
    """
    if not para.runs:
        return

    full = ''.join(r.text for r in para.runs)
    if '{{' not in full:
        return  # fast-path: no placeholders at all

    replaced = full
    for key, val in ctx.items():
        replaced = replaced.replace('{{' + key + '}}', str(val) if val is not None else '')

    if replaced == full:
        return  # nothing changed

    para.runs[0].text = replaced
    for r in para.runs[1:]:
        r.text = ''


def generate_letter_docx(template_path, ctx, output_path):
    doc = Document(template_path)

    for para in doc.paragraphs:
        _replace_in_paragraph(para, ctx)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _replace_in_paragraph(para, ctx)

    for section in doc.sections:
        for para in section.header.paragraphs:
            _replace_in_paragraph(para, ctx)
        for para in section.footer.paragraphs:
            _replace_in_paragraph(para, ctx)
        for tbl in section.header.tables:
            for row in tbl.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        _replace_in_paragraph(para, ctx)
        for tbl in section.footer.tables:
            for row in tbl.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        _replace_in_paragraph(para, ctx)

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
        p = '/Applications/LibreOffice.app/Contents/MacOS/soffice'
        if os.path.exists(p):
            return p
    return None


def generate_letter_pdf(docx_path, pdf_path):
    lo = _find_libreoffice()
    if not lo:
        logger.warning('LibreOffice not found — PDF generation skipped')
        return None
    try:
        out_dir = os.path.dirname(pdf_path)
        os.makedirs(out_dir, exist_ok=True)

        env = os.environ.copy()
        env['HOME'] = '/tmp/libreoffice_home'
        os.makedirs('/tmp/libreoffice_home', exist_ok=True)

        subprocess.run([
            lo,
            '--headless',
            '--norestore',
            '--nofirststartwizard',
            '--nolockcheck',
            '--convert-to', 'pdf:writer_pdf_Export:EmbedStandardFonts=true,SelectPdfVersion=0',
            '--outdir', out_dir,
            docx_path
        ],
        capture_output=True,
        timeout=60,
        check=True,
        env=env,
        )

        base      = os.path.splitext(os.path.basename(docx_path))[0]
        generated = os.path.join(out_dir, base + '.pdf')
        if os.path.exists(generated):
            if generated != pdf_path:
                os.rename(generated, pdf_path)
            return pdf_path

    except Exception as e:
        logger.warning(f'PDF generation failed: {e}')
    return None
