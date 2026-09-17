// 一次性实证脚本：把 Receipt2.deobfuscated.js 里的纯函数原样搬过来跑。
// 行号对应 /Users/aaa/Desktop/door-main/legacy/js/Receipt2.deobfuscated.js
// 注：原文件里 `l` 是解码器别名；产物中绝大多数调用已内联成字面量，
//     唯一真正调用解码器的地方是 L295 `t(a >= n ? 385 : 659)`，这里用 dec() 还原。

const dec = (i) => (i === 385 ? "landscape" : i === 659 ? "portrait" : `<?${i}?>`);

// ---- L11 列宽默认（不是 X 坐标）----
const a = [13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5];

// ---- L13-20 字号默认 u ----
const u = {
  headerFontSize: 30,
  tableFontSize: 15,
  amountFontSize: 20,
  metaFontSize: 18,
  declarationFontSize: 15,
  orderDateFontSize: 13,
};

// ---- L21 品牌默认 r ----
const r = { enabled: !1, name: "" };

// ---- L24 打印设置默认 s ----
const s = { copies: 1, widthMm: 200, heightMm: 140, orientation: "landscape" };

// ---- L25-50 纸型预设 d ----
const d = {
  "pin-210-140": { widthMm: 210, heightMm: 140, orientation: "landscape" },
  "pin-200-140": { widthMm: 200, heightMm: 140, orientation: "landscape" },
  "pin-210-90": { widthMm: 210, heightMm: 90, orientation: "landscape" },
  "pin-200-90": { widthMm: 200, heightMm: 90, orientation: "landscape" },
  "a4-landscape": { widthMm: 297, heightMm: 210, orientation: "landscape" },
  "a4-portrait": { widthMm: 210, heightMm: 297, orientation: "portrait" },
  "a5-landscape": { widthMm: 210, heightMm: 148, orientation: "landscape" },
  "a5-portrait": { widthMm: 148, heightMm: 210, orientation: "portrait" },
};

// ---- L58-72 显隐默认 g ----
const g = {
  showOrderNo: !0,
  showDate: !0,
  showQrcode: !0,
  showClient: !0,
  showTel: !0,
  showAddress: !0,
  showProductionDays: !0,
  showAmounts: !0,
  showDeclaration: !0,
  orderNoPosition: "left",
  datePosition: "right",
  qrcodePosition: "right",
  metaOrder: ["client", "tel", "address", "productionDays"],
};

// ---- L80-91 元素 key ----
const x = [
  "orderNo", "date", "title", "qrcode", "client", "tel",
  "address", "productionDays", "amounts", "declaration",
];

// ---- L104-124 M ----
const M = (e) => {
  const o = [];
  return (
    e["visible"] || o["push"]("display:none"),
    (0 !== e.offsetXMm || 0 !== e["offsetYMm"]) &&
      o["push"]("position:relative;left:" + e["offsetXMm"] + "mm;top:" + e["offsetYMm"] + "mm;z-index:10"),
    e["fontSize"] > 0 && o["push"]("font-size:" + e["fontSize"] + "px"),
    e["widthMm"] > 0 && o["push"]("width:" + e["widthMm"] + "mm;max-width:" + e.widthMm + "mm"),
    o["join"](";")
  );
};

// ---- L125-136 L ----
const L = () => {
  const e = {};
  for (const t of x)
    e[t] = { offsetXMm: 0, offsetYMm: 0, fontSize: 0, widthMm: 0, visible: !0 };
  return e;
};

// ---- L143-171 D 的内联归一化器（入参是已 JSON.parse 的值）----
const D_parse = (e) => {
  const o = L();
  if (e && typeof e === "object")
    for (const l of x)
      if (e[l] && typeof e[l] === "object") {
        const a2 = e[l];
        o[l] = {
          offsetXMm: Number["isFinite"](Number(a2["offsetXMm"])) ? Number(a2["offsetXMm"]) : 0,
          offsetYMm: Number["isFinite"](Number(a2["offsetYMm"])) ? Number(a2["offsetYMm"]) : 0,
          fontSize:
            Number["isFinite"](Number(a2["fontSize"])) && Number(a2["fontSize"]) >= 0
              ? Number(a2["fontSize"]) : 0,
          widthMm:
            Number["isFinite"](Number(a2["widthMm"])) && Number(a2["widthMm"]) >= 0
              ? Number(a2.widthMm) : 0,
          visible: typeof a2.visible !== "boolean" || a2["visible"],
        };
      }
  return o;
};

// ---- L245-251 K ----
const K = (e, t, o, a2) => {
  const u2 = Number(e);
  return Number.isFinite(u2) ? Math["max"](t, Math.min(o, Math.round(u2))) : a2;
};

