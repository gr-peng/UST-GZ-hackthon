// Shared calendar for the synthetic App, its forms and scheduled examples.
// Historical statements and sourced market data retain their original dates.
export const STORY_DATE='2026-11-15';
export const STORY_DATE_LABEL=STORY_DATE.replaceAll('-','.');
export const STORY_WEEKDAY=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',weekday:'long'}).format(new Date(STORY_DATE+'T09:00:00+08:00'));
export const DEMO_START_AT=STORY_DATE+'T01:00:00.000Z';
export const RENT_DUE_DATE='2026-11-16';
export const RIDE_DATE='2026-11-21';
export const BIRTHDAY_DATE='2026-11-18';
export const BIRTHDAY_CLOCK_AT=BIRTHDAY_DATE+'T05:14:00Z';
