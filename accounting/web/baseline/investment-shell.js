import {PRODUCT_VISIBILITY} from '../product-visibility.mjs';
const sections = [['investment','个人持仓'],['holdings','银行理财'],['research','投资研究']];

export function investmentNavigation(active) {
  const visible=sections.filter(([route])=>route!=='holdings'||PRODUCT_VISIBILITY.bankWealthPage);
  return `<nav id="investment-sections" class="investment-sections segmented glass" aria-label="投资模块" style="grid-template-columns:repeat(${visible.length},minmax(0,1fr))">${visible.map(([route,label])=>`<button type="button" data-action="investment-section" data-value="${route}" ${route===active?'aria-current="page"':''}>${label}</button>`).join('')}</nav>`;
}
