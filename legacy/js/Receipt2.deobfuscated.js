export default {
  __name: "Receipt2PrintManager",
  props: {
    getCustomers: { type: Function },
    isReceipt2Active: { type: Function },
    onPreviewHtmlChange: { type: Function },
  },
  setup(e, { expose: t }) {
    const l = _o,
      o = e,
      a = [13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5],
      n = Vue.ref([...a]),
      u = {
        headerFontSize: 30,
        tableFontSize: 15,
        amountFontSize: 20,
        metaFontSize: 18,
        declarationFontSize: 15,
        orderDateFontSize: 13,
      },
      r = { enabled: !1, name: "" },
      i = Vue.ref({ ...r }),
      c = Vue.ref({ ...r }),
      s = { copies: 1, widthMm: 200, heightMm: 140, orientation: "landscape" },
      d = {
        "pin-210-140": {
          widthMm: 210,
          heightMm: 140,
          orientation: "landscape",
        },
        "pin-200-140": {
          widthMm: 200,
          heightMm: 140,
          orientation: "landscape",
        },
        "pin-210-90": { widthMm: 210, heightMm: 90, orientation: "landscape" },
        "pin-200-90": { widthMm: 200, heightMm: 90, orientation: "landscape" },
        "a4-landscape": {
          widthMm: 297,
          heightMm: 210,
          orientation: "landscape",
        },
        "a4-portrait": { widthMm: 210, heightMm: 297, orientation: "portrait" },
        "a5-landscape": {
          widthMm: 210,
          heightMm: 148,
          orientation: "landscape",
        },
        "a5-portrait": { widthMm: 148, heightMm: 210, orientation: "portrait" },
      },
      V = (e) => {
        const t = l,
          o = d[e];
        ((p["value"]["widthMm"] = o["widthMm"]),
          (p["value"].heightMm = o["heightMm"]),
          (p["value"].orientation = o["orientation"]));
      },
      g = {
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
      },
      y = Vue.ref(!1),
      v = Vue.ref({ ...u }),
      f = Vue.ref({ ...u }),
      h = Vue.ref({ ...s }),
      p = Vue.ref({ ...s }),
      C = Vue.ref({ ...g }),
      z = Vue.ref({ ...g }),
      x = [
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
      ],
      B = {
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
      },
      M = (e) => {
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
      },
      L = () => {
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
      },
      b = Vue.ref(L()),
      D = () => {
        const e = l;
        try {
          const t = localStorage["getItem"](ya);
          b["value"] = t
            ? ((e) => {
                const t = l,
                  o = L();
                if (e && typeof e === "object")
                  for (const l of x)
                    if (e[l] && typeof e[l] === "object") {
                      const a = e[l];
                      o[l] = {
                        offsetXMm: Number["isFinite"](Number(a["offsetXMm"]))
                          ? Number(a["offsetXMm"])
                          : 0,
                        offsetYMm: Number["isFinite"](Number(a["offsetYMm"]))
                          ? Number(a["offsetYMm"])
                          : 0,
                        fontSize:
                          Number["isFinite"](Number(a["fontSize"])) &&
                          Number(a["fontSize"]) >= 0
                            ? Number(a["fontSize"])
                            : 0,
                        widthMm:
                          Number["isFinite"](Number(a["widthMm"])) &&
                          Number(a["widthMm"]) >= 0
                            ? Number(a.widthMm)
                            : 0,
                        visible: typeof a.visible !== "boolean" || a["visible"],
                      };
                    }
                return o;
              })(JSON["parse"](t))
            : L();
        } catch (t) {
          b["value"] = L();
        }
      },
      A = () => {
        const e = l;
        localStorage["setItem"](ya, JSON["stringify"](b["value"]));
      },
      k = Vue.ref(null),
      P = Vue.ref({
        offsetXMm: 0,
        offsetYMm: 0,
        fontSize: 0,
        widthMm: 0,
        visible: !0,
      }),
      I = Vue.ref({
        offsetXMm: 0,
        offsetYMm: 0,
        fontSize: 0,
        widthMm: 0,
        visible: !0,
      }),
      U = Vue.ref({ top: 0, left: 0 });
    let S = null,
      T = null;
    const Y = () => {
      const e = l;
      if (!T) return;
      const t = M(P["value"]);
      t ? T["setAttribute"]("style", t) : T["removeAttribute"]("style");
    };
    Vue.watch(
      P,
      () => {
        Y();
      },
      { deep: !0 },
    );
    const W = Vue.computed(() => !!window["electronAPI"]),
      O = Vue.ref([]),
      H = Vue.ref(""),
      G = Vue.ref(!1),
      j = () => {
        const e = l;
        try {
          localStorage["setItem"](Va, H["value"]);
        } catch (t) {}
      },
      q = async () => {
        const e = l;
        if (W["value"]) {
          G.value = !0;
          try {
            O.value = await window["electronAPI"]["getPrinters"]();
          } catch (t) {
            ElementPlus.ElMessage["error"]("获取打印机列表失败");
          } finally {
            G["value"] = !1;
          }
        }
      },
      J = async () => {
        const e = l;
        W.value && 0 === O["value"].length && (await q());
      },
      _ = () => {
        var e;
        const t = l,
          a = null == (e = o["getCustomers"]) ? void 0 : e.call(o);
        return Array["isArray"](a) ? a : [];
      },
      K = (e, t, o, a) => {
        const n = l,
          u = Number(e);
        return Number.isFinite(u)
          ? Math["max"](t, Math.min(o, Math.round(u)))
          : a;
      },
      Z = (e) => ({
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
      }),
      X = (e) => {
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
      },
      Q = (e, t, o = 2) => Math["abs"](e - t) <= o,
      R = ["left", "right"],
      F = ["client", "tel", "address", "productionDays"],
      $ = {
        client: "客户",
        tel: "电话",
        address: "安装地址",
        productionDays: "生产天数",
      },
      ee = (e, t) => {
        const o = l,
          a = [...z.value["metaOrder"]],
          n = e + t;
        n < 0 ||
          n >= a.length ||
          (([a[e], a[n]] = [a[n], a[e]]), (z["value"]["metaOrder"] = a));
      },
      te = (e) => {
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
      },
      le = (e) =>
        e["replace"](/&/g, "&amp;")
          ["replace"](/</g, "&lt;")
          ["replace"](/>/g, "&gt;")
          ["replace"](/"/g, "&quot;")
          ["replace"](/'/g, "&#39;"),
      oe = (e) => {
        return le(
          ((t = e),
          String(null != t ? t : "")
            .replace(/<br\s*\/?>/gi, "\n")
            ["replace"](/\r\n/g, "\n")),
        );
        var t;
      },
      ae = (e) => le(String(null != e ? e : "")),
      ne = (e) => {
        const t = l,
          o = Number(e);
        return Number.isFinite(o) ? o.toFixed(2) : "0.00";
      },
      ue = (e, t) =>
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
        "\n    .receipt2-table { border-collapse: collapse !important; }\n    .receipt2-table th, .receipt2-table td { border: 1px solid #000 !important; }\n  }\n  @media screen {\n    .receipt2-root { background: #c0c0c0; padding: 12mm; display: flex; flex-direction: column; align-items: center; gap: 8mm; min-width: fit-content; }\n    .receipt2-page { position: relative; box-shadow: 0 3px 14px rgba(0,0,0,0.28); }\n    [data-r2-el] { cursor: pointer; transition: outline 0.15s; border-radius: 2px; position: relative; z-index: 5; }\n    [data-r2-el]:hover { outline: 2px dashed #409eff; outline-offset: 1px; z-index: 10; }\n  }\n",
      re = () =>
        "<thead><tr><th>型材</th><th>开向</th><th>颜色</th><th>玻璃</th><th>尺寸</th><th>数量</th><th>单价</th><th>金额</th><th>计价方式</th><th>备注</th></tr></thead>",
      ie = (e) =>
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
        "</td>\n  </tr>",
      ce = (e) => {
        const t = ((e) => {
          const t = b["value"][e];
          return t ? M(t) : "";
        })(e);
        return 'data-r2-el="' + e + '"' + (t ? ' style="' + t + '"' : "");
      },
      se = (e) => {
        const t = l,
          o = b["value"][e];
        return !o || o["visible"];
      },
      de = (e) => {
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
      },
      Ve = (e) => {
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
      },
      me = (e, t, o) =>
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
        "\n  </section>",
      we = async (e, t) => {
        const o = l,
          a = Array["isArray"](null == e ? void 0 : e["receipt"])
            ? e["receipt"]
            : [];
        if (0 === a["length"]) return [me(e, [], !0)];
        const {
            rowHeights: n,
            availNoFooter: u,
            availWithFooter: r,
          } = await ((m = e),
          (w = a),
          (g = t),
          new Promise((e) => {
            const t = Jo,
              l = document.createElement("div");
            ((l["style"]["cssText"] =
              "position:absolute;visibility:hidden;top:0;left:0;"),
              (l.innerHTML =
                "<style>" +
                ue(g, X(h["value"])) +
                '\n      #r2mp { height: auto !important; overflow: visible !important; }\n      #r2mf .receipt2-declaration { flex: 0 0 auto !important; min-height: 0 !important; }\n    </style>\n      <div class="receipt2-root">\n        <section class="receipt2-page" id="r2mp">\n          ' +
                de(m) +
                '\n          <table class="receipt2-table">\n            ' +
                re() +
                '\n            <tbody id="r2mb">' +
                w.map(ie)["join"]("") +
                '</tbody>\n          </table>\n          <div id="r2mf">' +
                Ve(m) +
                "</div>\n        </section>\n      </div>"),
              document.body["appendChild"](l),
              requestAnimationFrame(() => {
                const o = t,
                  a = l["querySelector"]("#r2mp"),
                  n = l["querySelector"]("#r2mb"),
                  u = l.querySelector("#r2mf"),
                  r = X(h["value"]),
                  i = a["getBoundingClientRect"]().height,
                  c =
                    a.getBoundingClientRect()["width"] *
                    (r["heightMm"] / r["widthMm"]),
                  s = u["getBoundingClientRect"]()["height"],
                  d = Array["from"](n.querySelectorAll("tr"))["map"](
                    (e) => e["getBoundingClientRect"]()["height"],
                  ),
                  V = i - d["reduce"]((e, t) => e + t, 0) - s,
                  m = c - V,
                  w = c - V - s;
                (document["body"]["removeChild"](l),
                  e({ rowHeights: d, availNoFooter: m, availWithFooter: w }));
              }));
          })),
          i = ((e) => {
            const t = l;
            switch (e) {
              case "pin-210-140":
              case "pin-200-140":
                return 0;
              case "pin-210-90":
              case "pin-200-90":
                return 1;
              case "a4-landscape":
              case "a4-portrait":
              default:
                return 0;
            }
          })(
            ((e) => {
              const t = l,
                o = Object["entries"](d).find(
                  ([, l]) =>
                    e["orientation"] === l["orientation"] &&
                    Q(e["widthMm"], l["widthMm"]) &&
                    Q(e["heightMm"], l["heightMm"]),
                );
              return o ? o[0] : "custom";
            })(X(h["value"])),
          ),
          c = Math["max"](0, u - i),
          s = Math["max"](0, r - i),
          V = [0];
        var m, w, g;
        let y = 0;
        for (; y < a.length;) {
          let e = 0;
          for (let u = y; u < a["length"]; u++) e += n[u];
          if (e <= s) break;
          let t = 0,
            l = y;
          for (; l < a["length"] && !(l > y && t + n[l] > c);)
            ((t += n[l]), l++);
          if (
            (l <= y && (l = y + 1),
            l >= a["length"] && a["length"] - y > 1 && (l = a["length"] - 1),
            (y = l),
            !(y < a["length"]))
          )
            break;
          V["push"](y);
        }
        const v = [];
        for (let l = 0; l < V.length; l++) {
          const t = V[l],
            n = l + 1 < V["length"] ? V[l + 1] : a["length"];
          v["push"](me(e, a["slice"](t, n), n === a["length"]));
        }
        return v;
      },
      ge = async (e) => {
        const t = l,
          o = Array.isArray(e) ? e : _(),
          a = Z(v["value"]),
          n = [];
        for (const l of o) {
          const e = await we(l, a);
          n["push"](...e);
        }
        return (
          '<div class="receipt2-root"><style>' +
          ue(a, X(h.value)) +
          "</style>" +
          n["join"]("") +
          "</div>"
        );
      },
      ye = async () => {
        const e = l,
          t = _(),
          o = Z(v.value),
          a = [];
        for (const l of t) {
          const t = await we(l, o);
          a["push"](...t);
        }
        const n =
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>收据单2</title>\n    <style>html,body{margin:0;padding:0;background:#fff;}' +
            ue(o, X(h.value)) +
            '</style>\n  </head><body><div class="receipt2-root">' +
            a["join"]("") +
            "</div></body></html>",
          u = document["createElement"]("iframe");
        ((u.style["cssText"] =
          "position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;"),
          document["body"].appendChild(u));
        const r = u["contentWindow"],
          i = u["contentDocument"] || r["document"];
        (i["open"](),
          i["write"](n),
          i["close"](),
          await new Promise((t) => {
            const l = e,
              o = Array["from"](i["querySelectorAll"]("img"));
            if (0 === o["length"]) return void t();
            let a = 0;
            o["forEach"]((e) => {
              const n = l,
                u = () => {
                  (a++, a === o["length"] && t());
                };
              e["complete"] ? u() : ((e.onload = u), (e["onerror"] = u));
            });
          }),
          setTimeout(() => {
            const t = e;
            (Array["from"](i.querySelectorAll("[data-shrink-fit]"))["forEach"](
              (e) => {
                const l = t,
                  o = e;
                o["style"]["fontSize"] = "";
                const a = o["getBoundingClientRect"]()["width"];
                if (a <= 0) return;
                const n = o["style"]["overflow"];
                o["style"]["overflow"] = "visible";
                const u = parseFloat(r["getComputedStyle"](o)["fontSize"]),
                  i = Math["max"](6, 0.5 * u);
                let c = u;
                for (; o["scrollWidth"] > a + 1 && c > i;)
                  ((c -= 0.5), (o["style"]["fontSize"] = c + "px"));
                o["style"]["overflow"] = n;
              },
            ),
              r["focus"](),
              r["print"](),
              setTimeout(() => {
                const e = t;
                document["body"].contains(u) &&
                  document["body"]["removeChild"](u);
              }, 1e3));
          }, 500));
      },
      ve = async () => {
        const e = l,
          t = await ge();
        await o["onPreviewHtmlChange"](t);
      },
      fe = () => {
        const e = l;
        ((f["value"] = { ...u }),
          (p["value"] = { ...s }),
          (z["value"] = { ...g, metaOrder: [...g["metaOrder"]] }),
          (c["value"] = { ...r }));
      },
      he = async () => {
        var e;
        const t = l;
        ((v.value = Z(f["value"])),
          (f["value"] = { ...v["value"] }),
          (h.value = X(p["value"])),
          (p.value = { ...h.value }),
          (C["value"] = te(z.value)),
          (z["value"] = { ...C["value"], metaOrder: [...C.value.metaOrder] }),
          (i["value"] = {
            enabled: c.value["enabled"],
            name: c["value"]["name"].trim(),
          }),
          (c["value"] = { ...i["value"] }),
          (() => {
            const e = Jo;
            localStorage.setItem(ga, JSON["stringify"](i["value"]));
          })(),
          (() => {
            const e = l;
            localStorage["setItem"](sa, JSON["stringify"](v["value"]));
          })(),
          (() => {
            const e = l;
            localStorage["setItem"](ma, JSON["stringify"](h["value"]));
          })(),
          (() => {
            const e = l;
            localStorage.setItem(wa, JSON["stringify"](C["value"]));
          })(),
          (y["value"] = !1),
          (null == (e = o["isReceipt2Active"]) ? void 0 : e.call(o)) &&
            (await ve()));
      },
      pe = (e) => {
        const t = l;
        if (!e) return;
        (((e) => {
          const t = l;
          if (!e) return;
          Array["from"](e["querySelectorAll"]("[data-shrink-fit]"))["forEach"](
            (e) => {
              const l = t;
              e["style"].fontSize = "";
              const o = e["getBoundingClientRect"]()["width"];
              if (o <= 0) return;
              const a = e["style"]["overflow"];
              e["style"]["overflow"] = "visible";
              const n = parseFloat(window.getComputedStyle(e).fontSize),
                u = Math["max"](6, 0.5 * n);
              let r = n;
              for (; e.scrollWidth > o + 1 && r > u;)
                ((r -= 0.5), (e.style["fontSize"] = r + "px"));
              e["style"]["overflow"] = a;
            },
          );
        })(e),
          e["querySelectorAll"](".r2-resize-handle").forEach((e) =>
            e["remove"](),
          ));
        const o = e.querySelector(".receipt2-page");
        if (!o) return;
        const a = Array["from"](o["querySelectorAll"]("thead th"));
        a["length"] < 2 ||
          a["forEach"]((o, u) => {
            const r = t;
            if (u === a["length"] - 1) return;
            ((o.style["position"] = "relative"),
              (o["style"]["overflow"] = "visible"));
            const i = document["createElement"]("div");
            ((i["className"] = "r2-resize-handle"),
              (i["title"] = "拖动调整列宽"),
              (i["style"].cssText =
                "position:absolute;right:-3px;top:0;width:6px;height:100%;cursor:col-resize;z-index:20;background:transparent;user-select:none;"),
              i.addEventListener("mouseenter", () => {
                const e = r;
                i["style"]["background"] = "rgba(64,158,255,0.35)";
              }),
              i["addEventListener"]("mouseleave", () => {
                const e = r;
                i["style"]["background"] = "transparent";
              }),
              i["addEventListener"]("mousedown", (t) => {
                const a = r;
                t["preventDefault"]();
                const c = t["clientX"],
                  s = Array["from"](e["querySelectorAll"](".receipt2-table")),
                  d = s[0] || o.closest("table"),
                  V = d["getBoundingClientRect"]().width,
                  m = Array.from(d["querySelectorAll"]("thead th")).map(
                    (e) => (e["getBoundingClientRect"]()["width"] / V) * 100,
                  );
                i.style["background"] = "rgba(64,158,255,0.55)";
                const w = (e) => {
                    const t = a,
                      l = ((e["clientX"] - c) / V) * 100,
                      o = Math["max"](3, m[u] + l),
                      n = Math.max(3, m[u + 1] - l);
                    s["forEach"]((e) => {
                      const l = t,
                        a = Array["from"](e["querySelectorAll"]("thead th"));
                      (a[u] && (a[u]["style"]["width"] = o + "%"),
                        a[u + 1] && (a[u + 1].style["width"] = n + "%"));
                    });
                  },
                  g = () => {
                    const e = a;
                    (document["removeEventListener"]("mousemove", w),
                      document["removeEventListener"]("mouseup", g),
                      (i["style"]["background"] = "transparent"));
                    const t = Array["from"](d["querySelectorAll"]("thead th")),
                      o = d.getBoundingClientRect()["width"];
                    ((n.value = t.map((t) => {
                      const l = e,
                        a = t["style"]["width"]
                          ? parseFloat(t.style["width"])
                          : (t.getBoundingClientRect()["width"] / o) * 100;
                      return Math["round"](10 * a) / 10;
                    })),
                      (() => {
                        const e = l;
                        localStorage["setItem"](da, JSON.stringify(n["value"]));
                      })());
                  };
                (document.addEventListener("mousemove", w),
                  document["addEventListener"]("mouseup", g));
              }),
              o.appendChild(i));
          });
      },
      Ce = (e) => {
        const t = l;
        let o = e["target"]["closest"]("[data-r2-el]");
        if (!o) {
          const l =
            document["elementsFromPoint"](e.clientX, e["clientY"]) || [];
          for (const e of l) {
            const l = e["closest"] && e["closest"]("[data-r2-el]");
            if (l && B[l["getAttribute"]("data-r2-el") || ""]) {
              o = l;
              break;
            }
          }
        }
        if (!o) return;
        const a = o.getAttribute("data-r2-el");
        if (!a || !B[a]) return;
        (e["preventDefault"](), e.stopPropagation());
        const n = o["getBoundingClientRect"]();
        let u = n["bottom"] + 8,
          r = n["left"];
        (u + 240 > window["innerHeight"] &&
          (u = Math["max"](8, n["top"] - 240 - 8)),
          r + 280 > window["innerWidth"] &&
            (r = Math["max"](8, window["innerWidth"] - 280 - 8)),
          (U.value = { top: u, left: r }),
          (k["value"] = a));
        const i = b["value"][a] || {
          offsetXMm: 0,
          offsetYMm: 0,
          fontSize: 0,
          widthMm: 0,
          visible: !0,
        };
        ((I["value"] = { ...i }), (P["value"] = { ...i }), (T = o));
      },
      ze = (e) => {
        const t = l;
        (S && S.removeEventListener("click", Ce),
          (S = e),
          e && e["addEventListener"]("click", Ce));
      },
      xe = async () => {
        var e;
        const t = k.value;
        t &&
          ((b.value = { ...b.value, [t]: { ...P.value } }),
          A(),
          (k.value = null),
          (T = null),
          (null == (e = o.isReceipt2Active) ? void 0 : e.call(o)) &&
            (await ve(),
            S &&
              requestAnimationFrame(() => {
                (pe(S), ze(S));
              })));
      },
      Be = () => {
        const e = l;
        ((P.value = { ...I["value"] }), Y(), (k["value"] = null), (T = null));
      },
      Me = () => {
        P["value"] = {
          offsetXMm: 0,
          offsetYMm: 0,
          fontSize: 0,
          widthMm: 0,
          visible: !0,
        };
      };
    return (
      Vue.onMounted(() => {
        ((() => {
          const e = l;
          try {
            const t = localStorage["getItem"](sa);
            if (!t)
              return ((v["value"] = { ...u }), void (f["value"] = { ...u }));
            const l = Z(JSON["parse"](t));
            ((v["value"] = l), (f["value"] = { ...l }));
          } catch (t) {
            ((v["value"] = { ...u }), (f["value"] = { ...u }));
          }
        })(),
          (() => {
            const e = l;
            try {
              const t = localStorage["getItem"](ma);
              if (!t)
                return ((h["value"] = { ...s }), void (p["value"] = { ...s }));
              const l = X(JSON["parse"](t));
              ((h["value"] = l), (p["value"] = { ...l }));
            } catch (t) {
              ((h["value"] = { ...s }), (p["value"] = { ...s }));
            }
          })(),
          (() => {
            const e = l;
            try {
              const t = localStorage["getItem"](wa);
              if (!t)
                return (
                  (C["value"] = { ...g, metaOrder: [...g["metaOrder"]] }),
                  void (z.value = { ...g, metaOrder: [...g["metaOrder"]] })
                );
              const l = te(JSON.parse(t));
              ((C["value"] = l),
                (z["value"] = { ...l, metaOrder: [...l["metaOrder"]] }));
            } catch (t) {
              ((C.value = { ...g, metaOrder: [...g["metaOrder"]] }),
                (z["value"] = { ...g, metaOrder: [...g["metaOrder"]] }));
            }
          })(),
          (() => {
            const e = Jo;
            try {
              const t = localStorage.getItem(ga);
              if (t) {
                const l = JSON["parse"](t);
                i["value"] = {
                  enabled: !!l.enabled,
                  name: "string" == typeof l["name"] ? l.name : "",
                };
              } else i["value"] = { ...r };
              c["value"] = { ...i["value"] };
            } catch (t) {
              ((i["value"] = { ...r }), (c.value = { ...r }));
            }
          })(),
          D(),
          (() => {
            const e = l;
            try {
              const t = localStorage.getItem(da);
              if (!t) return void (n["value"] = [...a]);
              const l = JSON["parse"](t);
              Array.isArray(l) &&
                l["length"] === a["length"] &&
                (n.value = l.map((e) => Math.max(3, Number(e) || 3)));
            } catch (t) {
              n["value"] = [...a];
            }
          })(),
          (() => {
            const e = l;
            try {
              H["value"] = localStorage.getItem(Va) || "";
            } catch (t) {}
          })());
      }),
      t({
        buildReceipt2Html: ge,
        exportReceipt2PdfToBrowserPrint: async () => {
          await ye();
        },
        openFontDialog: () => {
          const e = l;
          ((f.value = { ...v.value }),
            (p["value"] = { ...h["value"] }),
            (c["value"] = { ...i["value"] }),
            (z["value"] = {
              ...C["value"],
              metaOrder: [...C.value["metaOrder"]],
            }),
            (y["value"] = !0));
        },
        printDirect: async () => {
          const e = l,
            t = {
              fontSettings: { ...v["value"] },
              columnWidths: [...n["value"]],
              printSettings: { ...h["value"] },
              printer: H.value || "系统默认",
            };
          JSON.stringify(t, null, 2);
          const o = ElementPlus.ElLoading["service"]({
            lock: !0,
            text: "正在生成收据单2...",
            background: "rgba(0, 0, 0, 0.7)",
          });
          try {
            (await ye(),
              ElementPlus.ElMessage.success("收据单2已打开浏览器打印"));
          } catch (a) {
            ElementPlus.ElMessage["error"](
              "收据单2打印失败: " + ((null == a ? void 0 : a.message) || a),
            );
          } finally {
            o["close"]();
          }
        },
        refreshPreview: ve,
        initColumnResize: pe,
        initElementEditor: ze,
        destroyElementEditor: () => {
          const e = l;
          (S && (S["removeEventListener"]("click", Ce), (S = null)),
            (k.value = null),
            (T = null));
        },
        resetAllElementConfigs: async () => {
          var e;
          ((b["value"] = L()),
            A(),
            (null == (e = o.isReceipt2Active) ? void 0 : e.call(o)) &&
              (await ve()));
        },
        copyPreviewToClipboard: async (e) => {
          const t = l;
          if (!e) return void ElementPlus.ElMessage.error("预览容器未就绪");
          const o = ElementPlus.ElLoading["service"]({
            lock: !0,
            text: "生成图片中...",
            background: "rgba(0,0,0,0.7)",
          });
          try {
            await document["fonts"]["ready"];
            const l = await m(e, {
                useCORS: !0,
                scale: 2,
                backgroundColor: "#ffffff",
              }),
              o = await new Promise((e, o) =>
                l["toBlob"](
                  (l) => (l ? e(l) : o(new Error("toBlob失败"))),
                  "image/png",
                ),
              ),
              a = new ClipboardItem({ "image/png": o });
            (await navigator["clipboard"].write([a]),
              ElementPlus.ElMessage.success("收据单2已复制到剪切板！"));
          } catch (a) {
            ElementPlus.ElMessage["error"](
              "复制失败: " + ((null == a ? void 0 : a["message"]) || a),
            );
          } finally {
            o.close();
          }
        },
        exportPreviewToPdf: async (e) => {
          const t = l;
          if (!e) return void ElementPlus.ElMessage["error"]("预览容器未就绪");
          const o = ElementPlus.ElLoading.service({
            lock: !0,
            text: "导出PDF中...",
            background: "rgba(0,0,0,0.7)",
          });
          try {
            await document["fonts"]["ready"];
            const l = Array.from(e.querySelectorAll(".receipt2-page"));
            if (0 === l.length) throw new Error("未找到收据页面");
            const o = X(h["value"]),
              a = o["widthMm"] >= o["heightMm"] ? "landscape" : "portrait",
              n = new w({
                orientation: a,
                unit: "mm",
                format: [o["widthMm"], o["heightMm"]],
              });
            for (let e = 0; e < l["length"]; e++) {
              const u = (
                await m(l[e], {
                  useCORS: !0,
                  scale: 2,
                  backgroundColor: "#ffffff",
                })
              ).toDataURL("image/jpeg", 0.95);
              (e > 0 && n["addPage"]([o.widthMm, o["heightMm"]], a),
                n["addImage"](u, "JPEG", 0, 0, o["widthMm"], o["heightMm"]));
            }
            (n["save"]("收据单2.pdf"),
              ElementPlus.ElMessage.success("收据单2已导出PDF"));
          } catch (a) {
            ElementPlus.ElMessage["error"](
              "导出PDF失败: " + ((null == a ? void 0 : a["message"]) || a),
            );
          } finally {
            o["close"]();
          }
        },
        printFromContainer: async (e) => {
          const t = l;
          if (!e) return;
          const o = Z(v["value"]),
            a = e["cloneNode"](!0);
          a.querySelectorAll(".r2-resize-handle").forEach((e) => e["remove"]());
          const n =
              '<!DOCTYPE html><html><head><meta charset="utf-8"><title>收据单2</title>\n    <style>html,body{margin:0;padding:0;background:#fff;}' +
              ue(o, X(h["value"])) +
              '</style>\n  </head><body><div class="receipt2-root">' +
              a["innerHTML"] +
              "</div></body></html>",
            u = document["createElement"]("iframe");
          ((u["style"]["cssText"] =
            "position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;"),
            document.body["appendChild"](u));
          const r = u["contentWindow"],
            i = u["contentDocument"] || r["document"];
          (i["open"](),
            i.write(n),
            i["close"](),
            await new Promise((e) => {
              const l = t,
                o = Array["from"](i["querySelectorAll"]("img"));
              if (0 === o.length) return void e();
              let a = 0;
              o.forEach((t) => {
                const n = l,
                  u = () => {
                    (a++, a === o["length"] && e());
                  };
                t["complete"] ? u() : ((t["onload"] = u), (t.onerror = u));
              });
            }),
            setTimeout(() => {
              const e = t;
              (r["focus"](),
                r["print"](),
                setTimeout(() => {
                  const t = e;
                  document["body"]["contains"](u) &&
                    document["body"]["removeChild"](u);
                }, 1e3));
            }, 500));
        },
        printSilent: async (e) => {
          const t = l;
          if (!W["value"])
            return (
              ElementPlus.ElMessage["warning"](
                "直接打印仅在 Electron 客户端可用",
              ),
              !1
            );
          if (!e) return (ElementPlus.ElMessage["error"]("预览容器未就绪"), !1);
          const o = ElementPlus.ElLoading["service"]({
            lock: !0,
            text: "正在发送到打印机...",
            background: "rgba(0,0,0,0.7)",
          });
          try {
            const l = Z(v["value"]),
              o = X(h.value),
              a = e.cloneNode(!0);
            (a["querySelectorAll"](".r2-resize-handle")["forEach"]((e) =>
              e["remove"](),
            ),
              "landscape" === o["orientation"] &&
                Array["from"](a["querySelectorAll"](".receipt2-page"))[
                  "forEach"
                ]((e) => {
                  const l = t,
                    o = document["createElement"]("div");
                  ((o["className"] = "r2-page-wrap"),
                    e.parentNode["insertBefore"](o, e),
                    o["appendChild"](e));
                }));
            const n =
                '<!DOCTYPE html><html><head><meta charset="utf-8"><title>收据单2</title>\n      <style>html,body{margin:0;padding:0;background:#fff;}' +
                ue(l, o) +
                '</style>\n    </head><body><div class="receipt2-root">' +
                a["innerHTML"] +
                "</div></body></html>",
              u = o["orientation"] === "landscape",
              r = await window.electronAPI["silentPrint"](n, H["value"] || "", {
                landscape: !1,
                copies: o["copies"],
                pageWidthMm: u ? o["heightMm"] : o["widthMm"],
                pageHeightMm: u ? o["widthMm"] : o["heightMm"],
              });
            return (null == r ? void 0 : r.success)
              ? (ElementPlus.ElMessage["success"](
                  "收据单2已发送至打印机：" + (H["value"] || "系统默认"),
                ),
                !0)
              : (ElementPlus.ElMessage["error"](
                  "打印失败：" +
                    ((null == r ? void 0 : r["reason"]) || "未知错误"),
                ),
                !1);
          } catch (a) {
            return (
              ElementPlus.ElMessage.error(
                "直接打印失败: " + ((null == a ? void 0 : a["message"]) || a),
              ),
              !1
            );
          } finally {
            o["close"]();
          }
        },
        isElectronEnv: W,
      }),
      (e, t) => {
        const o = l,
          a = Vue.resolveComponent("el-switch"),
          n = Vue.resolveComponent("el-form-item"),
          u = Vue.resolveComponent("el-input"),
          r = Vue.resolveComponent("el-input-number"),
          i = Vue.resolveComponent("el-divider"),
          s = Vue.resolveComponent("el-option"),
          d = Vue.resolveComponent("el-select"),
          m = Vue.resolveComponent("el-button"),
          w = Vue.resolveComponent("el-checkbox"),
          g = Vue.resolveComponent("el-radio-button"),
          v = Vue.resolveComponent("el-radio-group"),
          h = Vue.resolveComponent("el-form"),
          C = Vue.resolveComponent("el-dialog");
        return (
          Vue.openBlock(),
          Vue.createElementBlock(
            Vue.Fragment,
            null,
            [
              Vue.createVNode(
                C,
                {
                  modelValue: y.value,
                  "onUpdate:modelValue":
                    t[30] || (t[30] = (e) => (y["value"] = e)),
                  title: "收据单2 设置",
                  width: "460px",
                  "destroy-on-close": !1,
                  onOpen: J,
                },
                {
                  footer: Vue.withCtx(() => [
                    Vue.createVNode(
                      m,
                      { onClick: fe },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[61] ||
                            (t[61] = [Vue.createTextVNode("重置默认")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      m,
                      { onClick: t[29] || (t[29] = (e) => (y["value"] = !1)) },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[62] || (t[62] = [Vue.createTextVNode("取消")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      m,
                      { type: "primary", onClick: he },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[63] || (t[63] = [Vue.createTextVNode("保存")]),
                        ),
                        _: 1,
                      },
                    ),
                  ]),
                  default: Vue.withCtx(() => [
                    Vue.createVNode(
                      h,
                      { "label-width": "110px" },
                      {
                        default: Vue.withCtx(() => [
                          Vue.createVNode(
                            n,
                            { label: "自定义品牌名" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  a,
                                  {
                                    modelValue: c["value"]["enabled"],
                                    "onUpdate:modelValue":
                                      t[0] ||
                                      (t[0] = (e) =>
                                        (c["value"]["enabled"] = e)),
                                  },
                                  null,
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          c["value"].enabled
                            ? (Vue.openBlock(),
                              Vue.createBlock(
                                n,
                                { key: 0, label: "品牌名称" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      u,
                                      {
                                        modelValue: c["value"]["name"],
                                        "onUpdate:modelValue":
                                          t[1] ||
                                          (t[1] = (e) =>
                                            (c["value"]["name"] = e)),
                                        placeholder: "请输入品牌名",
                                        maxlength: "40",
                                        "show-word-limit": "",
                                        style: { width: "200px" },
                                      },
                                      null,
                                      8,
                                      ["modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ))
                            : Vue.createCommentVNode("", !0),
                          Vue.createVNode(
                            n,
                            { label: "品牌字体" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  r,
                                  {
                                    modelValue: f.value["headerFontSize"],
                                    "onUpdate:modelValue":
                                      t[2] ||
                                      (t[2] = (e) =>
                                        (f["value"]["headerFontSize"] = e)),
                                    min: 14,
                                    max: 36,
                                    step: 1,
                                  },
                                  null,
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            n,
                            { label: "编号日期字体" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  r,
                                  {
                                    modelValue: f["value"]["orderDateFontSize"],
                                    "onUpdate:modelValue":
                                      t[3] ||
                                      (t[3] = (e) =>
                                        (f["value"]["orderDateFontSize"] = e)),
                                    min: 8,
                                    max: 18,
                                    step: 1,
                                  },
                                  null,
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            n,
                            { label: "表格字体" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  r,
                                  {
                                    modelValue: f["value"]["tableFontSize"],
                                    "onUpdate:modelValue":
                                      t[4] ||
                                      (t[4] = (e) =>
                                        (f["value"].tableFontSize = e)),
                                    min: 8,
                                    max: 18,
                                    step: 1,
                                  },
                                  null,
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            n,
                            { label: "金额字体" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  r,
                                  {
                                    modelValue: f["value"].amountFontSize,
                                    "onUpdate:modelValue":
                                      t[5] ||
                                      (t[5] = (e) =>
                                        (f["value"].amountFontSize = e)),
                                    min: 16,
                                    max: 40,
                                    step: 1,
                                  },
                                  null,
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            n,
                            { label: "基础信息字体" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  r,
                                  {
                                    modelValue: f["value"]["metaFontSize"],
                                    "onUpdate:modelValue":
                                      t[6] ||
                                      (t[6] = (e) =>
                                        (f.value["metaFontSize"] = e)),
                                    min: 8,
                                    max: 18,
                                    step: 1,
                                  },
                                  null,
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            n,
                            { label: "说明字体" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  r,
                                  {
                                    modelValue:
                                      f["value"]["declarationFontSize"],
                                    "onUpdate:modelValue":
                                      t[7] ||
                                      (t[7] = (e) =>
                                        (f.value["declarationFontSize"] = e)),
                                    min: 8,
                                    max: 18,
                                    step: 1,
                                  },
                                  null,
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            i,
                            { "content-position": "left" },
                            {
                              default: Vue.withCtx(
                                () =>
                                  t[36] ||
                                  (t[36] = [Vue.createTextVNode("纸张设置")]),
                              ),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            n,
                            { label: "宽度 (mm)" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  r,
                                  {
                                    modelValue: p.value["widthMm"],
                                    "onUpdate:modelValue":
                                      t[8] ||
                                      (t[8] = (e) => (p.value["widthMm"] = e)),
                                    min: 50,
                                    max: 500,
                                    step: 1,
                                  },
                                  null,
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            n,
                            { label: "高度 (mm)" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  r,
                                  {
                                    modelValue: p.value["heightMm"],
                                    "onUpdate:modelValue":
                                      t[9] ||
                                      (t[9] = (e) =>
                                        (p["value"]["heightMm"] = e)),
                                    min: 50,
                                    max: 500,
                                    step: 1,
                                  },
                                  null,
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            n,
                            { label: "方向" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  d,
                                  {
                                    modelValue: p["value"]["orientation"],
                                    "onUpdate:modelValue":
                                      t[10] ||
                                      (t[10] = (e) =>
                                        (p["value"]["orientation"] = e)),
                                    style: { width: "200px" },
                                  },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(s, {
                                        label: "纵向",
                                        value: "portrait",
                                      }),
                                      Vue.createVNode(s, {
                                        label: "横向",
                                        value: "landscape",
                                      }),
                                    ]),
                                    _: 1,
                                  },
                                  8,
                                  ["modelValue"],
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            n,
                            { label: "常用尺寸" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createElementVNode("div", Zo, [
                                  Vue.createVNode(
                                    m,
                                    {
                                      size: "small",
                                      onClick:
                                        t[11] ||
                                        (t[11] = (e) => V("pin-210-140")),
                                    },
                                    {
                                      default: Vue.withCtx(
                                        () =>
                                          t[37] ||
                                          (t[37] = [
                                            Vue.createTextVNode("210×140"),
                                          ]),
                                      ),
                                      _: 1,
                                    },
                                  ),
                                  Vue.createVNode(
                                    m,
                                    {
                                      size: "small",
                                      onClick:
                                        t[12] ||
                                        (t[12] = (e) => V("pin-200-140")),
                                    },
                                    {
                                      default: Vue.withCtx(
                                        () =>
                                          t[38] ||
                                          (t[38] = [
                                            Vue.createTextVNode("200×140"),
                                          ]),
                                      ),
                                      _: 1,
                                    },
                                  ),
                                  Vue.createVNode(
                                    m,
                                    {
                                      size: "small",
                                      onClick:
                                        t[13] ||
                                        (t[13] = (e) => V("pin-210-90")),
                                    },
                                    {
                                      default: Vue.withCtx(
                                        () =>
                                          t[39] ||
                                          (t[39] = [
                                            Vue.createTextVNode("210×90"),
                                          ]),
                                      ),
                                      _: 1,
                                    },
                                  ),
                                  Vue.createVNode(
                                    m,
                                    {
                                      size: "small",
                                      onClick:
                                        t[14] ||
                                        (t[14] = (e) => V("pin-200-90")),
                                    },
                                    {
                                      default: Vue.withCtx(
                                        () =>
                                          t[40] ||
                                          (t[40] = [
                                            Vue.createTextVNode("200×90"),
                                          ]),
                                      ),
                                      _: 1,
                                    },
                                  ),
                                  Vue.createVNode(
                                    m,
                                    {
                                      size: "small",
                                      onClick:
                                        t[15] ||
                                        (t[15] = (e) => V("a4-landscape")),
                                    },
                                    {
                                      default: Vue.withCtx(
                                        () =>
                                          t[41] ||
                                          (t[41] = [
                                            Vue.createTextVNode("A4横向"),
                                          ]),
                                      ),
                                      _: 1,
                                    },
                                  ),
                                  Vue.createVNode(
                                    m,
                                    {
                                      size: "small",
                                      onClick:
                                        t[16] ||
                                        (t[16] = (e) => V("a4-portrait")),
                                    },
                                    {
                                      default: Vue.withCtx(
                                        () =>
                                          t[42] ||
                                          (t[42] = [
                                            Vue.createTextVNode("A4纵向"),
                                          ]),
                                      ),
                                      _: 1,
                                    },
                                  ),
                                  Vue.createVNode(
                                    m,
                                    {
                                      size: "small",
                                      onClick:
                                        t[17] ||
                                        (t[17] = (e) => V("a5-landscape")),
                                    },
                                    {
                                      default: Vue.withCtx(
                                        () =>
                                          t[43] ||
                                          (t[43] = [
                                            Vue.createTextVNode("A5横向"),
                                          ]),
                                      ),
                                      _: 1,
                                    },
                                  ),
                                  Vue.createVNode(
                                    m,
                                    {
                                      size: "small",
                                      onClick:
                                        t[18] ||
                                        (t[18] = (e) => V("a5-portrait")),
                                    },
                                    {
                                      default: Vue.withCtx(
                                        () =>
                                          t[44] ||
                                          (t[44] = [
                                            Vue.createTextVNode("A5纵向"),
                                          ]),
                                      ),
                                      _: 1,
                                    },
                                  ),
                                ]),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            i,
                            { "content-position": "left" },
                            {
                              default: Vue.withCtx(
                                () =>
                                  t[45] ||
                                  (t[45] = [Vue.createTextVNode("头部元素")]),
                              ),
                              _: 1,
                            },
                          ),
                          Vue.createElementVNode("div", Xo, [
                            Vue.createElementVNode("div", Qo, [
                              Vue.createVNode(
                                w,
                                {
                                  modelValue: z["value"]["showOrderNo"],
                                  "onUpdate:modelValue":
                                    t[19] ||
                                    (t[19] = (e) =>
                                      (z["value"].showOrderNo = e)),
                                  style: { width: "80px" },
                                },
                                {
                                  default: Vue.withCtx(
                                    () =>
                                      t[46] ||
                                      (t[46] = [Vue.createTextVNode("编号")]),
                                  ),
                                  _: 1,
                                },
                                8,
                                ["modelValue"],
                              ),
                              Vue.createVNode(
                                v,
                                {
                                  modelValue: z["value"]["orderNoPosition"],
                                  "onUpdate:modelValue":
                                    t[20] ||
                                    (t[20] = (e) =>
                                      (z["value"]["orderNoPosition"] = e)),
                                  size: "small",
                                  disabled: !z.value.showOrderNo,
                                },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      g,
                                      { value: "left" },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[47] ||
                                            (t[47] = [
                                              Vue.createTextVNode("左侧"),
                                            ]),
                                        ),
                                        _: 1,
                                      },
                                    ),
                                    Vue.createVNode(
                                      g,
                                      { value: "right" },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[48] ||
                                            (t[48] = [
                                              Vue.createTextVNode("右侧"),
                                            ]),
                                        ),
                                        _: 1,
                                      },
                                    ),
                                  ]),
                                  _: 1,
                                },
                                8,
                                ["modelValue", "disabled"],
                              ),
                            ]),
                            Vue.createElementVNode("div", Ro, [
                              Vue.createVNode(
                                w,
                                {
                                  modelValue: z.value["showDate"],
                                  "onUpdate:modelValue":
                                    t[21] ||
                                    (t[21] = (e) => (z["value"].showDate = e)),
                                  style: { width: "80px" },
                                },
                                {
                                  default: Vue.withCtx(
                                    () =>
                                      t[49] ||
                                      (t[49] = [Vue.createTextVNode("日期")]),
                                  ),
                                  _: 1,
                                },
                                8,
                                ["modelValue"],
                              ),
                              Vue.createVNode(
                                v,
                                {
                                  modelValue: z["value"]["datePosition"],
                                  "onUpdate:modelValue":
                                    t[22] ||
                                    (t[22] = (e) =>
                                      (z["value"]["datePosition"] = e)),
                                  size: "small",
                                  disabled: !z.value["showDate"],
                                },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      g,
                                      { value: "left" },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[50] ||
                                            (t[50] = [
                                              Vue.createTextVNode("左侧"),
                                            ]),
                                        ),
                                        _: 1,
                                      },
                                    ),
                                    Vue.createVNode(
                                      g,
                                      { value: "right" },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[51] ||
                                            (t[51] = [
                                              Vue.createTextVNode("右侧"),
                                            ]),
                                        ),
                                        _: 1,
                                      },
                                    ),
                                  ]),
                                  _: 1,
                                },
                                8,
                                ["modelValue", "disabled"],
                              ),
                            ]),
                            Vue.createElementVNode("div", Fo, [
                              Vue.createVNode(
                                w,
                                {
                                  modelValue: z["value"]["showQrcode"],
                                  "onUpdate:modelValue":
                                    t[23] ||
                                    (t[23] = (e) =>
                                      (z.value["showQrcode"] = e)),
                                  style: { width: "80px" },
                                },
                                {
                                  default: Vue.withCtx(
                                    () =>
                                      t[52] ||
                                      (t[52] = [Vue.createTextVNode("二维码")]),
                                  ),
                                  _: 1,
                                },
                                8,
                                ["modelValue"],
                              ),
                              Vue.createVNode(
                                v,
                                {
                                  modelValue: z["value"].qrcodePosition,
                                  "onUpdate:modelValue":
                                    t[24] ||
                                    (t[24] = (e) =>
                                      (z["value"].qrcodePosition = e)),
                                  size: "small",
                                  disabled: !z["value"]["showQrcode"],
                                },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      g,
                                      { value: "left" },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[53] ||
                                            (t[53] = [
                                              Vue.createTextVNode("左侧"),
                                            ]),
                                        ),
                                        _: 1,
                                      },
                                    ),
                                    Vue.createVNode(
                                      g,
                                      { value: "right" },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[54] ||
                                            (t[54] = [
                                              Vue.createTextVNode("右侧"),
                                            ]),
                                        ),
                                        _: 1,
                                      },
                                    ),
                                  ]),
                                  _: 1,
                                },
                                8,
                                ["modelValue", "disabled"],
                              ),
                            ]),
                          ]),
                          Vue.createVNode(
                            i,
                            { "content-position": "left" },
                            {
                              default: Vue.withCtx(
                                () =>
                                  t[55] ||
                                  (t[55] = [
                                    Vue.createTextVNode("信息栏（拖动排序）"),
                                  ]),
                              ),
                              _: 1,
                            },
                          ),
                          Vue.createElementVNode("div", $o, [
                            (Vue.openBlock(!0),
                            Vue.createElementBlock(
                              Vue.Fragment,
                              null,
                              Vue.renderList(z.value["metaOrder"], (e, t) => {
                                const l = o;
                                return (
                                  Vue.openBlock(),
                                  Vue.createElementBlock(
                                    "div",
                                    {
                                      key: e,
                                      style: {
                                        display: "flex",
                                        "align-items": "center",
                                        gap: "6px",
                                        padding: "4px 8px",
                                        background: "#f5f7fa",
                                        "border-radius": "4px",
                                      },
                                    },
                                    [
                                      Vue.createVNode(
                                        w,
                                        {
                                          "model-value":
                                            z.value[
                                              "show" +
                                                e["charAt"](0).toUpperCase() +
                                                e.slice(1)
                                            ],
                                          "onUpdate:modelValue": (t) => {
                                            const o = l;
                                            z.value[
                                              "show" +
                                                e.charAt(0)["toUpperCase"]() +
                                                e["slice"](1)
                                            ] = t;
                                          },
                                          style: { "margin-right": "0" },
                                        },
                                        null,
                                        8,
                                        ["model-value", "onUpdate:modelValue"],
                                      ),
                                      Vue.createElementVNode(
                                        "span",
                                        ea,
                                        Vue.toDisplayString(Vue.unref($)[e]),
                                        1,
                                      ),
                                      Vue.createVNode(
                                        m,
                                        {
                                          size: "small",
                                          icon: Vue.unref(N),
                                          disabled: 0 === t,
                                          circle: "",
                                          onClick: (e) => ee(t, -1),
                                        },
                                        null,
                                        8,
                                        ["icon", "disabled", "onClick"],
                                      ),
                                      Vue.createVNode(
                                        m,
                                        {
                                          size: "small",
                                          icon: Vue.unref(E),
                                          disabled:
                                            t ===
                                            z.value["metaOrder"]["length"] - 1,
                                          circle: "",
                                          onClick: (e) => ee(t, 1),
                                        },
                                        null,
                                        8,
                                        ["icon", "disabled", "onClick"],
                                      ),
                                    ],
                                  )
                                );
                              }),
                              128,
                            )),
                          ]),
                          Vue.createVNode(
                            i,
                            { "content-position": "left" },
                            {
                              default: Vue.withCtx(
                                () =>
                                  t[56] ||
                                  (t[56] = [Vue.createTextVNode("底部元素")]),
                              ),
                              _: 1,
                            },
                          ),
                          Vue.createElementVNode("div", ta, [
                            Vue.createVNode(
                              w,
                              {
                                modelValue: z.value["showAmounts"],
                                "onUpdate:modelValue":
                                  t[25] ||
                                  (t[25] = (e) => (z["value"].showAmounts = e)),
                              },
                              {
                                default: Vue.withCtx(
                                  () =>
                                    t[57] ||
                                    (t[57] = [Vue.createTextVNode("金额")]),
                                ),
                                _: 1,
                              },
                              8,
                              ["modelValue"],
                            ),
                            Vue.createVNode(
                              w,
                              {
                                modelValue: z["value"].showDeclaration,
                                "onUpdate:modelValue":
                                  t[26] ||
                                  (t[26] = (e) =>
                                    (z["value"]["showDeclaration"] = e)),
                              },
                              {
                                default: Vue.withCtx(
                                  () =>
                                    t[58] ||
                                    (t[58] = [Vue.createTextVNode("说明")]),
                                ),
                                _: 1,
                              },
                              8,
                              ["modelValue"],
                            ),
                          ]),
                          W["value"]
                            ? (Vue.openBlock(),
                              Vue.createBlock(
                                i,
                                { key: 1, "content-position": "left" },
                                {
                                  default: Vue.withCtx(
                                    () =>
                                      t[59] ||
                                      (t[59] = [
                                        Vue.createTextVNode("打印机设置"),
                                      ]),
                                  ),
                                  _: 1,
                                },
                              ))
                            : Vue.createCommentVNode("", !0),
                          W["value"]
                            ? (Vue.openBlock(),
                              Vue.createBlock(
                                n,
                                { key: 2, label: "选择打印机" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      d,
                                      {
                                        modelValue: H["value"],
                                        "onUpdate:modelValue":
                                          t[27] ||
                                          (t[27] = (e) => (H.value = e)),
                                        placeholder: "使用系统默认打印机",
                                        clearable: "",
                                        style: { width: "100%" },
                                        onChange: j,
                                      },
                                      {
                                        default: Vue.withCtx(() => [
                                          (Vue.openBlock(!0),
                                          Vue.createElementBlock(
                                            Vue.Fragment,
                                            null,
                                            Vue.renderList(O["value"], (e) => {
                                              const t = o;
                                              return (
                                                Vue.openBlock(),
                                                Vue.createBlock(
                                                  s,
                                                  {
                                                    key: e["name"],
                                                    label: e.isDefault
                                                      ? e.displayName +
                                                        "（默认）"
                                                      : e.displayName,
                                                    value: e["name"],
                                                  },
                                                  null,
                                                  8,
                                                  ["label", "value"],
                                                )
                                              );
                                            }),
                                            128,
                                          )),
                                        ]),
                                        _: 1,
                                      },
                                      8,
                                      ["modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ))
                            : Vue.createCommentVNode("", !0),
                          W["value"]
                            ? (Vue.openBlock(),
                              Vue.createBlock(
                                n,
                                { key: 3 },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      m,
                                      {
                                        size: "small",
                                        loading: G["value"],
                                        onClick: q,
                                      },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[60] ||
                                            (t[60] = [
                                              Vue.createTextVNode(
                                                "刷新打印机列表",
                                              ),
                                            ]),
                                        ),
                                        _: 1,
                                      },
                                      8,
                                      ["loading"],
                                    ),
                                    Vue.createElementVNode(
                                      "span",
                                      la,
                                      "已选：" +
                                        Vue.toDisplayString(
                                          H["value"] || "系统默认",
                                        ),
                                      1,
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ))
                            : Vue.createCommentVNode("", !0),
                          W["value"]
                            ? (Vue.openBlock(),
                              Vue.createBlock(
                                n,
                                { key: 4, label: "打印份数" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      r,
                                      {
                                        modelValue: p["value"]["copies"],
                                        "onUpdate:modelValue":
                                          t[28] ||
                                          (t[28] = (e) =>
                                            (p.value["copies"] = e)),
                                        min: 1,
                                        max: 99,
                                        step: 1,
                                      },
                                      null,
                                      8,
                                      ["modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ))
                            : Vue.createCommentVNode("", !0),
                        ]),
                        _: 1,
                      },
                    ),
                  ]),
                  _: 1,
                },
                8,
                ["modelValue"],
              ),
              (Vue.openBlock(),
              Vue.createBlock(Vue.Teleport, { to: "body" }, [
                k.value
                  ? (Vue.openBlock(),
                    Vue.createElementBlock("div", {
                      key: 0,
                      class: "r2-el-editor-mask",
                      onClick: Vue.withModifiers(Be, ["self"]),
                    }))
                  : Vue.createCommentVNode("", !0),
                k["value"]
                  ? (Vue.openBlock(),
                    Vue.createElementBlock(
                      "div",
                      {
                        key: 1,
                        class: "r2-el-editor",
                        style: Vue.normalizeStyle({
                          top: U["value"].top + "px",
                          left: U["value"]["left"] + "px",
                        }),
                      },
                      [
                        Vue.createElementVNode(
                          "div",
                          oa,
                          Vue.toDisplayString(B[k["value"]] || k.value),
                          1,
                        ),
                        Vue.createElementVNode("div", aa, [
                          t[64] ||
                            (t[64] = Vue.createElementVNode(
                              "label",
                              null,
                              "X偏移(mm)",
                              -1,
                            )),
                          Vue.createVNode(
                            r,
                            {
                              modelValue: P["value"]["offsetXMm"],
                              "onUpdate:modelValue":
                                t[31] ||
                                (t[31] = (e) => (P["value"].offsetXMm = e)),
                              step: 0.5,
                              precision: 1,
                              size: "small",
                              style: { width: "120px" },
                            },
                            null,
                            8,
                            ["modelValue"],
                          ),
                        ]),
                        Vue.createElementVNode("div", na, [
                          t[65] ||
                            (t[65] = Vue.createElementVNode(
                              "label",
                              null,
                              "Y偏移(mm)",
                              -1,
                            )),
                          Vue.createVNode(
                            r,
                            {
                              modelValue: P.value["offsetYMm"],
                              "onUpdate:modelValue":
                                t[32] ||
                                (t[32] = (e) => (P.value["offsetYMm"] = e)),
                              step: 0.5,
                              precision: 1,
                              size: "small",
                              style: { width: "120px" },
                            },
                            null,
                            8,
                            ["modelValue"],
                          ),
                        ]),
                        Vue.createElementVNode("div", ua, [
                          t[66] ||
                            (t[66] = Vue.createElementVNode(
                              "label",
                              null,
                              "字体(px)",
                              -1,
                            )),
                          Vue.createVNode(
                            r,
                            {
                              modelValue: P["value"]["fontSize"],
                              "onUpdate:modelValue":
                                t[33] ||
                                (t[33] = (e) => (P["value"]["fontSize"] = e)),
                              min: 0,
                              max: 60,
                              step: 1,
                              size: "small",
                              style: { width: "120px" },
                            },
                            null,
                            8,
                            ["modelValue"],
                          ),
                          t[67] ||
                            (t[67] = Vue.createElementVNode(
                              "span",
                              {
                                style: {
                                  color: "#999",
                                  "font-size": "11px",
                                  "margin-left": "4px",
                                },
                              },
                              "0=默认",
                              -1,
                            )),
                        ]),
                        Vue.createElementVNode("div", ra, [
                          t[68] ||
                            (t[68] = Vue.createElementVNode(
                              "label",
                              null,
                              "宽度(mm)",
                              -1,
                            )),
                          Vue.createVNode(
                            r,
                            {
                              modelValue: P["value"]["widthMm"],
                              "onUpdate:modelValue":
                                t[34] ||
                                (t[34] = (e) => (P["value"]["widthMm"] = e)),
                              min: 0,
                              max: 300,
                              step: 0.5,
                              precision: 1,
                              size: "small",
                              style: { width: "120px" },
                            },
                            null,
                            8,
                            ["modelValue"],
                          ),
                          t[69] ||
                            (t[69] = Vue.createElementVNode(
                              "span",
                              {
                                style: {
                                  color: "#999",
                                  "font-size": "11px",
                                  "margin-left": "4px",
                                },
                              },
                              "0=默认",
                              -1,
                            )),
                        ]),
                        Vue.createElementVNode("div", ia, [
                          Vue.createVNode(
                            w,
                            {
                              modelValue: P["value"]["visible"],
                              "onUpdate:modelValue":
                                t[35] ||
                                (t[35] = (e) => (P["value"]["visible"] = e)),
                            },
                            {
                              default: Vue.withCtx(
                                () =>
                                  t[70] ||
                                  (t[70] = [Vue.createTextVNode("显示")]),
                              ),
                              _: 1,
                            },
                            8,
                            ["modelValue"],
                          ),
                        ]),
                        Vue.createElementVNode("div", ca, [
                          Vue.createVNode(
                            m,
                            { size: "small", onClick: Me },
                            {
                              default: Vue.withCtx(
                                () =>
                                  t[71] ||
                                  (t[71] = [Vue.createTextVNode("重置")]),
                              ),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            m,
                            { size: "small", onClick: Be },
                            {
                              default: Vue.withCtx(
                                () =>
                                  t[72] ||
                                  (t[72] = [Vue.createTextVNode("取消")]),
                              ),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            m,
                            { size: "small", type: "primary", onClick: xe },
                            {
                              default: Vue.withCtx(
                                () =>
                                  t[73] ||
                                  (t[73] = [Vue.createTextVNode("确认")]),
                              ),
                              _: 1,
                            },
                          ),
                        ]),
                      ],
                      4,
                    ))
                  : Vue.createCommentVNode("", !0),
              ])),
            ],
            64,
          )
        );
      }
    );
  },
};
