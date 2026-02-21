"use strict";(()=>{var t={};t.id=837,t.ids=[837],t.modules={399:t=>{t.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:t=>{t.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},8678:t=>{t.exports=import("pg")},1559:(t,e,r)=>{r.a(t,async(t,o)=>{try{r.r(e),r.d(e,{originalPathname:()=>A,patchFetch:()=>p,requestAsyncStorage:()=>E,routeModule:()=>u,serverHooks:()=>m,staticGenerationAsyncStorage:()=>l});var a=r(9303),n=r(8716),i=r(670),s=r(4733),d=t([s]);s=(d.then?(await d)():d)[0];let u=new a.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/reports/monthly/route",pathname:"/api/reports/monthly",filename:"route",bundlePath:"app/api/reports/monthly/route"},resolvedPagePath:"/Users/eaintmyatthu/AsspumptionUniversity/Database System/Project/Restaurant Management App/backend/src/app/api/reports/monthly/route.js",nextConfigOutput:"",userland:s}),{requestAsyncStorage:E,staticGenerationAsyncStorage:l,serverHooks:m}=u,A="/api/reports/monthly/route";function p(){return(0,i.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:l})}o()}catch(t){o(t)}})},9303:(t,e,r)=>{t.exports=r(517)},4733:(t,e,r)=>{r.a(t,async(t,o)=>{try{r.r(e),r.d(e,{GET:()=>s,OPTIONS:()=>d});var a=r(9248),n=r(6222),i=t([a]);a=(i.then?(await i)():i)[0];let p=t=>(Array.isArray(t)?t:[]).map(t=>({month:t?.month||"",orders:Number(t?.orders||0),revenue:Number(t?.revenue||0)}));async function s(){try{let t=await (0,a.I)(`WITH item_totals AS (
         SELECT oi.order_id, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS subtotal
         FROM order_item oi
         GROUP BY oi.order_id
       ),
       paid_orders AS (
         SELECT
           o.order_id,
           DATE_TRUNC('month', COALESCE(p.pay_time, o.order_time)) AS month_start,
           COALESCE(NULLIF(p.amount, 0), it.subtotal, 0) + COALESCE(p.tax, 0) - COALESCE(p.discount, 0) AS total_amount
         FROM orders o
         LEFT JOIN payment p ON p.order_id = o.order_id
         LEFT JOIN item_totals it ON it.order_id = o.order_id
         WHERE
           LOWER(COALESCE(p.payment_status, '')) = 'paid'
           OR (p.order_id IS NULL AND LOWER(COALESCE(o.status, '')) = 'paid')
       )
       SELECT
         TRIM(TO_CHAR(month_start, 'Mon YYYY')) AS month,
         COUNT(*)::int AS orders,
         COALESCE(SUM(total_amount), 0)::float8 AS revenue
       FROM paid_orders
       GROUP BY month_start
       ORDER BY month_start ASC`);return(0,n.o)(Response.json(p(t.rows)))}catch(t){console.error("GET /api/reports/monthly primary query failed",t);try{let t=await (0,a.I)(`WITH item_totals AS (
           SELECT oi.order_id, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS subtotal
           FROM order_item oi
           GROUP BY oi.order_id
         )
         SELECT
           TRIM(TO_CHAR(DATE_TRUNC('month', o.order_time), 'Mon YYYY')) AS month,
           COUNT(*)::int AS orders,
           COALESCE(SUM(COALESCE(it.subtotal, 0)), 0)::float8 AS revenue
         FROM orders o
         LEFT JOIN item_totals it ON it.order_id = o.order_id
         WHERE LOWER(COALESCE(o.status, '')) = 'paid'
         GROUP BY DATE_TRUNC('month', o.order_time)
         ORDER BY DATE_TRUNC('month', o.order_time) ASC`);return(0,n.o)(Response.json(p(t.rows)))}catch(t){return console.error("GET /api/reports/monthly fallback query failed",t),(0,n.o)(Response.json([]))}}}async function d(){return(0,n.c)()}o()}catch(t){o(t)}})},6222:(t,e,r)=>{r.d(e,{c:()=>n,o:()=>a});let o={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"},a=t=>(Object.entries(o).forEach(([e,r])=>{t.headers.set(e,r)}),t),n=()=>new Response(null,{status:204,headers:o})},9248:(t,e,r)=>{r.a(t,async(t,o)=>{try{r.d(e,{I:()=>s});var a=r(8678),n=t([a]);let i=new(a=(n.then?(await n)():n)[0]).Pool({connectionString:process.env.DATABASE_URL}),s=(t,e)=>i.query(t,e);o()}catch(t){o(t)}})}};var e=require("../../../../webpack-runtime.js");e.C(t);var r=t=>e(e.s=t),o=e.X(0,[948],()=>r(1559));module.exports=o})();