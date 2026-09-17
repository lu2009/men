// ==== 自动抽取自 Receipt2.deobfuscated.js（逐字，勿手改）====
const dec = (i) => (i === 385 ? "landscape" : i === 659 ? "portrait" : (() => { throw new Error("未知解码下标 " + i) })());
const l = dec;
const a = [13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5];
const n = { value: [...a] };
const u = {
        headerFontSize: 30,
        tableFontSize: 15,
        amountFontSize: 20,
        metaFontSize: 18,
        declarationFontSize: 15,
        orderDateFontSize: 13,
      };
const r = { enabled: !1, name: "" };
const s = { copies: 1, widthMm: 200, heightMm: 140, orientation: "landscape" };
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
const x = [
        "orderNo",
        "date",
        "title",
        "qrcode",
        "client",
        "tel",
        "address",
        "productionDays",
        "amounts",
        "declaration",
      ];
const B = {
        orderNo: "编号",
        date: "日期",
        title: "品牌标题",
        qrcode: "二维码",
        client: "客户",
        tel: "电话",
        address: "安装地址",
        productionDays: "生产天数",
        amounts: "金额",
        declaration: "说明",
      };
const F = ["client", "tel", "address", "productionDays"];
const R = ["left", "right"];
let b = { value: null };
const C = { value: { ...g, metaOrder: [...g.metaOrder] } };
const i = { value: { ...r } };
const L = () => {
        const e = {};
        for (const t of x)
          e[t] = {
            offsetXMm: 0,
            offsetYMm: 0,
            fontSize: 0,
            widthMm: 0,
            visible: !0,
          };
        return e;
      };
const K = (e, t, o, a) => {
        const n = l,
          u = Number(e);
        return Number.isFinite(u)
          ? Math["max"](t, Math.min(o, Math.round(u)))
          : a;
      };
const M = (e) => {
        const t = l,
          o = [];
        return (
          e["visible"] || o["push"]("display:none"),
          (0 !== e.offsetXMm || 0 !== e["offsetYMm"]) &&
            o["push"](
              "position:relative;left:" +
                e["offsetXMm"] +
                "mm;top:" +
                e["offsetYMm"] +
                "mm;z-index:10",
            ),
          e["fontSize"] > 0 && o["push"]("font-size:" + e["fontSize"] + "px"),
          e["widthMm"] > 0 &&
            o["push"](
              "width:" + e["widthMm"] + "mm;max-width:" + e.widthMm + "mm",
            ),
          o["join"](";")
        );
      };
const te = (e) => {
        const t = l,
          o = { ...g };
        if (e && typeof e === "object") {
          const l = [
            "showOrderNo",
            "showDate",
            "showQrcode",
            "showClient",
            "showTel",
            "showAddress",
            "showProductionDays",
            "showAmounts",
            "showDeclaration",
          ];
          for (const a of l) typeof e[a] === "boolean" && (o[a] = e[a]);
          for (const a of ["orderNoPosition", "datePosition", "qrcodePosition"])
            R.includes(e[a]) && (o[a] = e[a]);
          if (Array["isArray"](e["metaOrder"])) {
            const l = e.metaOrder["filter"]((e) => F["includes"](e)),
              a = F["filter"]((e) => !l["includes"](e));
            o.metaOrder = [...l, ...a];
          }
        }
        return o;
      };