// ---- L252-289 Z ----
const Z = (e) => ({
  headerFontSize: K(e?.["headerFontSize"], 14, 36, u["headerFontSize"]),
  tableFontSize: K(e?.["tableFontSize"], 8, 18, u["tableFontSize"]),
  amountFontSize: K(e?.["amountFontSize"], 16, 40, u.amountFontSize),
  metaFontSize: K(e?.metaFontSize, 8, 18, u["metaFontSize"]),
  declarationFontSize: K(e?.["declarationFontSize"], 8, 18, u["declarationFontSize"]),
  orderDateFontSize: K(e?.["orderDateFontSize"], 8, 18, u["orderDateFontSize"]),
});

// ---- L290-306 X ----
const X = (e) => {
  const o = K(e?.["copies"], 1, 99, s["copies"]),
    a2 = K(e?.["widthMm"], 50, 500, s["widthMm"]),
    n = K(e?.["heightMm"], 50, 500, s["heightMm"]),
    u2 = dec(a2 >= n ? 385 : 659);
  return {
    copies: o,
    widthMm: a2,
    heightMm: n,
    orientation:
      e?.["orientation"] === "landscape" || e?.["orientation"] === "portrait"
        ? e.orientation : u2,
  };
};

// ---- L307 Q ----
const Q = (e, t, o = 2) => Math["abs"](e - t) <= o;

// ---- L308 R / L309 F ----
const R = ["left", "right"];
const F = ["client", "tel", "address", "productionDays"];

// ---- L324-349 te ----
const te = (e) => {
  const o = { ...g };
  if (e && typeof e === "object") {
    const l = [
      "showOrderNo", "showDate", "showQrcode", "showClient", "showTel",
      "showAddress", "showProductionDays", "showAmounts", "showDeclaration",
    ];
    for (const a2 of l) typeof e[a2] === "boolean" && (o[a2] = e[a2]);
    for (const a2 of ["orderNoPosition", "datePosition", "qrcodePosition"])
      R.includes(e[a2]) && (o[a2] = e[a2]);
    if (Array["isArray"](e["metaOrder"])) {
      const l2 = e.metaOrder["filter"]((e2) => F["includes"](e2)),
        a3 = F["filter"]((e2) => !l2["includes"](e2));
      o.metaOrder = [...l2, ...a3];
    }
  }
  return o;
};

// ---- L682-692 找预设 key ----
const findPreset = (e) => {
  const o = Object["entries"](d).find(
    ([, l]) => e["orientation"] === l["orientation"] &&
      Q(e["widthMm"], l["widthMm"]) && Q(e["heightMm"], l["heightMm"]),
  );
  return o ? o[0] : "custom";
};

// ================= 输出 =================
const j = (v) => JSON.stringify(v);
const line = (s) => console.log(s);

line("=== [1] te(): metaOrder 归一化 ===");
for (const inp of [
  { metaOrder: ["client", "client"] },
  { metaOrder: ["address"] },
  { metaOrder: [] },
  { metaOrder: ["非法值", "tel"] },
  { metaOrder: [1, "tel"] },
  { metaOrder: ["productionDays", "client", "tel", "address"] },
  { metaOrder: ["client", "client", "client", "tel"] },
  { metaOrder: "notanarray" },
  {},
]) {
  const out = te(inp);
  line(`  输入 metaOrder=${j(inp.metaOrder)}  ->  产出=${j(out.metaOrder)}  len=${out.metaOrder.length}`);
}

line("");
line("=== [2] K() 边界 ===");
for (const [arg, mn, mx, fb, note] of [
  ['""', 14, 36, 30, "空串"],
  ['"abc"', 14, 36, 30, "非数字串"],
  ["NaN", 14, 36, 30, "NaN"],
  ["null", 14, 36, 30, "null"],
  ["undefined", 14, 36, 30, "undefined"],
  ["14.5", 14, 36, 30, "四舍五入 half-up?"],
  ["15.5", 14, 36, 30, "四舍五入 half-up?"],
  ["13.5", 14, 36, 30, "半值+下界"],
  ["1/0", 14, 36, 30, "Infinity"],
  ["-1/0", 14, 36, 30, "-Infinity"],
  ["1e9", 14, 36, 30, "远超上限"],
  ["-5", 14, 36, 30, "负值"],
]) {
  const val = eval(`(${arg})`);
  line(`  K(${arg}, ${mn}, ${mx}, ${fb}) = ${j(K(val, mn, mx, fb))}   // ${note}`);
}

line("");
line("=== [3] X() orientation 反推 vs 保留 ===");
for (const inp of [
  { widthMm: 100, heightMm: 200, orientation: "landscape" },
  { widthMm: 100, heightMm: 200, orientation: "portrait" },
  { widthMm: 100, heightMm: 200, orientation: "bogus" },
  { widthMm: 100, heightMm: 200 },
  { widthMm: 200, heightMm: 200, orientation: "bogus" },
  { widthMm: 200, heightMm: 200 },
  { widthMm: 200, heightMm: 140 },
  { copies: 0, widthMm: 10, heightMm: 9999 },
  { },
]) {
  line(`  输入 ${j(inp)}  ->  ${j(X(inp))}`);
}

