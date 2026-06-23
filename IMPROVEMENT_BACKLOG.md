# Improvement Backlog — "make it solid"

จาก review codebase (2026-06-22) ช่วงที่ generate /analyze + /dashboard ถี่ขึ้น
เรียงตาม leverage. หยิบทำได้ทีละอันแบบ stateless — แต่ละข้อมีไฟล์เกี่ยวข้องครบ

---

## 1. ปิด loop ของ backtest (auto-checkpoint price fetch) — สำคัญสุด
**ปัญหา:** `web/lib/backtest.ts` มีโครง 30/60/90 วันครบ แต่พึ่ง `priceCache` ที่ต้อง populate เอง → ไม่มี job ดึงราคาย้อนหลังที่ checkpoint → hit-rate ขึ้น "pending" เกือบหมด วัดความแม่นของ verdict/score ไม่ได้จริง
**ทำ:** scheduled task / script ดึงราคา ณ `targetDate` ของแต่ละ checkpoint (Yahoo เหมือน `web/app/api/prices/route.ts` หรือ `tools/market.py`) มาเติม `web/data/backtest-cache.json`
**ไฟล์:** `web/lib/backtest.ts` · `web/app/backtest/api/route.ts` · `web/app/api/prices/route.ts` · `tools/market.py`
**เป้า:** ตอบได้ว่า BUY/SPECULATIVE แม่นกี่ % ที่ 30/60/90 วัน

## 2. ทำให้ `score` reproducible (ไม่ใช่ LLM ใส่มือ)
**ปัญหา:** มีสอง scoring ไม่ตรงกัน — `references/scoring.md` (composite ละเอียด) vs `web/lib/ranking.ts` (heuristic หยาบ) และ field `score` ใน JSON เป็นเลข LLM ใส่มือ → หุ้นเดิม gen หลายรอบได้ score ไม่ตรงกัน
**ทำ:** (a) compute จาก `edgar.py`/`market.py` ตาม formula ใน scoring.md หรือ (b) เขียน rubric ตายตัวใน CLAUDE.md ที่ต้องตามทุกครั้ง + แสดง breakdown ในรายงาน
**ไฟล์:** `web/lib/ranking.ts` · `references/scoring.md` · `tools/edgar.py` · `tools/market.py` · `web/lib/types.ts` · `CLAUDE.md`
**เป้า:** หุ้นเดิม + ข้อมูลเดิม = score เดิมทุกครั้ง

## 3. แสดง staleness / price-drift บนหน้า report
**ปัญหา:** report เป็น snapshot พอ gen ถี่ report เก่าค้าง คนเปิดเจออันเก่าแล้วเข้าใจผิด entry levels ที่ stale
**ทำ:** ดึง live price มาเทียบ `report.price` + `report.generatedAt` → banner "เก่า N วัน · ราคาขยับ +X% · entry อาจ stale" สี 🟡/🔴 ตาม drift
**ไฟล์:** `web/app/report/[ticker]/ReportContent.tsx` · `web/app/api/prices/route.ts` · `web/lib/types.ts`
**เป้า:** ผู้อ่านรู้ทันทีว่ารายงานสด/เก่าแค่ไหน

## 5. Guardrail กัน fabrication ใน catalystSpot / comparableCases
**ปัญหา:** CLAUDE.md ย้ำ "ห้าม fabricate" แต่ไม่มีขั้น verify → ยิ่ง gen ถี่ยิ่งเสี่ยงตัวเลขมั่ว
**ทำ:** validation script สแกน `web/data/reports/*.json` flag report ที่ (1) comparableCases ไม่มี source/URL, (2) catalystSpot postWin/postLose ไม่มี exampleDate, (3) sources[] ว่าง/น้อยเกิน → รันก่อน git push (เพิ่มใน `scripts/push-report.sh`)
**ไฟล์:** `web/lib/types.ts` · `web/data/reports/*.json` · `scripts/push-report.sh` · `CLAUDE.md`
**เป้า:** ทุกตัวเลขประวัติศาสตร์มี source ผูก — block push ถ้าไม่มี

---

## ยังไม่เลือกทำ (ไว้พิจารณาทีหลัง)
- **#4 Portfolio-level correlation view** — holding (AVGO/NVDA/MRVL/INTC/PLTR/ASTS) correlate สูง เด้งพร้อมกันตาม AI sentiment; ควรมี view exposure/concentration/powder
- **#6 Price-trigger alerts** — ต่อ scheduled task + live price → alert "แตะ Entry 2 zone" / "ใกล้ stop" (pairs กับ journal-validator skill)

_Generated during code review · not financial advice · XVARY Research_
