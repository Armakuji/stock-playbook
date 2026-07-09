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

## 12. ธาตุที่ 4 🌍 Earth — Rare Earth Elements, Precious Metals

**ปัญหา:** landing มี 4 ธาตุ (💧 DCA · 🌬️ Catalyst · 🔥 Turbo · 🌍 Earth) แต่ Earth ยังเป็น ghost card — ต้องตัดสิน thesis lane ให้ชัดก่อน build feature จริง
**ทำ (เคาะแล้ว 2026-07-06):** **Earth = Rare Earth Elements, Precious Metals** — REE / critical minerals / gold-silver plays (เช่น MP, USAR, NB, CRML) · ไม่ใช่ journal / macro / backtest · ตอนนี้ card ปิด (ghost) บน landing พร้อม description แล้ว (`web/app/Landing.tsx` tagline EN/TH)
  **รอ build:** screen criteria + หน้า dashboard ใหม่ (เช่น `/earth`) + data dir + skill/command (เทียบ `/catalyst`, `/turbo`, `/dca`) → ปลดล็อก tile จาก ghost→active
**ไฟล์:** `web/app/Landing.tsx` (description ✅) · หน้าใหม่ `web/app/earth/*` · `web/data/earth/` (หรือชื่อที่เทียบเท่า) · skill ใหม่ · `web/app/layout.tsx` (nav ธาตุ 4 เมื่อเปิด)
**เป้า:** Earth card กดเข้าได้ · โฟกัส REE + precious metals · สี Earth = อำพัน-บรอนซ์/โอลีฟ (เลี่ยงชนเขียวของ Air)

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

## 16. Journal API — 5 minor items ที่ defer จาก Phase 1 final review (PR #29)

