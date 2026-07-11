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

## 6. ✅ DONE — Structured catalyst date → timing sort + event-clustering warning
*(รวม idea 1+3+7)*
**ปัญหา:** ไม่มี structured catalyst date เลย — `Catalyst.dateBadge` เป็น string โชว์เฉย ๆ เทียบ/sort ด้วยเครื่องไม่ได้ เครื่องเดิมพัน timing 1–2 สัปดาห์ แต่ระบบไม่รู้ว่าอีเวนต์ห่างกี่วัน
**ทำ:** เพิ่ม field `catalystDate` (ISO) ใน `Catalyst` → คำนวณ `daysToCatalyst` → ใช้เป็น **sort หลัก** ของ dashboard + **soft penalty** ตามระยะ (ห้าม hard filter ≤10 วัน เพราะ pre-run-up เริ่ม 1–2 สัปดาห์ก่อน = ส่วนหนึ่งของ edge) + เตือนเมื่อ ≥3 pick มีอีเวนต์ภายใน 3 วันเดียวกัน (วันพังพร้อมกัน)
**ไฟล์:** `web/lib/types.ts` (Catalyst) · `web/lib/ranking.ts` · `web/app/page.tsx` · `web/app/CatalystCalendar.tsx` · `CLAUDE.md` (บังคับ /dashboard·/analyze ใส่ catalystDate) · `web/data/reports/*.json`
**เป้า:** dashboard เรียงตามความใกล้อีเวนต์ + เตือนวันกระจุก · pick ที่ไม่มี catalystDate = ไม่ใช่ catalyst play (เตะ mega-cap นอกรอบงบออกเอง)

**✅ Audit ยืนยันแล้ว (2026-07-10):** ครบทุก sub-feature — `Catalyst.catalystDate` (ISO) ใน types.ts · `web/lib/catalyst-timing.ts` มี `daysToCatalyst`/`nextCatalyst`/`timingTier` (soft tier 0/1/2/3 ตาม spec ≤3d/≤10d/≤21d/far, ไม่ hard filter) · `web/lib/ranking.ts` `rankReports()` sort หลักด้วย `timingTier` แล้วค่อย secondary ด้วย conviction score จริง · `detectCatalystClusters()` เตือนเมื่อ ≥3 pick ภายใน 3 วัน render อยู่ใน `CatalystContent.tsx` (compact inline strip) · CLAUDE.md rule 8 บังคับ catalystDate อยู่แล้ว · ไม่เหลืออะไรค้าง

