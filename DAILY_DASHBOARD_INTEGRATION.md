# StockPlaybook Research — Daily Top 10 Dashboard Integration

Drop this into your NestJS cowork project as reference. Everything needed to run the auto-discover daily dashboard.

---

## How It Works

```
NestJS cron fires at 7 AM
  → reads prompts/daily_dashboard.md
  → calls claude CLI with the prompt
  → Claude finds top 10 movers, researches each
  → saves watchlist_YYYYMMDD.html to stock-radar-weekly folder
```

One Claude call. One combined HTML dashboard. No fixed tickers needed.

---

## 1. Config — add `radarDir` and update `timeoutMs`

```typescript
// shared/config.ts
export const config = {
  claude: {
    claudeBin: '/path/to/claude',      // your existing value
    pluginDir:  '/path/to/plugin-dir', // your existing value
    tickers:    [],                    // keep for manual mode

    // ADD THIS
    radarDir: '/Users/nitiponchingthongchai/Documents/cowork/stock-radar-weekly',
  },
  cron: {
    schedule:  '0 7 * * 1-5',   // weekdays 7 AM
    timeZone:  'Asia/Bangkok',
    timeoutMs: 5 * 60 * 1000,   // 5 min — dashboard takes longer than single ticker
  },
};
```

---

## 2. CoworkService — replace with this

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../shared/config';

const execAsync = promisify(exec);

@Injectable()
export class CoworkService {
  private readonly logger = new Logger(CoworkService.name);
  private readonly logDir = path.join(process.cwd(), 'logs');
  private readonly radarDir = config.claude.radarDir;

  // AUTO-DISCOVER MODE — runs on cron, finds top 10 movers, generates dashboard
  @Cron(config.cron.schedule, { timeZone: config.cron.timeZone })
  async runDailyDashboard() {
    this.logger.log('Starting daily top-10 dashboard...');

    const promptFile = path.join(this.radarDir, 'prompts', 'daily_dashboard.md');
    let prompt: string;

    try {
      prompt = fs.readFileSync(promptFile, 'utf-8');
    } catch (err) {
      this.logger.error(`Cannot read prompt file: ${promptFile}`, err.message);
      return;
    }

    const cmd = [
      `"${config.claude.claudeBin}"`,
      `--plugin-dir "${config.claude.pluginDir}"`,
      `--add-dir "${config.claude.pluginDir}"`,
      `--dangerously-skip-permissions`,
      `-p ${JSON.stringify(prompt)}`,
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.radarDir,
        timeout: config.cron.timeoutMs,
        env: { ...process.env },
        maxBuffer: 10 * 1024 * 1024,
      });

      this.logger.log('Dashboard generated successfully.');
      this.writeLog('daily-dashboard', 'success', stdout);
      if (stderr) this.logger.warn('Claude stderr:', stderr);
    } catch (error) {
      this.logger.error('Dashboard failed:', error.message);
      this.writeLog('daily-dashboard', 'error', error.message);
    }
  }

  // FIXED TICKER MODE — call manually or bind to separate cron
  async runFixedTickerAnalysis() {
    const tickers: string[] = config.claude.tickers ?? [];
    if (!tickers.length) return;

    for (const ticker of tickers) {
      await this.analyzeTicker(ticker);
    }
  }

  private async analyzeTicker(ticker: string) {
    const cmd = [
      `"${config.claude.claudeBin}"`,
      `--plugin-dir "${config.claude.pluginDir}"`,
      `--add-dir "${config.claude.pluginDir}"`,
      `--dangerously-skip-permissions`,
      `-p "/analyze ${ticker}"`,
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.radarDir,
        timeout: config.cron.timeoutMs,
        env: { ...process.env },
        maxBuffer: 10 * 1024 * 1024,
      });
      this.writeLog(ticker, 'success', stdout);
      if (stderr) this.logger.warn(`${ticker} stderr:`, stderr);
    } catch (error) {
      this.logger.error(`${ticker} failed:`, error.message);
      this.writeLog(ticker, 'error', error.message);
    }
  }

  private writeLog(label: string, type: 'success' | 'error', content: string) {
    if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
    const date = new Date().toISOString().split('T')[0];
    const filepath = path.join(this.logDir, `${date}-${label}-${type}.log`);
    fs.appendFileSync(filepath, `[${new Date().toISOString()}]\n${content}\n\n`);
  }
}
```

---

## 3. Claude Prompt — save this file

Save the content below as:
```
/Users/nitiponchingthongchai/Documents/cowork/stock-radar-weekly/prompts/daily_dashboard.md
```

```markdown
You are StockPlaybook Research, an institutional-grade stock analysis assistant.

## Objective
Find today's top 10 stocks worth watching, analyze each, and generate a single combined HTML dashboard.

## Step 1 — Find Top 10 Movers
Search these URLs:
- https://finance.yahoo.com/markets/stocks/gainers/
- https://finviz.com/screener.ashx?v=111&s=ta_topgainers
- https://stockanalysis.com/stocks/market-movers/

Criteria: price > $5, market cap > $500M, price change > 2%, clear news catalyst.
Pick exactly 10 tickers across mixed sectors.

## Step 2 — Research Each Ticker
For each ticker fetch: current price + % change, 52-week range, key news headline (catalyst),
analyst consensus + price target, sector, P/E ratio.

## Step 3 — Fed/Macro Context
Check: current Fed rate stance (hawkish/neutral/dovish), rate hike probability from
https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html,
any FOMC/CPI/jobs data due this week, 10-year Treasury yield direction.

## Step 4 — Rate Each Ticker
Fed Risk (LOW / MEDIUM / HIGH based on sector rate sensitivity).
Verdict:
- 🟢 Core holding — strong setup, catalyst confirmed, Fed risk manageable
- 🟡 Speculative — opportunity exists but volatility is elevated
- 🔴 ค่าขนม — fun money only, short-term trade at best

## Step 5 — Generate Combined HTML Dashboard
Save to: /Users/nitiponchingthongchai/Documents/cowork/stock-radar-weekly/watchlist_YYYYMMDD.html

Design: dark theme (#0f172a bg, #1e293b cards, #10b981 green, #f59e0b yellow, #ef4444 red).
Layout:
1. Header — "StockPlaybook Research · Daily Top 10" + date
2. Macro summary box — Fed stance badge + context + key events this week
3. Scorecard table — Ticker | Price | % Change | Sector | Catalyst | Fed Risk | Verdict
4. Stock cards grid (2 columns) — one card per ticker with price, range, catalyst, analyst target, verdict
5. Sources — all URLs used
6. Footer — "Not financial advice · StockPlaybook Research · [date]"

Add hover animation on cards (scale + border glow). Fully self-contained HTML.

## Constraints
- Research FIRST, generate HTML AFTER
- Never fabricate prices or news
- Footer must always say: "Not financial advice · StockPlaybook Research"
```

---

## Output

Every weekday at 7 AM, a file is saved to:
```
stock-radar-weekly/watchlist_YYYYMMDD.html
```

Logs land in your NestJS project:
```
logs/YYYY-MM-DD-daily-dashboard-success.log
logs/YYYY-MM-DD-daily-dashboard-error.log
```
