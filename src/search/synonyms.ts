/**
 * Static synonym map for search autocomplete expansion.
 *
 * Maps common abbreviations and short forms to their full equivalents.
 * Used by the Elasticsearch synonym token filter in index settings.
 */
export const SYNONYM_MAP: Record<string, string[]> = {
  sw: ['software'],
  sde: ['software engineer', 'software development engineer'],
  eng: ['engineer'],
  engr: ['engineer'],
  sr: ['senior'],
  jr: ['junior'],
  dev: ['developer'],
  devops: ['devops engineer'],
  pm: ['project manager', 'product manager'],
  ux: ['user experience'],
  ui: ['user interface'],
  fe: ['frontend', 'front-end'],
  be: ['backend', 'back-end'],
  fs: ['fullstack', 'full-stack'],
  ml: ['machine learning'],
  ai: ['artificial intelligence'],
  ds: ['data scientist', 'data science'],
  hr: ['human resources'],
  vp: ['vice president'],
  cto: ['chief technology officer'],
  ceo: ['chief executive officer'],
  cfo: ['chief financial officer'],
  cmo: ['chief marketing officer'],
};

/**
 * Build an Elasticsearch-compatible synonym list from the synonym map.
 * Each entry becomes a comma-separated mapping: "sw, software"
 */
export function buildSynonymList(): string[] {
  return Object.entries(SYNONYM_MAP).map(([abbr, expansions]) => {
    return `${abbr}, ${expansions.join(', ')}`;
  });
}