const le = (e) =>
        e["replace"](/&/g, "&amp;")
          ["replace"](/</g, "&lt;")
          ["replace"](/>/g, "&gt;")
          ["replace"](/"/g, "&quot;")
          ["replace"](/'/g, "&#39;");
const oe = (e) => {
        return le(
          ((t = e),
          String(null != t ? t : "")
            .replace(/<br\s*\/?>/gi, "\n")
            ["replace"](/\r\n/g, "\n")),
        );
        var t;
      };
const ae = (e) => le(String(null != e ? e : ""));
const ne = (e) => {
        const t = l,
          o = Number(e);
        return Number.isFinite(o) ? o.toFixed(2) : "0.00";
      };
const ce = (e) => {
        const t = ((e) => {
          const t = b["value"][e];
          return t ? M(t) : "";
        })(e);
        return 'data-r2-el="' + e + '"' + (t ? ' style="' + t + '"' : "");
      };
const se = (e) => {
        const t = l,
          o = b["value"][e];
        return !o || o["visible"];
      };
const de = (e) => {
        const t = l,
          o = C["value"],
          a =
            "string" == typeof (null == e ? void 0 : e.payQrcode) &&
            "" !== e["payQrcode"].trim()
              ? '<img class="receipt2-qrcode" ' +
                ce("qrcode") +
                ' src="' +
                e["payQrcode"] +
                '" alt="收款二维码" />'
              : '<div class="receipt2-qrcode receipt2-qrcode-empty" ' +
                ce("qrcode") +
                "></div>",
          n =
            '<div class="receipt2-order" ' +
            ce("orderNo") +
            ">编号：" +
            ae(null == e ? void 0 : e["orderNo"]) +
            "</div>",
          u =
            '<div class="receipt2-date" ' +
            ce("date") +
            ">日期：" +
            ae(null == e ? void 0 : e["date"]) +
            "</div>",
          r = [],
          c = [];
        (o.showOrderNo &&
          se("orderNo") &&
          (o["orderNoPosition"] === "left" ? r : c)["push"](n),
          o["showDate"] &&
            se("date") &&
            ("left" === o["datePosition"] ? r : c)["push"](u),
          o["showQrcode"] &&
            se("qrcode") &&
            ("left" === o["qrcodePosition"] ? r : c)["push"](a));
        const s =
            r["length"] > 0
              ? '<div class="receipt2-header-left">' + r["join"]("") + "</div>"
              : "<div></div>",
          d =
            c["length"] > 0
              ? '<div class="receipt2-header-right">' + c["join"]("") + "</div>"
              : "<div></div>",
          V = {
            client: () =>
              "<span data-shrink-fit " +
              ce("client") +
              ">客户：" +
              ae(null == e ? void 0 : e["client"]) +
              "</span>",
            tel: () =>
              "<span data-shrink-fit " +
              ce("tel") +
              ">电话：" +
              ae(null == e ? void 0 : e["tel"]) +
              "</span>",
            address: () =>
              "<span data-shrink-fit " +
              ce("address") +
              ">安装地址：" +
              ae(null == e ? void 0 : e["安装地址"]) +
              "</span>",
            productionDays: () =>
              "<span " +
              ce("productionDays") +
              ">生产天数：" +
              ae(null == e ? void 0 : e["productionDays"]) +
              "</span>",
          },
          m = {
            client: o.showClient && se("client"),
            tel: o["showTel"] && se("tel"),
            address: o["showAddress"] && se("address"),
            productionDays: o.showProductionDays && se("productionDays"),
          },
          w = [];
        for (const l of o.metaOrder) m[l] && V[l] && w.push(V[l]());
        const g =
          w["length"] > 0
            ? '<div class="receipt2-meta-row" style="grid-template-columns:' +
              w.map(() => "1fr")["join"](" ") +
              ';">' +
              w["join"]("") +
              "</div>"
            : "";
        return (
          '\n    <div class="receipt2-header">\n      ' +
          s +
          '\n      <div class="receipt2-title" ' +
          ce("title") +
          ">" +
          ae(
            i["value"].enabled && i["value"].name
              ? i.value["name"]
              : (null == e ? void 0 : e.brand) || "收据单2",
          ) +
          "</div>\n      " +
          d +
          "\n    </div>\n    " +
          g
        );
      };
const Ve = (e) => {
        const t = l,
          o = C["value"];
        return (
          (o.showAmounts && se("amounts")
            ? '<div class="receipt2-amounts" ' +
              ce("amounts") +
              ">\n        <span>总额：" +
              ne(null == e ? void 0 : e.total) +
              "</span>\n        <span>已付：" +
              ne(null == e ? void 0 : e["deposit"]) +
              "</span>\n        <span>未付：" +
              ne(null == e ? void 0 : e["balance"]) +
              "</span>\n      </div>"
            : "") +
          (o.showDeclaration && se("declaration")
            ? '<div class="receipt2-declaration" ' +
              ce("declaration") +
              ">" +
              oe(null == e ? void 0 : e["declaration"]) +
              "</div>"
            : "")
        );
      };
const re = () =>
        "<thead><tr><th>型材</th><th>开向</th><th>颜色</th><th>玻璃</th><th>尺寸</th><th>数量</th><th>单价</th><th>金额</th><th>计价方式</th><th>备注</th></tr></thead>";
const ie = (e) =>
        '<tr>\n    <td class="cell-multi">' +
        oe(null == e ? void 0 : e["profile"]) +
        "</td>\n    <td>" +
        ae(null == e ? void 0 : e.direction) +
        "</td>\n    <td>" +
        ae(null == e ? void 0 : e["color"]) +
        '</td>\n    <td class="cell-multi">' +
        oe(null == e ? void 0 : e["glass"]) +
        '</td>\n    <td class="cell-multi">' +
        oe(null == e ? void 0 : e["size"]) +
        "</td>\n    <td>" +
        ae(null == e ? void 0 : e["quantity"]) +
        "</td>\n    <td>" +
        ae(null == e ? void 0 : e["price"]) +
        "</td>\n    <td>" +
        ae(null == e ? void 0 : e["amount"]) +
        '</td>\n    <td class="cell-multi">' +
        oe(null == e ? void 0 : e.pricing) +
        '</td>\n    <td class="cell-multi">' +
        oe(null == e ? void 0 : e["remark"]) +
        "</td>\n  </tr>";
const me = (e, t, o) =>
        '<section class="receipt2-page">\n    ' +
        de(e) +
        '\n    <table class="receipt2-table">\n      ' +
        re() +
        "\n      <tbody>" +
        (t["length"] > 0
          ? t["map"](ie)["join"]("")
          : '<tr><td colspan="10" class="empty-row">暂无明细</td></tr>') +
        "</tbody>\n    </table>\n    " +
        (o ? Ve(e) : "") +
        "\n  </section>";
const ue = (e, t) =>
        '\n  * { box-sizing: border-box; }\n  .receipt2-root { color: #000; background: #fff; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }\n  .receipt2-page {\n    width: ' +
        t["widthMm"] +
        "mm; height: " +
        t.heightMm +
        "mm;\n    padding: 4mm 4mm 3mm; background: #fff;\n    display: flex; flex-direction: column; overflow: hidden;\n    page-break-after: always;\n  }\n  .receipt2-page:last-child { page-break-after: auto; }\n  .receipt2-header {\n    display: grid; grid-template-columns: 1fr 2fr 1fr;\n    align-items: start; margin-bottom: 2mm; flex-shrink: 0;\n  }\n  .receipt2-order { font-size: " +
        e["orderDateFontSize"] +
        "px; padding-top: 1mm; }\n  .receipt2-title { text-align: center; font-size: " +
        e["headerFontSize"] +
        "px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.05; }\n  .receipt2-header-left { display: flex; align-items: flex-start; justify-content: flex-start; gap: 2mm; }\n  .receipt2-header-right { display: flex; align-items: flex-start; justify-content: flex-end; gap: 2mm; }\n  .receipt2-date { font-size: " +
        e["orderDateFontSize"] +
        "px; padding-top: 1mm; white-space: nowrap; }\n  .receipt2-qrcode { width: 18" +
        "mm; height: " +
        18 +
        "mm; object-fit: contain; border: 1px solid #bbb; }\n  .receipt2-qrcode-empty { border-style: dashed; }\n  .receipt2-meta-row {\n    display: grid; grid-template-columns: 1.2fr 1.5fr 1.7fr 0.8fr;\n    gap: 1.5mm; margin-bottom: 1.5mm; font-size: " +
        e["metaFontSize"] +
        "px; line-height: 1.2; flex-shrink: 0;\n  }\n  .receipt2-meta-row span { overflow: hidden; white-space: nowrap; display: flex; align-items: center; }\n  .receipt2-meta-row span:nth-child(3) { padding-left: 6mm; }\n  .receipt2-table {\n    width: 100%; border-collapse: collapse; table-layout: fixed;\n    font-size: " +
        e["tableFontSize"] +
        "px; margin-bottom: 1.5mm;\n  }\n  .receipt2-table th, .receipt2-table td {\n    border: 1px solid #000; padding: 1mm 0.8mm;\n    vertical-align: top; line-height: 1.18; word-break: break-all;\n  }\n  .receipt2-table th { text-align: center; font-weight: 600; }\n  .receipt2-table td { text-align: left; }\n  .receipt2-table .cell-multi { white-space: pre-line; }\n  .receipt2-table th:nth-child(1), .receipt2-table td:nth-child(1) { width: " +
        n["value"][0] +
        "%; }\n  .receipt2-table th:nth-child(2), .receipt2-table td:nth-child(2) { width: " +
        n.value[1] +
        "%; text-align: center; }\n  .receipt2-table th:nth-child(3), .receipt2-table td:nth-child(3) { width: " +
        n.value[2] +
        "%; text-align: center; }\n  .receipt2-table th:nth-child(4), .receipt2-table td:nth-child(4) { width: " +
        n["value"][3] +
        "%; }\n  .receipt2-table th:nth-child(5), .receipt2-table td:nth-child(5) { width: " +
        n["value"][4] +
        "%; }\n  .receipt2-table th:nth-child(6), .receipt2-table td:nth-child(6) { width: " +
        n["value"][5] +
        "%; text-align: center; }\n  .receipt2-table th:nth-child(7), .receipt2-table td:nth-child(7) { width: " +
        n["value"][6] +
        "%; text-align: center; }\n  .receipt2-table th:nth-child(8), .receipt2-table td:nth-child(8) { width: " +
        n.value[7] +
        "%; text-align: center; }\n  .receipt2-table th:nth-child(9), .receipt2-table td:nth-child(9) { width: " +
        n.value[8] +
        "%; }\n  .receipt2-table th:nth-child(10), .receipt2-table td:nth-child(10) { width: " +
        n["value"][9] +
        "%; }\n  .empty-row { text-align: center !important; vertical-align: middle !important; color: #666; }\n  .receipt2-amounts {\n    display: grid; grid-template-columns: repeat(3, 1fr);\n    margin-bottom: 1.2mm; color: #d9001b; font-size: " +
        e["amountFontSize"] +
        "px; line-height: 1; flex-shrink: 0;\n  }\n  .receipt2-amounts span { white-space: nowrap; }\n  .receipt2-declaration {\n    border-top: 1px dashed #999; padding-top: 1.2mm;\n    white-space: pre-line; line-height: 1.16; font-size: " +
        e["declarationFontSize"] +
        "px; flex: 1; overflow: hidden;\n  }\n  " +
        ((e) => {
          const t = l;
          return (
            "@page { size: " +
            (e["orientation"] === "landscape" ? e.heightMm : e["widthMm"]) +
            "mm " +
            (e["orientation"] === "landscape" ? e["widthMm"] : e["heightMm"]) +
            "mm; margin: 0; }"
          );
        })(t) +
        "\n  @media print {\n    html, body { margin: 0 !important; padding: 0 !important; background: #fff; }\n    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n    " +
        (t["orientation"] === "landscape"
          ? "\n    .receipt2-root { display: block !important; background: #fff !important; padding: 0 !important; gap: 0 !important; }\n    .r2-page-wrap { width: " +
            t["heightMm"] +
            "mm !important; height: " +
            t["widthMm"] +
            "mm !important; overflow: hidden !important; position: relative !important; page-break-after: always !important; }\n    .r2-page-wrap:last-child { page-break-after: auto !important; }\n    .receipt2-page { position: absolute !important; top: 0 !important; left: 0 !important; width: " +
            t.widthMm +
            "mm !important; height: " +
            t["heightMm"] +
            "mm !important; transform-origin: top left !important; transform: translateY(" +
            t.widthMm +
            "mm) rotate(-90deg) !important; box-shadow: none !important; page-break-after: auto !important; }\n    "
          : "") +
        "\n    .receipt2-table { border-collapse: collapse !important; }\n    .receipt2-table th, .receipt2-table td { border: 1px solid #000 !important; }\n  }\n  @media screen {\n    .receipt2-root { background: #c0c0c0; padding: 12mm; display: flex; flex-direction: column; align-items: center; gap: 8mm; min-width: fit-content; }\n    .receipt2-page { position: relative; box-shadow: 0 3px 14px rgba(0,0,0,0.28); }\n    [data-r2-el] { cursor: pointer; transition: outline 0.15s; border-radius: 2px; position: relative; z-index: 5; }\n    [data-r2-el]:hover { outline: 2px dashed #409eff; outline-offset: 1px; z-index: 10; }\n  }\n";
const X = (e) => {
        const t = l,
          o = K(null == e ? void 0 : e["copies"], 1, 99, s["copies"]),
          a = K(null == e ? void 0 : e["widthMm"], 50, 500, s["widthMm"]),
          n = K(null == e ? void 0 : e["heightMm"], 50, 500, s["heightMm"]),
          u = t(a >= n ? 385 : 659);
        return {
          copies: o,
          widthMm: a,
          heightMm: n,
          orientation:
            (null == e ? void 0 : e["orientation"]) === "landscape" ||
            (null == e ? void 0 : e["orientation"]) === "portrait"
              ? e.orientation
              : u,
        };
      };
const Z = (e) => ({
        headerFontSize: K(
          null == e ? void 0 : e["headerFontSize"],
          14,
          36,
          u["headerFontSize"],
        ),
        tableFontSize: K(
          null == e ? void 0 : e["tableFontSize"],
          8,
          18,
          u["tableFontSize"],
        ),
        amountFontSize: K(
          null == e ? void 0 : e["amountFontSize"],
          16,
          40,
          u.amountFontSize,
        ),
        metaFontSize: K(
          null == e ? void 0 : e.metaFontSize,
          8,
          18,
          u["metaFontSize"],
        ),
        declarationFontSize: K(
          null == e ? void 0 : e["declarationFontSize"],
          8,
          18,
          u["declarationFontSize"],
        ),
        orderDateFontSize: K(
          null == e ? void 0 : e["orderDateFontSize"],
          8,
          18,
          u["orderDateFontSize"],
        ),
      });

// b 用真实默认（L() 已可用）
b.value = L();
export const __meta = {
  "a": {
    "line": 11
  },
  "u": {
    "line": 13
  },
  "r": {
    "line": 21
  },
  "s": {
    "line": 24
  },
  "g": {
    "line": 58
  },
  "x": {
    "line": 80
  },
  "B": {
    "line": 92
  },
  "F": {
    "line": 309
  },
  "R": {
    "line": 308
  },
  "L": {
    "line": 125
  },
  "K": {
    "line": 245
  },
  "M": {
    "line": 104
  },
  "te": {
    "line": 324
  },
  "le": {
    "line": 350
  },
  "oe": {
    "line": 356
  },
  "ae": {
    "line": 365
  },
  "ne": {
    "line": 366
  },
  "ce": {
    "line": 463
  },
  "se": {
    "line": 470
  },
  "de": {
    "line": 475
  },
  "Ve": {
    "line": 579
  },
  "re": {
    "line": 439
  },
  "ie": {
    "line": 441
  },
  "me": {
    "line": 603
  },
  "ue": {
    "line": 371
  },
  "X": {
    "line": 290
  },
  "Z": {
    "line": 252
  }
};
export { dec, te, a, u, r, s, g, x, B, F, R, M, L, le, oe, ae, ne, ce, se, de, Ve, re, ie, me, ue, X, Z, b, C, i, n };
