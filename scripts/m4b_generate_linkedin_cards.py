#!/usr/bin/env python3
"""Generate editorial LinkedIn carousel cards for the M4b agent-loop post."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "M4b-linkedin-cardnews.json"
OUT_DIR = ROOT / "outputs" / "linkedin-agent-loop-cardnews" / "cards"
CONTACT_SHEET = ROOT / "outputs" / "linkedin-agent-loop-cardnews" / "card-contact-sheet.png"
ALT_TEXT = OUT_DIR / "alt-text.md"

WIDTH = 1080
HEIGHT = 1350
MARGIN = 76
TOP_H = 488
FOOTER_Y = 1234

FONT_CANDIDATES = [
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]

COLORS = {
    "ink": "#10151D",
    "ink_2": "#17202B",
    "ink_3": "#202B38",
    "paper": "#F6F0E5",
    "paper_2": "#EDE3D4",
    "paper_3": "#FFF9EF",
    "text": "#111821",
    "muted": "#586270",
    "line": "#D6C7B4",
    "white": "#F8F2E9",
    "coral": "#E46255",
    "blue": "#3978D5",
    "amber": "#DFAE32",
    "green": "#27A982",
    "violet": "#755CDE",
}

ACCENTS = [
    COLORS["coral"],
    COLORS["blue"],
    COLORS["amber"],
    COLORS["green"],
    COLORS["violet"],
    COLORS["coral"],
    COLORS["green"],
    COLORS["blue"],
    COLORS["amber"],
    COLORS["violet"],
]


def font(size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size, index=index)
    return ImageFont.load_default(size=size)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def text_width(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> int:
    return text_size(draw, text, fnt)[0]


def line_height(draw: ImageDraw.ImageDraw, fnt: ImageFont.ImageFont) -> int:
    return text_size(draw, "Ag가", fnt)[1]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    if not text:
        return [""]

    tokens = text.split(" ")
    lines: list[str] = []
    current = ""

    def push_long_token(token: str) -> None:
        chunk = ""
        for ch in token:
            proposed = chunk + ch
            if text_width(draw, proposed, fnt) <= max_width:
                chunk = proposed
            else:
                if chunk:
                    lines.append(chunk)
                chunk = ch
        if chunk:
            lines.append(chunk)

    for token in tokens:
        proposed = token if not current else f"{current} {token}"
        if text_width(draw, proposed, fnt) <= max_width:
            current = proposed
            continue

        if current:
            lines.append(current)
            current = ""

        if text_width(draw, token, fnt) <= max_width:
            current = token
        else:
            push_long_token(token)

    if current:
        lines.append(current)
    return lines


def text_block_height(
    draw: ImageDraw.ImageDraw,
    paragraphs: Iterable[str],
    fnt: ImageFont.ImageFont,
    max_width: int,
    paragraph_gap: int,
    leading: int,
) -> int:
    height = 0
    for para in paragraphs:
        lines = wrap_text(draw, para, fnt, max_width)
        height += len(lines) * (line_height(draw, fnt) + leading)
        height += paragraph_gap
    return max(0, height - paragraph_gap)


def draw_text_block(
    draw: ImageDraw.ImageDraw,
    paragraphs: Iterable[str],
    xy: tuple[int, int],
    fnt: ImageFont.ImageFont,
    fill: str,
    max_width: int,
    paragraph_gap: int = 22,
    leading: int = 12,
) -> int:
    x, y = xy
    for para in paragraphs:
        lines = wrap_text(draw, para, fnt, max_width)
        for line in lines:
            draw.text((x, y), line, font=fnt, fill=fill)
            y += line_height(draw, fnt) + leading
        y += paragraph_gap
    return y - paragraph_gap


def fit_headline(draw: ImageDraw.ImageDraw, headline: str, max_width: int) -> ImageFont.FreeTypeFont:
    for size in range(84, 54, -2):
        fnt = font(size)
        if len(wrap_text(draw, headline, fnt, max_width)) <= 2:
            return fnt
    return font(54)


def fit_body(draw: ImageDraw.ImageDraw, paragraphs: list[str], max_width: int, max_height: int) -> ImageFont.FreeTypeFont:
    for size in range(43, 32, -1):
        fnt = font(size)
        height = text_block_height(draw, paragraphs, fnt, max_width, paragraph_gap=24, leading=12)
        if height <= max_height:
            return fnt
    return font(32)


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], fill: str, width: int = 5) -> None:
    draw.line([start, end], fill=fill, width=width)
    sx, sy = start
    ex, ey = end
    dx = ex - sx
    dy = ey - sy
    if abs(dx) >= abs(dy):
        sign = 1 if dx >= 0 else -1
        points = [(ex, ey), (ex - sign * 18, ey - 11), (ex - sign * 18, ey + 11)]
    else:
        sign = 1 if dy >= 0 else -1
        points = [(ex, ey), (ex - 11, ey - sign * 18), (ex + 11, ey - sign * 18)]
    draw.polygon(points, fill=fill)


def module_label(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    label: str,
    accent: str,
    fill: str | None = None,
    text_fill: str | None = None,
) -> None:
    fill = fill or COLORS["paper_3"]
    text_fill = text_fill or COLORS["text"]
    draw.rounded_rectangle(xy, radius=7, fill=fill, outline=accent, width=2)
    fnt = font(25)
    tw, th = text_size(draw, label, fnt)
    draw.text((xy[0] + (xy[2] - xy[0] - tw) // 2, xy[1] + (xy[3] - xy[1] - th) // 2 - 2), label, font=fnt, fill=text_fill)


def draw_top_grid(draw: ImageDraw.ImageDraw) -> None:
    for x in range(48, WIDTH, 96):
        draw.line((x, 0, x, TOP_H), fill="#172231", width=1)
    for y in range(64, TOP_H, 80):
        draw.line((0, y, WIDTH, y), fill="#172231", width=1)


def draw_masthead(draw: ImageDraw.ImageDraw, card: dict, deck_title: str, accent: str) -> None:
    small = font(25)
    index = font(72)
    draw.text((MARGIN, 56), deck_title.upper(), font=small, fill=COLORS["paper_2"])
    draw.text((MARGIN, 92), "WHAT CLOSES THE LOOP?", font=font(23), fill=accent)
    number = f"{card['number']:02d}"
    tw, _ = text_size(draw, number, index)
    draw.text((WIDTH - MARGIN - tw, 45), number, font=index, fill=COLORS["ink_3"])
    draw.line((MARGIN, 142, WIDTH - MARGIN, 142), fill=accent, width=3)


def draw_background(draw: ImageDraw.ImageDraw, accent: str) -> None:
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=COLORS["paper"])
    draw.rectangle((0, 0, WIDTH, TOP_H), fill=COLORS["ink"])
    draw_top_grid(draw)
    draw.rectangle((0, 0, 18, HEIGHT), fill=accent)
    draw.rectangle((18, TOP_H - 8, WIDTH, TOP_H), fill=accent)
    draw.rectangle((18, TOP_H, WIDTH, TOP_H + 18), fill=COLORS["paper_2"])


def draw_visual(draw: ImageDraw.ImageDraw, number: int, accent: str) -> None:
    area = (MARGIN, 166, WIDTH - MARGIN, TOP_H - 38)
    x0, y0, x1, y1 = area
    cx = (x0 + x1) // 2 + 170
    cy = (y0 + y1) // 2

    if number == 1:
        r = 118
        draw.arc((cx - r, cy - r, cx + r, cy + r), 26, 336, fill=accent, width=10)
        arrow(draw, (cx + 76, cy - 92), (cx + 118, cy - 24), accent, 8)
        labels = [
            ("Verifier", cx - 282, cy - 40),
            ("Feedback", cx - 152, cy + 122),
            ("Tools", cx + 20, cy + 122),
            ("State", cx + 132, cy - 40),
        ]
        for label, x, y in labels:
            module_label(draw, (x, y, x + 148, y + 50), label, accent)
    elif number == 2:
        left_x = x1 - 430
        draw.line((left_x, cy, left_x + 150, cy), fill=COLORS["paper_2"], width=5)
        draw.line((left_x + 20, cy - 66, left_x + 126, cy + 40), fill=COLORS["coral"], width=9)
        draw.line((left_x + 20, cy + 40, left_x + 126, cy - 66), fill=COLORS["coral"], width=9)
        draw.rounded_rectangle((left_x + 236, cy - 108, left_x + 406, cy + 82), radius=7, outline=accent, width=5)
        draw.line((left_x + 258, cy - 54, left_x + 384, cy - 54), fill=accent, width=8)
        draw.line((left_x + 258, cy + 22, left_x + 384, cy + 22), fill=accent, width=8)
        arrow(draw, (left_x + 154, cy + 110), (left_x + 236, cy + 110), accent, 7)
    elif number == 3:
        labels = [("local", "next-token"), ("sequence", "likelihood"), ("task", "utility")]
        for i, (kind, detail) in enumerate(labels):
            x = x1 - 472 + i * 40
            y = y0 + 36 + i * 84
            draw.rounded_rectangle((x, y, x + 360, y + 66), radius=7, fill=COLORS["paper_3"], outline=accent, width=3)
            draw.text((x + 24, y + 11), kind, font=font(26), fill=accent)
            draw.text((x + 150, y + 11), detail, font=font(26), fill=COLORS["text"])
            if i < 2:
                draw.text((x + 376, y + 55), "!=", font=font(38), fill=accent)
    elif number == 4:
        labels = ["state", "action", "observe", "verify", "update"]
        coords = [(x1 - 450, y0 + 30), (x1 - 210, y0 + 30), (x1 - 210, y0 + 204), (x1 - 450, y0 + 204), (x1 - 330, y0 + 117)]
        for label, (x, y) in zip(labels, coords):
            module_label(draw, (x, y, x + 144, y + 52), label, accent)
        arrow(draw, (x1 - 306, y0 + 56), (x1 - 210, y0 + 56), accent, 5)
        arrow(draw, (x1 - 138, y0 + 82), (x1 - 138, y0 + 204), accent, 5)
        arrow(draw, (x1 - 210, y0 + 230), (x1 - 306, y0 + 230), accent, 5)
        arrow(draw, (x1 - 450, y0 + 204), (x1 - 450, y0 + 82), accent, 5)
    elif number == 5:
        for i, label in enumerate(["weak", "strong"]):
            x = x1 - 448 + i * 236
            draw.rounded_rectangle((x, y0 + 54, x + 184, y0 + 246), radius=7, fill=COLORS["paper_3"], outline=COLORS["line"], width=2)
            color = COLORS["muted"] if i == 0 else accent
            draw.arc((x + 48, y0 + 100, x + 136, y0 + 188), 20, 332, fill=color, width=9)
            draw.text((x + 50, y0 + 202), label, font=font(27), fill=COLORS["text"])
        draw.text((x1 - 248, y0 + 130), "vs", font=font(33), fill=COLORS["white"])
    elif number == 6:
        for y in [y0 + 48, y0 + 126, y0 + 204]:
            draw.rounded_rectangle((x1 - 468, y, x1 - 346, y + 48), radius=7, fill=COLORS["paper_2"])
            arrow(draw, (x1 - 346, y + 24), (x1 - 244, y0 + 150), COLORS["line"], 4)
        draw.polygon([(x1 - 244, y0 + 74), (x1 - 102, y0 + 150), (x1 - 244, y0 + 226)], fill=accent)
        draw.text((x1 - 216, y0 + 126), "V", font=font(56), fill=COLORS["ink"])
        arrow(draw, (x1 - 102, y0 + 150), (x1 - 16, y0 + 150), accent, 7)
    elif number == 7:
        draw.line((x1 - 452, y0 + 88, x1 - 346, y0 + 194), fill=COLORS["coral"], width=12)
        draw.line((x1 - 452, y0 + 194, x1 - 346, y0 + 88), fill=COLORS["coral"], width=12)
        arrow(draw, (x1 - 306, y0 + 140), (x1 - 214, y0 + 140), accent, 7)
        draw.rounded_rectangle((x1 - 182, y0 + 52, x1 - 22, y0 + 230), radius=7, fill=COLORS["paper_3"])
        for i, width in enumerate([108, 78, 122, 92]):
            draw.rectangle((x1 - 154, y0 + 86 + i * 34, x1 - 154 + width, y0 + 100 + i * 34), fill=accent)
    elif number == 8:
        draw.rounded_rectangle((x1 - 470, y0 + 112, x1 - 328, y0 + 224), radius=7, fill=COLORS["paper_3"], outline=accent, width=4)
        draw.text((x1 - 436, y0 + 148), "LLM", font=font(34), fill=COLORS["text"])
        labels = ["test", "web", "db", "api"]
        coords = [(x1 - 218, y0 + 34), (x1 - 82, y0 + 92), (x1 - 218, y0 + 198), (x1 - 82, y0 + 252)]
        for label, (x, y) in zip(labels, coords):
            module_label(draw, (x, y, x + 104, y + 46), label, accent)
            arrow(draw, (x1 - 328, y0 + 168), (x, y + 23), accent, 4)
    elif number == 9:
        x = x1 - 456
        y = y0 + 58
        draw.rounded_rectangle((x, y, x + 390, y + 238), radius=7, fill=COLORS["paper_3"], outline=accent, width=4)
        draw.line((x + 195, y, x + 195, y + 238), fill=COLORS["line"], width=3)
        draw.line((x, y + 119, x + 390, y + 119), fill=COLORS["line"], width=3)
        labels = ["own", "trace", "rollback", "stop"]
        positions = [(x + 42, y + 42), (x + 230, y + 42), (x + 34, y + 160), (x + 246, y + 160)]
        for label, pos in zip(labels, positions):
            draw.text(pos, label, font=font(30), fill=COLORS["text"])
    elif number == 10:
        cx = x1 - 260
        cy = y0 + 160
        r = 138
        arcs = [(20, 90, COLORS["blue"]), (110, 180, COLORS["green"]), (200, 270, COLORS["amber"]), (290, 358, COLORS["coral"])]
        for start, end, color in arcs:
            draw.arc((cx - r, cy - r, cx + r, cy + r), start, end, fill=color, width=12)
        draw.text((cx - 48, cy - 24), "signal", font=font(31), fill=COLORS["white"])
        arrow(draw, (cx + 84, cy - 118), (cx + 130, cy - 38), COLORS["violet"], 8)


def draw_reading_zone(draw: ImageDraw.ImageDraw, card: dict, accent: str) -> None:
    x = MARGIN
    max_width = WIDTH - MARGIN * 2
    y = TOP_H + 62

    eyebrow = font(30)
    draw.text((x, y), card["eyebrow"], font=eyebrow, fill=accent)
    y += 52

    headline = fit_headline(draw, card["headline"], max_width)
    for line in wrap_text(draw, card["headline"], headline, max_width):
        draw.text((x, y), line, font=headline, fill=COLORS["text"])
        y += line_height(draw, headline) + 15

    y += 34
    max_body_h = FOOTER_Y - y - 56
    body_font = fit_body(draw, card["body"], max_width, max_body_h)

    if card["number"] == 3:
        fnt = font(40)
        for idx, paragraph in enumerate(card["body"]):
            fill = accent if idx < 3 else COLORS["text"]
            draw.text((x, y), paragraph, font=fnt, fill=fill)
            y += line_height(draw, fnt) + 24
    elif card["number"] == 10:
        for idx, paragraph in enumerate(card["body"]):
            fnt = font(41)
            fill = accent if idx in {1, 2} else COLORS["text"]
            for line in wrap_text(draw, paragraph, fnt, max_width):
                draw.text((x, y), line, font=fnt, fill=fill)
                y += line_height(draw, fnt) + 12
            y += 18
    else:
        draw_text_block(draw, card["body"], (x, y), body_font, COLORS["text"], max_width, paragraph_gap=24, leading=12)

    draw.line((MARGIN, FOOTER_Y - 30, WIDTH - MARGIN, FOOTER_Y - 30), fill=COLORS["line"], width=2)
    footer_font = font(26)
    draw.text((MARGIN, FOOTER_Y), card["footer"], font=footer_font, fill=COLORS["muted"])
    number = f"{card['number']:02d}/10"
    tw, _ = text_size(draw, number, footer_font)
    draw.text((WIDTH - MARGIN - tw, FOOTER_Y), number, font=footer_font, fill=accent)


def render_card(card: dict, deck_title: str) -> Image.Image:
    accent = ACCENTS[(card["number"] - 1) % len(ACCENTS)]
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["paper"])
    draw = ImageDraw.Draw(image)

    draw_background(draw, accent)
    draw_masthead(draw, card, deck_title, accent)
    draw_visual(draw, card["number"], accent)
    draw_reading_zone(draw, card, accent)

    return image


def make_contact_sheet(paths: list[Path]) -> None:
    thumb_w = 324
    thumb_h = 405
    gap = 32
    label_h = 34
    cols = 5
    rows = 2
    sheet_w = cols * thumb_w + (cols + 1) * gap
    sheet_h = rows * (thumb_h + label_h) + (rows + 1) * gap
    sheet = Image.new("RGB", (sheet_w, sheet_h), COLORS["ink"])
    draw = ImageDraw.Draw(sheet)
    label_font = font(24)

    for idx, path in enumerate(paths):
        img = Image.open(path).convert("RGB")
        img.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        col = idx % cols
        row = idx // cols
        x = gap + col * (thumb_w + gap)
        y = gap + row * (thumb_h + label_h + gap)
        sheet.paste(img, (x, y))
        draw.text((x, y + thumb_h + 8), f"card-{idx + 1:02d}.png", font=label_font, fill=COLORS["paper"])

    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, quality=95)


def validate_image(path: Path) -> None:
    image = Image.open(path).convert("RGB")
    if image.size != (WIDTH, HEIGHT):
        raise ValueError(f"{path} has unexpected size {image.size}")
    extrema = image.getextrema()
    if all(lo == hi for lo, hi in extrema):
        raise ValueError(f"{path} is blank")
    stat = ImageStat.Stat(image)
    if max(stat.stddev) < 10:
        raise ValueError(f"{path} has suspiciously low visual variance")


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    paths: list[Path] = []
    alt_lines = ["# LinkedIn Card News Alt Text", ""]
    for card in data["cards"]:
        image = render_card(card, data["deckTitle"])
        path = OUT_DIR / f"card-{card['number']:02d}.png"
        image.save(path, quality=95)
        validate_image(path)
        paths.append(path)
        alt_lines.append(f"## Card {card['number']:02d}")
        alt_lines.append("")
        alt_lines.append(card["alt"])
        alt_lines.append("")

    if len(paths) != 10:
        raise ValueError(f"expected 10 cards, got {len(paths)}")

    ALT_TEXT.write_text("\n".join(alt_lines), encoding="utf-8")
    make_contact_sheet(paths)

    print(f"wrote {len(paths)} individual cards to {OUT_DIR}")
    print(f"wrote contact sheet to {CONTACT_SHEET}")
    print(f"wrote alt text to {ALT_TEXT}")


if __name__ == "__main__":
    main()
