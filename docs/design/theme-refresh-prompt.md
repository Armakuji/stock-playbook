# Playbook Theme Refresh — prompt สำหรับ Claude Design (ยังไม่ได้รัน)

> สถานะ: รอรัน (usage limit ใกล้เต็ม 2026-07-05) · แนบ screenshot หน้าเว็บปัจจุบัน
> 3–4 หน้าไปด้วย (landing, /catalyst, /report, /journal) จะได้ผลดีขึ้นมาก
> ผลลัพธ์ที่ต้องได้กลับมา: `docs/design/playbook-theme-handoff.md` → ส่งต่อ Claude CLI implement

## Prompt (paste ให้ Claude Design)

```
เราเพิ่ง rebrand จาก "Stock Radar Weekly" → "StockPlaybook" (stockplaybook.app)
แต่ visual identity ยังเป็น "radar" อยู่ทั้งหมด — ช่วยออกแบบ theme refresh
ให้เป็น "playbook" identity แล้วทำ design handoff spec เพราะคุณแก้โค้ดไม่ได้
— ต้องส่ง handoff ให้ Claude CLI เป็นคน implement

## Context
- Product: stock analysis + trade journal · dark theme ทั้งเว็บ
- Concept ใหม่ "Playbook" = แผนการเล่น/สมุด strategy (sport playbook):
  ทุก report คือ "play" ที่มี entry/TP/SL ชัดเจน, journal วัด plan adherence
- Concept เก่า "Radar" = การสแกน/กวาดหา — logo ⬡, จุด pulse เขียว ๆ,
  ชื่อ component อย่าง MarketTicker ยังสื่อ scanning

## สิ่งที่ต้องออกแบบ
1. Logo/wordmark "StockPlaybook" + icon (ต้องได้เป็น SVG code ใน handoff
   เพื่อให้ CLI วางแทน icon.svg/favicon ได้เลย) — คิด motif จาก playbook:
   play diagram (X-O-เส้นลูกศร tactical), สมุด, chalkboard lines ฯลฯ
2. Design tokens: palette (พื้นหลัง dark คงไว้ + accent ใหม่ถ้าเหมาะ),
   typography scale, spacing, radius — เป็น CSS variables
3. Motif/background: ตอนนี้มี dot grid — เสนอ evolution ที่สื่อ playbook
   (เช่น tactical line pattern จาง ๆ) แบบไม่รก
4. Header + landing hero refresh ให้รับ identity ใหม่
5. Social preview / OG image (1200x630) — ไฟล์เดิมเสีย ต้อง spec ใหม่ทั้งใบ

## Constraints (ห้ามแตะ)
- Dark theme คงเดิมเป็นหลัก
- สี verdict เป็น semantic ห้ามเปลี่ยน: 🟢 #10b981 BUY · 🟡 #f59e0b HOLD ·
  🔴 #ef4444 SELL · 🟣 #8b5cf6 SPECULATIVE
- ธีม 4 ธาตุของ navigation คงไว้ (💧 DCA · 🌬️ Catalyst · 🔥 Turbo · 🌍 Earth
  coming soon) — เป็น feature identity ไม่ใช่ brand identity
- รองรับ EN/TH · mobile-first (มี user ใช้จอ 390px จริง)
- เป็น incremental refresh ไม่ใช่ redesign ทั้งเว็บ — component structure เดิม

## Deliverable: Design Handoff (สำคัญที่สุด)
ใช้ design-handoff skill ทำ spec ที่ engineer implement ได้โดยไม่เห็นภาพ:
- CSS variables ครบ (ค่าเก่า → ค่าใหม่ ระบุไฟล์ globals.css)
- SVG code เต็มของ logo/icon ทุก variant (header, favicon, OG)
- รายการแก้ per-component: ไฟล์ไหน แก้อะไร ค่าอะไร (before → after)
- OG image spec ละเอียดพอที่ CLI จะ gen ด้วยโค้ด (layout, text, สี, ฟอนต์)
- ลำดับ implement + วิธี verify แต่ละขั้น
บันทึกเป็นไฟล์เดียว: docs/design/playbook-theme-handoff.md
```

## Prompt ต่อให้ Claude CLI (หลังได้ handoff)

```
Implement theme refresh ตาม docs/design/playbook-theme-handoff.md ทีละ section
ตามลำดับใน spec · commit แยกต่อ section · เช็ค mobile 390px + EN/TH ทุกจุด ·
screenshot เทียบก่อน/หลังให้ดูตอนจบ
```

## หมายเหตุ
- **ไม่ rename** component radar-era (MarketTicker ฯลฯ) ในรอบ theme — แยกเป็น
  housekeeping ทีหลัง กัน diff ปนกัน
- social-preview.png เดิมไฟล์เสีย (ไบต์เกินก่อน PNG signature) — ต้อง gen ใหม่อยู่แล้ว
