// Presentation switches. Tools, data, authorization and execution stay intact.
export const PRODUCT_VISIBILITY=Object.freeze({
 cardApplications:false,
 creditLimitAdjustment:false,
 bankWealthPage:false,
 accountActivity:false,
 researchHistory:false,
 researchQuoteEntry:false,
 connectedAccounts:false,
});

export function visibleInvestmentView(view){
 return !PRODUCT_VISIBILITY.bankWealthPage&&view==='wealth'?'research':view;
}
