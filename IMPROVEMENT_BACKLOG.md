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

## 11. Turbo-compare: moonshot ranking criteria แยกจาก core dashboard

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

## 12. ธาตุที่ 4 🌍 Earth — feature ที่ยังว่าง (เติมให้ครบ 4 ธาตุ)

**ปัญหา:** landing page + nav ทำ theme 4 ธาตุไว้ (💧 Water=DCA · 🌬️ Air=Catalyst · 🔥 Fire=Turbo) แต่ตอนนี้มีจริงแค่ 3 — ช่อง Earth ยังเป็น "coming soon" ทำให้ composition ไม่ครบวง ต้องตัดสินใจว่า Earth = อะไร แล้วทำให้เป็น feature จริง
**ทำ:** เลือก 1 ใน 3 ทางที่ประเมินไว้ แล้ว build:
  - (ก) **Portfolio/Journal เป็น Earth** — rebrand `/journal` (ดิน = พอร์ตจริงที่ถืออยู่ = รากฐาน) · ต้องแก้ให้ดูได้บน prod (ตอนนี้ `isLocal`-gate ใน `web/app/layout.tsx`) หรือทำ read-only view
  - (ข) **Macro/Market terrain เป็น Earth** — ทำหน้า `/macro` จาก `web/data/market-timing.json` + skill `analyze-market-situation` (ดิน = สภาพพื้นดินของตลาด Fed/CPI/VIX)
  - (ค) **Backtest/Track record เป็น Earth** — rebrand `/backtest` (ดิน = ชั้นหิน/รากฐานข้อมูลย้อนหลัง)
**ไฟล์:** `web/app/page.tsx` (landing — ปลดล็อก Earth tile จาก ghost→active) · `web/app/layout.tsx` (nav เพิ่ม tab ธาตุ 4) · แล้วแต่ทางเลือก: `web/app/journal/*` | หน้า `/macro` ใหม่ + `web/lib` อ่าน market-timing | `web/app/backtest/*`
**เป้า:** 4 ธาตุครบ — landing มี 4 element card ที่กดเข้าได้จริงทั้งหมด, เอา ghost "coming soon" ออก · สี Earth = อำพัน-บรอนซ์/โอลีฟ (เลี่ยงชนเขียวของ Air)

## 13. i18n เฟสถัดไป — panel/tool ที่ยังไม่ผูก global EN/TH

**ปัญหา:** ทำ global LanguageContext + toggle EN/TH (default EN, persist localStorage `srw-lang`) แล้ว และผูกครบ: Header/nav, Landing, DCA (page+card), Turbo (page+card), Catalyst hero/stats/badges, report page + simulator. **แต่ยังเหลือ component ที่มี string ไทย/อังกฤษ baked อยู่และยังไม่อ่าน `useLang()`** → พอสลับภาษา ส่วนพวกนี้ไม่เปลี่ยน
**ทำ:** เติม `const { lang } = useLang(); const th = lang === "th";` + ternary ในแต่ละตัว (ทุกตัวอยู่ใต้ `LanguageProvider` แล้ว เรียก hook ได้เลย):
  - `web/app/FactorRiskPanel.tsx` · `web/app/MarketTimingPanel.tsx` · `web/app/RankingChangeTable.tsx` · `web/app/CatalystCalendar.tsx` · `web/app/ThemeGroups.tsx` · `web/app/StockCard.tsx`
  - Tools: `web/app/backtest/BacktestContent.tsx` · `web/app/journal/JournalContent.tsx`
  - การ์ด Turbo บางจุด (TurboBar "Price → Moon") + DcaCard quality labels (Moat/Margin/FCF/Balance) ถ้าอยากแปลด้วย
**ไฟล์:** ตามรายการบน · pattern อ้างอิงจาก `web/app/Landing.tsx` / `web/app/dca/DcaContent.tsx`
**เป้า:** สลับ EN/TH แล้วทั้งเว็บเปลี่ยนครบ 100% ไม่เหลือ string ค้างภาษาเดียว

## 14. Journal API — public multi-user journal (NestJS + Postgres + Google OIDC)

