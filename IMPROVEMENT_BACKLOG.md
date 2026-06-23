# Improvement Backlog — "make it solid"

จาก review codebase (2026-06-22) ช่วงที่ generate /analyze + /dashboard ถี่ขึ้น
เรียงตาม leverage. หยิบทำได้ทีละอันแบบ stateless — แต่ละข้อมีไฟล์เกี่ยวข้องครบ

---

## 1. ✅ DONE — ปิด loop ของ backtest (auto-checkpoint price fetch)
`scripts/fetch-backtest-prices.mjs` (รัน `npm run backtest:fetch`) ดึงราคา checkpoint 30/60/90 วันมาเติม `web/data/backtest-cache.json`

## 2. ✅ DONE — `score` reproducible
`web/lib/scoring.ts` (`computeScore`) คำนวณ deterministic จาก grounded fields, recompute ตอน load ใน `reports.ts`, hover เห็น breakdown

## 3. ✅ DONE — staleness / price-drift banner
`web/app/report/[ticker]/StalenessBanner.tsx` โชว์อายุ report + drift จากราคาตอนเขียน

## 5. ✅ DONE — guardrail กัน fabrication
`scripts/validate-reports.mjs` block push ถ้า report ไม่มี source (ต่อใน `push-report.sh`)

---

# Dashboard — pure 30% catalyst hunter (จาก critique 2026-06-23)

แกนคิด: ถ้าจะเป็น 30% catalyst hunter จริง ระบบต้องจัดระเบียบรอบ *อีเวนต์* และวัดด้วย *hit-rate จริง* ไม่ใช่ความเชื่อเรื่อง sector
**Dependency order:** 6 → 7 → 8 → 9 → (แล้วค่อยปลดล็อก deferred) · ข้อ 10 ทำขนานได้ตลอด

## 6. Structured catalyst date → timing sort + event-clustering warning
*(รวม idea 1+3+7)*
**ปัญหา:** ไม่มี structured catalyst date เลย — `Catalyst.dateBadge` เป็น string โชว์เฉย ๆ เทียบ/sort ด้วยเครื่องไม่ได้ เครื่องเดิมพัน timing 1–2 สัปดาห์ แต่ระบบไม่รู้ว่าอีเวนต์ห่างกี่วัน
**ทำ:** เพิ่ม field `catalystDate` (ISO) ใน `Catalyst` → คำนวณ `daysToCatalyst` → ใช้เป็น **sort หลัก** ของ dashboard + **soft penalty** ตามระยะ (ห้าม hard filter ≤10 วัน เพราะ pre-run-up เริ่ม 1–2 สัปดาห์ก่อน = ส่วนหนึ่งของ edge) + เตือนเมื่อ ≥3 pick มีอีเวนต์ภายใน 3 วันเดียวกัน (วันพังพร้อมกัน)
**ไฟล์:** `web/lib/types.ts` (Catalyst) · `web/lib/ranking.ts` · `web/app/page.tsx` · `web/app/CatalystCalendar.tsx` · `CLAUDE.md` (บังคับ /dashboard·/analyze ใส่ catalystDate) · `web/data/reports/*.json`
**เป้า:** dashboard เรียงตามความใกล้อีเวนต์ + เตือนวันกระจุก · pick ที่ไม่มี catalystDate = ไม่ใช่ catalyst play (เตะ mega-cap นอกรอบงบออกเอง)

