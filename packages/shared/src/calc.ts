/** Defaults de probabilidade por estágio — espelham quote_stage_default_probability() no Postgres. */
export const STAGE_DEFAULT_PROBABILITY: Record<string, number> = {
  received: 15,
  in_analysis: 25,
  sent: 35,
  negotiation: 55,
  stalled: 20,
  won: 100,
  lost: 0,
  expired: 0,
}

export function effectiveProbability(stage: string, probability: number | null | undefined): number {
  if (probability != null) return probability
  return STAGE_DEFAULT_PROBABILITY[stage] ?? 25
}
