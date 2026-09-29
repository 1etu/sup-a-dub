from pathlib import Path
import copy
import json
import pathops
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

root = Path(__file__).resolve().parents[3]
source = Path(__file__).with_name('Righteous-source.ttf')
output = root / 'packages/assets/fonts/supadub-display.ttf'
font = TTFont(source)
glyph_set = font.getGlyphSet()
original_metrics = copy.deepcopy(font['hmtx'].metrics)
new_glyphs = {}

for name in font.getGlyphOrder():
    outline = pathops.Path()
    pen = TransformPen(outline.getPen(glyph_set), (1.12, 0, 0, 1, 60, 0))
    glyph_set[name].draw(pen)
    if outline.contours:
        stroke = pathops.Path(outline)
        stroke.stroke(104, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 2)
        stroke.convertConicsToQuads()
        outline = pathops.op(outline, stroke, pathops.PathOp.UNION)
    target_pen = TTGlyphPen(None)
    outline.draw(target_pen)
    new_glyphs[name] = target_pen.glyph()
    width, bearing = original_metrics[name]
    font['hmtx'][name] = (round(width * 1.12 + 120), round(bearing * 1.12 + 8))

for name, glyph in new_glyphs.items():
    font['glyf'][name] = glyph

def make_glyph(commands, width, transform=None):
    path = pathops.Path()
    pen = path.getPen()
    for operation, points in commands:
        getattr(pen, operation)(*points)
    if transform:
        path = path.transform(*transform)
    path = path.transform(1, 0, 0, 1538 / 1434, 0, -52)
    path = pathops.simplify(path)
    target_pen = TTGlyphPen(None)
    path.draw(target_pen)
    return target_pen.glyph(), (width, 100)

m = [
    ('moveTo', [(100, 0)]),
    ('lineTo', [(100, 640)]),
    ('qCurveTo', [(100, 1434), (850, 1434)]),
    ('lineTo', [(1770, 1434)]),
    ('lineTo', [(1770, 0)]),
    ('lineTo', [(1390, 0)]),
    ('lineTo', [(1390, 1060)]),
    ('lineTo', [(1160, 1060)]),
    ('lineTo', [(1160, 0)]),
    ('lineTo', [(780, 0)]),
    ('lineTo', [(780, 1028)]),
    ('qCurveTo', [(480, 920), (480, 640)]),
    ('lineTo', [(480, 0)]),
    ('closePath', []),
]
n = [
    ('moveTo', [(100, 0)]),
    ('lineTo', [(100, 1434)]),
    ('lineTo', [(800, 1434)]),
    ('qCurveTo', [(1500, 1434), (1500, 750)]),
    ('lineTo', [(1500, 0)]),
    ('lineTo', [(1110, 0)]),
    ('lineTo', [(1110, 740)]),
    ('qCurveTo', [(1110, 1060), (790, 1060)]),
    ('lineTo', [(490, 1060)]),
    ('lineTo', [(490, 0)]),
    ('closePath', []),
]
c = [
    ('moveTo', [(1480, 1434)]),
    ('lineTo', [(820, 1434)]),
    ('qCurveTo', [(100, 1434), (100, 717)]),
    ('qCurveTo', [(100, 0), (820, 0)]),
    ('lineTo', [(1480, 0)]),
    ('lineTo', [(1480, 374)]),
    ('lineTo', [(830, 374)]),
    ('qCurveTo', [(490, 374), (490, 717)]),
    ('qCurveTo', [(490, 1060), (830, 1060)]),
    ('lineTo', [(1480, 1060)]),
    ('closePath', []),
]
y = [
    ('moveTo', [(40, 1434)]),
    ('lineTo', [(500, 1434)]),
    ('lineTo', [(770, 1000)]),
    ('lineTo', [(1040, 1434)]),
    ('lineTo', [(1500, 1434)]),
    ('lineTo', [(970, 630)]),
    ('lineTo', [(970, 0)]),
    ('lineTo', [(570, 0)]),
    ('lineTo', [(570, 630)]),
    ('closePath', []),
]

for character, commands, width, transform in [
    ('M', m, 1870, None),
    ('N', n, 1600, None),
    ('W', m, 1870, (-1, 0, 0, -1, 1870, 1434)),
    ('C', c, 1580, None),
    ('Y', y, 1540, None),
]:
    name = font.getBestCmap()[ord(character)]
    glyph, metrics = make_glyph(commands, width, transform)
    font['glyf'][name] = glyph
    font['hmtx'][name] = metrics

for name in font.getGlyphOrder():
    font['glyf'][name].recalcBounds(font['glyf'])
    glyph = font['glyf'][name]
    if glyph.numberOfContours:
        width, bearing = font['hmtx'][name]
        font['hmtx'][name] = (width, glyph.xMin)

for table in ['VDMX', 'kern']:
    if table in font:
        del font[table]

replacements = {
    0: 'Copyright (c) 2011 by Brian J. Bonislawsky DBA Astigmatic (AOETI). Supadub Display modifications (c) 2026 Sup-a-Dub contributors. Licensed under the SIL Open Font License, Version 1.1.',
    1: 'Supadub Display',
    2: 'Regular',
    3: 'SupadubDisplay-1.000',
    4: 'Supadub Display',
    5: 'Version 1.000',
    6: 'SupadubDisplay-Regular',
    16: 'Supadub Display',
    17: 'Regular',
}
for record in font['name'].names:
    if record.nameID in replacements:
        record.string = replacements[record.nameID].encode(record.getEncoding(), errors='replace')
for name_id, value in replacements.items():
    font['name'].setName(value, name_id, 3, 1, 0x409)
font['OS/2'].usWeightClass = 700
font['OS/2'].usWidthClass = 7
font['OS/2'].sTypoAscender = 1650
font['OS/2'].sTypoDescender = -440
font['OS/2'].sTypoLineGap = 0
font['hhea'].ascent = 1650
font['hhea'].descent = -440
font['hhea'].lineGap = 0
font.recalcBBoxes = True
font.save(output)
web_output = root / 'apps/web/public/fonts/supadub-display.ttf'
web_output.write_bytes(output.read_bytes())
print(json.dumps({'output': str(output), 'bytes': output.stat().st_size, 'family': 'Supadub Display', 'modifiedGlyphs': ['M', 'N', 'W', 'C', 'Y'], 'widthScale': 1.12, 'outlineExpansion': 52}, indent=2))