**ปัญหา:** journal เป็น local-only (`fs` เขียน `private/journal.json`) — ใช้บน Vercel prod ไม่ได้เลย (filesystem read-only) และอยากเปิดให้คนอื่น login ด้วย Google แล้วมี journal ส่วนตัวของตัวเอง (private per-user, ไม่มี social/likes) · design คุยจบแล้ว 2026-07-04
**ทำ:** ตาม design doc — Phase 1: NestJS + Postgres บน Railway + Google OIDC (httpOnly cookie, same apex domain) + CRUD trades/exits + import journal เดิมเป็น user #1 · Phase 2: เปิด signup + PAT (Bearer) ให้ Claude scripts อ่าน/เขียน journal ผ่าน API + validator เขียนผล `trade_validations` ลง DB · Phase 3 (optional): sync reports → jsonb · **reports ยังอยู่ใน git เหมือนเดิม ไม่แตะ publish pipeline**
**ไฟล์:** `docs/architecture/journal-api.md` (spec เต็ม: schema, endpoints, hosting) · `web/lib/journal.ts` + `web/app/journal/*` (เลิก fs → เรียก API + login gate) · `web/lib/journal-types.ts` (map เป็น schema) · `scripts/fetch-backtest-prices.mjs` + analyze-journal skill (อ่านผ่าน `JOURNAL_API_URL`/`JOURNAL_API_TOKEN`) · repo ใหม่สำหรับ NestJS service
**เป้า:** `/journal` ใช้ได้บน prod — login Google แล้วเห็น/แก้ trade ของตัวเองเท่านั้น · scripts ทำงานผ่าน API แทนไฟล์ local · ค่า hosting ~$5–10/เดือน (Railway) · เกี่ยวพัน: ทำก่อน #12(ก) ถ้าเลือก journal เป็นธาตุ Earth · ประสานกับ #13 (JournalContent i18n) กันแก้ซ้ำ

---

## ยังไม่เลือกทำ (ไว้พิจารณาทีหลัง)
- **Earned category ranking + expectancy-based sizing** *(idea 5+9)* — ลบ sector priority (Tech→AI→Space) ให้ category ลอยขึ้น top ตาม hit-rate จริง + size ตาม expectancy (`hitRate × upside ÷ MAE`) **⚠️ ขึ้นกับ #9 มี sample พอก่อน** ไม่งั้น optimize บน noise — ต้องใส่ shrinkage/prior + cap อิทธิพลตอน N น้อย
- **Portfolio-level correlation view** — holding (AVGO/NVDA/MRVL/INTC/PLTR/ASTS) correlate สูง เด้งพร้อมกันตาม AI sentiment; view exposure/concentration/powder *(ทับซ้อนกับ #10 — อาจรวม)*
- **Price-trigger alerts** — ต่อ scheduled task + live price → alert "แตะ Entry 2 zone" / "ใกล้ stop" (pairs กับ analyze-journal skill)
- **Small-cap quota ใน /dashboard** — บังคับ ≥1 pick ที่ <$10B + แก้ scoring ให้ตอนไม่มี analyst target ใช้ scenario-implied upside แทนการให้ 0 (เลิกกดหุ้น coverage บาง)

---

## Ops setup (ทำบน Mac mini หลังย้าย project + เปลี่ยน account Claude)

- **ตั้ง scheduled task รัน `backtest:fetch` รายเช้า** — ให้ price-cache + path-cache สะสมอัตโนมัติ ไม่งั้น backtest/North Star/near-miss จะว่างตลอด *(network ในแซนด์บ็อกซ์ blocked — ต้องรันบนเครื่องจริงที่ต่อ Yahoo ได้)*
  - คำสั่ง: `cd web && npm run backtest:fetch` (หรือ `node scripts/fetch-backtest-prices.mjs` จาก root)
  - cron แนะนำ: ทุกเช้าหลังตลาดปิด 1 รอบ เช่น `0 6 * * *`
  - หมายเหตุ: ต้องตั้งบน account/เครื่องใหม่ (Mac mini) เพราะ schedule ผูกกับ session/เครื่อง
- **รัน `npm run build` ครั้งแรกบน Mac** — ยืนยัน production build ผ่าน (แซนด์บ็อกซ์รันไม่ได้เพราะ SWC binary เป็น linux/arm64 ไม่ตรง platform) tsc ผ่านแล้วทุกไฟล์

_Generated during code review · not financial advice · Stock Radar Research_
