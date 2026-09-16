"""Package and table-order checks, without claiming desktop Office validation."""
from pathlib import Path
import posixpath
import zipfile
from xml.etree import ElementTree as ET


def validate(path):
    with zipfile.ZipFile(path) as package:
        assert package.testzip() is None, 'ZIP checksum failure'
        names = package.namelist()
        assert len(names) == len(set(names)), 'Duplicate ZIP entries'
        slides = 0
        cells = 0
        for name in names:
            if not name.endswith(('.xml', '.rels')):
                continue
            root = ET.fromstring(package.read(name))
            if name.startswith('ppt/slides/slide') and name.endswith('.xml'):
                slides += 1
            if name.endswith('.rels'):
                base = '' if name == '_rels/.rels' else posixpath.dirname(posixpath.dirname(name))
                ids = [r.attrib['Id'] for r in root]
                assert len(ids) == len(set(ids)), (name, 'duplicate relationship IDs')
                for rel in root:
                    if rel.get('TargetMode') != 'External':
                        target = posixpath.normpath(posixpath.join(base, rel.attrib['Target'])).lstrip('/')
                        assert target in names, (name, target)
            for cell in root.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}tcPr'):
                cells += 1
                fill_seen = False
                for child in cell:
                    tag = child.tag.rsplit('}', 1)[-1]
                    if tag in ('noFill','solidFill','gradFill','blipFill','pattFill','grpFill'):
                        fill_seen = True
                    if tag in ('lnL','lnR','lnT','lnB','lnTlToBr','lnBlToTr'):
                        assert not fill_seen, (name, 'table border appears after fill')
        return {'slides': slides, 'tableCells': cells}


if __name__ == '__main__':
    import sys
    paths = [Path(p) for p in sys.argv[1:]] or sorted((Path(__file__).resolve().parents[1] / 'exports').glob('*.pptx'))
    for path in paths:
        print(path.name, validate(path))
