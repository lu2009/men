const K=(e,t,o,a2)=>{const u2=Number(e);return Number.isFinite(u2)?Math.max(t,Math.min(o,Math.round(u2))):a2};
const u={headerFontSize:30,tableFontSize:15,amountFontSize:20,metaFontSize:18,declarationFontSize:15,orderDateFontSize:13};
const s={copies:1,widthMm:200,heightMm:140,orientation:"landscape"};
const dec=(i)=>(i===385?"landscape":i===659?"portrait":`<?${i}?>`);
const Z=(e)=>({headerFontSize:K(e?.["headerFontSize"],14,36,u["headerFontSize"]),
 tableFontSize:K(e?.["tableFontSize"],8,18,u["tableFontSize"]),
 amountFontSize:K(e?.["amountFontSize"],16,40,u.amountFontSize),
 metaFontSize:K(e?.metaFontSize,8,18,u["metaFontSize"]),
 declarationFontSize:K(e?.["declarationFontSize"],8,18,u["declarationFontSize"]),
 orderDateFontSize:K(e?.["orderDateFontSize"],8,18,u["orderDateFontSize"])});
const X=(e)=>{const o=K(e?.["copies"],1,99,s["copies"]),a2=K(e?.["widthMm"],50,500,s["widthMm"]),
 n=K(e?.["heightMm"],50,500,s["heightMm"]),u2=dec(a2>=n?385:659);
 return {copies:o,widthMm:a2,heightMm:n,orientation:(e?.["orientation"]==="landscape"||e?.["orientation"]==="portrait")?e.orientation:u2}};
const j=JSON.stringify;
console.log("== JSON 里显式写 null 的字段（真实可达路径：手改 localStorage）==");
console.log('  Z({headerFontSize:null})      =', j(Z({headerFontSize:null})));
console.log('  Z({tableFontSize:null})       =', j(Z({tableFontSize:null})));
console.log('  Z({amountFontSize:null})      =', j(Z({amountFontSize:null})));
console.log('  Z({headerFontSize:"24"})      =', j(Z({headerFontSize:"24"})));
console.log('  Z({headerFontSize:[]})        =', j(Z({headerFontSize:[]})));
console.log('  Z({headerFontSize:[20]})      =', j(Z({headerFontSize:[20]})));
console.log('  Z({headerFontSize:true})      =', j(Z({headerFontSize:true})));
console.log('  Z({headerFontSize:false})     =', j(Z({headerFontSize:false})));
console.log("== X 的 null ==");
console.log('  X({copies:null})              =', j(X({copies:null})));
console.log('  X({widthMm:null,heightMm:null,orientation:null}) =', j(X({widthMm:null,heightMm:null,orientation:null})));
console.log('  X({orientation:"LANDSCAPE"})  =', j(X({orientation:"LANDSCAPE"})));
console.log('  X({orientation:""})           =', j(X({orientation:""})));
console.log("== Math.round 半值方向（负数）==");
for (const v of [0.5,-0.5,1.5,2.5,-1.5,-2.5,13.5,14.5]) console.log(`  K(${v}, 8, 18, 15) =`, K(v,8,18,15));
console.log("== 对照：JSON.stringify(null 字段) 会不会保留 ==");
console.log('  ', j(Z({headerFontSize:null})), '<- 注意 headerFontSize 变成 14 而不是默认 30');
