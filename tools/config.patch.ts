// Add this field to your existing config (shared/config.ts)
// under the `claude` section:

export const config = {
  claude: {
    claudeBin:  '/path/to/claude',      // already in your config
    pluginDir:  '/path/to/plugin-dir',  // already in your config
    tickers:    [],                     // already in your config (keep for Mode B)

    // ✅ ADD THIS — path to StockPlaybook Research workspace
    radarDir: '/Users/nitiponchingthongchai/Documents/cowork/stock-radar-weekly',
  },
  cron: {
    schedule:  '0 7 * * 1-5',  // weekdays at 7 AM  (change to your timezone cron)
    timeZone:  'Asia/Bangkok',  // adjust to your timezone
    timeoutMs: 5 * 60 * 1000,  // 5 min — dashboard takes longer than single-ticker
  },
};