## 7. Group dashboard ตาม catalystType (ไม่ใช่ ticker/sector)
*(idea 2)*
**ปัญหา:** `ThemeGroups.tsx` group ด้วย `TICKER_THEME` map มือ — แย่กว่า sector ด้วยซ้ำ + label มั่ว ("Small-cap AI" มี TSLA/PLTR ที่เป็น MEGA) ตัวตัดสิน +30% คือ "ประเภทอีเวนต์" ไม่ใช่ value chain
**ทำ:** normalize `catalystType` เป็น primary type เดียว (journal ตอนนี้เก็บ free-text ต่อกัน เช่น `"satellite_launch + carrier_activation + contract_win"`) → group dashboard ตาม `catalystType` ที่แชร์ enum กับ journal
**ไฟล์:** `web/app/ThemeGroups.tsx` · `web/lib/types.ts` · `web/lib/journal-types.ts` (CatalystType enum) · `web/data/reports/*.json`
**เป้า:** dashboard ตอบได้ว่า earnings / FDA / contract กระจุกตรงไหน — ปูทางวัด hit-rate ต่อ type (#9)

## 8. Backtest ให้ซื่อสัตย์: auto-archive post-catalyst + near-miss log
*(รวม idea 4+10)*
**ปัญหา:** หลังอีเวนต์ผ่าน pick ยังโชว์ active → หลอกตัวเอง + backtest เพี้ยน · และ log แค่ตัวที่เลือก = survivorship bias ดูเก่งเกินจริง
**ทำ:** (a) เพิ่ม `stage` (pre/post) — เมื่อ `catalystDate` ผ่าน auto-ย้ายเป็น "realized/monitoring" **ไม่ลบ record** (เก็บไว้ backtest) (b) near-miss log: ตัวที่เข้าเกณฑ์ screen แต่ไม่ติด top 5 + ผลจริง → counterfactual
**ไฟล์:** `web/lib/backtest.ts` · `web/lib/reports.ts` · `prompts/daily_dashboard.md` (สั่งให้ log near-miss) · `web/data/` (near-miss store)
**เป้า:** backtest นับเฉพาะ active ถูกต้อง + วัดได้ว่า ranking top-5 เพิ่ม alpha จริงไหมเทียบ near-miss

## 9. North Star: "+30% ใน 14 วัน" hit-rate + median MAE แยกตาม catalystType
*(idea 8 — keystone)*
**ปัญหา:** "30% Hunter" เป็น slogan ที่ยังไม่ถูกวัด · checkpoint ปัจจุบันเป็น 30/60/90 วัน ไม่ใช่ 14 และเก็บราคาจุดเดียว → วัด drawdown ไม่ได้
**ทำ:** เพิ่ม checkpoint **14 วัน** + เก็บ **price path** (ไม่ใช่จุดเดียว) เพื่อคำนวณ **median MAE** (max adverse excursion) ต่อ `catalystType` → แสดงบนหน้า backtest
**ไฟล์:** `web/lib/backtest.ts` · `web/app/backtest/api/route.ts` · `scripts/fetch-backtest-prices.mjs` (ดึง path) · `web/app/backtest/BacktestContent.tsx`
**เป้า:** รู้ว่า hit-rate "+30%/14d" จริงเท่าไหร่ และต้องทน drawdown แค่ไหนก่อนเป้ามา — แยกตามประเภทอีเวนต์ (เปลี่ยน slogan เป็นตัวเลข)

## 10. Factor-correlation concentration (tag-based) แทน bucket-share
*(idea 6 — ทำขนานได้)*
**ปัญหา:** concentration warning ปัจจุบันนับ % ใน bucket ที่ label มั่ว/overlap ความเสี่ยงจริงคือ "factor เดียวกัน" — NVDA+AVGO+MRVL ลงพร้อมกันบนข่าว semis ตัวเดียว
**ทำ:** เพิ่ม factor tags มือ/กึ่งอัตโนมัติ (`ai_semi`, `long_duration_rate`, `single_customer`, `space_launch`...) → warn เมื่อ tag ซ้อนเกิน threshold (จับ NVDA+RKLB ที่ long-duration เหมือนกันแม้คนละ bucket)
**ไฟล์:** `web/app/ThemeGroups.tsx` · `web/lib/types.ts` (factorTags) · `web/data/reports/*.json`
**เป้า:** เตือนความเสี่ยง factor จริง ไม่ใช่แค่ป้าย bucket

---

## North Star v2 — แก้ construct validity ของ metric (ทำตอน tuning phase · มีข้อมูลจริงแล้ว)

ทั้งคู่ **คำนวณย้อนหลังได้จากประวัติ** (path หุ้น + benchmark history) → ไม่ต้องรีบ capture · ทำหลังมี completed window พอ

- **v2.1 · per-catalystType window + time-to-hit distribution** *(คมสุด · ถูกเพราะ path เก็บแล้ว)*
  **ปัญหา:** `north-star.ts` ใช้ `NS_WINDOW_DAYS=14` กับทุก catalystType — FDA/earnings จบ 1-3 วัน แต่ foundry/contract slow-burn 3-4 สัปดาห์ → slow-burn ดู "fail" ทั้งที่ thesis ยังดี · bias ที่ denominator บิดการเปรียบเทียบข้าม type
  **ทำ:** (a) เก็บ time-to-hit (แตะ +30% วันที่เท่าไหร่) เป็น distribution — honest สุด (b) per-type window config (FDA 3d / earnings 5d / foundry-contract 30d) (c) **เก็บ fixed 14d ไว้ด้วย** อย่าทิ้ง — เป็น signal "ความเร็ว" ตาม thesis เดิม → รายงานทั้งคู่
  **ไฟล์:** `web/lib/north-star.ts` · `web/app/backtest/BacktestContent.tsx`
  **เป้า:** เทียบ hit-rate ข้าม catalystType ได้แฟร์ + เห็นรูปร่าง time-to-hit

- **v2.2 · beta / benchmark-adjusted edge** *(ของหนัก · รอ sample + beta เสถียร)*
  **ปัญหา:** hit-rate ดิบปน "catalyst เวิร์ก" กับ "ตลาดลากขึ้น" — universe beta สูง (AVGO 1.43, ASTS 2.80) ตลาด +8% ก็แตะ +30% ได้โดยไม่เกี่ยว catalyst · near-miss คุม selection แต่ไม่คุม regime
  **ทำ:** fetch benchmark path (SPY/QQQ + SMH) ช่วง window เดียวกัน → คำนวณ excess return หัก market+sector beta (เริ่มจาก benchmark-relative ดิบก่อน แล้วค่อย full beta-adjusted) · ⚠️ n น้อย = noisy + beta หุ้นพวกนี้ไม่นิ่ง ทำเมื่อ sample พอ
  **ไฟล์:** `scripts/fetch-backtest-prices.mjs` (ดึง benchmark) · `web/lib/north-star.ts` · `web/app/backtest/BacktestContent.tsx`
  **เป้า:** isolate selection edge จริง — pick ชนะ expected move ของมันไหม

## ยังไม่เลือกทำ (ไว้พิจารณาทีหลัง)
- **Earned category ranking + expectancy-based sizing** *(idea 5+9)* — ลบ sector priority (Tech→AI→Space) ให้ category ลอยขึ้น top ตาม hit-rate จริง + size ตาม expectancy (`hitRate × upside ÷ MAE`) **⚠️ ขึ้นกับ #9 มี sample พอก่อน** ไม่งั้น optimize บน noise — ต้องใส่ shrinkage/prior + cap อิทธิพลตอน N น้อย
- **Portfolio-level correlation view** — holding (AVGO/NVDA/MRVL/INTC/PLTR/ASTS) correlate สูง เด้งพร้อมกันตาม AI sentiment; view exposure/concentration/powder *(ทับซ้อนกับ #10 — อาจรวม)*
- **Price-trigger alerts** — ต่อ scheduled task + live price → alert "แตะ Entry 2 zone" / "ใกล้ stop" (pairs กับ journal-validator skill)
- **Small-cap quota ใน /dashboard** — บังคับ ≥1 pick ที่ <$10B + แก้ scoring ให้ตอนไม่มี analyst target ใช้ scenario-implied upside แทนการให้ 0 (เลิกกดหุ้น coverage บาง)

---

## Ops setup (ทำบน Mac mini หลังย้าย project + เปลี่ยน account Claude)

- **ตั้ง scheduled task รัน `backtest:fetch` รายเช้า** — ให้ price-cache + path-cache สะสมอัตโนมัติ ไม่งั้น backtest/North Star/near-miss จะว่างตลอด *(network ในแซนด์บ็อกซ์ blocked — ต้องรันบนเครื่องจริงที่ต่อ Yahoo ได้)*
  - คำสั่ง: `cd web && npm run backtest:fetch` (หรือ `node scripts/fetch-backtest-prices.mjs` จาก root)
  - cron แนะนำ: ทุกเช้าหลังตลาดปิด 1 รอบ เช่น `0 6 * * *`
  - หมายเหตุ: ต้องตั้งบน account/เครื่องใหม่ (Mac mini) เพราะ schedule ผูกกับ session/เครื่อง
- **รัน `npm run build` ครั้งแรกบน Mac** — ยืนยัน production build ผ่าน (แซนด์บ็อกซ์รันไม่ได้เพราะ SWC binary เป็น linux/arm64 ไม่ตรง platform) tsc ผ่านแล้วทุกไฟล์

_Generated during code review · not financial advice · XVARY Research_
