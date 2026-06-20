import { StockReport, ReportTranslation } from "./types";

export type Lang = "en" | "th";

/**
 * Deep-merges i18n.th overrides onto the base EN report.
 * Returns a new report object with translated fields applied.
 * Non-translated fields remain in English.
 */
export function applyTranslation(report: StockReport, lang: Lang): StockReport {
  if (lang === "en" || !report.i18n?.th) return report;

  const t: ReportTranslation = report.i18n.th;

  return {
    ...report,
    summary: t.summary ?? report.summary,
    priceNote: t.priceNote ?? report.priceNote,
    scoreLabel: t.scoreLabel ?? report.scoreLabel,

    catalysts: report.catalysts.map((c, i) => ({
      ...c,
      name: t.catalysts?.[i]?.name ?? c.name,
      description: t.catalysts?.[i]?.description ?? c.description,
    })),

    risks: t.risks ?? report.risks,

    macroRisk: {
      ...report.macroRisk,
      rateOutlook: t.macroRisk?.rateOutlook ?? report.macroRisk.rateOutlook,
      inflationNote: t.macroRisk?.inflationNote ?? report.macroRisk.inflationNote,
      sectorImpact: t.macroRisk?.sectorImpact ?? report.macroRisk.sectorImpact,
      summary: t.macroRisk?.summary ?? report.macroRisk.summary,
    },

    entryStrategy: {
      ...report.entryStrategy,
      verdict: t.entryStrategy?.verdict ?? report.entryStrategy.verdict,
      entryLevels: report.entryStrategy.entryLevels.map((el, i) => ({
        ...el,
        note: t.entryStrategy?.entryLevels?.[i]?.note ?? el.note,
        timing: t.entryStrategy?.entryLevels?.[i]?.timing ?? el.timing,
      })),
      tp1: { ...report.entryStrategy.tp1, note: t.entryStrategy?.tp1?.note ?? report.entryStrategy.tp1.note },
      tp2: { ...report.entryStrategy.tp2, note: t.entryStrategy?.tp2?.note ?? report.entryStrategy.tp2.note },
      tp3: { ...report.entryStrategy.tp3, note: t.entryStrategy?.tp3?.note ?? report.entryStrategy.tp3.note },
      stopLoss: {
        ...report.entryStrategy.stopLoss,
        tightNote: t.entryStrategy?.stopLoss?.tightNote ?? report.entryStrategy.stopLoss.tightNote,
        hardNote: t.entryStrategy?.stopLoss?.hardNote ?? report.entryStrategy.stopLoss.hardNote,
        rrNote: t.entryStrategy?.stopLoss?.rrNote ?? report.entryStrategy.stopLoss.rrNote,
        rrWarning: t.entryStrategy?.stopLoss?.rrWarning ?? report.entryStrategy.stopLoss.rrWarning,
      },
    },

    estimateDates: report.estimateDates?.map((d, i) => ({
      ...d,
      event: t.estimateDates?.[i]?.event ?? d.event,
      note: t.estimateDates?.[i]?.note ?? d.note,
    })),
  };
}