**ปัญหา:** final review ของ Phase 1 พบ 5 จุด minor ที่ตั้งใจไม่ fix ตอนนั้น (ไม่ block การใช้งาน) — จดไว้ให้คนที่ทำ Phase 2 / polish รอบหน้าเก็บ
**ทำ:**
  1. ✅ DONE (ทำพร้อม #17) — subtitle เก่าอ้าง "private/journal.json" ค้างอยู่ — แก้เป็น "{n} trades" เฉย ๆ
  2. `addExit` ไม่มี server-side over-exit guard — client กันอยู่ฝั่งเดียว ยิง API ตรงขาย shares เกินที่ถือได้ (เพิ่ม validation ใน service)
  3. POST `/trades` ด้วย client-chosen id ที่ชนกัน → 500 ไม่ใช่ 409 (จับ Prisma P2002 → ConflictException)
  4. `apiLogout` ไม่ใช้ shared `readError` convention — ตอนนี้ logout อยู่ใน `web/lib/auth-client.ts` แล้ว (ย้ายจาก JournalContent เป็นส่วนหนึ่งของ #17) แต่ยังไม่ได้ปรับให้ใช้ readError convention
  5. ✅ DONE (ทำพร้อม #17) — `AuthService.backfillProfile` เติม `name`/`avatarUrl` ให้ user ที่มีอยู่แล้ว (ทั้ง identity-linked และ email-linked) เมื่อค่ายังว่างและ Google profile มีให้ — ไม่ทับค่าที่มีอยู่แล้ว
**ไฟล์:** `web/app/journal/JournalContent.tsx` · `service/src/trades/*` (exit guard, 409) · `web/lib/auth-client.ts` (apiLogout/readError) · `service/src/auth/auth.service.ts` (backfill, ✅ done)
**เป้า:** เก็บครบ 5 จุด (2 เหลือ 3 ข้อ: #2, #3, #4) · จุดสำคัญสุดคือข้อ 2 (server ต้องไม่เชื่อ client) ควรทำก่อนเปิด public signup (Phase 2)

## 17. ✅ DONE — Journal UI — auth-aware header (avatar/login/logout) + ลบ PRIVATE badge

**ปัญหา:** login แล้วไม่มีอะไรบอกว่าใคร login อยู่ · ปุ่ม Logout ลอยอยู่ข้าง "+ Log Trade" ผิดที่ · ไม่มีปุ่ม Login บน header (ต้องเข้า /journal ก่อนถึงเจอ) · badge "🔒 PRIVATE — local only" + subtitle "private/journal.json · never committed to git" ยังโชว์อยู่ทั้งที่เป็น API/DB แล้ว (ทับกับ #16 ข้อ 1)
**ทำ:** (1) Header แสดง avatar + name จาก `GET /auth/me` (fallback = ตัวอักษรแรกของ email/name) — เพิ่ม `avatarUrl` ใน response ของ `/auth/me` (2) กด avatar → dropdown (click-outside ปิดเอง) → Logout ผ่าน `web/lib/auth-client.ts` (ย้ายจากปุ่มเดิมข้าง "+ Log Trade") (3) ยังไม่ login → ปุ่ม "Login" บน header ทุกหน้า (desktop + mobile) → `GET /auth/google?returnTo=<current path>` → เก็บใน cookie `oauth_return_to` (validate เป็น same-origin relative path เท่านั้น กัน open-redirect — มี unit test แยก `safe-return-path.spec.ts`) → callback redirect กลับหน้าเดิมแทนที่จะ hardcode `/journal` (4) ลบ PRIVATE badge + แก้ subtitle เป็น "{n} trades" เฉย ๆ · พ่วง backlog #16 ข้อ 5 (backfill name/avatarUrl) เพราะ header ต้องมีข้อมูลจริงให้แสดง
**ไฟล์:** `web/app/Header.tsx` (AuthWidget: avatar/dropdown/login, desktop+mobile) · `web/lib/auth-client.ts` (ใหม่ — fetchCurrentUser/logout/loginUrl ใช้ร่วมกับ JournalContent) · `web/app/journal/JournalContent.tsx` (ลบ badge + ปุ่ม logout เดิม + apiLogout) · `service/src/auth/auth.controller.ts` (returnTo cookie flow, avatarUrl ใน /me) · `service/src/auth/safe-return-path.ts` (ใหม่) · `service/src/auth/auth.service.ts` (backfillProfile)
**เป้า:** เปิดหน้าไหนก็รู้สถานะ login ✓ · logout อยู่ใต้ avatar dropdown ตาม convention ปกติ ✓ · ไม่มีร่องรอย "local only" เหลือ ✓ · login จากหน้าไหนก็กลับมาหน้านั้น ✓ · tests: 29/29 service unit tests ผ่าน (รวม 3 test ใหม่สำหรับ backfill + 6 test ใหม่สำหรับ safe-return-path) · tsc --noEmit ผ่านทั้ง service/web

## 18. Playbook theme refresh — visual identity ยังเป็น radar อยู่ ⭐ ทำก่อนตัวอื่น

> **Priority note (2026-07-06):** เว็บติด Google อันดับ 1 แล้วแต่ favicon ยังไม่ขึ้น (Google
> crawl favicon ตามหลัง 2–7 วัน) — ถ้าทำ #18 ให้เสร็จก่อน Google cache ตัว ⬡ เก่า
> จะได้ icon ใหม่ของ Stock Playbook ขึ้นในผล search เลย ไม่ต้องรอ re-cache อีกรอบ
> (cache favicon ของ Google อัปเดตช้ามาก) · ลำดับคุ้มสุด: **#18 → #19 (sitemap+JSON-LD)**
> แล้วรอ Google เก็บภาพชุดใหม่ทีเดียว · สถานะ: รอ usage limit reset (พฤ.) แล้วเริ่ม

**ปัญหา:** rebrand ชื่อเป็น StockPlaybook แล้ว (#15 ✅) แต่ visual ยังเป็น radar-era ทั้งหมด: logo ⬡, favicon/icon.svg, จุด pulse, dot grid background, social-preview.png (ไฟล์เสียด้วย — ไบต์เกินก่อน PNG signature) — แบรนด์กับหน้าตาไม่ตรงกัน
**ทำ:** 2 เฟส — (1) รัน prompt ใน `docs/design/theme-refresh-prompt.md` กับ Claude Design (แนบ screenshot landing/catalyst/report/journal) → ได้ `docs/design/playbook-theme-handoff.md` (2) ส่ง handoff ให้ Claude CLI implement ทีละ section (มี prompt ต่อให้ CLI ในไฟล์เดียวกัน) · ห้าม rename component radar-era (MarketTicker ฯลฯ) ในรอบนี้ — แยก housekeeping ทีหลัง · **wordmark:** display copy คือ **"Stock Playbook"** สองคำ (มี space — เปลี่ยนจาก "StockPlaybook" ตัวติดกันเดิม 2026-07-06) ใน `web/app/Header.tsx` / `web/app/Landing.tsx` / `layout.tsx` title แล้ว — ให้ Claude Design ออกแบบโลโก้/OG image ตรงกับ wordmark สองคำนี้ (ส่วน domain `stockplaybook.app`, repo `stock-playbook`, User-Agent `stockplaybook/1.0` ยังคงเป็นตัวติดกันเหมือนเดิม — เป็น identifier ไม่ใช่ display copy)
**ไฟล์:** `docs/design/theme-refresh-prompt.md` (prompt พร้อมใช้) · เป้าหมายแก้: `web/app/globals.css` (tokens), `web/app/icon.svg` + favicon, `web/app/Header.tsx`, `web/app/Landing.tsx`, `assets/social-preview.png` (gen ใหม่), layout OG metadata
**เป้า:** identity "playbook" ครบทุกจุด (logo/motif/OG) · dark theme + สี verdict + ธีม 4 ธาตุคงเดิม · mobile 390px + EN/TH ไม่พัง

## 19. Improve SEO — search Google แล้วหาเว็บไม่เจอ

**ปัญหา:** stockplaybook.app ยังไม่ติด Google index เลย — ส่วนหนึ่งเพราะโดเมนใหม่มาก (เพิ่งซื้อ) แต่ฝั่งเว็บก็ยังไม่มีโครง SEO พื้นฐาน: ไม่มี sitemap/robots, metadata ต่อหน้าอาจไม่ครบ, ไม่มี structured data, ยังไม่ได้ submit Search Console
**ทำ:** (1) **โค้ด** — App Router: เพิ่ม `web/app/sitemap.ts` (gen จากรายการ report/หน้า static ทั้งหมด) + `web/app/robots.ts` · เช็ค `generateMetadata` ทุกหน้า: title/description เฉพาะหน้า (โดยเฉพาะ `/report/[ticker]` — title แบบ "NVDA — StockPlaybook: entry, targets, catalyst"), canonical URL, OG/Twitter tags (รอ OG image จาก #18) · เพิ่ม JSON-LD structured data ที่เหมาะ (WebSite + Article ต่อ report) · ห้าม index หน้า auth-only (`/journal` → noindex) (2) **Manual (คนทำ)** — Google Search Console: verify domain (DNS TXT) → submit sitemap → ขอ index หน้าแรก · Bing Webmaster ด้วยก็ได้ฟรี (3) รอ — โดเมนใหม่ใช้เวลา index เป็นสัปดาห์ต่อให้ทำครบ อย่าตกใจ
**ไฟล์:** `web/app/layout.tsx` (metadata กลาง) · `web/app/sitemap.ts` + `web/app/robots.ts` (ใหม่) · `web/app/report/[ticker]/page.tsx` + หน้า catalyst/dca/turbo/backtest (generateMetadata) · `web/lib/reports.ts` (list ticker สำหรับ sitemap)
**เป้า:** search "StockPlaybook" / "stockplaybook.app" เจอเว็บใน Google · ทุก report page มี title/description/OG เฉพาะตัว · Search Console เห็น sitemap ครบ ไม่มี coverage error · เกี่ยวพัน: OG image รอ #18 (theme) — ทำ SEO โครงก่อนได้เลยไม่ต้องรอ

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

## 23. Dashboard card pixel-tuning — DcaCard/TurboCard gauge/chip/bar vs. mockup

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
**ไฟล์:** `web/app/dca/DcaCard.tsx`, `web/app/turbo/TurboCard.tsx`, `web/app/globals.css`
**เป้า:** gauge/chip/bar สีและขนาดตรงกับ `design_handoff_stock_playbook/Stock Playbook Dashboard.dc.html` แบบ pixel-level — ไม่กระทบ radar-card/radar-ring ที่ถูกต้องอยู่แล้ว

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

_Generated during code review · not financial advice · Stock Playbook Research_
