# Points the digit characters of each font at its tabular (tnum) glyphs.
# takumi-pdf ignores font-feature-settings and font-variant-numeric, so this
# is the only way to get amounts that line up in a column.
#
#   uv run --with fonttools python scripts/tabular-figures.py \
#     Geist-Regular.ttf src/fonts/Geist-Regular.ttf
#
# Takes (source, output) pairs. Sources are the static TTFs from
# https://github.com/vercel/geist-font (fonts/Geist/ttf), OFL 1.1.
import sys

from fontTools.ttLib import TTFont

for source, output in zip(sys.argv[1::2], sys.argv[2::2]):
    font = TTFont(source)
    gsub = font['GSUB'].table
    tabular = {}
    for record in gsub.FeatureList.FeatureRecord:
        if record.FeatureTag != 'tnum':
            continue
        for index in record.Feature.LookupListIndex:
            for table in gsub.LookupList.Lookup[index].SubTable:
                table = getattr(table, 'ExtSubTable', table)
                tabular.update(getattr(table, 'mapping', {}))
    for table in font['cmap'].tables:
        for code, glyph in list(table.cmap.items()):
            if glyph in tabular:
                table.cmap[code] = tabular[glyph]
    font.save(output)
