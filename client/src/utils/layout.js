// Watch browsers lay pages out at most about 320px wide and under 400px tall
// (an Apple Watch Series 12, 46mm, reports 320x382). Phones that narrow, such
// as the many Android phones that are 360px wide, are far taller, so the
// height check keeps them on the regular layout and its navigation buttons.
export const WATCH_SCREEN_QUERY = '(max-width:360px) and (max-height:420px)';
