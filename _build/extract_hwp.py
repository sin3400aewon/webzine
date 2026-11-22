#!/usr/bin/env python3
"""애원복지 합본 HWP → 원고 구조 덤프 + 웹용 사진 만들기

사용법:
  pip install pyhwp lxml pillow --break-system-packages
  python3 -I extract_hwp.py "합본.hwp" 작업폴더 [사진원본폴더]

결과:
  작업폴더/dump.txt   : 본문·표·사진(BIN....) 순서를 그대로 펼친 텍스트 (꼭지별 원고 작성에 사용)
  작업폴더/img/*.jpg  : 합본에 들어 있던 사진을 웹용(긴 변 1200px, 품질 72)으로 줄인 것
  사진원본폴더를 주면 그 안의 사진도 같은 기준으로 줄여 작업폴더/img_orig/ 에 둔다
주의: 합본 안의 사진 위치 정보가 빠진 경우가 있다(50호 화보NEWS1). dump.txt에 [IMG] 위치가
      없는 사진은 사진 내용을 직접 보고 꼭지에 맞춰야 하며, 담당자에게 확인을 요청한다.
"""
import os, shutil, subprocess, sys
from lxml import etree
from PIL import Image, ImageOps

src, out = sys.argv[1], sys.argv[2]
orig = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(out, exist_ok=True)
shutil.copy(src, os.path.join(out, "src.hwp"))
subprocess.run(["hwp5html", "--output", os.path.join(out, "html"), os.path.join(out, "src.hwp")], check=True)

# 1) 순서대로 펼치기
t = etree.parse(os.path.join(out, "html", "index.xhtml"), etree.HTMLParser())
lines = []
def walk(el, d):
    tag = el.tag if isinstance(el.tag, str) else ""
    if tag == "img":
        lines.append("  " * d + "[IMG " + el.get("src", "").split("/")[-1] + "]"); return
    if tag == "table": lines.append("  " * d + "<TABLE>")
    if tag == "td": lines.append("  " * d + "<TD>")
    if tag == "p":
        txt = "".join(el.itertext()).strip()
        if txt and not el.findall(".//table"): lines.append("  " * d + txt)
        if not el.findall(".//table"):
            for i in el.findall(".//img"): lines.append("  " * d + "[IMG " + i.get("src", "").split("/")[-1] + "]")
            return
    for c in el: walk(c, d + 1 if tag in ("table", "td") else d)
walk(t.getroot(), 0)
open(os.path.join(out, "dump.txt"), "w", encoding="utf-8").write("\n".join(l for l in lines if l.strip()))

# 2) 사진 줄이기
def shrink(folder, dest):
    os.makedirs(dest, exist_ok=True)
    for f in sorted(os.listdir(folder)):
        p = os.path.join(folder, f)
        try:
            im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        except Exception:
            continue
        tall = im.height > im.width * 2
        im.thumbnail((700, 2100) if tall else (1200, 1200), Image.LANCZOS)
        im.save(os.path.join(dest, os.path.splitext(f)[0] + ".jpg"), "JPEG", quality=72, optimize=True, progressive=True)

shrink(os.path.join(out, "html", "bindata"), os.path.join(out, "img"))
if orig: shrink(orig, os.path.join(out, "img_orig"))
used = {l.split()[-1].rstrip("]").split(".")[0] for l in lines if "[IMG" in l}
allimg = {os.path.splitext(f)[0] for f in os.listdir(os.path.join(out, "img"))}
print("dump:", os.path.join(out, "dump.txt"))
print("사진", len(allimg), "장 / 위치 없는 사진:", sorted(allimg - used))
