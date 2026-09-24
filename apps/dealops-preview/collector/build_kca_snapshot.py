import csv, hashlib, html, json, re, statistics, sys, urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

CATALOG_PAGE = "https://www.data.go.kr/data/15083256/fileData.do"
CATALOG_JSON = "https://www.data.go.kr/catalog/15083256/fileData.json"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "kca-latest.json"
UA = "DealOps-KCA-Snapshot/1.0 (+https://dealops-preview.obvious-chive.workers.dev)"
FOOD = re.compile(r"쌀|콩|국|탕|면|만두|우유|치즈|요거트|두부|계란|고기|돼지|소고기|닭|과자|아몬드|음료|커피|차|주스|식용유|참기름|간장|고추장|된장|김치|냉동|빵|햄|소시지|라면|생수|과일|채소|버터|참치|통조림|카레|식초|설탕|소금")
LIFE = re.compile(r"세제|락스|칫솔|치약|샴푸|린스|비누|휴지|화장지|기저귀|섬유|주방|욕실|세정|랩|호일|건전지|생리대")

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def download_url():
    page = get(CATALOG_PAGE).decode("utf-8", "replace")
    m = re.search(r'"contentUrl"\s*:\s*"(https://www\.data\.go\.kr/cmm/cmm/fileDownload\.do\?[^"]+)"', page)
    if not m:
        raise RuntimeError("공공데이터포털 CSV 다운로드 주소를 찾지 못했습니다.")
    return html.unescape(m.group(1))
def split_product(name):
    m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", name)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return name.strip(), "참가격 조사 상품"

def category_for(name):
    if LIFE.search(name):
        return "생활·육아"
    if FOOD.search(name):
        return "장보기·식품"
    return "이 가격 어때요?"

def candidate_row(row, median):
    price = int(row["판매가격"])
    sale = row.get("세일여부", "").strip().upper() == "Y"
    oneplus = row.get("원플러스원", "").strip().upper() == "Y"
    ratio = price / median if median else 1
    if oneplus:
        priority = 0
    elif sale and ratio <= 0.82:
        priority = 1
    else:
        return None
    product, variant = split_product(row["상품명"])
    flags = []
    if sale:
        flags.append("세일 표시 Y")
    if oneplus:
        flags.append("원플러스원 표시 Y")
    conditions = f"참가격 조사일 {row['조사일']} · {' · '.join(flags)}. 조사 시점 가격이며 현재 판매가격은 판매점에서 다시 확인해야 합니다."
    key_src = f"{row['상품명']}|{row['판매업소']}"
    return {
        "key": hashlib.sha256(key_src.encode()).hexdigest()[:20],
        "priority": priority,
        "ratio": round(ratio, 6),
        "product": product,
        "variant": variant,
        "seller": row["판매업소"].strip(),
        "manufacturer": row.get("제조사", "").strip(),
        "price": price,
        "sale": sale,
        "onePlusOne": oneplus,
        "observedDate": row["조사일"],
        "category": category_for(name=row["상품명"]),
        "conditions": conditions,
    }
def build():
    direct = download_url()
    raw = get(direct)
    text = raw.decode("cp949")
    rows = list(csv.DictReader(text.splitlines()))
    required = {"상품명", "조사일", "판매가격", "판매업소", "제조사", "세일여부", "원플러스원"}
    if not rows or not required.issubset(rows[0]):
        raise RuntimeError("참가격 CSV 열 구성이 예상과 다릅니다.")
    latest = max(r["조사일"] for r in rows if r["조사일"])
    latest_rows = [r for r in rows if r["조사일"] == latest and r["판매가격"].isdigit()]
    by_product = defaultdict(list)
    for row in latest_rows:
        price = int(row["판매가격"])
        if 0 < price <= 100_000_000:
            by_product[row["상품명"]].append(row)

    picks = []
    for product, group in by_product.items():
        prices = [int(r["판매가격"]) for r in group]
        median = statistics.median(prices)
        eligible = [candidate_row(r, median) for r in group]
        eligible = [x for x in eligible if x]
        if not eligible:
            continue
        eligible.sort(key=lambda x: (x["priority"], x["ratio"], x["price"], x["seller"]))
        best = eligible[0]
        best["storeMedian"] = int(round(median))
        picks.append(best)

    picks.sort(key=lambda x: (x["priority"], x["ratio"], x["price"], x["product"]))
    picks = picks[:32]
    for x in picks:
        x.pop("priority", None)
    meta = json.loads(get(CATALOG_JSON).decode("utf-8"))
    snapshot = {
        "schema": 1,
        "feedKey": "kca-price-baseline",
        "datasetId": "15083256",
        "name": "한국소비자원 생필품 가격 정보",
        "license": meta.get("license"),
        "datasetPage": CATALOG_PAGE,
        "observedDate": latest,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "latestRowCount": len(latest_rows),
        "candidateCount": len(picks),
        "notice": "조사 시점 기준 가격 후보입니다. 현재 판매가격 확인 전에는 게시하지 않습니다.",
        "candidates": picks,
    }
    if snapshot["license"] != "이용허락범위 제한 없음":
        raise RuntimeError(f"예상한 이용허락범위가 아닙니다: {snapshot['license']!r}")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    old = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else None
    OUTPUT.write_text(content, encoding="utf-8")
    print(json.dumps({
        "changed": old != content,
        "observedDate": latest,
        "latestRows": len(latest_rows),
        "candidates": len(picks),
        "output": str(OUTPUT),
        "sourceSha256": snapshot["sourceSha256"],
    }, ensure_ascii=False))

if __name__ == "__main__":
    try:
        build()
    except Exception as exc:
        print(f"snapshot build failed: {exc}", file=sys.stderr)
        raise
