export const CONNECTED_TOOLS=Object.freeze([
 {id:'meituan',name:'订餐软件',image:'assets/tools/meituan.svg',capabilities:['预订餐厅与查询订单','安排蛋糕和用餐时间'],example:'帮我安排生日晚餐和蛋糕。'},
 {id:'didi',name:'打车软件',image:'assets/tools/didi.png',capabilities:['预约出行并核对上下车地点','设置出发时间与车费上限'],example:'帮我约一辆周六上午回家的车。'},
 {id:'gmail',name:'邮箱',image:'assets/tools/gmail.svg',capabilities:['接收房租和账单提醒','提取到期日期与待核对金额'],example:'看看房东发来的房租邮件。'},
 {id:'payment',name:'支付工具',icon:'card',capabilities:['查询账户与准备付款','核对收款人和金额，完成授权后执行'],example:'从生活账户支付这次蛋糕定金。'},
 {id:'contacts',name:'通讯录',icon:'user',capabilities:['查询已保存的联系人','核对姓名、电话和收款对象'],example:'核对蛋糕店陈老板的联系方式。'},
 {id:'calendar',name:'日程工具',icon:'calendar',capabilities:['保存提醒和定时安排','跟进生日、还款与出发时间'],example:'生日当天 13:14 提醒并按授权转账。'},
]);

export function taskWorkspaceTabs(active){
 return `<nav class="task-workspace-tabs" aria-label="任务与工具">${[['tasks','我的任务'],['tools','已接入工具']].map(([id,label])=>`<a href="#/bot/${id}" ${active===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}

export function renderConnectedTools({esc,icon}){
 return `<p class="connected-tools-intro">这些工具可以交给 Bot 协调使用，涉及付款时按你的授权执行。</p><div class="connected-tools-grid">${CONNECTED_TOOLS.map(tool=>`<button type="button" class="card connected-tool" data-action="connected-tool" data-tool="${tool.id}"><span class="connected-tool-icon ${tool.id}">${tool.image?`<img src="${tool.image}" alt="${esc(tool.name)}图标">`:icon(tool.icon)}</span><strong>${esc(tool.name)}</strong><span class="connected-tool-status"><i></i>已接入</span></button>`).join('')}</div>`;
}
