"""보고서를 PDF로 뽑고 `보고서/` 폴더까지 한 번에 갱신한다.

    python docs/보고서만들기.py

변환과 복사를 따로 하면 옛 판이 `보고서/` 에 남는다 — 실제로 그랬다.
한 번에 묶어 두면 어긋날 수 없다.
"""
import pathlib
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

DOCS = pathlib.Path(__file__).resolve().parent
ROOT = DOCS.parent
OUT = ROOT / "보고서"
SKILL = pathlib.Path.home() / ".claude" / "skills" / "hwp" / "scripts"


def run(*args: str) -> None:
    """스크립트를 docs/ 에서 실행한다 — 그림 경로가 상대 경로라 cwd 가 중요하다."""
    r = subprocess.run(
        [sys.executable, *args], cwd=DOCS,
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if r.returncode != 0:
        sys.stdout.write(r.stdout or "")
        sys.stderr.write(r.stderr or "")
        raise SystemExit(f"실패: {' '.join(args)}")
    tail = [ln for ln in (r.stdout or "").splitlines() if ln.strip()]
    if tail:
        print("  " + tail[-1])


pdf = DOCS / "보고서.pdf"
before = pdf.stat().st_mtime if pdf.exists() else None

print("1) PDF 변환")
run(str(SKILL / "md2hwp.py"), "보고서.md", "보고서.pdf")

# 대상이 열려 있으면 저장이 조용히 실패하고 옛 파일이 남는다. 갱신 여부를 확인한다.
if before is not None and pdf.stat().st_mtime == before:
    raise SystemExit("오류: 보고서.pdf 가 갱신되지 않았습니다. PDF 뷰어에서 닫고 다시 실행하세요.")

print("2) 쪽별 이미지 렌더")
shutil.rmtree(DOCS / "_chk", ignore_errors=True)
run(str(SKILL / "preview.py"), "보고서.pdf", "--outdir", "_chk")

print("3) 보고서/ 폴더 갱신")
shutil.rmtree(OUT, ignore_errors=True)
OUT.mkdir(parents=True)
for name in ("보고서.pdf", "보고서.md", "flow_screen.png"):
    src = DOCS / name
    if src.exists():
        shutil.copy2(src, OUT / name)
if (DOCS / "screenshots").is_dir():
    shutil.copytree(DOCS / "screenshots", OUT / "screenshots")
for png in sorted((DOCS / "_chk").glob("*.png")):
    shutil.copy2(png, OUT / png.name)

pages = len(list(OUT.glob("보고서.p*.png")))
print(f"\n완료 — {OUT}")
print(f"  보고서.pdf  ({pages}쪽)")
print(f"  보고서.p1~p{pages}.png  ← 쪽별로 바로 볼 수 있다")
if not 2 <= pages <= 4:
    print(f"  주의: 분량 요건은 2~4쪽인데 현재 {pages}쪽이다.")
