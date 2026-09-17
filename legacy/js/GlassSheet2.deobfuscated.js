export default {
  __name: "GlassSheet2PrintManager",
  props: {
    getData: { type: Function },
    isActive: { type: Function },
    onPreviewHtmlChange: { type: Function },
  },
  setup(e, { expose: t }) {
    const l = Bn,
      o = e,
      a = () => ({
        paper: {
          widthMm: 297,
          heightMm: 210,
          paddingMm: 3,
          orientation: "landscape",
        },
        table: {
          title: "玻璃合片单",
          borderColor: "#444444",
          headerFontSize: 13.5,
          columns: [
            {
              key: "client",
              label: "客户",
              widthMm: 30,
              fontSize: 13,
              rowHeightMm: 7,
              fontColor: "#000000",
              visible: !0,
            },
            {
              key: "door",
              label: "门类",
              widthMm: 28,
              fontSize: 13,
              rowHeightMm: 7,
              fontColor: "#000000",
              visible: !0,
            },
            {
              key: "order",
              label: "单号",
              widthMm: 24,
              fontSize: 12,
              rowHeightMm: 7,
              fontColor: "#111111",
              visible: !0,
            },
            {
              key: "basicInfo",
              label: "订单信息",
              widthMm: 34,
              fontSize: 13,
              rowHeightMm: 7,
              fontColor: "#111111",
              visible: !0,
            },
            {
              key: "lockImg",
              label: "方向",
              widthMm: 20,
              fontSize: 10,
              rowHeightMm: 8,
              fontColor: "#111111",
              visible: !0,
            },
            {
              key: "doorsheet",
              label: "玻璃尺寸",
              widthMm: 36,
              fontSize: 14,
              rowHeightMm: 8,
              fontColor: "#111111",
              visible: !0,
            },
            {
              key: "doorImg",
              label: "门图",
              widthMm: 28,
              fontSize: 12,
              rowHeightMm: 6.2,
              fontColor: "#111111",
              visible: !0,
            },
            {
              key: "remark",
              label: "备注",
              widthMm: 30,
              fontSize: 12,
              rowHeightMm: 7,
              fontColor: "#111111",
              visible: !0,
            },
          ],
        },
        print: { copies: 1 },
      }),
      n = Vue.ref(!1),
      u = Vue.ref(!1),
      r = Vue.ref("paper"),
      i = Vue.ref(a()),
      c = Vue.ref(a()),
      s = Vue.ref(a()),
      d = Vue.ref([]),
      V = Vue.ref(null),
      m = Vue.ref({ w: 800, h: 600 }),
      w = Vue.computed(() => !!window["electronAPI"]),
      v = Vue.ref([]),
      f = Vue.ref(""),
      h = Vue.ref(!1),
      p = Vue.computed(() =>
        i["value"]["table"]["columns"].filter((e) => e.visible),
      ),
      C = () => {
        const e = l;
        try {
          localStorage["setItem"](Dn, JSON["stringify"](i.value));
        } catch (t) {}
      },
      z = () => {
        const e = l;
        try {
          localStorage["setItem"](An, f.value);
        } catch (t) {}
      },
      x = async () => {
        const e = l;
        if (w["value"]) {
          h["value"] = !0;
          try {
            v.value = await window["electronAPI"]["getPrinters"]();
          } catch (t) {
            ElementPlus.ElMessage["error"]("获取打印机列表失败");
          } finally {
            h["value"] = !1;
          }
        }
      },
      B = () => {
        c["value"] = a();
      },
      M = () => {
        s["value"] = a();
      },
      N = async () => {
        var e;
        const t = l;
        ((i["value"] = JSON.parse(JSON.stringify(c["value"]))),
          C(),
          (n["value"] = !1),
          (null == (e = o["isActive"]) ? void 0 : e.call(o)) && (await q()));
      },
      E = async () => {
        var e;
        const t = l;
        ((i["value"] = JSON["parse"](JSON["stringify"](s.value))),
          C(),
          (u.value = !1),
          (null == (e = o["isActive"]) ? void 0 : e.call(o)) && (await q()));
      },
      L = () => {
        const e = l,
          t = V["value"];
        m.value = t
          ? { w: t["clientWidth"] - 32, h: t["clientHeight"] - 32 }
          : {
              w: Math["max"](600, window.innerWidth - 500),
              h: Math["max"](400, window["innerHeight"] - 200),
            };
      },
      b = Vue.computed(() => {
        const e = l,
          t = s["value"]["paper"],
          o = m["value"].w,
          a = m.value.h;
        return Math["min"](
          o / Math["max"](1, t["widthMm"]),
          a / Math.max(1, t["heightMm"]),
        );
      }),
      D = (e) =>
        e["replace"](/&/g, "&amp;")
          .replace(/</g, "&lt;")
          ["replace"](/>/g, "&gt;")
          ["replace"](/"/g, "&quot;")
          ["replace"](/'/g, "&#39;"),
      A = (e) => {
        const t = l,
          o = ((e) => {
            const t = l;
            return String(null != e ? e : "")
              ["split"](/<br\s*\/?>/i)
              ["map"]((e) => e["trim"]())
              ["filter"](Boolean);
          })(e);
        return 0 === o["length"]
          ? ""
          : o
              .map((e) => '<div class="gs2-line">' + D(e) + "</div>")
              ["join"]("");
      },
      k = new y(),
      P = new Map([[g["MARGIN"], 1]]),
      I = new Map(),
      U = (e, t, o, a) => {
        var n, u;
        const r = l,
          i = (null == a ? void 0 : a.qrSize) || "17mm",
          c =
            (null == a ? void 0 : a["imgStyle"]) ||
            "width:100%;display:block;margin:0 auto;object-fit:contain;";
        switch (e) {
          case "client":
            return A(null == t ? void 0 : t["client"]);
          case "door":
            return A(null == t ? void 0 : t["door"]);
          case "doorImg": {
            const e = String(
              null != (n = null == t ? void 0 : t["doorImg"]) ? n : "",
            ).trim();
            return e ? '<img style="' + c + '" src="' + e + '" />' : "";
          }
          case "order": {
            const e = ((e) => {
                var t, o, a;
                return String(
                  null !=
                    (a =
                      null !=
                      (o =
                        null != (t = null == e ? void 0 : e["OrderID"])
                          ? t
                          : null == e
                            ? void 0
                            : e["orderID"])
                        ? o
                        : null == e
                          ? void 0
                          : e["qrcode"])
                    ? a
                    : "",
                );
              })(t),
              o = ((e) => {
                const t = l;
                if (!e) return null;
                const o = e + "::m1";
                if (I["has"](o)) return JSON["parse"](I["get"](o));
                try {
                  const l = k.write(e, 180, 180, P),
                    a = {
                      viewBox: l["getAttribute"]("viewBox") || "0 0 180 180",
                      inner: l.innerHTML,
                    };
                  return (I["set"](o, JSON["stringify"](a)), a);
                } catch (a) {
                  return null;
                }
              })(e),
              a = o
                ? '<svg style="width:' +
                  i +
                  ";height:" +
                  i +
                  ';display:block;margin:0 auto 0.5mm;" viewBox="' +
                  o["viewBox"] +
                  '" preserveAspectRatio="xMidYMid meet">' +
                  o["inner"] +
                  "</svg>"
                : "",
              n = ((e) => {
                const t = l,
                  o = String(e || "");
                if (!o) return "";
                const a = o["split"]("/");
                return a["length"] >= 3
                  ? D(a[0] + "/" + a[1]) + "<br>" + D(a["slice"](2).join("/"))
                  : 2 === a["length"]
                    ? D(a[0]) + "<br>" + D(a[1])
                    : D(o);
              })(e);
            return (
              a +
              (n
                ? '<div style="text-align:center;line-height:1.4;">' +
                  n +
                  "</div>"
                : "")
            );
          }
          case "basicInfo":
            return A(null == t ? void 0 : t["basicInfo"]);
          case "lockImg": {
            const e = String(
              null != (u = null == t ? void 0 : t.lockImg) ? u : "",
            ).trim();
            return e ? '<img style="' + c + '" src="' + e + '" />' : "";
          }
          case "doorsheet":
            return A(null == t ? void 0 : t["doorsheet"]);
          case "remark":
            return A(null == t ? void 0 : t["remark"]);
          default:
            return "";
        }
      },
      S = (e, t) => {
        const o = l,
          a = t["table"]["columns"]["filter"]((e) => e.visible);
        if (0 === a["length"])
          return '<div style="text-align:center;color:#999;padding:20px;">无可见列</div>';
        const n = a["map"](
            (e) =>
              '<th style="width:' +
              e["widthMm"] +
              "mm;font-size:" +
              t["table"]["headerFontSize"] +
              'pt;">' +
              e.label +
              "</th>",
          )["join"](""),
          u = e
            .map((e) => {
              const t = o,
                l = a
                  .map((l) => {
                    return (
                      '<td style="' +
                      ("width:" +
                        (a = l)["widthMm"] +
                        "mm;font-size:" +
                        a["fontSize"] +
                        "pt;color:" +
                        a["fontColor"] +
                        ";line-height:" +
                        a["rowHeightMm"] +
                        "mm;" +
                        '">') +
                      U(l["key"], e, 0, { qrSize: "15mm" }) +
                      "</td>"
                    );
                    var a;
                  })
                  ["join"]("");
              return "<tr>" + l + "</tr>";
            })
            ["join"]("");
        return (
          '<div style="text-align:center;font-size:7mm;line-height:8mm;font-weight:500;margin-bottom:0.5mm;">' +
          D(t["table"]["title"]) +
          '</div>\n    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">\n      <thead><tr>' +
          n +
          "</tr></thead>\n      <tbody>" +
          u +
          "</tbody>\n    </table>\n    <style>\n      .gs2-prev-table th, .gs2-prev-table td { border:0.2mm solid " +
          t["table"]["borderColor"] +
          "; vertical-align:top; padding:1mm 1.2mm; word-break:break-all; }\n      .gs2-prev-table th { text-align:center; font-weight:600; }\n    </style>"
        );
      },
      T = Vue.ref("");
    let Y = 0;
    const W = async () => {
      const e = l,
        t = ++Y,
        o = JSON["parse"](JSON.stringify(s["value"])),
        a = b["value"],
        n = d.value;
      if (0 === n["length"])
        return void (T["value"] =
          '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#999;font-size:12px;">暂无预览数据</div>');
      const u = await H(n, o);
      if (t !== Y) return;
      const r = a / 3.78,
        i = o["table"]["columns"]
          ["filter"]((t) => t["visible"])
          ["reduce"]((t, l) => t + l["widthMm"], 0),
        c = Math["max"](120, o.paper["widthMm"] * a),
        V = Math.max(120, o["paper"]["heightMm"] * a),
        m = o["paper"]["paddingMm"] * a,
        w = u["map"]((t, l) => {
          const a = e,
            n = S(t, o),
            s =
              u["length"] > 1
                ? '<div class="gs2-layout-page-label">第 ' +
                  (l + 1) +
                  " / " +
                  u.length +
                  " 页</div>"
                : "";
          return (
            '<div class="gs2-layout-page-wrap">' +
            s +
            '<div class="gs2-layout-canvas" style="width:' +
            c +
            "px;height:" +
            V +
            "px;padding:" +
            m +
            'px;"><div class="gs2-prev-table" style="transform-origin:top left;transform:scale(' +
            r +
            ");width:" +
            3.78 * i +
            'px;">' +
            n +
            "</div></div></div>"
          );
        }).join("");
      T["value"] = w;
    };
    Vue.watch(
      [s, d, b],
      () => {
        u["value"] && W();
      },
      { deep: !0 },
    );
    const O = async (e, t) => {
        var o;
        const a = l,
          n = t["table"]["columns"]["filter"]((e) => e["visible"]),
          u = new Map(n["map"]((e) => [e["key"], e])),
          r = n
            .map(
              (e) =>
                '<th style="width:' +
                e["widthMm"] +
                "mm;font-size:" +
                t["table"]["headerFontSize"] +
                'pt;">' +
                e["label"] +
                "</th>",
            )
            ["join"](""),
          i = (e, t) => {
            const l = a,
              o = n["map"](
                (t) =>
                  '<td style="' +
                  ((e) => {
                    const t = a,
                      l = u.get(e);
                    return (
                      "width:" +
                      l["widthMm"] +
                      "mm;font-size:" +
                      l["fontSize"] +
                      "pt;color:" +
                      l["fontColor"] +
                      ";line-height:" +
                      l["rowHeightMm"] +
                      "mm;"
                    );
                  })(t["key"]) +
                  '">' +
                  U(t["key"], e, 0, {
                    qrSize: "17mm",
                    imgStyle:
                      "width:100%;display:block;margin:0 auto;object-fit:contain;",
                  }) +
                  "</td>",
              )["join"]("");
            return '<tr data-ridx="' + t + '">' + o + "</tr>";
          },
          c = e["map"]((e, t) => i(e, t))["join"](""),
          s =
            '<table style="width:100%;border-collapse:collapse;table-layout:fixed;">\n    <thead><tr>' +
            r +
            "</tr></thead><tbody>" +
            c +
            "</tbody></table>",
          d =
            "\n    th,td{border:0.2mm solid #444;vertical-align:top;padding:1mm 1.2mm;word-break:break-all;}\n    th{text-align:center;font-weight:600;}\n    .gs2-line{line-height:inherit;}\n    body{margin:0;padding:0;}\n  ",
          V = t["paper"],
          m = V["widthMm"] - 2 * V["paddingMm"],
          w = document["createElement"]("iframe");
        ((w.style["cssText"] =
          "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;visibility:hidden;"),
          document["body"]["appendChild"](w));
        const g = w["contentDocument"] || w.contentWindow.document;
        (g["open"](),
          g.write(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
              d +
              '</style></head><body><div style="width:' +
              m +
              'mm;">' +
              s +
              "</div></body></html>",
          ),
          g["close"](),
          await new Promise((e) => {
            const t = a,
              l = Array.from(g["querySelectorAll"]("img"));
            if (0 === l["length"]) return void e();
            let o = 0;
            const n = () => {
              (o++, o >= l["length"] && e());
            };
            (l.forEach((e) => {
              const l = t;
              e["complete"] ? n() : ((e.onload = n), (e["onerror"] = n));
            }),
              setTimeout(e, 2e3));
          }));
        const y = Array["from"](g.querySelectorAll("tr[data-ridx]")),
          v =
            m /
            ((null == (o = g.querySelector("div"))
              ? void 0
              : o["offsetWidth"]) || 1),
          f = y.map((e) => e["offsetHeight"] * v);
        return (
          document["body"]["contains"](w) && document["body"]["removeChild"](w),
          f
        );
      },
      H = async (e, t) => {
        var o;
        const a = l;
        if (!Array["isArray"](e) || 0 === e.length) return [[]];
        const n = t || i["value"],
          u = n.paper,
          r = u["heightMm"] - 2 * u["paddingMm"] - 8 - 10,
          c = await O(e, n),
          s = [];
        let d = [],
          V = 0;
        for (let l = 0; l < e["length"]; l++) {
          const t = null != (o = c[l]) ? o : 20;
          (V + t > r && d.length > 0 && (s.push(d), (d = []), (V = 0)),
            d["push"](e[l]),
            (V += t));
        }
        return (d["length"] > 0 && s["push"](d), s);
      },
      G = (e) => {
        const t = l;
        return (
          "\n  <tr>" +
          p["value"]
            ["map"]((l) => {
              const o = t,
                a =
                  "width:" +
                  l.widthMm +
                  "mm;font-size:" +
                  l["fontSize"] +
                  "pt;color:" +
                  l["fontColor"] +
                  ";line-height:" +
                  l["rowHeightMm"] +
                  "mm;";
              return (
                '<td style="' +
                a +
                '">' +
                U(l["key"], e, 0, {
                  qrSize: "17mm",
                  imgStyle:
                    "width:100%;display:block;margin:0 auto;object-fit:contain;",
                }) +
                "</td>"
              );
            })
            ["join"]("") +
          "</tr>"
        );
      },
      j = async (e) => {
        var t;
        const a = l,
          n = Array["isArray"](e)
            ? e
            : (null == (t = o["getData"]) ? void 0 : t.call(o)) || [],
          u = await H(n),
          r = u["map"]((e, t) =>
            ((e, t, o) => {
              const a = l,
                n = i["value"]["paper"],
                u = [
                  "width:" + n["widthMm"] + "mm",
                  "height:" + n["heightMm"] + "mm",
                  "padding:" + n["paddingMm"] + "mm",
                  "position:relative",
                  "box-sizing:border-box",
                  "background:#fff",
                  "overflow:hidden",
                ].join(";"),
                r = p["value"]
                  .map(
                    (e) =>
                      '<th style="width:' +
                      e["widthMm"] +
                      'mm">' +
                      e["label"] +
                      "</th>",
                  )
                  ["join"](""),
                c = e["map"](G).join(""),
                s =
                  null != t && null != o && o > 1
                    ? '<div class="gs2-page-num">' +
                      (t + 1) +
                      " / " +
                      o +
                      "</div>"
                    : "";
              return (
                '\n  <section class="gs-sheet" style="' +
                u +
                '">\n    ' +
                s +
                '\n    <div class="gs2-title">' +
                D(i["value"]["table"].title) +
                '</div>\n    <table class="gs2-table">\n      <thead><tr>' +
                r +
                "</tr></thead>\n      <tbody>" +
                c +
                "</tbody>\n    </table>\n  </section>"
              );
            })(e, t, u["length"]),
          ).join("");
        return (
          '<div class="gs-root"><style>' +
          (() => {
            const e = l,
              t = i["value"]["paper"],
              o = i["value"]["table"],
              a = t.widthMm,
              n = t["heightMm"];
            return (
              "\n.gs-root { background:#fff; color:#111; width:" +
              a +
              "mm; }\n.gs2-title { text-align:center; font-size:7mm; line-height:8mm; font-weight:500; margin-bottom:0.5mm; }\n.gs2-page-num { position:absolute; top:" +
              t["paddingMm"] +
              "mm; right:" +
              t["paddingMm"] +
              "mm; font-size:9pt; color:#666; }\n.gs2-table { width:100%; border-collapse:collapse; table-layout:fixed; }\n.gs2-table th, .gs2-table td { border:0.2mm solid " +
              o["borderColor"] +
              "; vertical-align:top; padding:1mm 1.2mm; word-break:break-all; }\n.gs2-table th { text-align:center; font-weight:600; background:#fff; font-size:" +
              o["headerFontSize"] +
              "pt; }\n.gs2-line { line-height:inherit; }\n.gs2-qr { width:17mm; height:17mm; display:block; margin:0 auto 0.8mm; }\n.gs2-order { text-align:center; line-height:1.4; }\n.gs2-lock-img, .gs2-door-img { width:100%; height:100%; display:block; margin:0 auto; object-fit:contain; }\n@page { size: " +
              a +
              "mm " +
              n +
              "mm; margin: 0; }\n@media screen {\n  .gs-root { background:#c0c0c0; padding:8mm; display:flex; flex-wrap:wrap; gap:8mm; align-items:flex-start; justify-content:flex-start; min-width:fit-content; width:auto; }\n  .gs-sheet { box-shadow:0 2px 10px rgba(0,0,0,0.25); height:" +
              n +
              "mm; overflow:hidden; }\n}\n@media print {\n  html, body { width:" +
              a +
              "mm !important; height:" +
              n +
              "mm !important; margin:0 !important; padding:0 !important; background:#fff; overflow:visible !important; }\n  .gs-root { width:" +
              a +
              "mm !important; background:#fff !important; padding:0 !important; gap:0 !important; display:block !important; }\n  .gs-sheet { width:" +
              a +
              "mm !important; height:" +
              n +
              "mm !important; box-shadow:none !important; margin:0 !important; break-after:page; page-break-after:always; page-break-inside:avoid; }\n  .gs-sheet:last-child { break-after:auto; page-break-after:auto; }\n  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n}\n"
            );
          })() +
          "</style>" +
          r +
          "</div>"
        );
      },
      q = async () => {
        const e = l,
          t = await j();
        await o["onPreviewHtmlChange"](t);
      },
      J = async () => {
        const e = l,
          t = await j();
        return (
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义玻璃合片单</title></head><body>' +
          t +
          "</body></html>"
        );
      };
    return (
      Vue.onMounted(async () => {
        var e;
        const t = l;
        ((() => {
          var e, t, o, n, u, r, c, s, d, V;
          const m = l;
          try {
            const l = localStorage["getItem"](Dn);
            if (!l) return void (i["value"] = a());
            const w = JSON["parse"](l),
              g = a();
            i["value"] = {
              paper: {
                widthMm:
                  Number(
                    null == (e = null == w ? void 0 : w["paper"])
                      ? void 0
                      : e["widthMm"],
                  ) || g["paper"]["widthMm"],
                heightMm:
                  Number(
                    null == (t = null == w ? void 0 : w["paper"])
                      ? void 0
                      : t["heightMm"],
                  ) || g["paper"]["heightMm"],
                paddingMm:
                  null !=
                  (n = Number(
                    null == (o = null == w ? void 0 : w["paper"])
                      ? void 0
                      : o["paddingMm"],
                  ))
                    ? n
                    : g["paper"]["paddingMm"],
                orientation:
                  (null == (u = null == w ? void 0 : w.paper)
                    ? void 0
                    : u["orientation"]) === "portrait"
                    ? "portrait"
                    : "landscape",
              },
              table: {
                title:
                  (null == (r = null == w ? void 0 : w["table"])
                    ? void 0
                    : r["title"]) || g["table"]["title"],
                borderColor:
                  (null == (c = null == w ? void 0 : w["table"])
                    ? void 0
                    : c["borderColor"]) || g["table"]["borderColor"],
                headerFontSize:
                  Number(
                    null == (s = null == w ? void 0 : w["table"])
                      ? void 0
                      : s["headerFontSize"],
                  ) || g["table"]["headerFontSize"],
                columns:
                  Array["isArray"](
                    null == (d = null == w ? void 0 : w["table"])
                      ? void 0
                      : d["columns"],
                  ) && w["table"]["columns"]["length"] > 0
                    ? w.table["columns"].map((e, t) => ({
                        ...g.table["columns"][t],
                        ...e,
                      }))
                    : g.table["columns"],
              },
              print: {
                copies: Math["max"](
                  1,
                  Math["min"](
                    99,
                    Number(
                      null == (V = null == w ? void 0 : w["print"])
                        ? void 0
                        : V["copies"],
                    ) || g["print"]["copies"],
                  ),
                ),
              },
            };
          } catch (w) {
            i.value = a();
          }
        })(),
          (() => {
            const e = l;
            try {
              f["value"] = localStorage.getItem(An) || "";
            } catch (t) {}
          })(),
          w["value"] && x(),
          (null == (e = o["isActive"]) ? void 0 : e.call(o)) && (await q()));
      }),
      t({
        buildGlassSheet2Html: j,
        refreshPreview: q,
        openSettingsDialog: async () => {
          const e = l;
          ((c.value = JSON.parse(JSON["stringify"](i["value"]))),
            (r["value"] = "paper"),
            (n["value"] = !0),
            w.value && 0 === v.value["length"] && (await x()));
        },
        openLayoutEditor: async () => {
          var e;
          const t = l;
          s["value"] = JSON.parse(JSON["stringify"](i.value));
          const a = (null == (e = o.getData) ? void 0 : e.call(o)) || [];
          ((d["value"] = a["length"] > 0 ? a : []),
            (u.value = !0),
            await Vue.nextTick(),
            L(),
            W());
        },
        printDirect: async () => {
          const e = l,
            t = ElementPlus.ElLoading["service"]({
              lock: !0,
              text: "正在生成玻璃合片单...",
              background: "rgba(0,0,0,0.7)",
            });
          try {
            const t = await J(),
              l = document["createElement"]("iframe");
            ((l.style["cssText"] =
              "position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;"),
              document["body"]["appendChild"](l));
            const o = l["contentWindow"],
              a = l["contentDocument"] || o.document;
            (a["open"](),
              a["write"](t),
              a["close"](),
              await new Promise((t) => {
                const l = e,
                  o = Array["from"](a["querySelectorAll"]("img"));
                if (0 === o["length"]) return void t();
                let n = 0;
                o["forEach"]((e) => {
                  const a = l,
                    u = () => {
                      (n++, n === o["length"] && t());
                    };
                  e["complete"] ? u() : ((e["onload"] = u), (e.onerror = u));
                });
              }),
              setTimeout(() => {
                const t = e;
                (o.focus(),
                  o["print"](),
                  setTimeout(() => {
                    const e = t;
                    document["body"]["contains"](l) &&
                      document["body"]["removeChild"](l);
                  }, 1e3));
              }, 300),
              ElementPlus.ElMessage["success"]("已打开打印对话框"));
          } catch (o) {
            ElementPlus.ElMessage["error"](
              "打印失败: " + ((null == o ? void 0 : o["message"]) || o),
            );
          } finally {
            t["close"]();
          }
        },
        printSilent: async () => {
          const e = l;
          if (!w.value)
            return (
              ElementPlus.ElMessage["warning"](
                "直接打印仅在Electron客户端可用",
              ),
              !1
            );
          const t = ElementPlus.ElLoading["service"]({
            lock: !0,
            text: "正在发送到打印机...",
            background: "rgba(0,0,0,0.7)",
          });
          try {
            const t = await J(),
              l = i.value["paper"],
              o = await window["electronAPI"].silentPrint(t, f["value"] || "", {
                landscape: l["widthMm"] > l.heightMm,
                copies: i["value"].print.copies,
                pageWidthMm: l["widthMm"],
                pageHeightMm: l["heightMm"],
              });
            return (null == o ? void 0 : o.success)
              ? (ElementPlus.ElMessage["success"]("已发送至打印机"), !0)
              : (ElementPlus.ElMessage.error(
                  "打印失败：" +
                    ((null == o ? void 0 : o["reason"]) || "未知错误"),
                ),
                !1);
          } catch (o) {
            return (
              ElementPlus.ElMessage.error(
                "直接打印失败: " + ((null == o ? void 0 : o["message"]) || o),
              ),
              !1
            );
          } finally {
            t.close();
          }
        },
        isElectronEnv: Vue.computed(() => w.value),
      }),
      (e, t) => {
        const o = l,
          a = Vue.resolveComponent("el-input-number"),
          i = Vue.resolveComponent("el-form-item"),
          d = Vue.resolveComponent("el-option"),
          m = Vue.resolveComponent("el-select"),
          g = Vue.resolveComponent("el-button"),
          y = Vue.resolveComponent("el-form"),
          p = Vue.resolveComponent("el-tab-pane"),
          C = Vue.resolveComponent("el-alert"),
          L = Vue.resolveComponent("el-tabs"),
          b = Vue.resolveComponent("el-dialog"),
          D = Vue.resolveComponent("el-input"),
          A = Vue.resolveComponent("el-color-picker"),
          k = Vue.resolveComponent("el-checkbox"),
          P = Vue.resolveComponent("el-table-column"),
          I = Vue.resolveComponent("el-table");
        return (
          Vue.openBlock(),
          Vue.createElementBlock(
            Vue.Fragment,
            null,
            [
              Vue.createVNode(
                b,
                {
                  modelValue: n["value"],
                  "onUpdate:modelValue":
                    t[11] || (t[11] = (e) => (n["value"] = e)),
                  title: "自定义玻璃合片单 - 打印设置",
                  width: "820px",
                  "destroy-on-close": !1,
                },
                {
                  footer: Vue.withCtx(() => [
                    Vue.createVNode(
                      g,
                      { onClick: B },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[24] ||
                            (t[24] = [Vue.createTextVNode("重置默认")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      g,
                      { onClick: t[10] || (t[10] = (e) => (n["value"] = !1)) },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[25] || (t[25] = [Vue.createTextVNode("取消")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      g,
                      { type: "primary", onClick: N },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[26] ||
                            (t[26] = [Vue.createTextVNode("保存并应用")]),
                        ),
                        _: 1,
                      },
                    ),
                  ]),
                  default: Vue.withCtx(() => [
                    Vue.createVNode(
                      L,
                      {
                        modelValue: r["value"],
                        "onUpdate:modelValue":
                          t[9] || (t[9] = (e) => (r["value"] = e)),
                      },
                      {
                        default: Vue.withCtx(() => [
                          Vue.createVNode(
                            p,
                            { label: "纸张", name: "paper" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  y,
                                  { "label-width": "120px", size: "small" },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        i,
                                        { label: "纸张宽(mm)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  c["value"].paper["widthMm"],
                                                "onUpdate:modelValue":
                                                  t[0] ||
                                                  (t[0] = (e) =>
                                                    (c.value["paper"][
                                                      "widthMm"
                                                    ] = e)),
                                                min: 100,
                                                max: 420,
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
                                        { label: "纸张高(mm)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  c.value["paper"]["heightMm"],
                                                "onUpdate:modelValue":
                                                  t[1] ||
                                                  (t[1] = (e) =>
                                                    (c["value"]["paper"][
                                                      "heightMm"
                                                    ] = e)),
                                                min: 100,
                                                max: 297,
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
                                        { label: "内边距(mm)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  c["value"].paper.paddingMm,
                                                "onUpdate:modelValue":
                                                  t[2] ||
                                                  (t[2] = (e) =>
                                                    (c.value.paper.paddingMm =
                                                      e)),
                                                min: 0,
                                                max: 20,
                                                step: 0.5,
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
                                        { label: "方向" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              m,
                                              {
                                                modelValue:
                                                  c["value"]["paper"][
                                                    "orientation"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[3] ||
                                                  (t[3] = (e) =>
                                                    (c.value.paper[
                                                      "orientation"
                                                    ] = e)),
                                                style: { width: "200px" },
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(d, {
                                                    label: "横向",
                                                    value: "landscape",
                                                  }),
                                                  Vue.createVNode(d, {
                                                    label: "纵向",
                                                    value: "portrait",
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
                                        i,
                                        { label: "常用尺寸" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              g,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[4] ||
                                                  (t[4] = (e) => {
                                                    const t = o;
                                                    ((c["value"]["paper"][
                                                      "widthMm"
                                                    ] = 297),
                                                      (c["value"][
                                                        "paper"
                                                      ].heightMm = 210));
                                                  }),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[20] ||
                                                    (t[20] = [
                                                      Vue.createTextVNode("A4"),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                            Vue.createVNode(
                                              g,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[5] ||
                                                  (t[5] = (e) => {
                                                    const t = o;
                                                    ((c["value"]["paper"][
                                                      "widthMm"
                                                    ] = 210),
                                                      (c["value"]["paper"][
                                                        "heightMm"
                                                      ] = 148));
                                                  }),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[21] ||
                                                    (t[21] = [
                                                      Vue.createTextVNode("A5"),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                            Vue.createVNode(
                                              g,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[6] ||
                                                  (t[6] = (e) => {
                                                    const t = o;
                                                    ((c["value"][
                                                      "paper"
                                                    ].widthMm = 257),
                                                      (c["value"]["paper"][
                                                        "heightMm"
                                                      ] = 182));
                                                  }),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[22] ||
                                                    (t[22] = [
                                                      Vue.createTextVNode("B5"),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                    ]),
                                    _: 1,
                                  },
                                ),
                              ]),
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            p,
                            { label: "打印机", name: "printer" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  y,
                                  { "label-width": "110px", size: "small" },
                                  {
                                    default: Vue.withCtx(() => [
                                      w["value"]
                                        ? Vue.createCommentVNode("", !0)
                                        : (Vue.openBlock(),
                                          Vue.createBlock(
                                            i,
                                            { key: 0, label: "" },
                                            {
                                              default: Vue.withCtx(() => [
                                                Vue.createVNode(C, {
                                                  type: "warning",
                                                  closable: !1,
                                                  title:
                                                    "仅Electron客户端支持静默打印，当前为浏览器模式",
                                                }),
                                              ]),
                                              _: 1,
                                            },
                                          )),
                                      Vue.createVNode(
                                        i,
                                        { label: "选择打印机" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              m,
                                              {
                                                modelValue: f["value"],
                                                "onUpdate:modelValue":
                                                  t[7] ||
                                                  (t[7] = (e) =>
                                                    (f["value"] = e)),
                                                placeholder:
                                                  "使用系统默认打印机",
                                                clearable: "",
                                                style: { width: "100%" },
                                                onChange: z,
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  (Vue.openBlock(!0),
                                                  Vue.createElementBlock(
                                                    Vue.Fragment,
                                                    null,
                                                    Vue.renderList(
                                                      v.value,
                                                      (e) => {
                                                        const t = o;
                                                        return (
                                                          Vue.openBlock(),
                                                          Vue.createBlock(
                                                            d,
                                                            {
                                                              key: e["name"],
                                                              label: e[
                                                                "isDefault"
                                                              ]
                                                                ? e.displayName +
                                                                  "（默认）"
                                                                : e[
                                                                    "displayName"
                                                                  ],
                                                              value: e.name,
                                                            },
                                                            null,
                                                            8,
                                                            ["label", "value"],
                                                          )
                                                        );
                                                      },
                                                    ),
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
                                      ),
                                      Vue.createVNode(i, null, {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            g,
                                            {
                                              size: "small",
                                              loading: h["value"],
                                              onClick: x,
                                            },
                                            {
                                              default: Vue.withCtx(
                                                () =>
                                                  t[23] ||
                                                  (t[23] = [
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
                                        ]),
                                        _: 1,
                                      }),
                                      Vue.createVNode(
                                        i,
                                        { label: "打印份数" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  c["value"]["print"]["copies"],
                                                "onUpdate:modelValue":
                                                  t[8] ||
                                                  (t[8] = (e) =>
                                                    (c["value"]["print"][
                                                      "copies"
                                                    ] = e)),
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
                                      ),
                                    ]),
                                    _: 1,
                                  },
                                ),
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
                  ]),
                  _: 1,
                },
                8,
                ["modelValue"],
              ),
              Vue.createVNode(
                b,
                {
                  modelValue: u["value"],
                  "onUpdate:modelValue":
                    t[19] || (t[19] = (e) => (u["value"] = e)),
                  title: "自定义玻璃合片单 - 布局编辑",
                  fullscreen: "",
                  "destroy-on-close": !1,
                },
                {
                  footer: Vue.withCtx(() => [
                    Vue.createVNode(
                      g,
                      { onClick: t[18] || (t[18] = (e) => (u["value"] = !1)) },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[32] || (t[32] = [Vue.createTextVNode("取消")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      g,
                      { onClick: M },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[33] ||
                            (t[33] = [Vue.createTextVNode("重置默认")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      g,
                      { type: "primary", onClick: E },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[34] ||
                            (t[34] = [Vue.createTextVNode("保存布局")]),
                        ),
                        _: 1,
                      },
                    ),
                  ]),
                  default: Vue.withCtx(() => [
                    Vue.createElementVNode("div", Mn, [
                      Vue.createElementVNode("div", Nn, [
                        t[29] ||
                          (t[29] = Vue.createElementVNode(
                            "div",
                            { class: "gs2-layout-section-title" },
                            "纸张",
                            -1,
                          )),
                        Vue.createVNode(
                          y,
                          { "label-width": "80px", size: "small" },
                          {
                            default: Vue.withCtx(() => [
                              Vue.createVNode(
                                i,
                                { label: "宽(mm)" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue: s["value"].paper["widthMm"],
                                        "onUpdate:modelValue":
                                          t[12] ||
                                          (t[12] = (e) =>
                                            (s["value"].paper["widthMm"] = e)),
                                        min: 100,
                                        max: 420,
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
                                { label: "高(mm)" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue:
                                          s["value"]["paper"]["heightMm"],
                                        "onUpdate:modelValue":
                                          t[13] ||
                                          (t[13] = (e) =>
                                            (s["value"]["paper"]["heightMm"] =
                                              e)),
                                        min: 100,
                                        max: 297,
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
                                { label: "边距(mm)" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue:
                                          s["value"]["paper"]["paddingMm"],
                                        "onUpdate:modelValue":
                                          t[14] ||
                                          (t[14] = (e) =>
                                            (s["value"]["paper"]["paddingMm"] =
                                              e)),
                                        min: 0,
                                        max: 20,
                                        step: 0.5,
                                      },
                                      null,
                                      8,
                                      ["modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                            ]),
                            _: 1,
                          },
                        ),
                        t[30] ||
                          (t[30] = Vue.createElementVNode(
                            "div",
                            { class: "gs2-layout-section-title" },
                            "表格全局",
                            -1,
                          )),
                        Vue.createVNode(
                          y,
                          { "label-width": "80px", size: "small" },
                          {
                            default: Vue.withCtx(() => [
                              Vue.createVNode(
                                i,
                                { label: "标题" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      D,
                                      {
                                        modelValue:
                                          s["value"]["table"]["title"],
                                        "onUpdate:modelValue":
                                          t[15] ||
                                          (t[15] = (e) =>
                                            (s["value"]["table"]["title"] = e)),
                                        style: { width: "160px" },
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
                                { label: "表头字号" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue:
                                          s["value"]["table"].headerFontSize,
                                        "onUpdate:modelValue":
                                          t[16] ||
                                          (t[16] = (e) =>
                                            (s["value"]["table"][
                                              "headerFontSize"
                                            ] = e)),
                                        min: 7,
                                        max: 28,
                                        step: 0.5,
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
                                { label: "边框颜色" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      A,
                                      {
                                        modelValue:
                                          s["value"].table["borderColor"],
                                        "onUpdate:modelValue":
                                          t[17] ||
                                          (t[17] = (e) =>
                                            (s.value.table["borderColor"] = e)),
                                        size: "small",
                                      },
                                      null,
                                      8,
                                      ["modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                            ]),
                            _: 1,
                          },
                        ),
                        t[31] ||
                          (t[31] = Vue.createElementVNode(
                            "div",
                            { class: "gs2-layout-section-title" },
                            "各列设置",
                            -1,
                          )),
                        Vue.createVNode(
                          I,
                          {
                            data: s["value"]["table"].columns,
                            size: "small",
                            border: "",
                            style: { width: "100%" },
                            "max-height": 400,
                          },
                          {
                            default: Vue.withCtx(() => [
                              Vue.createVNode(
                                P,
                                { label: "显", width: "38" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      k,
                                      {
                                        modelValue: e["visible"],
                                        "onUpdate:modelValue": (t) =>
                                          (e.visible = t),
                                      },
                                      null,
                                      8,
                                      ["modelValue", "onUpdate:modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(P, {
                                prop: "label",
                                label: "列名",
                                width: "72",
                              }),
                              Vue.createVNode(
                                P,
                                { label: "宽mm", width: "72" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue: e["widthMm"],
                                        "onUpdate:modelValue": (t) =>
                                          (e["widthMm"] = t),
                                        min: 10,
                                        max: 120,
                                        step: 1,
                                        size: "small",
                                        "controls-position": "right",
                                      },
                                      null,
                                      8,
                                      ["modelValue", "onUpdate:modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(
                                P,
                                { label: "字号pt", width: "72" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue: e.fontSize,
                                        "onUpdate:modelValue": (t) =>
                                          (e.fontSize = t),
                                        min: 7,
                                        max: 28,
                                        step: 0.5,
                                        size: "small",
                                        "controls-position": "right",
                                      },
                                      null,
                                      8,
                                      ["modelValue", "onUpdate:modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(
                                P,
                                { label: "行高mm", width: "72" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue: e["rowHeightMm"],
                                        "onUpdate:modelValue": (t) =>
                                          (e.rowHeightMm = t),
                                        min: 3,
                                        max: 20,
                                        step: 0.5,
                                        size: "small",
                                        "controls-position": "right",
                                      },
                                      null,
                                      8,
                                      ["modelValue", "onUpdate:modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(
                                P,
                                { label: "颜色", width: "52" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      A,
                                      {
                                        modelValue: e["fontColor"],
                                        "onUpdate:modelValue": (t) =>
                                          (e["fontColor"] = t),
                                        size: "small",
                                      },
                                      null,
                                      8,
                                      ["modelValue", "onUpdate:modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(
                                P,
                                { label: "排序", width: "70" },
                                {
                                  default: Vue.withCtx(({ $index: e }) => [
                                    Vue.createVNode(
                                      g,
                                      {
                                        size: "small",
                                        disabled: 0 === e,
                                        onClick: (t) =>
                                          ((e) => {
                                            const t = l;
                                            if (e <= 0) return;
                                            const o =
                                                s["value"]["table"]["columns"],
                                              a = o[e];
                                            ((o[e] = o[e - 1]), (o[e - 1] = a));
                                          })(e),
                                      },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[27] ||
                                            (t[27] = [
                                              Vue.createTextVNode("↑"),
                                            ]),
                                        ),
                                        _: 2,
                                      },
                                      1032,
                                      ["disabled", "onClick"],
                                    ),
                                    Vue.createVNode(
                                      g,
                                      {
                                        size: "small",
                                        disabled:
                                          e ===
                                          s["value"]["table"]["columns"][
                                            "length"
                                          ] -
                                            1,
                                        onClick: (t) =>
                                          ((e) => {
                                            const t = l,
                                              o =
                                                s["value"]["table"]["columns"];
                                            if (e >= o.length - 1) return;
                                            const a = o[e];
                                            ((o[e] = o[e + 1]), (o[e + 1] = a));
                                          })(e),
                                      },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[28] ||
                                            (t[28] = [
                                              Vue.createTextVNode("↓"),
                                            ]),
                                        ),
                                        _: 2,
                                      },
                                      1032,
                                      ["disabled", "onClick"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                            ]),
                            _: 1,
                          },
                          8,
                          ["data"],
                        ),
                      ]),
                      Vue.createElementVNode(
                        "div",
                        {
                          class: "gs2-layout-right",
                          ref_key: "layoutEditorRightRef",
                          ref: V,
                        },
                        [
                          Vue.createElementVNode(
                            "div",
                            {
                              class: "gs2-layout-canvas-shell",
                              innerHTML: T["value"],
                            },
                            null,
                            8,
                            En,
                          ),
                        ],
                        512,
                      ),
                    ]),
                  ]),
                  _: 1,
                },
                8,
                ["modelValue"],
              ),
            ],
            64,
          )
        );
      }
    );
  },
};