line("");
line("=== [3b] findPreset() ===");
for (const inp of [
  { widthMm: 200, heightMm: 140, orientation: "landscape" },
  { widthMm: 202, heightMm: 140, orientation: "landscape" },
  { widthMm: 202.1, heightMm: 140, orientation: "landscape" },
  { widthMm: 210, heightMm: 140, orientation: "portrait" },
  { widthMm: 148, heightMm: 210, orientation: "portrait" },
]) {
  line(`  输入 ${j(inp)}  ->  ${j(findPreset(inp))}`);
}

line("");
line("=== [6] Q() 容差 ===");
line(`  Q(100.0, 102.0) = ${Q(100.0, 102.0)}   // 恰好差 2`);
line(`  Q(100.0, 102.1) = ${Q(100.0, 102.1)}   // 差 2.1`);
line(`  Q(100.0, 101.999999999) = ${Q(100.0, 101.999999999)}`);

line("");
line("=== [4] D_parse() 越界容错 ===");
line("  输入 {orderNo:{fontSize:9999,widthMm:-5,offsetXMm:'abc',visible:'yes'}}");
line("  产出 orderNo = " + j(D_parse({ orderNo: { fontSize: 9999, widthMm: -5, offsetXMm: "abc", visible: "yes" } }).orderNo));
const dp2 = D_parse({
  orderNo: { fontSize: 9999, widthMm: -5, offsetXMm: "abc", visible: "yes" },
  date: { offsetXMm: "-3.5", offsetYMm: 2, fontSize: 0, widthMm: 0, visible: false },
});
line("  多项输入 -> orderNo=" + j(dp2.orderNo) + "  date=" + j(dp2.date));
line("  缺 key（只给 orderNo）-> title=" + j(D_parse({ orderNo: {} }).title) + "  amounts=" + j(D_parse({ orderNo: {} }).amounts));
line("  key 数 = " + Object.keys(D_parse({ orderNo: {} })).length);
line("  非法元素名 {bogus:{}} -> 是否多出 bogus: " + ("bogus" in D_parse({ bogus: { fontSize: 5 } })));
line("  null -> " + j(D_parse(null).orderNo) + " ; 字符串 -> " + j(D_parse("x").orderNo));
line("  子项为 null {orderNo:null} -> " + j(D_parse({ orderNo: null }).orderNo));

line("");
line("=== [5] M() 边角 ===");
const zero = { offsetXMm: 0, offsetYMm: 0, fontSize: 0, widthMm: 0, visible: true };
line("  全零 visible:true   -> " + j(M(zero)));
line("  全零 visible:false  -> " + j(M({ ...zero, visible: false })));
line("  visible:false + 偏移 -> " + j(M({ ...zero, visible: false, offsetXMm: 5, offsetYMm: -2 })));
line("  仅 X 偏移 3        -> " + j(M({ ...zero, offsetXMm: 3 })));
line("  仅 Y 偏移 -1.5     -> " + j(M({ ...zero, offsetYMm: -1.5 })));
line("  fontSize:0,width:0 -> " + j(M({ ...zero, fontSize: 0, widthMm: 0 })));
line("  fontSize:12        -> " + j(M({ ...zero, fontSize: 12 })));
line("  widthMm:40         -> " + j(M({ ...zero, widthMm: 40 })));
line("  全开               -> " + j(M({ offsetXMm: 1, offsetYMm: 2, fontSize: 12, widthMm: 40, visible: true })));
line("  visible 非布尔(0)  -> " + j(M({ ...zero, visible: 0 })));

line("");
line("=== [7] L() 默认 elementConfigs ===");
line("  key 数 = " + Object.keys(L()).length + "  keys = " + j(Object.keys(L())));
line("  orderNo 默认 = " + j(L().orderNo));
line("  两次调用是否同一引用 = " + (L().orderNo === L().orderNo));

line("");
line("=== [8] Z() 默认与清洗 ===");
line("  Z({}) = " + j(Z({})));
line("  Z(undefined) = " + j(Z(undefined)));
line("  Z(null) = " + j(Z(null)));
line("  Z({headerFontSize:100, extra:1}) = " + j(Z({ headerFontSize: 100, extra: 1 })));
line("  u 是否被 Z 污染 = " + j(u));

line("");
line("=== [9] a 列宽求和 ===");
line("  sum = " + a.reduce((s2, v) => s2 + v, 0).toFixed(4) + "  len = " + a.length);
