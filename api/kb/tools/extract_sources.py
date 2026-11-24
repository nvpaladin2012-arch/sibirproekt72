"""Извлекает тексты из PDF-чек-листа и раздела «Полезные статьи» в KB.

Запуск: python sitenew/api/kb/tools/extract_sources.py
Результат: sitenew/api/kb/documents/*.txt (читаются поиском в chat.php).
"""
from __future__ import annotations

import html
import re
from pathlib import Path

HERE = Path(__file__).resolve()
KB_DIR = HERE.parent.parent
DOCS_DIR = KB_DIR / "documents"
SITE_DIR = HERE.parents[3]
PDF_PATH = SITE_DIR / "assets" / "files" / "Check-list-pered-tenderom-Sibir-Proekt.pdf"
ARTICLES_DIR = SITE_DIR / "articles"

DOCS_DIR.mkdir(parents=True, exist_ok=True)


def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def write_doc(filename: str, source: str, title: str, url: str, body: str) -> None:
    header = f"# SOURCE: {source}\n# TITLE: {title}\n# URL: {url}\n\n"
    (DOCS_DIR / filename).write_text(header + clean(body), encoding="utf-8")
    print(f"OK {filename} ({len(body)} chars)")


def extract_pdf() -> None:
    if not PDF_PATH.is_file():
        print(f"SKIP PDF: {PDF_PATH} not found")
        return
    try:
        from pypdf import PdfReader
    except ImportError:
        print("SKIP PDF: install pypdf (pip install pypdf)")
        return
    reader = PdfReader(str(PDF_PATH))
    body = "\n\n".join((page.extract_text() or "") for page in reader.pages)
    write_doc(
        "01-checklist-12-tochk.txt",
        PDF_PATH.name,
        "Чек-лист: 12 критических точек проверки заявки до подачи (44-ФЗ и 223-ФЗ)",
        "https://sibirproekt72.ru/checklist.html",
        body,
    )


def extract_articles() -> None:
    if not ARTICLES_DIR.is_dir():
        print(f"SKIP articles: {ARTICLES_DIR} not found")
        return
    for path in sorted(ARTICLES_DIR.glob("*.html")):
        if path.name == "index.html":
            continue
        raw = path.read_text(encoding="utf-8", errors="replace")
        title_match = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.S | re.I)
        title = clean(title_match.group(1)) if title_match else path.stem
        start = re.search(r'<div class="article-page__body"[^>]*>', raw, re.I)
        if not start:
            print(f"SKIP {path.name}: body block not found")
            continue
        body_raw = raw[start.end():]
        end = re.search(r'<nav class="article-nav"|</main>', body_raw, re.I)
        if end:
            body_raw = body_raw[: end.start()]
        write_doc(
            f"02-article-{path.stem}.txt",
            path.name,
            title,
            f"https://sibirproekt72.ru/articles/{path.name}",
            body_raw,
        )


if __name__ == "__main__":
    extract_pdf()
    extract_articles()
