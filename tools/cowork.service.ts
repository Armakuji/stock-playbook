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

  // Path to the XVARY Research workspace
  private readonly xvaryDir = config.claude.xvaryDir ??
    '/Users/nitiponchingthongchai/Documents/cowork/xvary-stock-research';

  // ─────────────────────────────────────────────
  // MODE A: Auto-discover top 10 movers (dashboard)
  // Triggered by cron — one Claude call, one HTML output
  // ─────────────────────────────────────────────
  @Cron(config.cron.schedule, { timeZone: config.cron.timeZone })
  async runDailyDashboard() {
    this.logger.log('Starting daily top-10 dashboard run...');

    // Read the self-contained prompt from the workspace
    const promptFile = path.join(this.xvaryDir, 'prompts', 'daily_dashboard.md');
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
      this.logger.log('Calling Claude — finding top 10 movers + generating dashboard...');

      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.xvaryDir,            // run from workspace so file saves land correctly
        timeout: config.cron.timeoutMs,
        env: { ...process.env },
        maxBuffer: 10 * 1024 * 1024,  // 10 MB — HTML output can be large
      });

      this.logger.log('Dashboard generated successfully.');
      this.writeLog('daily-dashboard', 'success', stdout);

      if (stderr) {
        this.logger.warn('Claude stderr:', stderr);
      }
    } catch (error) {
      this.logger.error('Dashboard run failed:', error.message);
      this.writeLog('daily-dashboard', 'error', error.message);
    }
  }

  // ─────────────────────────────────────────────
  // MODE B: Analyze a fixed list of tickers (original behavior)
  // Call manually or bind to a separate cron if needed
  // ─────────────────────────────────────────────
  async runFixedTickerAnalysis() {
    const tickers: string[] = config.claude.tickers ?? [];

    if (tickers.length === 0) {
      this.logger.warn('No tickers in config.claude.tickers — skipping fixed analysis.');
      return;
    }

    this.logger.log(`Starting fixed-ticker analysis for: ${tickers.join(', ')}`);

    for (const ticker of tickers) {
      await this.analyzeTicker(ticker);
    }

    this.logger.log('All tickers completed.');
  }

  private async analyzeTicker(ticker: string) {
    this.logger.log(`Analyzing ${ticker}...`);

    const cmd = [
      `"${config.claude.claudeBin}"`,
      `--plugin-dir "${config.claude.pluginDir}"`,
      `--add-dir "${config.claude.pluginDir}"`,
      `--dangerously-skip-permissions`,
      `-p "/analyze ${ticker}"`,
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.xvaryDir,
        timeout: config.cron.timeoutMs,
        env: { ...process.env },
        maxBuffer: 10 * 1024 * 1024,
      });

      this.logger.log(`${ticker} completed successfully`);
      this.writeLog(ticker, 'success', stdout);

      if (stderr) {
        this.logger.warn(`${ticker} stderr:`, stderr);
      }
    } catch (error) {
      this.logger.error(`${ticker} failed:`, error.message);
      this.writeLog(ticker, 'error', error.message);
    }
  }

  // ─────────────────────────────────────────────
  // Logging helper
  // ─────────────────────────────────────────────
  private writeLog(label: string, type: 'success' | 'error', content: string) {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}-${label}-${type}.log`;
    const filepath = path.join(this.logDir, filename);
    const entry = `[${new Date().toISOString()}]\n${content}\n\n`;

    fs.appendFileSync(filepath, entry);
  }
}