## 7. ✅ DONE — Group dashboard ตาม catalystType (ไม่ใช่ ticker/sector)
*(idea 2)*
**ปัญหา:** `ThemeGroups.tsx` group ด้วย `TICKER_THEME` map มือ — แย่กว่า sector ด้วยซ้ำ + label มั่ว ("Small-cap AI" มี TSLA/PLTR ที่เป็น MEGA) ตัวตัดสิน +30% คือ "ประเภทอีเวนต์" ไม่ใช่ value chain
**ทำ:** normalize `catalystType` เป็น primary type เดียว (journal ตอนนี้เก็บ free-text ต่อกัน เช่น `"satellite_launch + carrier_activation + contract_win"`) → group dashboard ตาม `catalystType` ที่แชร์ enum กับ journal
**ไฟล์:** `web/app/ThemeGroups.tsx` · `web/lib/types.ts` · `web/lib/journal-types.ts` (CatalystType enum) · `web/data/reports/*.json`
**เป้า:** dashboard ตอบได้ว่า earnings / FDA / contract กระจุกตรงไหน — ปูทางวัด hit-rate ต่อ type (#9)

**✅ Audit ยืนยันแล้ว (2026-07-10):** `ThemeGroups.tsx` group ด้วย `primaryCatalystType()` จริง (`web/lib/catalyst-timing.ts`) — `grep -rn "TICKER_THEME" web/` ว่างเปล่า ไม่เหลือ map มือเลย · group sort ตาม soonest catalyst ในกลุ่ม + avg conviction, มี concentration warning ในตัว (≥50%/70% ของ watchlist บน event type เดียว) ไม่เหลืออะไรค้าง

## 8. ✅ DONE — Backtest ให้ซื่อสัตย์: auto-archive post-catalyst + near-miss log
*(รวม idea 4+10)*
**ปัญหา:** หลังอีเวนต์ผ่าน pick ยังโชว์ active → หลอกตัวเอง + backtest เพี้ยน · และ log แค่ตัวที่เลือก = survivorship bias ดูเก่งเกินจริง
**ทำ:** (a) เพิ่ม `stage` (pre/post) — เมื่อ `catalystDate` ผ่าน auto-ย้ายเป็น "realized/monitoring" **ไม่ลบ record** (เก็บไว้ backtest) (b) near-miss log: ตัวที่เข้าเกณฑ์ screen แต่ไม่ติด top 5 + ผลจริง → counterfactual
**ไฟล์:** `web/lib/backtest.ts` · `web/lib/reports.ts` · `prompts/daily_dashboard.md` (สั่งให้ log near-miss) · `web/data/` (near-miss store)
**เป้า:** backtest นับเฉพาะ active ถูกต้อง + วัดได้ว่า ranking top-5 เพิ่ม alpha จริงไหมเทียบ near-miss

**✅ ปิดครบทั้ง 2 ครึ่ง (2026-07-10):**
  - **(b) near-miss log:** เสร็จผ่าน #25/#27 — `web/data/near-misses.json` (`lane: "core"|"turbo"`), counterfactual ต่อ lane ใน `skill-feedback.json` (`nearMissCounterfactual.core`/`.turbo`), `/catalyst-list`+`/turbo-list` สั่ง log ทุกรอบ
  - **(a) auto-archive post-catalyst — ทำรอบนี้:** derive (ไม่ persist) `reportStage(report)` → `"pre"|"post"|"undated"` ใน `web/lib/catalyst-timing.ts` — `"post"` เมื่อ catalyst date ทั้งหมด (catalysts[] + estimateDates[]) ผ่านไปแล้ว, ไม่ลบ record ไฟล์ JSON เดิม · `CatalystContent.tsx` แยก `allActive`/`realized` แล้ว (มีอยู่แล้วก่อนหน้านี้จริง ๆ — เจอระหว่าง audit) รอบนี้เพิ่ม: (1) section ยุบ/ขยายได้จริง (`RealizedSection`, collapsed by default, ไม่ใช่โชว์ตลอด) (2) badge "days since event" ต่อ ticker (`daysSinceCatalyst()`/`lastCatalyst()` ใหม่ใน catalyst-timing.ts) (3) label ปรับเป็น `⏳ Realized` ตาม spec · `allActive`/clustering warning (`detectCatalystClusters`) คำนวณจาก active เท่านั้นอยู่แล้ว ไม่รวม post-stage
  - **Verify:** ทดสอบด้วย fixture ชั่วคราว (`ZZTEST`, catalystDate ทั้งหมดในอดีต) ผ่าน dev server จริง → ขึ้นใน realized section (collapsed by default, count badge ถูกต้อง) ไม่ขึ้นใน active grid — ลบ fixture ออกหลังทดสอบ, `validate-reports.mjs` ยืนยัน 113 reports เท่าเดิม (ไม่เหลือ fixture ค้าง)
**ไฟล์ (รอบนี้):** `web/lib/catalyst-timing.ts` (`lastCatalyst`/`daysSinceCatalyst` ใหม่) · `web/app/catalyst/CatalystContent.tsx` (`RealizedSection` component ใหม่, collapse/expand + days-since badge)

## 9. ✅ DONE — North Star: "+30% ใน 14 วัน" hit-rate + median MAE แยกตาม catalystType
*(idea 8 — keystone)*
**ปัญหา:** "30% Hunter" เป็น slogan ที่ยังไม่ถูกวัด · checkpoint ปัจจุบันเป็น 30/60/90 วัน ไม่ใช่ 14 และเก็บราคาจุดเดียว → วัด drawdown ไม่ได้
**ทำ:** เพิ่ม checkpoint **14 วัน** + เก็บ **price path** (ไม่ใช่จุดเดียว) เพื่อคำนวณ **median MAE** (max adverse excursion) ต่อ `catalystType` → แสดงบนหน้า backtest
**ไฟล์:** `web/lib/backtest.ts` · `web/app/backtest/api/route.ts` · `scripts/fetch-backtest-prices.mjs` (ดึง path) · `web/app/backtest/BacktestContent.tsx`
**เป้า:** รู้ว่า hit-rate "+30%/14d" จริงเท่าไหร่ และต้องทน drawdown แค่ไหนก่อนเป้ามา — แยกตามประเภทอีเวนต์ (เปลี่ยน slogan เป็นตัวเลข)

**✅ Audit ยืนยันแล้ว (2026-07-10):** `web/lib/north-star.ts` ครบสเปค — `NS_WINDOW_DAYS=14`, `NS_TARGET_PCT=30`, price path จาก `path-cache.json`, `medianMAE`/`avgMaxGain`/`hitRate` แยกต่อ `byType[]` (catalystType) + overall, render บน `/backtest` ผ่าน `NorthStarSection` · **ต่อยอดไปไกลกว่าสเปคเดิมแล้วผ่าน #24/#25/#27:** turbo North Star แยก lane (+50%/30d), `medianTimeToHitDays`, regime context (`avgBenchmarkPct`/`regimeNote` เทียบ SPY), near-miss counterfactual ต่อ lane — ไม่เหลืออะไรค้างจากสเปคเดิม

## 10. ✅ DONE — Factor-correlation concentration (tag-based) แทน bucket-share
*(idea 6 — ทำขนานได้)*
**ปัญหา:** concentration warning ปัจจุบันนับ % ใน bucket ที่ label มั่ว/overlap ความเสี่ยงจริงคือ "factor เดียวกัน" — NVDA+AVGO+MRVL ลงพร้อมกันบนข่าว semis ตัวเดียว
**ทำ:** เพิ่ม factor tags มือ/กึ่งอัตโนมัติ (`ai_semi`, `long_duration_rate`, `single_customer`, `space_launch`...) → warn เมื่อ tag ซ้อนเกิน threshold (จับ NVDA+RKLB ที่ long-duration เหมือนกันแม้คนละ bucket)
**ไฟล์:** `web/app/ThemeGroups.tsx` · `web/lib/types.ts` (factorTags) · `web/data/reports/*.json`

**Audit (2026-07-10):** เกินคาดจากที่ prompt สมมติไว้ว่า "field staged, feature unbuilt" — จริง ๆ **build ไปเกือบครบแล้ว**: `web/lib/factors.ts` มี `deriveFactorTags()` (auto-derive จาก sector/companyDescription/catalystType + เก็บ `report.factorTags` ที่ตั้งเองไว้ด้วยถ้ามี — 5 ไฟล์ report ตั้ง `factorTags` เองแล้ว) + `factorConcentration()` (warn เมื่อ ≥3 ticker หรือ ≥40% ของ book ถือ factor เดียวกัน) · `web/app/FactorRiskPanel.tsx` render เป็น collapsible panel ต่อ factor พร้อม threshold สี (เหลือง ≥50%, แดง ≥70%) ต่อสายกับ `CatalystContent.tsx` แล้วจริง (`factorConcentration(allActive)`) · tag ที่มี: `ai_semi`, `ai_software`, `space_launch`, `quantum`, `ev_auto`, `long_duration_rate` — ตรงตามตัวอย่างในสเปค (ขาดแค่ `single_customer` ที่ระบุไว้เป็นตัวอย่าง)
**เหลือ:** (1) `single_customer` tag ยังไม่มี logic derive (ตัวอย่างในสเปคเดิม แต่ยังไม่ implement — ต้องมี field บอก customer concentration ใน report ก่อนถึง derive ได้) (2) `factorTags` explicit ยังตั้งเองแบบ manual ไม่มี validate/enum บังคับใน `scripts/validate-reports.mjs` (3) ยังไม่มีเอกสารสั่งให้ skill (`stock-report`/`turbo-report`) ตั้ง `factorTags` ตอน generate report — ตอนนี้พึ่ง auto-derive ล้วน ซึ่งพอใช้ได้แต่ไม่ครอบคลุมเท่า manual tag ที่แม่นกว่า
**สถานะ:** เปลี่ยนจาก "field staged, unbuilt" → **build ไปแล้ว ~80%** เหลือ polish เล็กน้อยตามข้างบน ไม่ใช่งานใหญ่
**เป้า:** เตือนความเสี่ยง factor จริง ไม่ใช่แค่ป้าย bucket
**ผล (2026-07-10):** ปิด 3 gap ที่เหลือครบ:
  1. Export `FACTOR_TAGS` (7 ค่า: 6 เดิม + `single_customer`) จาก `web/lib/factors.ts` เป็น canonical source — `scripts/validate-reports.mjs` (plain `.mjs`, import TS ไม่ได้) duplicate list เดียวกันพร้อม comment ชี้กลับมา ตาม convention ของ `build-skill-feedback.mjs` · เพิ่ม WARN (ไม่ block) เมื่อ `factorTags` มีค่านอก enum — เทสจริงด้วยการใส่ typo `ai-semi` ใน NVDA report แล้ว revert, WARN ขึ้นถูกต้องไม่ block push
  2. เพิ่ม `single_customer` derive ใน `deriveFactorTags()` — heuristic จับข้อความใน `companyDescription` + `risks[]` (ไม่ใช่ทั้ง report เพื่อไม่ให้ false-positive จาก catalyst description ที่พูดถึง "customer" แบบ upside ไม่ใช่ risk) เทสกับ report จริง: AVGO/LUNR (มี "customer concentration" ใน risks) → true ถูกต้อง, QUBT (มีคำว่า "single customer order" แต่อยู่ใน `catalysts[].description` ไม่ใช่ risks) → false ถูกต้องตามสเปค, AMD (ไม่มี signal) → false
  3. เพิ่มแถว `factorTags` ใน "Plan the values" ของ `skills/stock-report/SKILL.md` + `skills/turbo-report/SKILL.md` — ประโยคเดียวเหมือนกันทั้งคู่: ตั้งเองจาก enum เมื่อ auto-derive จะพลาด/ป้ายผิด ไม่งั้นปล่อยให้ derive
  **พบระหว่างทำ (ไม่ใช่ bug ของงานนี้ แยกไว้พิจารณา):** `node scripts/validate-reports.mjs` เจอ WARN จริง 5 ไฟล์ใน `web/data/dca/` (GOOGL/META/MSFT/NVDA/V) ที่ตั้ง `factorTags` เป็นคำนอก enum (`mega_cap_quality`, `ad_cycle`, `enterprise_software`, `semis_cycle`, `payments`, `consumer_spend`) — เช็คแล้วว่า **ไม่กระทบอะไรตอนนี้** เพราะ `factorConcentration`/`FactorRiskPanel` ต่อสายแค่ `CatalystContent.tsx` (`/catalyst`) เท่านั้น ไม่ได้ใช้กับ `/dca` เลย — เป็น tag แบบอิสระที่คนเขียน DCA report ใส่ไว้ล่วงหน้าก่อนมี canonical enum ตัวนี้ ปล่อยไว้ตามเดิมไม่แก้ (ไม่อยู่ใน scope "polish 3 gap" ของ item นี้) — ถ้าจะเอา factor-concentration ไปใช้กับ `/dca` ในอนาคตต้องคุย vocabulary ใหม่ก่อน (DCA เป็นเรื่อง business-model quality ไม่ใช่ catalyst-timing correlation)
  **Verify:** `tsc --noEmit` + eslint clean · `validate-reports.mjs` ผ่าน (113 reports, 0 blocking, 5 warnings จากของเดิมที่เจอ) · dev server `/catalyst` เรนเดอร์ปกติไม่มี error

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
  **✅ Groundwork done (#27, 2026-07-10):** `scripts/fetch-backtest-prices.mjs` ดึง SPY path ต่อ unique report date แล้ว เก็บที่ `path-cache.json` key `bench:SPY_YYYYMMDD` (dedupe ต่อวันที่ ไม่ใช่ต่อ ticker, เก็บ window กว้างสุดถ้าวันเดียวกันมีทั้ง core 14d/turbo 30d) · `scripts/build-skill-feedback.mjs` ใช้ path นี้คำนวณ `avgBenchmarkPct`/`regimeNote` ต่อ type + `regime` top-level แล้ว (raw benchmark-relative, ยังไม่ beta-adjust) — v2.2 ที่แท้จริง (excess return หัก beta ใน `web/lib/north-star.ts` + แสดงบน `/backtest`) ยังไม่ทำ แต่ path data พร้อมใช้ต่อได้เลย ไม่ต้อง fetch ใหม่

## 11. ✅ DONE — Turbo-compare: moonshot ranking criteria แยกจาก core dashboard *(implement ผ่าน #32, 2026-07-10)*

**ปัญหา:** `dashboard-compare` skill v2 ใช้ catalyst proximity เป็น primary gate — ถูกต้องสำหรับ core portfolio (event-driven 30% plays) แต่ turbo stocks มี thesis คนละแบบ: "lottery ticket ค่าขนม ถือรอเด้ง 300%+" ซึ่งไม่ต้องการ catalyst วันชัด แต่ต้องการ (1) survival / dilution risk ต่ำ (2) upside path เป็นจริงได้ (3) entry ถูกพอให้ % วิ่ง การนำ catalyst-gate มาใช้กับ turbo ทำให้ RXRX ถูก demote เพราะไม่มีวันที่ ทั้งที่มันคือ moonshot ที่ดีที่สุดในกลุ่ม

**ทำ:** สร้าง turbo-compare logic แยก (skill หรือ section ใน dashboard-compare) โดยใช้ criteria ชุดใหม่:
- **Survival score** (0–30): cash runway / burn rate / dilution risk · runway ≥ 18m = +30, 12–18m = +20, <12m = 0
- **Upside reality score** (0–25): มี analyst PT ที่ฝันถึง 3x+ ไหม / TAM ใหญ่พอ / platform play vs single product
- **Entry score** (0–25): distance จาก preferred zone (เหมือน v2)
- **Headwind penalty** (−30 to 0): class action, cancelled POs, management transition, PFIC, analyst PT ต่ำกว่าราคา
- **Bull% bonus** (0–10): bull case ≥ 200% = +10, 100–200% = +5 (ไม่ใช่ primary sort แต่ใช้เป็น tiebreaker)

Output แยก: "🎰 Moonshot Leaderboard" ไม่ใช่ "Best to Open NOW" — ชื่อต่างกันเพื่อเตือน framing

**ไฟล์:** `skills/dashboard-compare/SKILL.md` (เพิ่ม turbo mode section) · อาจแยกเป็น `skills/turbo-compare/SKILL.md` ใหม่เลย

**เป้า:** compare turbo portfolio ได้ถูก thesis — RXRX ขึ้น #1 เพราะ survival แข็ง + entry ใกล้โซน ไม่ใช่เพราะมีวัน catalyst ชัด
**ผล:** implement ผ่าน `skills/turbo-compare/SKILL.md` (ใหม่) — criteria ทั้ง 5 ตัว (Survival/Upside/Entry/Headwind/Bull%) ตรงตามสเปคข้างบนคำต่อคำ ไม่มีการปรับ ดูรายละเอียดการปิดงานที่ #32

## 12. ธาตุที่ 4 🌍 Earth — Rare Earth Elements, Precious Metals

**ปัญหา:** landing มี 4 ธาตุ (💧 DCA · 🌬️ Catalyst · 🔥 Turbo · 🌍 Earth) แต่ Earth ยังเป็น ghost card — ต้องตัดสิน thesis lane ให้ชัดก่อน build feature จริง
**ทำ (เคาะแล้ว 2026-07-06):** **Earth = Rare Earth Elements, Precious Metals** — REE / critical minerals / gold-silver plays (เช่น MP, USAR, NB, CRML) · ไม่ใช่ journal / macro / backtest · ตอนนี้ card ปิด (ghost) บน landing พร้อม description แล้ว (`web/app/Landing.tsx` tagline EN/TH)
  **รอ build:** screen criteria + หน้า dashboard ใหม่ (เช่น `/earth`) + data dir + skill/command (เทียบ `/catalyst`, `/turbo`, `/dca`) → ปลดล็อก tile จาก ghost→active
**ไฟล์:** `web/app/Landing.tsx` (description ✅) · หน้าใหม่ `web/app/earth/*` · `web/data/earth/` (หรือชื่อที่เทียบเท่า) · skill ใหม่ · `web/app/layout.tsx` (nav ธาตุ 4 เมื่อเปิด)
**เป้า:** Earth card กดเข้าได้ · โฟกัส REE + precious metals · สี Earth = อำพัน-บรอนซ์/โอลีฟ (เลี่ยงชนเขียวของ Air)

## 13. ✅ DONE — i18n เฟสถัดไป — panel/tool ที่ยังไม่ผูก global EN/TH

**ปัญหา:** ทำ global LanguageContext + toggle EN/TH (default EN, persist localStorage `srw-lang`) แล้ว และผูกครบ: Header/nav, Landing, DCA (page+card), Turbo (page+card), Catalyst hero/stats/badges, report page + simulator. **แต่ยังเหลือ component ที่มี string ไทย/อังกฤษ baked อยู่และยังไม่อ่าน `useLang()`** → พอสลับภาษา ส่วนพวกนี้ไม่เปลี่ยน
**ทำ (audited 2026-07-10 — scope จริงเหลือแค่ 5 ไฟล์):** ตรวจสอบสถานะปัจจุบันพบว่า `BacktestContent`, `JournalContent`, `TurboCard`, `DcaCard`, `CatalystContent`, `MarketTicker` (แทนที่ `MarketTimingPanel` เดิมที่ list ไว้ในนี้ — คอมโพเนนต์นั้นถูกยกเลิกไปแล้ว), `Header`, `Landing` ผูก `useLang()` ครบแล้วจากงาน #18/#24 — ไม่ต้องแตะ **scope จริงเหลือแค่ 5 ไฟล์ (`useLang: 0` ทุกตัว):**
  - `web/app/FactorRiskPanel.tsx` — เติม `useLang` + แปล header "FACTOR RISK" และบรรทัดสรุป pick/book
  - `web/app/RankingChangeTable.tsx` — แปล header, column headers, pagination, "NEW"/empty-source fallback, "View →"
  - `web/app/CatalystCalendar.tsx` — แปล header, count, legend, TODAY/TOMORROW, cluster badge, "est."
  - `web/app/ThemeGroups.tsx` — แปล stock count, "next Nd", "avg conviction", sort label, concentration warning
  - `web/app/StockCard.tsx` (highest-traffic) — เติม `useLang` + เรียก `applyTranslation(report, lang)` จาก `lib/i18n.ts` เพื่อให้ `report.summary` อ่านจาก `i18n.th` จริง (เดิมโชว์ EN ตายตัว) · แปล stat-chip labels (Fed Risk/Approach/Sector), Price-bar labels (ENTRY/Price vs Targets), tooltip
**ไฟล์:** ตามรายการบน · pattern อ้างอิงจาก `web/app/dca/DcaContent.tsx` (`useLang` + ternary) และ `web/app/report/[ticker]/ReportContent.tsx` (`applyTranslation` สำหรับข้อมูลจาก `i18n.th`)
**เป้า:** สลับ EN/TH แล้วทั้งเว็บเปลี่ยนครบ 100% ไม่เหลือ string ค้างภาษาเดียว ✅ — verify: `tsc --noEmit` ผ่าน, SSR default-TH smoke test ยืนยันทุก string ขึ้น TH ครบ, revert กลับ default EN แล้ว

## 14. Journal API — public multi-user journal (NestJS + Postgres + Google OIDC)

**ปัญหา:** journal เป็น local-only (`fs` เขียน `private/journal.json`) — ใช้บน Vercel prod ไม่ได้เลย (filesystem read-only) และอยากเปิดให้คนอื่น login ด้วย Google แล้วมี journal ส่วนตัวของตัวเอง (private per-user, ไม่มี social/likes) · design คุยจบแล้ว 2026-07-04
**ทำ:** ตาม design doc — Phase 1: NestJS + Postgres บน Railway + Google OIDC (httpOnly cookie, same apex domain) + CRUD trades/exits + import journal เดิมเป็น user #1 · Phase 2: เปิด signup + PAT (Bearer) ให้ Claude scripts อ่าน/เขียน journal ผ่าน API + validator เขียนผล `trade_validations` ลง DB · Phase 3 (optional): sync reports → jsonb · **reports ยังอยู่ใน git เหมือนเดิม ไม่แตะ publish pipeline**
**ไฟล์:** `docs/architecture/journal-api.md` (spec เต็ม: schema, endpoints, hosting) · `web/lib/journal.ts` + `web/app/journal/*` (เลิก fs → เรียก API + login gate) · `web/lib/journal-types.ts` (map เป็น schema) · `scripts/fetch-backtest-prices.mjs` + analyze-journal skill (อ่านผ่าน `JOURNAL_API_URL`/`JOURNAL_API_TOKEN`) · `service/` folder ใหม่ใน repo นี้ (monorepo — Railway ตั้ง Root Directory = `service`)
**เป้า:** `/journal` ใช้ได้บน prod — login Google แล้วเห็น/แก้ trade ของตัวเองเท่านั้น · scripts ทำงานผ่าน API แทนไฟล์ local · ค่า hosting ~$5–10/เดือน (Railway) · เกี่ยวพัน: ทำก่อน #12(ก) ถ้าเลือก journal เป็นธาตุ Earth · ประสานกับ #13 (JournalContent i18n) กันแก้ซ้ำ

## 15. ✅ DONE — Rebrand ชื่อโปรเจค — เดิม "Stock Radar" ชนกับ StockRadars (แอปหุ้นไทยดัง) → StockPlaybook

**ปัญหา:** แบรนด์เดิม "Stock Radar Research" ชนกับ **StockRadars** (stockradars.co ของ SiamSquared — แอปหุ้นไทยที่มี user เยอะ, พาร์ทเนอร์ AIS) รวมถึง stockradar.ai / traderadar.app ที่มีอยู่แล้ว — เสี่ยงสับสนมากโดยเฉพาะ user ไทย ต้องเปลี่ยนก่อนเปิด public (Phase 2 ของ journal API — ตอนคนอื่นเริ่ม login ได้)
**ทำ:** ✅ เคาะชื่อแล้ว (2026-07-05): **StockPlaybook** — สื่อ product ตรงสุด (report = แผนการเล่น entry/TP/SL, journal มี Plan Adherence อยู่แล้ว) · search แล้วว่าง · ตัวที่ตกรอบ: ThesisRadar (ไม่สื่อ stock), Stockscope (แออัด), StockHunt (มีแอปแล้ว), StockAtlas/StockForge (รอง)
✅ **Code sweep (2026-07-05):** grep -ri "stock radar" ทั้ง repo (ยกเว้น .git/node_modules/.next/.worktrees) → แทนที่ "Stock Radar Research"/"Stock Radar Weekly"/"Stock Radar" → "StockPlaybook"/"StockPlaybook Research" ครบทุกไฟล์ (persona strings, LICENSE, CLAUDE.md, skills/*/SKILL.md, docs/, references/, web UI: Header/Landing/layout metadata/globals.css, private/journey.html) · User-Agent ใน tools/edgar.py + tools/market.py: `stock-radar-weekly/1.0` → `stockplaybook/1.0` · เช็ค icon.svg/favicon(-animated).svg แล้ว — ไม่มี text แบรนด์เก่า embed (เป็น path/shape ล้วน) ปลอดภัย ไม่ต้อง gen ใหม่ · **ข้อยกเว้นที่ตั้งใจไม่แตะตอนนั้น:** `PROJECT_STATUS.md` บรรทัด log ประวัติไฟล์ `Stock Radar_full_report_20260615.html` (ชื่อไฟล์จริงในอดีต เปลี่ยนจะผิดประวัติ — ยังคงเดิม)
✅ **Manual steps + URL sweep (2026-07-05):** domain stockplaybook.app จดแล้ว · GitHub repo renamed → `Armakuji/stock-playbook` (เช็คแล้ว remote origin ตามอัตโนมัติ) · Vercel project rename + custom domain ผูกแล้ว · Google OAuth redirect URI + Railway `WEB_ORIGIN` อัปเป็น `https://stockplaybook.app` แล้ว · README (CI badge + Live link) และ docs/architecture/journal-api.md + journal-api-deployment.md (WEB_ORIGIN example, project-structure repo name) อัปเป็นโดเมน/repo ใหม่ครบ
⚠️ **พบระหว่างเช็ค asset (ไม่เกี่ยวกับ rebrand โดยตรง — แยกเป็นบั๊กคนละเรื่อง ยังไม่ fix):** `assets/social-preview.png` เป็นไฟล์เสีย — มี 3 byte แปลกปลอม (`ef bf bd`, UTF-8 replacement char) ต่อหน้า PNG signature มาตั้งแต่ initial commit อ่าน/เปิดไม่ได้เลย ยังไม่รู้ว่ามี text แบรนด์เก่าอยู่ในรูปหรือไม่
**ไฟล์:** ครบทุกไฟล์ตาม code sweep + README.md + docs/architecture/journal-api.md + docs/architecture/journal-api-deployment.md · ที่เหลือ (คนละเรื่อง): `assets/social-preview.png`
**เป้า:** แบรนด์เดียวไม่ชนใคร ใช้ทั้ง repo + เว็บ + API + User-Agent ✅ · repo/Vercel/domain/OAuth rename ✅ · README/docs URL ตรงโดเมนใหม่ ✅ — **ปิด item นี้**

## 16. ✅ DONE — Journal API — 5 minor items ที่ defer จาก Phase 1 final review (PR #29)

**ปัญหา:** final review ของ Phase 1 พบ 5 จุด minor ที่ตั้งใจไม่ fix ตอนนั้น (ไม่ block การใช้งาน) — จดไว้ให้คนที่ทำ Phase 2 / polish รอบหน้าเก็บ
**ทำ:**
  1. ✅ DONE (ทำพร้อม #17) — subtitle เก่าอ้าง "private/journal.json" ค้างอยู่ — แก้เป็น "{n} trades" เฉย ๆ
  2. ✅ DONE — `addExit` เพิ่ม server-side over-exit guard: sum existing exits ก่อน insert → reject ด้วย `BadRequestException` ถ้า `existing + dto.shares > trade.shares` (message บอก remaining) · เพิ่ม `@IsPositive()` ใน `CreateExitDto.shares`
  3. ✅ DONE — POST `/trades` จับ Prisma `P2002` (duplicate id) → `ConflictException` (409) แทนที่จะปล่อยให้ 500 · error อื่นยัง rethrow เหมือนเดิม
  4. ✅ DONE — ย้าย `readError` จาก `JournalContent.tsx` เข้า `web/lib/auth-client.ts` (export) · `logout()` เช็ค `res.ok` แล้ว throw ผ่าน `readError` ก่อน reload · เรียก `logout()` ทั้ง 2 จุดใน `Header.tsx` (desktop dropdown + mobile) เพิ่ม `.catch(console.error)` กันค้าง UI
  5. ✅ DONE (ทำพร้อม #17) — `AuthService.backfillProfile` เติม `name`/`avatarUrl` ให้ user ที่มีอยู่แล้ว (ทั้ง identity-linked และ email-linked) เมื่อค่ายังว่างและ Google profile มีให้ — ไม่ทับค่าที่มีอยู่แล้ว
**ไฟล์:** `service/src/trades/trades.service.ts` (`addExit` guard, `create` 409) · `service/src/trades/dto/create-exit.dto.ts` (+`@IsPositive()`) · `service/src/trades/trades.service.spec.ts` + `create-exit.dto.spec.ts` (new tests) · `web/lib/auth-client.ts` (`readError` export, `logout()`) · `web/app/journal/JournalContent.tsx` (import shared `readError`) · `web/app/Header.tsx` (logout call sites) · `service/src/auth/auth.service.ts` (backfill, ✅ done)
**เป้า:** เก็บครบ 5/5 จุด ✅ — จุดสำคัญสุดคือข้อ 2 (server ต้องไม่เชื่อ client) ปิดก่อนเปิด public signup (Phase 2) แล้ว · 99/99 service tests ผ่าน (รวม test ใหม่สำหรับ over-exit/exact-remaining/duplicate-id/DTO validation) · tsc --noEmit สะอาดทั้ง service/web

## 17. ✅ DONE — Journal UI — auth-aware header (avatar/login/logout) + ลบ PRIVATE badge

**ปัญหา:** login แล้วไม่มีอะไรบอกว่าใคร login อยู่ · ปุ่ม Logout ลอยอยู่ข้าง "+ Log Trade" ผิดที่ · ไม่มีปุ่ม Login บน header (ต้องเข้า /journal ก่อนถึงเจอ) · badge "🔒 PRIVATE — local only" + subtitle "private/journal.json · never committed to git" ยังโชว์อยู่ทั้งที่เป็น API/DB แล้ว (ทับกับ #16 ข้อ 1)
**ทำ:** (1) Header แสดง avatar + name จาก `GET /auth/me` (fallback = ตัวอักษรแรกของ email/name) — เพิ่ม `avatarUrl` ใน response ของ `/auth/me` (2) กด avatar → dropdown (click-outside ปิดเอง) → Logout ผ่าน `web/lib/auth-client.ts` (ย้ายจากปุ่มเดิมข้าง "+ Log Trade") (3) ยังไม่ login → ปุ่ม "Login" บน header ทุกหน้า (desktop + mobile) → `GET /auth/google?returnTo=<current path>` → เก็บใน cookie `oauth_return_to` (validate เป็น same-origin relative path เท่านั้น กัน open-redirect — มี unit test แยก `safe-return-path.spec.ts`) → callback redirect กลับหน้าเดิมแทนที่จะ hardcode `/journal` (4) ลบ PRIVATE badge + แก้ subtitle เป็น "{n} trades" เฉย ๆ · พ่วง backlog #16 ข้อ 5 (backfill name/avatarUrl) เพราะ header ต้องมีข้อมูลจริงให้แสดง
**ไฟล์:** `web/app/Header.tsx` (AuthWidget: avatar/dropdown/login, desktop+mobile) · `web/lib/auth-client.ts` (ใหม่ — fetchCurrentUser/logout/loginUrl ใช้ร่วมกับ JournalContent) · `web/app/journal/JournalContent.tsx` (ลบ badge + ปุ่ม logout เดิม + apiLogout) · `service/src/auth/auth.controller.ts` (returnTo cookie flow, avatarUrl ใน /me) · `service/src/auth/safe-return-path.ts` (ใหม่) · `service/src/auth/auth.service.ts` (backfillProfile)
**เป้า:** เปิดหน้าไหนก็รู้สถานะ login ✓ · logout อยู่ใต้ avatar dropdown ตาม convention ปกติ ✓ · ไม่มีร่องรอย "local only" เหลือ ✓ · login จากหน้าไหนก็กลับมาหน้านั้น ✓ · tests: 29/29 service unit tests ผ่าน (รวม 3 test ใหม่สำหรับ backfill + 6 test ใหม่สำหรับ safe-return-path) · tsc --noEmit ผ่านทั้ง service/web

## 18. ✅ DONE — Playbook theme refresh — visual identity ยังเป็น radar อยู่

**ปัญหา:** rebrand ชื่อเป็น StockPlaybook แล้ว (#15 ✅) แต่ visual ยังเป็น radar-era ทั้งหมด — แบรนด์กับหน้าตาไม่ตรงกัน
**ทำ:** implement ทีละ phase จาก `design_handoff_stock_playbook/` (design handoff ที่ได้จาก Claude Design ตามแผนเดิม) ผ่าน superpowers spec→plan→subagent-driven-development, 4 phase:
  1. **Header + Ticker** — sticky/glass header, retuned nav pills/avatar/login button, dynamic verdict/entry ticker colors (`docs/superpowers/specs/2026-07-09-header-ticker-restyle-design.md`)
  2. **Landing page** — removed superseded radar-rings hero centerpiece (explicitly rejected in an earlier design pass) → ambient glow only, fixed "on one radar"→"in one playbook" copy bug, pip-dot pick counters (`docs/superpowers/specs/2026-07-09-landing-restyle-design.md`)
  3. **Dashboard** — new shared `DashboardSwitcher` component (DCA↔Catalyst↔Turbo cross-route pills, previously missing entirely), stats/tier/grid value tuning across all 3 routes (`docs/superpowers/specs/2026-07-09-dashboard-restyle-design.md`)
  4. **Journal login gate** — full rewrite: ambient bg, pulsing icon ring, gradient title, gradient/shine-sweep CTA, trust pips, feature-card accents, **and added full EN/TH i18n** (this page had zero Thai support before, unlike every other page in the app) (`docs/superpowers/specs/2026-07-09-journal-gate-restyle-design.md`)
  Radar-era component names (`MarketTicker`, `RadarBadge`, etc.) kept as-is per constraint — not renamed. Logo/favicon (`icon.svg`) also kept unchanged — the final approved design handoff explicitly narrowed the original broader ask ("do not restyle it, this mark is unchanged from the original build").
**ไฟล์:** `web/app/Header.tsx`, `MarketTicker.tsx`, `Landing.tsx`, `DashboardSwitcher.tsx` (new), `dca/`+`catalyst/`+`turbo/` page+Content files, `ThemeGroups.tsx`, `StockCard.tsx`, `journal/LoginGate.tsx` · specs/plans in `docs/superpowers/specs/` + `docs/superpowers/plans/` (4× each, dated 2026-07-09)
**เป้า:** identity "playbook" ครบทุกจุด ✅ · dark theme + สี verdict + ธีม 4 ธาตุคงเดิม ✅ · ทุก phase ผ่าน task-level review + final whole-branch review (opus) — bugs ที่เจอระหว่างทางแก้หมดแล้ว (nav-pill hover ที่ทำ gradient text หาย, pip-dot overflow ที่ real pick count 10/20/21 เกิน mockup demo data 6/4/3, tools-row hover ที่ขาด `!important`) · **ยังไม่ทำ** (logged เป็น backlog แยก): #23 DcaCard/TurboCard chip/gauge/bar pixel-tuning ละเอียด

## 19. ✅ DONE — Improve SEO — search Google แล้วหาเว็บไม่เจอ

**ปัญหา:** stockplaybook.app ยังไม่ติด Google index เลย — ส่วนหนึ่งเพราะโดเมนใหม่มาก (เพิ่งซื้อ) แต่ฝั่งเว็บก็ยังไม่มีโครง SEO พื้นฐาน: ไม่มี sitemap/robots, metadata ต่อหน้าอาจไม่ครบ, ไม่มี structured data, ยังไม่ได้ submit Search Console
**ทำ:** (1) **โค้ด** — App Router: เพิ่ม `web/app/sitemap.ts` (gen จากรายการ report/หน้า static ทั้งหมด) + `web/app/robots.ts` · เช็ค `generateMetadata` ทุกหน้า: title/description เฉพาะหน้า (โดยเฉพาะ `/report/[ticker]` — title แบบ "NVDA — StockPlaybook: entry, targets, catalyst"), canonical URL, OG/Twitter tags (รอ OG image จาก #18) · เพิ่ม JSON-LD structured data ที่เหมาะ (WebSite + Article ต่อ report) · ห้าม index หน้า auth-only (`/journal` → noindex) (2) **Manual (คนทำ)** — Google Search Console: verify domain (DNS TXT) → submit sitemap → ขอ index หน้าแรก · Bing Webmaster ด้วยก็ได้ฟรี (3) รอ — โดเมนใหม่ใช้เวลา index เป็นสัปดาห์ต่อให้ทำครบ อย่าตกใจ
**ไฟล์:** `web/app/layout.tsx` (metadata กลาง) · `web/app/sitemap.ts` + `web/app/robots.ts` (ใหม่) · `web/app/report/[ticker]/page.tsx` + หน้า catalyst/dca/turbo/backtest (generateMetadata) · `web/lib/reports.ts` (list ticker สำหรับ sitemap)
**เป้า:** search "StockPlaybook" / "stockplaybook.app" เจอเว็บใน Google · ทุก report page มี title/description/OG เฉพาะตัว · Search Console เห็น sitemap ครบ ไม่มี coverage error · เกี่ยวพัน: OG image รอ #18 (theme) — ทำ SEO โครงก่อนได้เลยไม่ต้องรอ

**✅ โค้ดเสร็จ (2026-07-10):**
  - `web/app/sitemap.ts` + `web/app/robots.ts` มีอยู่แล้วจากรอบก่อน (commit `1f89d10`, merge ไป `main` แล้ว) — รอบนี้เพิ่ม `disallow: "/api/"` (เดิมกัน `/journal` อย่างเดียว) และย้าย `SITE_URL` มา share จุดเดียวที่ `web/lib/site-meta.ts` (เดิมประกาศซ้ำ 3 จุด: layout/sitemap/robots)
  - **`generateMetadata`/`metadata` ครบทุกหน้า** (เดิมไม่มีเลยสักหน้า นอกจาก root layout default): `/` , `/catalyst`, `/turbo`, `/dca`, `/backtest` — title+description+canonical เฉพาะหน้า · `/journal` — `robots:{index:false,follow:false}` (ซ้อนกับ robots.ts) · `/report/[ticker]` — dynamic ตาม ticker จริง (title `"TICKER — entry, targets, catalyst"` ต่อท้ายด้วย template `· Stock Playbook`, description จาก `report.summary` ตัดที่ ~155 ตัวอักษรแบบไม่ตัดกลางคำ, canonical, OG/Twitter) · `/report/[ticker]/simulator` — เพิ่มใหม่ (เดิมไม่มี) ตั้งใจใส่ `noindex` เพราะเป็นหน้า tool ซ้ำ ticker เดียวกับ report หลัก กันแย่ง relevance กันเอง
  - **JSON-LD:** `WebSite` มีอยู่แล้วใน root layout (ของรอบก่อน) ไม่แตะ · เพิ่ม `AnalysisNewsArticle` ต่อ `/report/[ticker]` (headline, description, datePublished/dateModified จาก `generatedAt`, author+publisher Stock Playbook Research) — เลือก type นี้เจตนา เพราะไม่ใช่ financial-product/advice schema
  - **OG image:** ตามที่ #19 บอกไว้ว่า "รอ #18" แต่ #18 เสร็จแล้วไม่ได้สร้าง asset รูปมา — รอบนี้เลย **ไม่ generate รูป**, ใช้ metadata-only OG (title/description) และเขียน `TODO(#18 follow-up)` ไว้ในโค้ด `/report/[ticker]/page.tsx` ตรงจุดที่จะใส่ `openGraph.images` ทีหลัง
  - **Verify แล้ว:** `tsc --noEmit` + eslint สะอาด (คำเตือนที่เจอ 2 จุดเป็นของเดิมอยู่แล้วก่อนแก้ ยืนยันด้วย `git stash`) · dev server จริง: `/sitemap.xml` valid XML มี 54 URL (5 static + 49 ticker), `/robots.txt` ถูกต้อง (`disallow: /journal`, `/api/`), `/report/nvda` มี title/description/canonical เฉพาะตัว + JSON-LD 2 บล็อก (WebSite + AnalysisNewsArticle) parse ผ่านทั้งคู่, `/journal` มี `<meta name="robots" content="noindex, nofollow">`, `/report/nvda/simulator` มี `noindex, follow` · `npm run build` (production, SWC จริง) ผ่านสะอาด — sitemap.xml/robots.txt ขึ้นเป็น static (○) ตามคาด
**ไฟล์ (รอบนี้):** `web/app/sitemap.ts`, `web/app/robots.ts` (เพิ่ม /api/), `web/app/layout.tsx` (ใช้ shared SITE_URL), `web/lib/site-meta.ts` (เพิ่ม `SITE_URL` + `truncateDescription`), `web/app/page.tsx`, `web/app/catalyst/page.tsx`, `web/app/turbo/page.tsx`, `web/app/dca/page.tsx`, `web/app/backtest/page.tsx`, `web/app/journal/page.tsx`, `web/app/report/[ticker]/page.tsx`, `web/app/report/[ticker]/simulator/page.tsx`

**✅ Manual เสร็จ (2026-07-10):** Search Console property verify ผ่านแล้ว (แบบ URL prefix — ไม่ได้ใช้ DNS TXT ซึ่งจำเป็นเฉพาะ property แบบ Domain · อัปเกรดเป็น Domain property ทีหลังได้ถ้าต้องการคุม subdomain ทั้งหมด ไม่กระทบของที่ submit ไว้) · submit sitemap ✅ · request indexing `/` + `/catalyst` ✅ · แถม: แก้ favicon — ลบ/แทน `web/app/favicon.ico` default ของ create-next-app (โลโก้ Vercel) ที่ทับ brand icon อยู่ verify บน production แล้ว
**เหลืออย่างเดียว: รอ** — โดเมนใหม่ใช้เวลา 1–3 สัปดาห์กว่าจะติด index · แวะดู Coverage report ใน Search Console ~สัปดาห์หน้า (17 ก.ค. เป็นต้นไป) ถ้ามี coverage error ค่อยเปิด item ใหม่ · (ทางเลือก ยังไม่ทำ: Bing Webmaster Tools — มีปุ่ม Import from Google Search Console ทำได้ใน 2 นาทีถ้าอยากได้)

## 20. ✅ DONE — AI Validate Journal — user กดปุ่มให้ Claude API วิเคราะห์พอร์ต (quota 3 ครั้ง/lifetime)

**ปัญหา:** validator ปัจจุบันรันได้เฉพาะเจ้าของผ่าน Claude CLI (`/analyze-journal`) — user คนอื่นบน prod ไม่มีทางได้ AI validation เลย ทั้งที่ `trade_validations` table + VALIDATOR box ใน UI รอไว้แล้ว
**ทำ (ครบ 2026-07-06):**
  1. ✅ **Schema:** `validation_requests` + `plans`/`features`/`plan_features` (seed free/ai_validation limit=3) + `trade_validations` · migration `20260706035159_ai_validation_quota` · i18n `summary_th`/`action_th` migration `20260706143000_validation_i18n`
  2. ✅ **API:** `POST /journal/validate` + `GET /journal/validate/quota` · quota lifetime จาก count(status=done) · 0 open trades → 400 ไม่หัก quota · Claude fail → status=failed ไม่หัก quota · tool-use strict schema · Yahoo live price · timeout 90s · log แค่ token counts
  3. ✅ **UX:** ปุ่ม **Scan Trades** + quota pill · full-screen overlay ตอนสแกน · VALIDATOR box ต่อ OPEN trade (HOLD/WATCH/CUT + summary/action) · ผล persist ใน DB · refresh เห็นเดิม · quota หมด = disable + tooltip · modal เมื่อ journal ว่าง / ไม่มี open trades · i18n EN/TH (`summaryTh`/`actionTh`)
  4. ✅ **Tests:** 23 tests ใน `service/src/validation/*` ผ่านครบ
**ไฟล์:** `service/prisma/schema.prisma` · `service/src/validation/*` · `web/app/journal/JournalContent.tsx` · `web/app/journal/page.tsx` (quota fetch) · `web/lib/journal-types.ts` · `.claude/skills/analyze-journal/SKILL.md` · `service/.env.example` (`ANTHROPIC_API_KEY`)
**เป้า:** user login → กด Scan Trades → เห็น verdict ต่อ trade ใน <1 นาที → refresh แล้วผลยังอยู่ → ครบ 3 ครั้งปุ่ม disable ✅ · **Ops:** ✅ `ANTHROPIC_API_KEY` ตั้งบน Railway prod แล้ว (2026-07-06)

## 21. Monetization — subscription plan / buy more AI usage

**ปัญหา:** quota AI validation 3 ครั้ง/lifetime (#20) หมดแล้วไม่มีทางได้เพิ่ม — อนาคตอยากขาย: subscription plan (pro) หรือซื้อ usage เพิ่มเป็นครั้ง ๆ
**ทำ:** ยังไม่ออกแบบ — แต่โครงพร้อมแล้ว: `plans`/`plan_features` รองรับ plan ใหม่ (แค่ insert row limit_value สูงขึ้น), `subscriptions.external_ref` รอ Stripe · ตอนทำจริงค่อยเลือก: Stripe subscription vs one-time top-up (ต้องเพิ่มตาราง usage_credits ถ้าเป็น top-up)
**ไฟล์:** `service/prisma/schema.prisma` · Stripe webhook module ใหม่ · หน้า pricing/upgrade ใน web
**เป้า:** จ่ายแล้ว quota เพิ่มอัตโนมัติ — รอ #20 มีข้อมูลการใช้จริงก่อนค่อยตั้งราคา

## 22. ✅ DONE — Soft delete — user action ลบข้อมูลใช้ `deleted_at` แทน hard delete

**ปัญหา:** ตอนนี้ `DELETE /trades/:id` ลบ row ทิ้งจริงจาก DB — user กดพลาดแล้วข้อมูล trade (รวม exits + validation ที่เสีย quota AI ไป) หายถาวร กู้ไม่ได้ และเสีย audit trail
**ทำ:** เปลี่ยนเป็น soft delete ทั้ง user-facing delete actions:
  1. **Schema:** เพิ่ม `deleted_at timestamptz NULL` ใน `trades` (และ `trade_exits` ถ้ามี endpoint ลบ exit) — migration ใหม่ ไม่กระทบข้อมูลเดิม
  2. **Service:** `DELETE /trades/:id` → `UPDATE SET deleted_at = now()` แทน `prisma.delete` · ทุก query อ่าน (list/get/stats/AI validate) เติม `WHERE deleted_at IS NULL` — ระวังให้ครบทุกจุด แนะนำรวม filter ไว้ที่เดียว (Prisma client extension หรือ helper ใน TradesService) กันลืมใน query ใหม่ ๆ · `trade_validations`/`trade_exits` ของ trade ที่ soft-deleted ไม่ต้องแตะ (ผูกด้วย FK อยู่แล้ว หายจากผลลัพธ์เองเมื่อ trade ถูก filter)
  3. **Quota note:** trade ที่ถูก soft delete ไม่นับใน AI validate รอบใหม่ (query กรองแล้ว) แต่ validation_requests เดิมคงอยู่ (audit)
  4. **อนาคต (ไม่ทำรอบนี้):** ปุ่ม "restore" / auto-purge ข้อมูลที่ deleted เกิน 90 วัน / GDPR delete-account จริง (hard delete ทั้ง user — คนละ flow)
**ไฟล์:** `service/prisma/schema.prisma` (+deleted_at, migration `20260706104508_soft_delete_trades`) · `service/src/trades/trade-filters.ts` (ใหม่ — `activeTradeWhere()` centralized filter) · `service/src/trades/trades.service.ts` (`findOne` → `findFirst` + filter, `remove` → `update({deletedAt})` แทน `delete`) · `service/src/validation/validation.service.ts` (open-trades query ใช้ `activeTradeWhere` เดียวกัน) · tests ใน `trades.service.spec.ts` + `validation.service.spec.ts` (ลบแล้ว list ไม่เห็น/get 404/ลบซ้ำ→404/ไม่ hard-delete/ไม่ถูกส่งเข้า AI validate) · `docs/architecture/journal-api.md` schema section
**เป้า:** user กดลบ → หายจาก UI ทุกจุดเหมือนเดิม แต่ row ยังอยู่ใน DB พร้อม `deleted_at` · ไม่มี endpoint ไหน leak trade ที่ลบแล้ว ✅ · `trade_exits` ไม่มี endpoint ลบแยก จึงไม่ต้องเพิ่ม `deleted_at` ที่นั่นรอบนี้ (ตามเงื่อนไข "ถ้ามี endpoint ลบ exit แยก") · web ไม่ต้องแก้ (behavior เดิม) · 60/60 service tests ผ่าน, tsc/eslint สะอาด

## 23. ✅ DONE — Dashboard card pixel-tuning — DcaCard/TurboCard gauge/chip/bar vs. mockup

**ปัญหา:** ระหว่างทำ #18 (Phase 3 — dashboard switcher/card restyle), พบว่า `DcaCard.tsx`
และ `TurboCard.tsx` ใช้ `radar-card`/`radar-ring`/`radar-mk` ถูกต้องอยู่แล้ว (ไม่ต้องแก้
โครงสร้าง) แต่รายละเอียดปลีกย่อยของ chip grid (`.chip2`), valuation gauge (`.gauge`/
`.gbar`/`.gz1-3`), 3-up chip row (`.tchips`), price→moon bar (`.moon`/`.mbar`/`.mtick`)
ยังเป็น inline-style ที่ประมาณค่าจาก mockup ไม่ตรง pixel — `globals.css` ยังไม่มี CSS
class เหล่านี้ pre-stage ไว้เลย (มีแค่ `.radar-card`/`.radar-ring`/`.radar-mk`)
**ทำ:** เทียบค่า inline-style ปัจจุบันกับ `Stock Playbook Dashboard.dc.html` ทีละ chip/
gauge/bar แล้วเพิ่ม CSS class ใหม่ใน `globals.css` (`.chips`/`.chip2`/`.gauge`/`.gbar`/
`.gz1-3`/`.tchips`/`.moon`/`.mbar`/`.mtick`) หรือปรับ inline values ให้ตรง — เลือกวิธีไหน
ก็ได้ที่คงรูปแบบเดิมของไฟล์ (DcaCard/TurboCard ผสม global class + inline อยู่แล้ว)
**เลือกวิธี CSS classes** (ไม่ใช่ inline values) — เพิ่ม section 6 ใหม่ใน `globals.css`
(`.chips`/`.chip2`, `.gauge`/`.grow`/`.glab`/`.gval`/`.gbar`/`.gz1-3`/`.gends`/`.zline`,
`.tchips`/`.tchip`, `.moon`/`.mrow`/`.mlab`/`.mval`/`.mbar`/`.mfill`/`.mtick`/`.mend`/
`.mmoon`) แล้วสลับ `FundChips`/`ValuationGauge` (DcaCard) และ stat-chip row/`TurboBar`
(TurboCard) มาใช้ class เหล่านี้ ค่าที่แก้จริง: gauge/moon `margin-top` 14→12px ให้ตรง
`.gauge`/`.moon`, สี label/value หลายจุดที่เพี้ยนจาก theme token (`--mut`/`--c1`) เช่น
FundChips value `#7dd3fc`→`#38bdf8`, tchip label `#4d2020`→`#7f4040` + 9px→8px, moon-bar
label `#7f3030`→`#7f4040`, `.mval` 10px→11px, `.mfill` gradient alpha `30/80`→`40/90`,
`.mtick` `filter:drop-shadow(4px)`→`box-shadow:0 0 5px` ตาม spec, `.mend` 16px/4px→14px/5px
· `QualityBars` (stock/non-fund mode) ไม่แตะ — mockup demo data มีแต่ ETF ไม่มี pattern
ให้เทียบ
**ไฟล์:** `web/app/dca/DcaCard.tsx`, `web/app/turbo/TurboCard.tsx`, `web/app/globals.css`
**เป้า:** gauge/chip/bar สีและขนาดตรงกับ `design_handoff_stock_playbook/Stock Playbook Dashboard.dc.html` แบบ pixel-level — ไม่กระทบ radar-card/radar-ring ที่ถูกต้องอยู่แล้ว ✅ ·
tsc --noEmit + eslint สะอาดทั้ง 2 ไฟล์ที่แก้ · เช็ค render จริงผ่าน curl (`/dca`, `/turbo`
dev server) เห็น class ครบ ไม่มี error ใน server log

## 24. ✅ DONE — Turbo backtest coverage — `speculative/` ไม่ถูกวัดเลย + metric ของตัวเอง

**ปัญหา:** backtest ทั้งระบบ (`web/lib/backtest.ts`, `web/lib/north-star.ts`, `scripts/fetch-backtest-prices.mjs`) อ่านแค่ `web/data/reports/` — turbo reports ใน `web/data/speculative/` (36 ไฟล์ ณ 2026-07-10) ไม่ถูก backtest เลยสักตัว = `/turbo-list` ไม่มีทางรู้ว่าตัวเองแม่นไหม · และ North Star "+30%/14d" ไม่ตรง thesis moonshot (lottery ticket ถือรอเด้ง 300%+ ไม่ใช่ event 2 สัปดาห์) เอา metric เดิมมาใช้ตรง ๆ จะตัดสิน turbo ผิด
**ทำ:**
  1. ขยาย `scripts/fetch-backtest-prices.mjs` ให้ scan `web/data/speculative/` ด้วย → เก็บ path ลง `path-cache.json` (key เดิม `TICKER_YYYYMMDD` ใช้ร่วมได้ แต่ระวัง ticker ชนกันข้าม dir — อาจ prefix key หรือเก็บ dir ใน entry)
  2. เพิ่ม turbo North Star metric แยก — เสนอเริ่มที่ **"+50% ภายใน 30 วัน"** + median MAE (เคาะตัวเลขตอน implement ได้ แต่ต้อง fix ก่อนดูข้อมูลกัน hindsight bias) · เก็บ time-to-hit distribution ด้วยตามแนว North Star v2.1
  3. แสดงผลแยก section บนหน้า backtest (`web/app/backtest/BacktestContent.tsx`) — "🎰 Turbo" ไม่ปนกับ catalyst core กัน framing ผิด
**Key namespace:** turbo keys = `turbo:TICKER_YYYYMMDD` ในทั้ง `backtest-cache.json` และ `path-cache.json` (core keys `TICKER_YYYYMMDD` เดิมไม่เปลี่ยน — verify แล้วว่าไม่มี key ชนกัน) · **Metric:** `web/lib/turbo-north-star.ts` (ไฟล์ใหม่ แยกจาก `north-star.ts` ไม่แตะ core exports) — `TURBO_WINDOW_DAYS=30`, `TURBO_TARGET_PCT=50`, per-entry `maxGainPct`/`maePct`/`hit`/`timeToHitDays`/`status`, aggregate `hitRate`/`medianMAE`/`medianTimeToHit`/`timeToHitDistribution`/`n` เสมอ · `scripts/fetch-backtest-prices.mjs` รีแฟกเตอร์เป็น pure exported functions (`collectCheckpointTargets`/`collectPathSnapshots`/`cacheKey`/`turboCacheKey`) + guard `if (import.meta.url === ...)` กัน side-effect ตอน import เพื่อ unit-test ได้โดยไม่ยิง network · รันจริงบนเครื่อง (มี network) แล้ว: 62 core + 36 turbo path snapshots fetch สำเร็จ, ไม่มี key ชนกัน, core keys ตรงเดิมทุกตัว · หน้า `/backtest` render section "🎰 Turbo — +50% within 30 days" แยกจาก core section จริง (curl ยืนยัน: n=36, 0 complete, 36 accumulating — ตรงตามคาด เพราะ turbo report เก่าสุด 2026-06-21 window 30 วันจะครบ ~21 ก.ค.)
**ไฟล์:** `scripts/fetch-backtest-prices.mjs` · `web/lib/turbo-north-star.ts` (ใหม่) · `web/app/backtest/page.tsx` · `web/app/backtest/BacktestContent.tsx` · `web/data/path-cache.json`
**เป้า:** turbo pick ทุกตัวถูกวัดด้วย metric ที่ตรง thesis ตัวเอง ✅ · หน้า backtest ตอบได้ว่า hit-rate "+50%/30d" ของ turbo จริงเท่าไหร่ (ตอนนี้ n=36 ยังไม่มีตัว complete — รอ window ครบ) · เป็น input ให้ #25 · tsc --noEmit + eslint สะอาด · `npm run backtest:fetch` รันจริงผ่านแล้ว (ไม่ต้องรอ Ops อีก — path-cache มีข้อมูลแล้ว)

## 25. ✅ DONE — Skill feedback loop — เอาผล backtest จริงมาเป็น prior ให้ catalyst-list / turbo-list / analyze

**ปัญหา:** skills (`stock-report`, `turbo-report`, commands `/catalyst-list` `/turbo-list`) screen ด้วยความเชื่อล้วน ๆ — ไม่เคยเห็นผลจริงของ pick ที่ผ่านมา ทั้งที่ระบบมี north-star (hit-rate/MAE ต่อ catalystType), near-misses (counterfactual), scenario ที่เขียนไว้เทียบผลจริงได้ · slogan "แม่นขึ้นเรื่อย ๆ" ไม่มีทางเกิดถ้า loop ไม่ปิด
**ทำ:**
  1. **Lessons file:** script ใหม่ (เช่น `scripts/build-skill-feedback.mjs` ต่อท้าย `backtest:fetch` หรือรวมเป็น step เดียว) สรุปจาก north-star + backtest + near-misses → เขียน `web/data/skill-feedback.json` แบบกะทัดรัด: hit-rate/median MAE ต่อ catalystType · scenario calibration (base/bull ที่เขียน vs realized — optimism bias กี่ %) · near-miss counterfactual (ตัวที่ตัดทิ้ง outperform top-5 ไหม) · n ต่อ bucket เสมอ
  2. **แก้ SKILL.md:** `skills/stock-report/SKILL.md`, `skills/turbo-report/SKILL.md`, commands `.claude/commands/catalyst-list.md`, `.claude/commands/turbo-list.md` (+ `dashboard-compare` ถ้าเกี่ยว) เพิ่ม step แรกก่อน screen: อ่าน `skill-feedback.json` → ใช้เป็น **advisory prior**: catalystType ที่ hit-rate ต่ำต้องการ upside/conviction สูงขึ้นถึงติด top 5 · `spotSizing`/stop ผูกกับ median MAE จริง · `preRunupPct` cross-check กับ path จริงของ pick เก่า type เดียวกัน
  3. **Guardrail สำคัญ:** n น้อยมาก (~15 unique picks ณ 2026-07-10) — ทุกตัวเลขใน feedback file ต้องพก `n` และ SKILL.md ต้องสั่งชัด: **n < 5 ต่อ type = ห้ามใช้เป็นเหตุผลตัด/เลือก pick** ใช้ได้แค่ประกอบ · ห้าม auto-weight/hard rule จนกว่า sample พอ (สอดคล้อง ⚠️ ของ "Earned category ranking" ด้านล่าง — item นั้นคือเฟสถัดไปของอันนี้)
**🐛 Step 0 bug fix (พบระหว่างทำ):** `scripts/fetch-backtest-prices.mjs` `collectNearMissTargets()` เช็ค `m.screenDate` แต่ `near-misses.json` เก็บ field `date` (ไม่ใช่ `screenDate`) มาตั้งแต่ต้น — ทุก entry ถูก `continue` ข้ามหมด → near-miss checkpoint ไม่เคย fetch เลยสักตัว (bug เดิม ไม่ใช่ผลจาก #24 refactor) แก้โดย normalize field เหมือน `web/lib/near-miss.ts`'s `readNearMisses()` (`date`→`screenDate` ตัด `-`) → รันจริงแล้ว fetch ได้ 7/7 near-miss checkpoint
**Feedback file shape:** `web/data/skill-feedback.json` — `core` (14d/+30%, byType 8 ประเภท + overall), `turbo` (30d/+50%, overall — ไม่มี byType เพราะ North Star เดิมไม่ group turbo ตาม type), `scenarioCalibration` (median written Base/Bull vs realized maxGain → optimism bias), `nearMissCounterfactual` (near-miss point-in-time +14d vs picks' max-gain-in-window — มี `note` บอก methodology ไม่ apples-to-apples 100% แต่เป็น best-available จากข้อมูลที่มี), ทุก bucket มี `n` เสมอ, ปัดเลข 1 ตำแหน่งกัน float noise, ไม่มี NaN/Infinity leak (guard ด้วย `r1()`) · script เป็น `.mjs` ล้วน duplicate math จาก `north-star.ts`/`turbo-north-star.ts` (ตั้งใจ — Node import `.ts` ตรงไม่ได้ ไม่อยาก build step) มี comment บอกไว้ชัดว่า duplicate ที่ไหน
**Wire-up:** `web/package.json` — `backtest:fetch` chain ต่อ `&& npm run feedback:build` (script ใหม่ `feedback:build` เรียกได้เดี่ยว ๆ ด้วย) · รันจริงจบ end-to-end แล้ว: fetch → feedback build ผ่านทั้งคู่ ไม่มี error
**Skill/command wiring:** เพิ่ม guardrail verbatim (`n < 5` = context only ห้ามใช้ตัด/เลือก/re-rank) ครบทั้ง 5 ไฟล์ (`stock-report`, `turbo-report`, `catalyst-list.md`, `turbo-list.md`, `dashboard-compare` — อันหลังนี้ scope แคบกว่า เพราะ dashboard-compare ไม่ screen ตัวใหม่ ใช้ได้แค่เป็น context ใน summary เท่านั้น ไม่แตะ rank score) · เช็คแล้ว `.claude/skills/stock-report`/`turbo-report` ไม่มี symlink จริง (มีแต่ `xvary-*` symlink เสียชี้ไป path ที่ไม่มีอยู่ — ของเก่าไม่เกี่ยวกับงานนี้ ไม่แตะ) `dashboard-compare` symlink ปกติ ชี้ไฟล์เดียวกัน ไม่ต้องแก้ซ้ำ
**ไฟล์:** `scripts/build-skill-feedback.mjs` (ใหม่) · `scripts/fetch-backtest-prices.mjs` (bug fix) · `web/data/skill-feedback.json` (ใหม่ — generated) · `skills/stock-report/SKILL.md` · `skills/turbo-report/SKILL.md` · `skills/dashboard-compare/SKILL.md` · `.claude/commands/catalyst-list.md` · `.claude/commands/turbo-list.md` · `web/package.json` (script entry)
**เป้า:** ทุกครั้งที่รัน `/catalyst-list` หรือ `/turbo-list` Claude เห็นผลจริงของตัวเองก่อน screen → คำแนะนำ sizing/stop อ้างตัวเลขวัดได้ ไม่ใช่ vibes ✅ · guardrail กัน small-n overfit อยู่ครบทุกไฟล์ ✅ · **ปัจจุบัน:** core n=62 (26 complete, 8 catalyst type), turbo n=36 (0 complete — รอ window 30 วันครบ ~21 ก.ค.), scenario calibration n=26, near-miss counterfactual n=4 — ตัวเลขทั้งหมด n<5 หลายจุด ต้องรอสะสมข้อมูลเพิ่มก่อนเชื่อได้เต็มที่ (ตามคาด)

## 26. ✅ DONE — Catalyst-list run hygiene — market-timing Write error + push status ไม่ตรงจริง

**ปัญหา:** จาก run จริง `/catalyst-list` 2026-07-10 (รอบแรกหลัง #25) พบ 2 อาการ:
  (a) **Write `web/data/market-timing.json` error** — `analyze-market-situation` skill research สดครบ (10+ search) แล้ว Write fail จากนั้น rationalize ว่า "ไฟล์เดิม fresh กว่า" แล้วทิ้ง research ที่เพิ่งทำ (ตรรกะกลับด้าน — research ใหม่ย่อมสดกว่าไฟล์เมื่อเช้า) · โชคดีไฟล์เดิมยังเป็นของวันเดียวกัน panel ไม่พัง แต่ถ้าเป็นวันอื่นคือ market-timing stale เงียบ ๆ · run เดียวกันมี "Invalid tool parameters" ตอน load skill ด้วย — อาจเป็นสาเหตุเดียวกัน (path/schema/tool-call ใน SKILL.md เพี้ยน)
  (b) **รายงาน push status เกินจริง** — commit + push ไป branch `feature/improve` แต่สรุปว่า "✅ pushed → Vercel deploying → visible at /catalyst" ทั้งที่ Vercel production deploy จาก `main` เท่านั้น → user เข้าใจผิดว่าเว็บอัปเดตแล้ว
**ทำ:**
  1. ไล่สาเหตุ Write error ใน `analyze-market-situation` (ลอง reproduce: รัน `/macro` ดู) — เช็ค path ที่ skill ใช้เขียน (relative vs absolute, รันจาก cwd ไหน), แก้ให้เขียนสำเร็จหรือ retry · เพิ่มกติกาใน SKILL.md: ถ้า Write fail = **ต้อง fix แล้วเขียนให้สำเร็จ** ห้ามสรุปว่าไฟล์เดิมดีกว่า (fresh research ชนะเสมอ)
  2. แก้ `.claude/commands/catalyst-list.md` (+ commands อื่นที่ push: `analyze.md`, `turbo-list.md`, `dca-list.md`, `analyze-turbo.md`, `analyze-dca.md`): step สุดท้ายต้องเช็ค branch ปัจจุบัน — ถ้าไม่ใช่ `main` ให้รายงานตามจริง "pushed to <branch> — merge to main to deploy" ห้าม claim "Vercel deploying"
**ไฟล์:** `skills/analyze-market-situation/SKILL.md` · `.claude/commands/catalyst-list.md` · `.claude/commands/analyze.md` · `.claude/commands/turbo-list.md` · `.claude/commands/dca-list.md` · `.claude/commands/analyze-turbo.md` · `.claude/commands/analyze-dca.md`
**เป้า:** market-timing.json ถูกเขียนใหม่ทุกครั้งที่ `/catalyst-list`/`/macro` รันสำเร็จ · ไม่มี run ไหน claim "deploying" ทั้งที่อยู่ feature branch

**อัปเดต (2026-07-10, pre-turbo-list patch):**
  - **(b) ✅ DONE สำหรับ `catalyst-list.md` + `turbo-list.md`** — ทั้งสองไฟล์ตอนนี้สั่งชัด: step สุดท้ายต้องรายงาน branch จริงที่ push ไป ("pushed to `<branch>` — merge to main to deploy" ถ้าไม่ใช่ `main`, ห้าม claim "Vercel deploying") · **ยังไม่ทำ:** `analyze.md`, `dca-list.md`, `analyze-turbo.md`, `analyze-dca.md` ตามที่ระบุไว้ในข้อ 2 เดิม
  - **(a) scope เปลี่ยน, ยังเปิดอยู่** — ตัดสินใจ decouple market-timing ออกจาก `/catalyst-list` ทั้งหมดแล้ว (ดู CLAUDE.md "Market-timing refresh — /macro only" ใหม่) `/catalyst-list` เลยไม่เรียก `analyze-market-situation` อีกต่อไป → อาการ (a) จะไม่เกิดจาก `/catalyst-list` ได้อีก แต่ **root cause จริงใน `skills/analyze-market-situation/SKILL.md` (Write fail + fallback rationalize ผิดตรรกะ) ยังไม่ได้แก้เลย** — ยังกระทบตอนรัน `/macro` ตรง ๆ อยู่ ข้อ 1 เดิมยังต้องทำ

**✅ ปิดครบ (2026-07-10, backlog #26+#27 task):**
  - **(a) root cause พบแล้ว:** `analyze-market-situation/SKILL.md` (อยู่ที่ repo root ไม่ใช่ใต้ `skills/` — จุดสังเกตที่ทำให้งงตอนแรก) สั่งให้ save ที่ path สัมพัทธ์ `web/data/market-timing.json` เฉย ๆ โดยไม่บอกให้ resolve เป็น absolute path ก่อน — เครื่องมือ write ต้องการ absolute path เท่านั้น ตรงกับอาการ "Invalid tool parameters" ที่เจอ แก้แล้ว: เพิ่มคำเตือน ⚠️ ชัดเจนก่อน JSON schema block ให้ resolve absolute path ก่อนเขียนเสมอ + กติกา "Write fail → retry จนสำเร็จ ห้ามสรุปว่าไฟล์เดิมดีกว่า ห้ามถือว่า run สำเร็จถ้ายังไม่ได้เขียนไฟล์จริง" (ทั้งใน Step 6 และ Always-on rules) · **verify แล้วจริง:** รัน `/macro` ผ่าน Write tool ด้วย absolute path เขียนสำเร็จรอบเดียว ไม่มี error, `generatedAt` เป็นเวลาปัจจุบัน, JSON valid
  - **(b) ครบทุกไฟล์แล้ว:** เพิ่ม push-status rule ให้ `analyze.md`, `dca-list.md`, `analyze-turbo.md`, `analyze-dca.md` ด้วย (เดิมมีแค่ `catalyst-list.md`/`turbo-list.md`) — ครบ 6 ไฟล์ที่ push ทั้งหมดแล้ว
**เป้า (อัปเดต):** ✅ ครบทั้ง (a) และ (b) — `/macro` เขียน `market-timing.json` สำเร็จแบบ verify แล้ว · ทุก command ที่ push รายงาน branch จริง

## 27. ✅ DONE — Feedback prior v1.1 — n≥5 ต้องใช้จริง + regime note กัน hit-rate หลอก

**ปัญหา:** run จริงรอบแรก (2026-07-10) เผย 2 ช่อง:
  (a) **Guardrail ถูกตีความเข้มเกินสเปค** — กติกาคือ "n<5 = context only" แปลว่า **n≥5 ใช้ปรับ threshold ได้** แต่ run treat ทุก bucket เป็น context-only รวมทั้ง `earnings_beat (n=12, hitRate 0%)` แล้วเลือก earnings play ทั้ง 5 ตัวโดย prior ไม่มีผลอะไรเลย → loop เปิดแล้วแต่ยังไม่ bite
  (b) **hit-rate ไม่มี regime context** — 0/12 ของ earnings_beat วัดช่วง SOX -10.8% selloff พอดี ตลาดทั้งกระดานไม่มีทางวิ่ง +30%/14d → ตัวเลขดิบหลอกว่า type ห่วยทั้งที่คือ regime (นี่คือปัญหาที่ North Star v2.2 benchmark-adjusted แก้เต็มรูปแบบ — แต่ทำ hotfix หยาบก่อนได้)
**ทำ:**
  1. **Clarify กติกาใน SKILL.md/commands ทั้ง 5 ไฟล์ (ชุดเดียวกับ #25):** เขียน 2 tier ชัด ๆ — `n<5` = context only (เดิม) · `n≥5` = **ต้อง**ใช้เป็น prior จริง: type ที่ hitRate ต่ำกว่า overall ชัดเจน → pick type นั้นต้องมี upside/conviction สูงกว่าปกติถึงติด top 5 (ระบุเป็นกติกา ไม่ใช่ให้เลือกเอง) + ต้องพ่วง regime note จากข้อ 2 เสมอตอนตีความ
  2. **Regime context ใน `scripts/build-skill-feedback.mjs`:** ต่อ window ของแต่ละ complete entry เก็บ benchmark return หยาบ ๆ (SPY หรือ QQQ ช่วง 14d เดียวกัน — fetch เพิ่มใน `fetch-backtest-prices.mjs` เก็บลง path-cache key `bench:SPY_YYYYMMDD` แนว #24) → feedback file เพิ่ม per-type `avgBenchmarkPct` + `regimeNote` (เช่น "8/12 windows อยู่ในช่วงตลาดลง >3%") · ยังไม่ต้อง beta-adjust (นั่นคือ v2.2) แค่ให้ผู้อ่านเห็นว่า hit-rate วัดใน regime ไหน
  3. **อัปเดต guardrail note:** hitRate ที่ benchmark ติดลบแรงทั้ง window = ตีความเป็น "unproven in bad regime" ไม่ใช่ "type นี้ใช้ไม่ได้"
**ไฟล์:** `scripts/build-skill-feedback.mjs` · `scripts/fetch-backtest-prices.mjs` (benchmark path) · `web/data/skill-feedback.json` (shape ใหม่) · `skills/stock-report/SKILL.md` · `skills/turbo-report/SKILL.md` · `skills/dashboard-compare/SKILL.md` · `.claude/commands/catalyst-list.md` · `.claude/commands/turbo-list.md`
**เป้า:** รอบหน้าที่ n≥5 prior มีผลจริงต่อ threshold (เห็นได้จาก reasoning ตอน screen) · ทุก hit-rate ใน feedback file อ่านคู่ regime ได้ ไม่มีเลขดิบลอย ๆ ให้ตีความผิด · ปูทาง North Star v2.2 (benchmark path เก็บไว้แล้ว ใช้ต่อได้เลย)

**อัปเดต (2026-07-10, pre-turbo-list patch):** ทำ visible-output ของ step อ่าน feedback prior แล้ว (ใน `catalyst-list.md` + `turbo-list.md` ตอนนี้สั่งให้ print block `📊 Feedback prior (...)` ในแชทก่อน screen ทุกครั้ง กัน step โดนข้ามเงียบ ๆ ตามที่ #26 สังเกตเห็น) — แต่นี่แค่ทำให้เห็นว่า "อ่านจริง" **tier-2 (n≥5 ต้องใช้ปรับ threshold จริง) กับ regime note (ข้อ 1-3 ด้านบน) ยังไม่ได้ทำเลย** ยังต้องทำต่อ

**✅ ปิดครบ (2026-07-10, backlog #26+#27 task) — feedback file shape v1.1:**
  - **ข้อ 2 (regime context):** `scripts/fetch-backtest-prices.mjs` ดึง SPY path ต่อ **unique report date** (ไม่ใช่ต่อ ticker — dedupe จาก 67 core + 36 turbo path snapshot เหลือแค่ 13 SPY fetch จริง) เก็บที่ `path-cache.json` key `bench:SPY_YYYYMMDD`, ถ้าวันเดียวกันมีทั้ง core (14d) และ turbo (30d) จะดึง window กว้างสุด (30d) ไว้ — อ่าน 14d ได้จาก prefix ของ series เดียวกัน · `scripts/build-skill-feedback.mjs` เพิ่ม `avgBenchmarkPct` + `regimeNote` (เช่น `"0/12 windows had SPY down >2%"`) ต่อ `core.byType[]` + `core.overall` + `turbo.overall` และ top-level `regime` (n + median SPY return ข้าม core+turbo) — graceful ตอนไม่มี bench data (null ไม่ crash, ทดสอบแล้วตอน turbo n=0)
  - **ข้อ 1+3 (2-tier rule + guardrail note):** เขียนกติกา 2 tier ชัดใน SKILL.md/commands ครบ 5 ไฟล์เดิม (`stock-report`, `turbo-report`, `dashboard-compare`, `catalyst-list.md`, `turbo-list.md`) — n<5 = context only (เดิม), n≥5 = **ต้อง**ใช้จริง (ระบุ bucket/type ที่ divergence ชัดใน reasoning ตอน screen หรือบอกว่า "ไม่มี bucket ไหนผ่านเกณฑ์") + regime caveat คู่กันเสมอ (dashboard-compare ยังคง scope แคบ — ทั้ง 2 tier กระทบแค่ commentary ไม่กระทบ rank) · print block `📊 Feedback prior` ใน 2 command ไฟล์ เพิ่ม `regime:` line + `tier-2:` status line ตามสเปค
  - **⚠️ พบระหว่างทำ (สำคัญ):** ข้อมูลจริงตอนนี้ (26 complete core entries) ไม่ตรงกับสมมติฐานเดิมที่ว่า "earnings_beat 0/12 เพราะ SOX selloff" — `regimeNote` จริงอ่านว่า `"0/26 windows had SPY down >2%"` (median SPY **+2.4%**) เพราะ window ของ entry ที่ complete แล้ว (report date ~Jun 21-26) ปิดก่อนที่ SOX selloff ตัวจริงจะเกิดในต้น-กลาง ก.ค. — แปลว่า hit-rate 0% **ไม่ได้ถูก excuse ด้วย regime กว้าง** เลย (SPY นิ่ง/ขึ้นด้วยซ้ำ) นี่คือจุดสำคัญที่ prompt เขียนไว้ให้เช็ค `regimeNote` จริงทุกรอบ ห้ามสมมติเรื่องเดิมซ้ำ — ตัวอย่างนี้เอง (real, ไม่ใช่สมมติ) ถูกเขียนเป็น example ในทั้ง 5 ไฟล์แล้ว
  - **North Star v2.2:** benchmark path พร้อมใช้แล้ว (ดูหมายเหตุใน "North Star v2" ด้านบน)
**เป้า (อัปเดต):** ✅ ครบทุกข้อ — verify แล้วจริง: `npm run backtest:fetch` end-to-end บนเครื่องจริง (network จริง) → bench keys ปรากฏใน path-cache (13 keys), feedback file มี `avgBenchmarkPct`/`regimeNote`/`regime` ครบ ไม่มี NaN/Infinity, ทุก aggregate มี `n`, `node scripts/validate-reports.mjs` ผ่าน (113 reports, 0 blocking), `tsc --noEmit` สะอาด

## 28. ⏸️ WAIT-FOR-DATA — Mega-cap ครอง top-5 แต่ North Star วัดแบบ small-cap: SMH benchmark + small-cap quota

**สถานะ: รอ data — อย่าเพิ่งทำ** จนกว่า (a) turbo windows แรก complete (~2026-07-21 เป็นต้นไป) และ (b) มี catalyst screen เพิ่มอีกอย่างน้อย 2–3 รอบที่ไม่ใช่ช่วงเดียวกัน — n=12 ปัจจุบันมาจาก screen แค่ ~3 วันติดกัน (Jun 21–26) ไม่ independent พอจะสรุป
**ปัญหา (ข้อสังเกตจาก data จริงรอบแรก 2026-07-10):** earnings_beat hit-rate **0/12** ทั้งที่ regime กว้างปกติ (`regimeNote: "0/26 windows had SPY down >2%"`, median SPY +2.4% — ดู #27) → ข้อแก้ตัวเรื่อง market drawdown ตกไป เหลือ 2 สมมติฐาน:
  (a) **Sector ≠ market** — SPY ไม่ใช่ benchmark ที่ถูกสำหรับ pick กลุ่ม semi-heavy · semis อาจอ่อนก่อน SOX selloff จริงทั้งที่ SPY ยังบวก → ต้องมี SMH เทียบถึงตัดสินได้
  (b) **โครงสร้าง pick เอง (น่าจะใช่กว่า)** — top-5 catalyst ออกมาเป็น mega-cap ซ้ำ ๆ (NVDA/AVGO/MU/META) ซึ่งโอกาสวิ่ง +30%/14d แทบเป็นศูนย์โดยธรรมชาติของ market cap ต่อให้ thesis ถูก · สอดคล้อง counterfactual: picked median max-gain แค่ +2% ใน 14d — ทายทิศถูกแต่ target/horizon ไม่ match ขนาดหุ้น
**ทำ (เมื่อ data พอ):**
  1. **SMH benchmark เพิ่มเป็นตัวที่สอง** — งานเล็ก: `scripts/fetch-backtest-prices.mjs` ดึง `bench:SMH_YYYYMMDD` เพิ่ม (โครง `bench:` จาก #27 รองรับแล้ว, dedupe ต่อ unique date เหมือน SPY) → `build-skill-feedback.mjs` เพิ่ม `avgSectorBenchmarkPct` ใน regimeNote → ตัดสินสมมติฐาน (a) ได้ทันที
  2. **ถ้า (b) ยืนยัน:** ยก "Small-cap quota ใน /dashboard" (อยู่ใน "ยังไม่เลือกทำ" ด้านล่าง) ขึ้นมาทำจริง — บังคับ ≥1-2 pick <$10B ใน top-5 · และ/หรือพิจารณา per-cap-tier target (mega-cap วัด +15%/14d?) ซึ่งชนกับ North Star v2.1 per-type window — ควรออกแบบพร้อมกันจะได้ไม่แก้ metric สองรอบ
  3. เช็ค hit-rate อีกครั้งเมื่อ n ต่อ type ≥ 20 จากหลายช่วงเวลา ก่อน commit การเปลี่ยน screen logic ใด ๆ
**ไฟล์:** `scripts/fetch-backtest-prices.mjs` · `scripts/build-skill-feedback.mjs` · `web/data/skill-feedback.json` · (ถ้าทำข้อ 2) `.claude/commands/catalyst-list.md` + `web/lib/north-star.ts` (ประสาน v2.1)
**เป้า:** รู้ว่า 0/12 คือ sector regime หรือ pick structure · ถ้าเป็นอย่างหลัง top-5 ต้องมีสัดส่วน pick ที่ +30%/14d เป็นไปได้จริงตามขนาด market cap · เกี่ยวพัน: North Star v2.1/v2.2 + Small-cap quota

## 29. ✅ DONE — Contact links — เพิ่ม email + GitHub บนเว็บ

**ปัญหา:** เว็บไม่มีช่องทางติดต่อเลย — footer ใน `web/app/layout.tsx` (บรรทัด ~139) มีแค่ข้อความ ไม่มี link email/GitHub · คนเจอเว็บ (โดยเฉพาะหลัง #19 SEO เริ่มติด index และ #14 Phase 2 เปิด public signup) ไม่มีทาง report ปัญหา/ติดต่อ/ดู source
**ทำ:**
  1. เพิ่ม contact links ใน footer กลาง (`web/app/layout.tsx` — โชว์ทุกหน้า): email **`mailto:armakuji@hotmail.com`** + GitHub profile **`https://github.com/Armakuji`** (เคาะแล้ว 2026-07-10 — ใช้ profile ไม่ใช่ repo link) — icon เล็ก ๆ + label สไตล์เดียวกับ theme (dark, muted)
  2. พิจารณาใส่ซ้ำใน Landing footer (`web/app/Landing.tsx` บรรทัด ~177) ถ้า layout footer ไม่ปรากฏบนหน้า landing
  3. i18n EN/TH ตาม pattern `useLang()` (label เช่น "Contact" / "ติดต่อ")
**ไฟล์:** `web/app/layout.tsx` (footer) · `web/app/Landing.tsx` (ถ้าจำเป็น) · แนวทาง i18n จากไฟล์ที่ทำใน #13
**เป้า:** ทุกหน้ามี link email (armakuji@hotmail.com) + GitHub (github.com/Armakuji) มองเห็นได้ใน footer · กดแล้วเปิด mail client / profile จริง · สไตล์กลมกลืน theme เดิม
**ผล (2026-07-10):** สร้าง `web/app/Footer.tsx` เป็น client component (`useLang()`) แยกจาก `layout.tsx` (server component) ตาม pattern เดียวกับ `MarketTicker`/`Header` — layout footer อยู่นอก `<main>` แต่ยังอยู่ใต้ `LanguageProvider` และ render ทุกหน้ารวมถึง landing (HomePage วาง `Landing` เป็น `children` ข้างใน `<main>` เดียวกัน) → **ไม่ต้องใส่ซ้ำใน `Landing.tsx`** (ข้อ 2 ไม่จำเป็น, ยืนยันด้วยการอ่านโครงสร้าง JSX) · verify: tsc/eslint clean (มี pre-existing warning ใน layout.tsx ไม่เกี่ยวกับงานนี้), curl ตรวจ `/`, `/catalyst`, `/report/AMD` เห็น link ครบ, สลับ default lang เป็น th ชั่วคราวยืนยัน "Contact"→"ติดต่อ" แล้ว revert กลับ

## 30. ✅ DONE — Skill prompt hygiene sweep — 5 bugs + ตัดซาก radar-era ใน stock-report/turbo-report/list commands

**ปัญหา:** review prompt ทั้ง 4 ตัว (2026-07-10: `catalyst-list.md`, `turbo-list.md`, `stock-report`, `turbo-report`) พบ 5 bug จริง + ซากเก่าที่ขัดกติกาปัจจุบัน — commands สดเพราะเพิ่งผ่าน #25–#27 แต่ SKILL.md หลุด sync:
  1. **Stale push template ใน skills** — `stock-report` Step 4, `turbo-report` Step 5 (และ grep เจอใน `dca-report`, `analyze` skill ด้วย) ยัง hardcode `git push origin main` + confirm line "→ Vercel deploying" — กติกา honest push (#26) แก้เฉพาะ `.claude/commands/*` ไม่ได้แก้ skills → รัน `/analyze` เดี่ยวยัง claim เกินจริง
  2. **turbo-report บอก "visible at `/sing`"** — route ไม่มีจริง (ยุคเก่า) ต้องเป็น `/turbo`
  3. **turbo-list ขัดกันเอง** — Step 0 อ้าง "ranking stays survival-first per backlog #11" แต่ Step 1 สั่ง "rank by base-case % primary" · #11 ยังไม่ implement — แก้ Step 0 ให้พูดตรงความจริง ("ranking = upside-first ตามสเปคปัจจุบัน; survival-first คือ #11 ที่ยังไม่ทำ; feedback ไม่แตะ rank order")
  4. **`scoreLabel: "Moonshot"`** — turbo-report สั่งใช้ แต่ CLAUDE.md enum มีแค่ `Core Holding | Speculative | ค่าขนม` · types.ts เป็น `string` เลยไม่ crash และมี report จริงใช้แล้ว (IQMX_20260706) → ต้องเคาะ: เพิ่ม "Moonshot" เข้า enum ใน CLAUDE.md (แนะนำ — ใช้จริงแล้ว + สื่อความ) หรือแก้ skill+report เลิกใช้ · เช็คด้วยว่า UI/scoring ไม่ switch ตาม label นี้
  5. **stock-report ไม่มี list mode** — ถูกเรียกจาก `/catalyst-list` ต่อ 5 ตัวแล้ว Step 4 สั่ง commit+push ต่อ ticker ขัดกับ command ที่ push ครั้งเดียว → เพิ่มบรรทัด "list mode (called from /catalyst-list): skip Step 4 — the command validates/commits/pushes once at the end"
  **ซาก/โครงสร้าง (ทำในรอบเดียวกัน):**
  6. ตัด `turbo-report` Step 6 "HTML Preview" + Turbo Visual System block ทั้งก้อน — radar-era ขัดกับ "JSON only, site is presentation layer" ที่ประกาศต้นไฟล์ตัวเอง
  7. ตรึงนิยาม "30%+ upside" ใน `catalyst-list.md` — ระบุวิธีวัดให้ชัด (เสนอ: consensus target เป็นหลัก, top target ประกอบ; ไม่ใช้ scenario-implied เป็น gate) กัน bar เลื่อนข้ามรอบ run — near-miss log ปัจจุบันใช้ปนกันแล้ว
  8. (optional ถ้าไม่บาน) ลดสำเนา Step 0 tier rules ที่ตอนนี้ copy อยู่ 5 ที่ (2 commands + 3 skills, เนื้อเพี้ยนกันเล็กน้อยแล้ว) — ให้ skill เป็น canonical copy แล้ว command ชี้ไปหา · ถ้า scope ใหญ่เกินให้จดแยก item ใหม่
**ไฟล์:** `skills/stock-report/SKILL.md` · `skills/turbo-report/SKILL.md` · `skills/dca-report/SKILL.md` · `skills/analyze/SKILL.md` (เช็ค stale template ข้อ 1) · `.claude/commands/catalyst-list.md` · `.claude/commands/turbo-list.md` · `CLAUDE.md` (ถ้าเพิ่ม Moonshot เข้า enum) · เช็ค symlink `.claude/skills/*` ว่าชี้ไฟล์เดียวกัน (ตาม #25 พบว่า dashboard-compare เป็น symlink)
**เป้า:** ไม่มี prompt ไหน claim "Vercel deploying" / push main โดยไม่เช็ค branch · ไม่มี route/label/กติกาที่ตายแล้วเหลือใน skills · turbo-list พูดเสียงเดียวเรื่อง ranking · นิยาม 30% gate คงที่ข้ามรอบ run
**ผล (2026-07-10):** ทำครบทั้ง 7 bug + จุด optional (#8) → **เคาะแล้ว: ทำ 1–7, ไม่ consolidate #8** (รายละเอียด + เหตุผลอยู่ #31):
  1. แก้ push template ครบ 4 ไฟล์ (`stock-report` Step 4, `turbo-report` Step 5 **+ List mode point 4** ที่เจอเพิ่มระหว่างทำ, `dca-report` Step 3, `analyze` Step 4c) — `git push origin main` → `git push` + honest branch-report phrasing ตรงกับ `.claude/commands/*` ที่ทำใน #26
  2. `/sing` → `/turbo` (แก้พร้อม push-template ข้อ 1 เพราะอยู่บรรทัดเดียวกัน)
  3. `turbo-list.md` Step 0 sync กับ Step 1 แล้ว — "ranking is upside-first per the current spec... survival-first ranking is backlog #11 and not yet implemented" — sync คำเดียวกันใน `turbo-report/SKILL.md` Step 0 ด้วย (เดิมพูดคนละเสียงกับ command)
  4. **เคาะ: เพิ่ม `"Moonshot"` เข้า enum ใน CLAUDE.md** — grep `web/lib/` + `web/app/` ยืนยันแล้วว่า `scoreLabel` เป็น `string` เฉยๆ ไม่มี switch/style logic ผูกกับค่านี้เลย (ทุกจุด render ตรงๆ ด้วย `??` fallback, ไม่แตะ scoring) → ปลอดภัย 100%
  5. เพิ่ม "list mode: skip this step" ใน `stock-report` Step 4
  6. ตัด `turbo-report` Step 6 "HTML Preview" + Turbo Visual System ทั้งก้อนแล้ว
  7. ตรึงนิยาม 30%+ ใน `catalyst-list.md`: consensus analyst target vs current price = primary gate, top target = supporting color, scenario-implied ไม่ใช่ gate substitute — sync คำเดียวกันไปที่ near-miss `impliedUpside` note ด้วย
  8. **ไม่ consolidate** — assessment เต็มอยู่ใน #31 ใหม่ (นับ drift จริง + เหตุผลที่ไม่ทำตอนนี้ + พบ broken symlink `.claude/skills/xvary-*` ระหว่างเช็ค)
  **Verify:** `grep -rn "Vercel deploying"` เหลือเฉพาะใน "never say" rule text ✅ · `grep -rn "/sing"` ไม่มี ✅ · `node scripts/validate-reports.mjs` ผ่าน (113 reports, 0 blocking) ✅

## 31. Step 0 feedback-prior dedup — assessed 2026-07-10, NOT consolidated (logged per #30 point 8)

**ปัญหา:** #30 point 8 ขอให้นับ drift ของสำเนา Step 0 (skill-feedback.json advisory-prior block) ที่ตอนนี้อยู่ 5 ที่ — `.claude/commands/catalyst-list.md`, `.claude/commands/turbo-list.md`, `skills/stock-report/SKILL.md`, `skills/turbo-report/SKILL.md`, `skills/dashboard-compare/SKILL.md` — แล้วเคาะว่า consolidate ได้ไหม
**สิ่งที่พบ:**
  - **4 สำเนาจริงๆ ซ้ำกัน (2 คู่):** `catalyst-list.md` ↔ `stock-report/SKILL.md` และ `turbo-list.md` ↔ `turbo-report/SKILL.md` — command แต่ละตัวเขียน Step 0 แบบย่อ (ไม่มี `medianMAE` bullet, `scenarioCalibration` bullet, `nearMissCounterfactual` bullet ที่ skill เต็มมี) ก่อนแก้รอบนี้ `turbo-list.md` ยังมี ranking claim ขัดกับ `turbo-report` เอง (แก้แล้วใน #30 point 3 — sync คำเดียวกันทั้งคู่)
  - **`dashboard-compare/SKILL.md` ไม่ใช่สำเนาซ้ำจริง** — ตั้งใจให้ semantics ต่างจาก 4 ที่บน: ผลจาก feedback ที่นี่เป็น **commentary-only** ห้าม re-rank/เปลี่ยน zone/เปลี่ยน Best-to-Open-NOW list เด็ดขาด (เขียนไว้ชัดเป็น "HARD GUARDRAIL" ในไฟล์) ต่างจาก `stock-report`/`turbo-report` ที่ tier-2 **ต้อง** บังคับปรับ upside/conviction/sizing จริง — อันนี้คือ scope ที่ต่างกันโดยตั้งใจ ไม่ใช่ bug ไม่ควรรวม
  - **เคาะ: ไม่ consolidate ตอนนี้** — การให้ command ชี้ไปหา skill's Step 0 แทนที่จะ copy เนื้อมา เป็นการเปลี่ยน prompt ที่ agent ใช้จริงตอน run `/catalyst-list`/`/turbo-list` — ไม่มีทาง verify ว่า "behavior เหมือนเดิม" ได้ในแซนด์บ็อกซ์ (ต้องรัน live command จริงเทียบผลลัพธ์) ต่างจาก code refactor ที่ tsc/test ยืนยันได้ → ความเสี่ยงสูงกว่าประโยชน์ของการลด duplication ตอนนี้ ทำตามกติกา #30 point 8 ("ถ้าเสี่ยง behavior change อย่าทำ — จดไว้")
  - **พบเพิ่ม (แยกเรื่อง ไม่ใช่ dedup แต่เกี่ยวกับ symlink check ที่ #30 ขอ):** `.claude/skills/xvary-stock-report`, `.claude/skills/xvary-turbo-report`, `.claude/skills/xvary-dca-report` เป็น **broken symlinks** ชี้ไปที่ `skills/xvary-*` ที่ไม่มีจริง (ของจริงคือ `skills/stock-report`, `skills/turbo-report`, `skills/dca-report` — ไม่มี `xvary-` prefix) — เช็คแล้วว่าไม่กระทบงาน #30 (ไม่มี "สำเนาที่สอง" ที่จะลืมแก้ เพราะ symlink เสียไม่ได้ชี้ไปไฟล์จริงไหนเลย) แต่เป็น repo hygiene issue แยกที่ควรมีคนดู — ไม่รู้ว่าเป็นความตั้งใจ (ปิดใช้งานชั่วคราว) หรือ typo ตกค้าง
**ไฟล์:** อ่านอย่างเดียว ไม่แก้: `.claude/commands/catalyst-list.md` · `.claude/commands/turbo-list.md` · `skills/stock-report/SKILL.md` · `skills/turbo-report/SKILL.md` · `skills/dashboard-compare/SKILL.md` · `.claude/skills/xvary-*` (พบ broken symlink)
**เป้า:** ถ้าจะทำจริง — consolidate `catalyst-list.md`/`turbo-list.md` ให้ชี้ไปหา skill's Step 0 แทน copy เนื้อ (ทำทีละคู่ + รัน live `/catalyst-list` และ `/turbo-list` จริงเทียบ output ก่อน-หลัง) และเคาะว่า `.claude/skills/xvary-*` ตั้งใจ broken หรือควรแก้เป็นชื่อจริง

## 32. ✅ DONE — Compare v3 — rename `dashboard-compare`→`catalyst-compare` + stage/proximity-aware + แยก turbo-compare (implement #11)

**ปัญหา:** review `skills/dashboard-compare/SKILL.md` (2026-07-10) พบ 4 ช่อง — 2 อันแรกเกิดจาก #8 เพิ่ง landing (skill เขียนก่อน):
  1. **ไม่รู้จัก post-catalyst stage** — pick ที่ event ผ่านแล้ว (dashboard ย้ายเข้า Realized section แล้วโดย #8) ยังติด "🎯 Best to Open NOW" ได้เต็ม ๆ เพราะ formula ไม่ดู `catalystDate`
  2. **ไม่มี catalyst proximity ใน rank score** — event อีก 5 วัน vs 80 วัน คะแนนเท่ากัน ทั้งที่ thesis ทั้งระบบคือ timing (pre-runup 1–2 สัปดาห์)
  3. **Compare ได้แค่ core lane** — อ่านเฉพาะ `web/data/reports/` → turbo เทียบไม่ได้ = #11 ที่เปิดรออยู่
  4. **จุกจิก:** ราคาสดใช้ stockanalysis.com ขณะที่ backtest stack ใช้ Yahoo (source เพี้ยนกันได้) · `score` อ่านดิบจาก JSON ทั้งที่เป็น advisory (ของจริง recompute โดย `scoring.ts` — CLAUDE.md ข้อ 6)
**ทำ:**
  A. **Catalyst mode — rename skill เดิมเป็น `catalyst-compare`** (สื่อ lane ตรงกว่า "dashboard" ที่กำกวมหลังมี 3 lane · ย้าย dir `skills/dashboard-compare/`→`skills/catalyst-compare/` + สร้าง symlink `.claude/skills/catalyst-compare` ใหม่แทนอันเดิม · เช็คแล้ว: ไม่มีไฟล์อื่นใน repo อ้าง dashboard-compare นอกจาก backlog):
     - **Stage-aware:** derive stage แบบเดียวกับ `reportStage()` ใน `web/lib/catalyst-timing.ts` (nearest `catalystDate` < today = post) → pick ที่ post ตัดออกจาก Best to Open NOW ไปอยู่ section "⏳ Realized — ไม่ใช่ entry ใหม่" พร้อมเหตุผลสั้น
     - **Proximity points ใน rank score:** soft (ห้าม hard filter — pre-runup คือ edge): `daysToCatalyst ≤ 14` = +10 · `15–45` = +5 · `>45` หรือไม่มีวัน = 0
     - **Consistency:** เปลี่ยน live price source เป็น Yahoo (endpoint เดียวกับ `scripts/fetch-backtest-prices.mjs`, stockanalysis เป็น fallback) · เพิ่ม note ใน prompt ว่า `score` ใน JSON เป็น advisory — ใช้ได้แต่ให้รู้ว่าค่าจริง recompute ตอน load
  B. **Turbo-compare แยก (implement #11):** สร้าง `skills/turbo-compare/SKILL.md` ใหม่ อ่าน `web/data/speculative/` — เกณฑ์ตาม #11 ที่ spec ไว้แล้ว: Survival (0–30, runway/burn/dilution) · Upside reality (0–25) · Entry (0–25, ใช้ zone logic เดียวกับ catalyst mode) · Headwind penalty (−30–0) · Bull% bonus (0–10, tiebreaker) · Output = "🎰 Moonshot Leaderboard" (ห้ามใช้ชื่อ "Best to Open NOW" — framing ต่างกัน) · stage-aware เหมือนกัน (binary event ผ่านแล้ว = realized) · Step 0 feedback prior ใช้ semantics ของ turbo lane (`turbo.overall`, commentary + sizing language)
     - trigger: "compare turbo", "หุ้นซิ่งตัวไหนเข้าได้", "moonshot ตัวไหนน่าเปิด" ฯลฯ · dashboard-compare เดิมเพิ่มบรรทัด: ถ้า user ถามถึง turbo → ชี้ไป turbo-compare
**ไฟล์:** `skills/dashboard-compare/SKILL.md` · `skills/turbo-compare/SKILL.md` (ใหม่) · เช็ค `.claude/skills/` ว่าต้องมี symlink/สำเนาไหม (dashboard-compare เดิมเป็น symlink — ทำแบบเดียวกัน) · อ้างอิง logic: `web/lib/catalyst-timing.ts` (`reportStage`, `daysToCatalyst`)
**เป้า:** compare ไม่เชียร์เข้า pick ที่ event จบแล้ว · pick ใกล้ event ลอยขึ้นเหมาะกับ timing thesis · turbo มี leaderboard ของตัวเองด้วยเกณฑ์ survival-first ตาม #11 (RXRX-type ขึ้น top เพราะ survival แข็ง ไม่ใช่เพราะมีวันชัด) · ราคา source เดียวกับ backtest
**เกี่ยวพัน:** ปิด item นี้ = ปิด #11 ด้วย (จดใน #11 ว่า implement ผ่าน #32)
**ผล (2026-07-10):** ทำครบทั้ง A+B — prompt-only, ไม่แตะ app code:
  - **Rename:** `git mv skills/dashboard-compare skills/catalyst-compare` · ลบ symlink เก่า สร้าง `.claude/skills/catalyst-compare -> ../../skills/catalyst-compare` ใหม่ · `name:` frontmatter → `catalyst-compare` · เก็บ trigger เดิมครบ + เพิ่ม "compare catalyst"/"catalyst ตัวไหนเข้าได้" · grep ยืนยันไม่มีไฟล์อื่นอ้าง `dashboard-compare` อีก (เจอแค่ audit log ใน `.claude/settings.local.json` จาก `rm` command ที่รันตอน rename — ไม่ใช่ reference จริง)
  - **Stage-aware:** Step 1 derive stage ตามกฎเดียวกับ `reportStage()` เป๊ะ (parseable date ทุกตัวใน `catalysts[]`+`estimateDates[]`, ไม่มี=undated, มีอนาคต=pre, ทั้งหมดอดีต=post) · post ตัดออกจาก rank score/Best-to-Open-NOW/Wait-Skip ไปอยู่ section ใหม่ "⏳ Realized — event ผ่านแล้ว ไม่ใช่ entry ใหม่"
  - **Proximity points:** เพิ่มใน final formula เป็น `+ prox_pts` (≤14d=+10, 15–45d=+5, >45/undated=0) — soft signal ไม่ hard filter
  - **Price source:** Yahoo chart endpoint (`query1.finance.yahoo.com/v8/finance/chart/<TICKER>`, host เดียวกับ `fetch-backtest-prices.mjs`) เป็น primary, stockanalysis.com เป็น fallback
  - **Score note:** เพิ่ม footnote ใต้ตารางว่า `score` เป็น advisory, ของจริง recompute โดย `scoring.ts`
  - **Turbo pointer:** เพิ่มทั้งใน description และท้าย trigger phrases — ถ้าถามเรื่อง turbo ให้ชี้ไป `turbo-compare`
  - **`skills/turbo-compare/SKILL.md` ใหม่** — mirror โครงสร้างเดียวกัน (Step 0→1→2→3→4) แต่ criteria ตาม #11 คำต่อคำ (Survival/Upside/Entry/Headwind/Bull%) · output header "🎰 Moonshot Leaderboard" (มีบรรทัดห้ามใช้ "Best to Open NOW" ชัดเจน) · stage-aware แบบเดียวกัน · Step 0 feedback ใช้ `turbo.overall` semantics (commentary+sizing only) · symlink `.claude/skills/turbo-compare` สร้างแล้ว
  **Verify:** `ls -la .claude/skills/` → ทั้งสอง symlink valid, ไม่มี dangling dashboard-compare ✅ · `grep -rn "dashboard-compare"` เหลือแค่ audit log ใน settings.local.json (ไม่ใช่ wiring reference) ✅ · dry-read ทั้งสองไฟล์: "Best to Open NOW" ไม่โผล่ใน turbo-compare (นอกจาก negative-example rule), Survival/Headwind/Bull% ไม่โผล่ใน catalyst-compare, stage rule คำเดียวกันทั้งคู่ ✅ · **Sanity vs current data:** KTOS (nearest catalyst Aug 5, 26 วันจากวันนี้ 10 Jul) ตกช่วง 15–45d → +5 prox ตรงตามคาด ✅ · ไม่มี ticker ไหนใน `web/data/reports/` (core lane) เป็น "post" stage ตอนนี้จริง ๆ (ทุกตัวมีวันอนาคตอย่างน้อย 1 วัน) เลยไม่มีตัวอย่างจริงให้เช็ค Realized section บน core lane ได้ — แต่เจอตัวอย่างจริงบน turbo lane แทน: **POET** (`web/data/speculative/POET_20260702.json`) มีวันที่ parse ได้แค่ "Q2 2026" (≈พ.ค. 2026) ซึ่งผ่านมาแล้ว ไม่มีวันอนาคตเลย → เข้าเงื่อนไข post/Realized ตรงตามตรรกะที่เขียนไว้

## 33. Findings จากการ test-run catalyst-compare / turbo-compare จริงครั้งแรก (2026-07-10)

**ปัญหา:** ลองรัน compare ทั้งสองตัวกับ data จริง (22 core + 24 turbo tickers) เจอ 3 เรื่อง:
  1. **Tension ระหว่าง turbo-list กับ turbo-compare** — RCAT ที่ `/turbo-list` เพิ่งเลือกเป็น top-5 เมื่อเช้า (upside-first) ได้คะแนน survival-first แค่ ~5/100 บน turbo-compare (runway <1 ปี + shelf $300M = Survival 0, dilution headwind −15) — สอง skill ให้คำตอบตรงข้ามกับหุ้นตัวเดียวกันในวันเดียวกัน · ไม่ใช่ bug (คนละ thesis โดยตั้งใจตาม #11) แต่ user เห็นสองหน้าจอขัดกันโดยไม่มีคำอธิบาย → ควรเพิ่ม **survival sanity-check ใน `/turbo-list` screen**: ตัวที่ Survival score ต่ำมาก (runway <12m + active shelf) ต้องมีเหตุผลพิเศษถึงติด top 5 หรืออย่างน้อย report ต้องระบุ "survival flag" ให้ compare อ้างต่อได้ — ไม่ถึงกับเปลี่ยน ranking axis (นั่นคือการตัดสินใจใหญ่ แยกไปคุยก่อน)
  2. **Live price คือคอขวดจริงของ compare ทั้งคู่** — ราคาจาก report เก่าได้ถึง 2 สัปดาห์ (SOUN Jun 26 ขึ้น #1 ทั้งที่ราคาไม่ยืนยัน) และการ fetch หน้าเว็บ 22–24 ticker ต่อรอบหนักเกิน → ทำ **`scripts/fetch-live-prices.mjs`**: batch ดึงราคาปัจจุบันทุก ticker ใน reports/+speculative/ (Yahoo endpoint เดียวกับ backtest, ~2-3 batch calls) เขียน `web/data/live-prices.json` (ticker → {price, changePct, asOf}) → compare skills อ่านไฟล์นี้ก่อน ถ้า asOf เก่าเกิน X ชม. ค่อย fallback fetch เอง · รันก่อนใช้ compare หรือผูกเข้า cron เดียวกับ backtest:fetch
  3. **Realized pick ไม่มี follow-up loop** — VERA PDUFA ผ่านมา 3 วันแล้วไม่มีอะไรในระบบบอกว่าผลออกเป็นยังไง (ต้องไปเช็คข่าวเอง) → เพิ่มกติกาใน compare ทั้งสอง: pick ใน Realized section ให้ WebSearch ผล event สั้น ๆ (1 query ต่อตัว) แล้วรายงาน outcome ✅/❌ พร้อม % move — ปิด loop "แล้วมันเกิดอะไรขึ้น" โดยไม่ต้องรอ backtest 30 วัน
**ไฟล์:** `.claude/commands/turbo-list.md` + `skills/turbo-report/SKILL.md` (survival flag ข้อ 1) · `scripts/fetch-live-prices.mjs` (ใหม่, ข้อ 2) · `web/data/live-prices.json` (generated) · `skills/catalyst-compare/SKILL.md` + `skills/turbo-compare/SKILL.md` (อ่าน live-prices + realized outcome check, ข้อ 2+3) · `package.json` (script entry)
**เป้า:** turbo-list กับ turbo-compare ไม่ให้คำตอบขัดกันเงียบ ๆ (survival flag อธิบายได้) · compare ใช้ราคาสดจริงทุก ticker ใน 1-2 นาที · Realized section บอก outcome ไม่ใช่แค่ "event ผ่านแล้ว"

---

## ยังไม่เลือกทำ (ไว้พิจารณาทีหลัง)
- **Earned category ranking + expectancy-based sizing** *(idea 5+9)* — ลบ sector priority (Tech→AI→Space) ให้ category ลอยขึ้น top ตาม hit-rate จริง + size ตาม expectancy (`hitRate × upside ÷ MAE`) **⚠️ ขึ้นกับ #9 มี sample พอก่อน** ไม่งั้น optimize บน noise — ต้องใส่ shrinkage/prior + cap อิทธิพลตอน N น้อย
- **Portfolio-level correlation view** — holding (AVGO/NVDA/MRVL/INTC/PLTR/ASTS) correlate สูง เด้งพร้อมกันตาม AI sentiment; view exposure/concentration/powder *(#10 ปิดแล้ว — เป็น report-level warning ใน `/catalyst` เท่านั้น ไอเดียนี้ยังแยกเป็นคนละเรื่อง: cross-holding exposure view ต่อ user's actual portfolio/journal ไม่ใช่ต่อ dashboard picks — ไม่ทับซ้อนแล้ว เป็น idea ที่ใหญ่กว่า ทำทีหลังได้)*
- **Price-trigger alerts** — ต่อ scheduled task + live price → alert "แตะ Entry 2 zone" / "ใกล้ stop" (pairs กับ analyze-journal skill)
- **Small-cap quota ใน /dashboard** — บังคับ ≥1 pick ที่ <$10B + แก้ scoring ให้ตอนไม่มี analyst target ใช้ scenario-implied upside แทนการให้ 0 (เลิกกดหุ้น coverage บาง)

---

## Ops setup (ทำบน Mac mini หลังย้าย project + เปลี่ยน account Claude)

- **ตั้ง scheduled task รัน `backtest:fetch` รายเช้า** — ให้ price-cache + path-cache สะสมอัตโนมัติ ไม่งั้น backtest/North Star/near-miss จะว่างตลอด *(network ในแซนด์บ็อกซ์ blocked — ต้องรันบนเครื่องจริงที่ต่อ Yahoo ได้)*
  - คำสั่ง: `cd web && npm run backtest:fetch` (หรือ `node scripts/fetch-backtest-prices.mjs` จาก root)
  - cron แนะนำ: ทุกเช้าหลังตลาดปิด 1 รอบ เช่น `0 6 * * *`
  - หมายเหตุ: ต้องตั้งบน account/เครื่องใหม่ (Mac mini) เพราะ schedule ผูกกับ session/เครื่อง
- **รัน `npm run build` ครั้งแรกบน Mac** — ยืนยัน production build ผ่าน (แซนด์บ็อกซ์รันไม่ได้เพราะ SWC binary เป็น linux/arm64 ไม่ตรง platform) tsc ผ่านแล้วทุกไฟล์

_Generated during code review · not financial advice · Stock Playbook Research_
