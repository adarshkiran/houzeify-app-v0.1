import type { ConstructionLevel, EstimateLine, EstimateLineCategory } from "./models"
import type { CommandContext } from "./ports"

const CATALOG_EFFECTIVE_DATE = "2026-09-01T00:00:00.000Z"
const CATALOG_SOURCE = "Houzeify regional rate card"
const CONTINGENCY_SOURCE = "Houzeify policy — 5% contingency"
const CONTINGENCY_RATE = 0.05

/** Unit rate per construction level. Illustrative placeholders, not market data. */
const RATE_CARD = {
  cement: { basic: 350, standard: 380, premium: 420 }, // ₹ per bag
  steel: { basic: 62000, standard: 70000, premium: 78000 }, // ₹ per MT
  blocks: { basic: 60, standard: 70, premium: 85 }, // ₹ per block
  mason: { basic: 850, standard: 950, premium: 1100 }, // ₹ per day
  helper: { basic: 550, standard: 600, premium: 680 }, // ₹ per day
  finishing: { basic: 180, standard: 234, premium: 320 }, // ₹ per sq ft
} as const

/** Quantity consumed per sq ft of built-up area. */
const QTY_PER_SQFT = {
  cement: 0.93, // bags
  steel: 0.006, // MT
  blocks: 3.6, // blocks
  mason: 0.27, // days
  helper: 0.35, // days
}

function catalogLine(
  ctx: CommandContext,
  category: EstimateLineCategory,
  item: string,
  quantity: number,
  unit: string,
  rate: number,
  confidence: EstimateLine["confidence"],
): EstimateLine {
  return {
    id: ctx.ids.next("estimate-line"),
    category,
    item,
    quantity,
    unit,
    rate,
    amount: quantity * rate,
    source: CATALOG_SOURCE,
    effectiveDate: CATALOG_EFFECTIVE_DATE,
    confidence,
  }
}

export function buildCatalogLines(ctx: CommandContext, area: number, level: ConstructionLevel): EstimateLine[] {
  const steelQty = Math.max(0.1, Math.round(QTY_PER_SQFT.steel * area * 10) / 10)
  const body: EstimateLine[] = [
    catalogLine(ctx, "materials", "Cement (OPC 53 Grade)", Math.max(1, Math.round(QTY_PER_SQFT.cement * area)), "bags", RATE_CARD.cement[level], "medium"),
    catalogLine(ctx, "materials", "TMT Steel (Fe 500)", steelQty, "MT", RATE_CARD.steel[level], "medium"),
    catalogLine(ctx, "materials", "AAC Blocks", Math.max(1, Math.round(QTY_PER_SQFT.blocks * area)), "blocks", RATE_CARD.blocks[level], "medium"),
    catalogLine(ctx, "labour", "Mason (skilled)", Math.max(1, Math.round(QTY_PER_SQFT.mason * area)), "days", RATE_CARD.mason[level], "medium"),
    catalogLine(ctx, "labour", "Helper (unskilled)", Math.max(1, Math.round(QTY_PER_SQFT.helper * area)), "days", RATE_CARD.helper[level], "medium"),
    catalogLine(ctx, "finishing", "Finishing works (flooring, painting, fixtures)", area, "sqft", RATE_CARD.finishing[level], "medium"),
  ]
  const subtotal = body.reduce((sum, l) => sum + l.amount, 0)
  const contingency: EstimateLine = {
    id: ctx.ids.next("estimate-line"),
    category: "contingency",
    item: "Contingency (5% policy buffer)",
    quantity: 1,
    unit: "lump sum",
    rate: subtotal * CONTINGENCY_RATE,
    amount: subtotal * CONTINGENCY_RATE,
    source: CONTINGENCY_SOURCE,
    effectiveDate: CATALOG_EFFECTIVE_DATE,
    confidence: "high",
  }
  return [...body, contingency]
}
