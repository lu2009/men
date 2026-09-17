export default {
  __name: "QualifiedLabelPrintManager",
  props: {
    getLabels: { type: Function },
    isActive: { type: Function },
    onPreviewHtmlChange: { type: Function },
    onFixedQuantityChange: { type: Function },
  },
  setup(e, { expose: t }) {
    const l = pa,
      o = e;
    ("qrcode",
      "二维码",
      "client",
      "door",
      "size",
      "lockway",
      "color",
      "package",
      "包装:",
      "orderID",
      "订单号");
    const a = () => ({
        paper: {
          widthMm: 70,
          heightMm: 90,
          orientation: "portrait",
          paddingMm: 2,
          printRotate90: !1,
        },
        globalFont: {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: 16.5,
          fontWeight: "normal",
          lineHeight: 1.1,
        },
        autoHideEmpty: !0,
        fields: [
          {
            key: "qrcode",
            label: "二维码",
            visible: !0,
            showPrefix: !1,
            x: 0.5,
            y: 0,
            width: 20,
            height: 20,
            fontSize: 19,
            fontWeight: "normal",
            wrap: !1,
            maxLines: 1,
            textAlign: "left",
          },
          {
            key: "orderID",
            label: "订单号",
            visible: !0,
            showPrefix: !1,
            x: 21,
            y: 2,
            width: 48,
            height: 5,
            fontSize: 16,
            fontWeight: "normal",
            wrap: !1,
            maxLines: 1,
            textAlign: "left",
          },
          {
            key: "client",
            label: "客户",
            visible: !0,
            showPrefix: !1,
            x: 21,
            y: 11.5,
            width: 48,
            height: 5,
            fontSize: 16,
            fontWeight: "bold",
            wrap: !1,
            maxLines: 1,
            textAlign: "left",
          },
          {
            key: "door",
            label: "型材",
            visible: !0,
            showPrefix: !0,
            x: 2,
            y: 20.5,
            width: 66,
            height: 5,
            fontSize: 16,
            fontWeight: "normal",
            wrap: !0,
            maxLines: 1,
            textAlign: "left",
          },
          {
            key: "size",
            label: "尺寸",
            visible: !0,
            showPrefix: !0,
            x: 2,
            y: 29,
            width: 66,
            height: 5,
            fontSize: 16,
            fontWeight: "normal",
            wrap: !1,
            maxLines: 1,
            textAlign: "left",
          },
          {
            key: "lockway",
            label: "开向",
            visible: !0,
            showPrefix: !0,
            x: 2,
            y: 37,
            width: 66,
            height: 5,
            fontSize: 16,
            fontWeight: "normal",
            wrap: !1,
            maxLines: 1,
            textAlign: "left",
          },
          {
            key: "color",
            label: "颜色",
            visible: !0,
            showPrefix: !0,
            x: 2,
            y: 45,
            width: 66,
            height: 5,
            fontSize: 16,
            fontWeight: "normal",
            wrap: !1,
            maxLines: 1,
            textAlign: "left",
          },
          {
            key: "glass",
            label: "玻璃",
            visible: !0,
            showPrefix: !0,
            x: 2,
            y: 53,
            width: 66,
            height: 5,
            fontSize: 16,
            fontWeight: "normal",
            wrap: !1,
            maxLines: 1,
            textAlign: "left",
          },
          {
            key: "address",
            label: "地址",
            visible: !0,
            showPrefix: !0,
            x: 2,
            y: 61,
            width: 66,
            height: 5,
            fontSize: 16,
            fontWeight: "normal",
            wrap: !0,
            maxLines: 2,
            textAlign: "left",
          },
          {
            key: "remark",
            label: "备注",
            visible: !0,
            showPrefix: !0,
            x: 2,
            y: 73,
            width: 66,
            height: 5,
            fontSize: 16,
            fontWeight: "normal",
            wrap: !0,
            maxLines: 2,
            textAlign: "left",
          },
          {
            key: "package",
            label: "包装",
            visible: !0,
            showPrefix: !0,
            x: 4,
            y: 85,
            width: 66,
            height: 5,
            fontSize: 10,
            fontWeight: "normal",
            wrap: !1,
            maxLines: 1,
            textAlign: "center",
          },
        ],
        print: { copies: 1 },
      }),
      n = Vue.ref(!1),
      u = Vue.ref("paper"),
      r = Vue.ref(a()),
      i = Vue.ref(a()),
      c = Vue.ref(!1),
      s = Vue.ref(!1),
      d = Vue.ref(a()),
      V = Vue.computed(() => {
        const e = l,
          t = d["value"]["paper"];
        return Math["min"](
          320 / Math["max"](1, t["widthMm"]),
          260 / Math["max"](1, t["heightMm"]),
        );
      }),
      m = Vue.ref(""),
      w = Vue.computed(
        () =>
          d["value"]["fields"]["find"]((e) => e["key"] === m["value"]) || null,
      ),
      v = Vue.computed(() => !!window["electronAPI"]),
      f = Vue.ref([]),
      h = Vue.ref(""),
      p = Vue.ref(!1),
      C = Vue.ref(!1),
      z = Vue.ref(1),
      x = Vue.ref(!1),
      B = Vue.ref(1),
      M = () => {
        const e = l;
        try {
          localStorage["setItem"](Aa, JSON["stringify"](r.value));
        } catch (t) {}
      },
      N = (e) => {
        var t, o, n, u, r, i, c, s;
        const d = l,
          V = a(),
          m = (e, t, l, o) => {
            const a = Ca,
              n = Number(e);
            return Number.isFinite(n) ? Math["max"](t, Math["min"](l, n)) : o;
          },
          w = {
            paper: {
              ...V["paper"],
              ...((null == e ? void 0 : e["paper"]) || {}),
              widthMm: m(
                null == (t = null == e ? void 0 : e["paper"])
                  ? void 0
                  : t.widthMm,
                20,
                300,
                V["paper"]["widthMm"],
              ),
              heightMm: m(
                null == (o = null == e ? void 0 : e.paper)
                  ? void 0
                  : o["heightMm"],
                20,
                400,
                V["paper"]["heightMm"],
              ),
              paddingMm: m(
                null == (n = null == e ? void 0 : e["paper"])
                  ? void 0
                  : n.paddingMm,
                0,
                20,
                V["paper"]["paddingMm"],
              ),
              orientation:
                (null == (u = null == e ? void 0 : e["paper"])
                  ? void 0
                  : u["orientation"]) === "landscape"
                  ? "landscape"
                  : "portrait",
            },
            globalFont: {
              ...V["globalFont"],
              ...((null == e ? void 0 : e["globalFont"]) || {}),
              fontSize: m(
                null == (r = null == e ? void 0 : e["globalFont"])
                  ? void 0
                  : r["fontSize"],
                5,
                30,
                V["globalFont"]["fontSize"],
              ),
              lineHeight: m(
                null == (i = null == e ? void 0 : e["globalFont"])
                  ? void 0
                  : i["lineHeight"],
                1,
                2,
                V["globalFont"].lineHeight,
              ),
              fontWeight:
                "bold" ===
                (null == (c = null == e ? void 0 : e["globalFont"])
                  ? void 0
                  : c["fontWeight"])
                  ? "bold"
                  : "normal",
            },
            autoHideEmpty:
              void 0 !== (null == e ? void 0 : e["autoHideEmpty"])
                ? !!e["autoHideEmpty"]
                : V.autoHideEmpty,
            fields: [],
            print: {
              ...V["print"],
              ...((null == e ? void 0 : e["print"]) || {}),
              copies: Math["max"](
                1,
                Math.min(
                  99,
                  Number(
                    null == (s = null == e ? void 0 : e["print"])
                      ? void 0
                      : s["copies"],
                  ) || V.print["copies"],
                ),
              ),
            },
          },
          g = Array["isArray"](null == e ? void 0 : e["fields"])
            ? e["fields"]
            : [],
          y = new Map(g["map"]((e) => [null == e ? void 0 : e["key"], e])),
          v = w["paper"]["widthMm"],
          f = w["paper"]["heightMm"];
        for (const l of V["fields"]) {
          const e = y.get(l.key),
            t = { ...l, ...(e || {}) };
          ((t["width"] = m(t["width"], 1, v, l["width"])),
            t["key"] === "qrcode"
              ? (t["height"] = t["width"])
              : (t["height"] = m(t.height, 1, f, l["height"])),
            (t.x = m(t.x, 0, Math["max"](0, v - t["width"]), l.x)),
            (t.y = m(t.y, 0, Math["max"](0, f - t.height), l.y)),
            (t["fontSize"] = m(t["fontSize"], 5, 30, l.fontSize)),
            (t["maxLines"] = Math["max"](
              1,
              Math["min"](
                10,
                Math["round"](Number(t["maxLines"]) || l["maxLines"]),
              ),
            )),
            (t["fontWeight"] = t["fontWeight"] === "bold" ? "bold" : "normal"));
          const o = ["left", "center", "right"];
          ((t["textAlign"] = o["includes"](t.textAlign)
            ? t["textAlign"]
            : "left"),
            w.fields.push(t));
        }
        return (
          !w["fields"]["some"]((e) => e.visible) &&
            (w["fields"] = V["fields"]["map"]((e) => ({ ...e }))),
          w
        );
      },
      E = () => {
        const e = l;
        try {
          localStorage.setItem(ka, h["value"]);
        } catch (t) {}
      },
      L = (e) => {
        const t = l,
          o = Math.round(Number(e));
        return Number["isFinite"](o) ? Math["max"](1, Math["min"](99, o)) : 1;
      },
      b = async () => {
        const e = l;
        if (v.value) {
          p["value"] = !0;
          try {
            f["value"] = await window.electronAPI.getPrinters();
          } catch (t) {
            ElementPlus.ElMessage["error"]("获取打印机列表失败");
          } finally {
            p["value"] = !1;
          }
        }
      },
      D = async () => {
        const e = l;
        v.value && 0 === f["value"]["length"] && (await b());
      },
      A = () => {
        const e = l;
        ((i["value"] = a()), (x.value = !1), (B["value"] = 1));
      },
      k = async () => {
        var e;
        const t = l;
        ((r["value"] = N(JSON.parse(JSON["stringify"](i["value"])))),
          (C.value = x["value"]),
          (z["value"] = L(B["value"])),
          M(),
          (() => {
            const e = l;
            z.value = L(z["value"]);
            try {
              (localStorage.setItem(Pa, C["value"] ? "1" : "0"),
                localStorage["setItem"](Ia, String(z["value"])));
            } catch (t) {}
          })(),
          (n["value"] = !1),
          (null == (e = o.isActive) ? void 0 : e.call(o)) &&
            (o["onFixedQuantityChange"]
              ? await o["onFixedQuantityChange"]()
              : await ne()));
      },
      P = (e, t) => {
        const o = l;
        ((i["value"].paper["widthMm"] = e), (i.value.paper.heightMm = t));
      },
      I = ["door", "size", "lockway", "color", "glass", "address", "remark"],
      U = ["client", "orderID"],
      S = Vue.ref(16),
      T = Vue.ref(66),
      Y = Vue.ref(48),
      W = () => {
        const e = l,
          t = d["value"]["fields"]["find"]((t) => I["includes"](t["key"])),
          o = d.value["fields"]["find"]((t) => U["includes"](t.key));
        (t && ((S.value = t["fontSize"]), (T["value"] = t["width"])),
          o && (Y.value = o.width));
      },
      O = (e) => {
        const t = l;
        d["value"]["fields"]["forEach"]((l) => {
          const o = t;
          I["includes"](l["key"]) && (l.fontSize = e);
        });
      },
      H = (e) => {
        const t = l;
        d.value.fields["forEach"]((l) => {
          const o = t;
          I.includes(l["key"]) && (l["width"] = e);
        });
      },
      G = (e) => {
        const t = l;
        d["value"]["fields"]["forEach"]((l) => {
          const o = t;
          U["includes"](l["key"]) && (l["width"] = e);
        });
      },
      j = (e, t, o) => {
        const n = l,
          u = a(),
          r = t / 70,
          i = o / 90,
          c = Math["min"](r, i);
        e.forEach((e) => {
          const t = n,
            l = u["fields"]["find"]((l) => l["key"] === e["key"]);
          l &&
            ((e.x = Math["round"](l.x * r * 10) / 10),
            (e.y = Math.round(l.y * i * 10) / 10),
            (e["width"] = Math.round(l["width"] * r * 10) / 10),
            "qrcode" === e["key"]
              ? ((e.width = Math.round(l.width * c * 10) / 10),
                (e["height"] = e["width"]))
              : (e["height"] = l["height"]),
            (e["fontSize"] = Math["round"](l["fontSize"] * c * 2) / 2));
        });
      },
      q = () => {
        const e = l;
        (j(
          i["value"].fields,
          i["value"]["paper"]["widthMm"],
          i["value"]["paper"]["heightMm"],
        ),
          ElementPlus.ElMessage["success"](
            "已按 " +
              i["value"]["paper"]["widthMm"] +
              "×" +
              i["value"]["paper"].heightMm +
              "mm 自适应完成",
          ));
      },
      J = () => {
        const e = l;
        (j(
          d["value"]["fields"],
          d.value.paper["widthMm"],
          d["value"]["paper"]["heightMm"],
        ),
          W(),
          ElementPlus.ElMessage.success(
            "已按 " +
              d.value["paper"]["widthMm"] +
              "×" +
              d["value"]["paper"]["heightMm"] +
              "mm 自适应完成",
          ));
      },
      _ = {
        qrcode: ["qrcode", "qrCode", "QRCode", "orderQrcode"],
        client: ["client", "customer", "客户"],
        door: ["door", "profile", "型材"],
        size: ["size", "尺寸"],
        lockway: ["lockway", "direction", "开向"],
        color: ["color", "颜色"],
        glass: ["glass", "玻璃"],
        address: ["address", "安装地址", "地址"],
        remark: ["remark", "备注"],
        package: ["package", "包装"],
        orderID: ["orderID", "orderId", "orderNo", "编号"],
      },
      K = new y(),
      Z = new Map([[g.MARGIN, 1]]),
      X = new Map(),
      Q = (e, t, o) => {
        const a = l,
          n = ((e, t) => {
            const o = l,
              a = [t + ":", t + "："];
            for (const l of a)
              if (e["startsWith"](l)) return e["slice"](l["length"]);
            return e;
          })(
            ((e, t) => {
              const l = _[t] || [t];
              for (const a of l)
                if (
                  void 0 !== (null == e ? void 0 : e[a]) &&
                  null !== (null == e ? void 0 : e[a])
                )
                  return ((o = e[a]), String(null != o ? o : ""));
              var o;
              return "";
            })(t, e.key),
            e.label,
          );
        if (e["key"] === "qrcode") {
          const t = e.width,
            o =
              "position:absolute;left:" +
              e.x +
              "mm;top:" +
              e.y +
              "mm;width:" +
              t +
              "mm;height:" +
              t +
              "mm;display:block;overflow:hidden;";
          if (!n)
            return (
              '<svg class="qfield qfield-qr" data-key="' +
              e["key"] +
              '" style="' +
              o +
              '" viewBox="0 0 1 1"></svg>'
            );
          const u = ((e) => {
            const t = l;
            if (!e) return null;
            const o = 200,
              a = e + "::m1";
            if (X["has"](a)) return JSON["parse"](X.get(a));
            try {
              const l = K["write"](e, o, o, Z),
                n = {
                  viewBox: l["getAttribute"]("viewBox") || "0 0 200 " + o,
                  inner: l["innerHTML"],
                };
              return (X["set"](a, JSON["stringify"](n)), n);
            } catch (n) {
              return null;
            }
          })(n);
          return u
            ? '<svg class="qfield qfield-qr" data-key="' +
                e["key"] +
                '" style="' +
                o +
                '" viewBox="' +
                u["viewBox"] +
                '" preserveAspectRatio="xMidYMid meet">' +
                u.inner +
                "</svg>"
            : "";
        }
        if (!n && o["autoHideEmpty"]) return "";
        const u = e.showPrefix && e["label"] ? e["label"] + ":" + n : n,
          r = [
            "position:absolute",
            "left:" + e.x + "mm",
            "top:" + e.y + "mm",
            "width:" + e.width + "mm",
            "font-size:" + e.fontSize + "pt",
            "font-weight:" + e["fontWeight"],
            "text-align:" + (e["textAlign"] || "left"),
            e["wrap"] ? "white-space:normal" : "white-space:nowrap",
            e["wrap"] ? "word-break:break-all" : "overflow:hidden",
            e.wrap ? "" : "text-overflow:ellipsis",
            e.wrap
              ? "display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:" +
                e["maxLines"] +
                ";overflow:hidden"
              : "",
            "line-height:" + o.globalFont["lineHeight"],
          ]
            ["filter"](Boolean)
            ["join"](";");
        return (
          '<div class="qfield qfield-text" data-key="' +
          e["key"] +
          '" style="' +
          r +
          '">' +
          u["replace"](/&/g, "&amp;")
            ["replace"](/</g, "&lt;")
            ["replace"](/>/g, "&gt;")
            ["replace"](/"/g, "&quot;")
            ["replace"](/'/g, "&#39;") +
          "</div>"
        );
      },
      R = (e) => {
        const t = l,
          o = e["paper"]["widthMm"],
          a = e["paper"]["heightMm"],
          n = e["paper"]["printRotate90"],
          u = n ? a : o,
          r = n ? o : a;
        return (
          "\n  .qlabel-root { background:#fff; color:#000; }\n  .qlabel { background:#fff; display:block; }\n  .qfield { box-sizing:border-box; }\n  @page { size: " +
          u +
          "mm " +
          r +
          "mm; margin: 0; }\n  @media screen {\n    .qlabel-root { background:#c0c0c0; padding:12mm; display:flex; flex-wrap:wrap; gap:8mm; align-items:flex-start; justify-content:flex-start; min-width:fit-content; }\n    .qlabel { box-shadow:0 2px 10px rgba(0,0,0,0.25); }\n  }\n  @media print {\n    html, body { margin:0 !important; padding:0 !important; background:#fff; }\n    " +
          (n
            ? "html,body{width:" +
              u +
              "mm !important;height:" +
              r +
              "mm !important;overflow:hidden !important;}\n    .qlabel-root{position:fixed !important;top:" +
              o +
              "mm !important;left:0 !important;width:" +
              o +
              "mm !important;height:" +
              a +
              "mm !important;padding:0 !important;gap:0 !important;display:block !important;background:#fff !important;transform-origin:top left !important;transform:rotate(-90deg) !important;}"
            : ".qlabel-root{background:#fff !important;padding:0 !important;gap:0 !important;display:block !important;}") +
          "\n    .qlabel { box-shadow:none !important; }\n    .qlabel:last-child { page-break-after: avoid !important; break-after: avoid !important; }\n    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  }\n"
        );
      },
      F = Vue.computed(() => {
        const e = l,
          t = d["value"]["paper"];
        return {
          width: Math["max"](120, t["widthMm"] * V.value) + "px",
          height: Math["max"](120, t["heightMm"] * V["value"]) + "px",
          padding: t.paddingMm * V["value"] + "px",
        };
      }),
      $ = (e) => {
        const t = l,
          o = V["value"];
        (e.key, "qrcode");
        const a = Math["max"](10, 0.3528 * e.fontSize * o);
        return {
          left: e.x * o + "px",
          top: e.y * o + "px",
          width: Math.max(8, e["width"] * o) + "px",
          height:
            e["key"] === "qrcode"
              ? Math.max(8, e["width"] * o) + "px"
              : a + "px",
          fontSize: Math["max"](8, 0.3528 * e.fontSize * o) + "px",
          fontWeight: e["fontWeight"],
          lineHeight: "1",
          padding: "0",
          overflow: "hidden",
        };
      },
      ee = () => {
        const e = l,
          t = d["value"]["globalFont"].fontSize;
        d["value"]["fields"]["forEach"]((l) => {
          const o = e;
          "qrcode" !== l["key"] &&
            l["key"] !== "package" &&
            (l["fontSize"] = t);
        });
      },
      te = () => {
        const e = l,
          t = d.value["paper"],
          o = Math["max"](1, t.widthMm - 2 * t.paddingMm);
        d["value"].fields["forEach"]((t) => {
          "qrcode" !== t["key"] && (t.width = o);
        });
      },
      le = () => {
        ((d.value = a()), W());
      },
      oe = async () => {
        const e = l;
        ((r["value"] = N(JSON.parse(JSON["stringify"](d["value"])))),
          M(),
          (s["value"] = !1),
          await ne());
      },
      ae = async (e) => {
        var t;
        const a = l,
          n = Array.isArray(e)
            ? e
            : (null == (t = o["getLabels"]) ? void 0 : t.call(o)) || [],
          u = r.value,
          i = n["map"]((e) =>
            ((e, t) => {
              const o = l,
                a = t["paper"],
                n = t["globalFont"]["fontFamily"]["replace"](/"/g, "'"),
                u = [
                  "width:" + a["widthMm"] + "mm",
                  "height:" + a["heightMm"] + "mm",
                  "padding:" + a["paddingMm"] + "mm",
                  "font-family:" + n,
                  "font-size:" + t["globalFont"]["fontSize"] + "pt",
                  "font-weight:" + t["globalFont"]["fontWeight"],
                  "line-height:" + t["globalFont"].lineHeight,
                  "position:relative",
                  "box-sizing:border-box",
                  "background:#fff",
                  "color:#000",
                  "overflow:hidden",
                  "page-break-after:always",
                ]["join"](";"),
                r =
                  t["fields"]
                    ["filter"]((e) => e.visible)
                    ["map"]((l) => Q(l, e, t))
                    ["filter"](Boolean)
                    ["join"]("") ||
                  '<div style="position:absolute;left:2mm;top:2mm;font-size:8pt;color:#666;">无可显示字段</div>';
              return (
                '<section class="qlabel" data-qlabel style="' +
                u +
                '">' +
                r +
                "</section>"
              );
            })(e, u),
          )["join"]("");
        return (
          '<div class="qlabel-root"><style>' + R(u) + "</style>" + i + "</div>"
        );
      },
      ne = async () => {
        const e = l,
          t = await ae();
        await o["onPreviewHtmlChange"](t);
      };
    let ue = null;
    const re = [],
      ie = () => {
        const e = l;
        (re["forEach"]((e) => {
          try {
            e();
          } catch (t) {}
        }),
          (re["length"] = 0),
          ue &&
            (ue["querySelectorAll"]("[data-qlabel]")["forEach"]((t) => {
              const l = e;
              t.classList["remove"]("qlabel-edit");
            }),
            ue.querySelectorAll(".qfield")["forEach"]((t) => {
              const l = e,
                o = t;
              ((o.style["outline"] = ""), (o["style"].cursor = ""));
            })),
          (ue = null));
      },
      ce = (e) => {
        const t = l;
        if ((ie(), !e)) return;
        ((ue = e), (c["value"] = !0));
        const o = e["querySelector"]("[data-qlabel]");
        if (!o) return;
        o["classList"]["add"]("qlabel-edit");
        const a = o["getBoundingClientRect"](),
          n = r["value"],
          u = a["width"] / n["paper"]["widthMm"],
          i = a.height / n.paper["heightMm"];
        Array["from"](o["querySelectorAll"](".qfield"))["forEach"]((e) => {
          const l = t,
            o = e.dataset["key"];
          if (!o) return;
          const a = n["fields"]["find"]((e) => e.key === o);
          if (!a) return;
          ((e["style"]["outline"] = "1px dashed #409eff"),
            (e["style"]["cursor"] = "move"));
          const r = (t) => {
            const o = l;
            (t["preventDefault"](), t.stopPropagation());
            const r = t["clientX"],
              s = t["clientY"],
              d = a.x,
              V = a.y;
            e.style.outlineColor = "#f56c6c";
            const m = (t) => {
                const l = o,
                  c = (t["clientX"] - r) / u,
                  m = (t["clientY"] - s) / i;
                let w = d + c,
                  g = V + m;
                ((w = Math["round"](2 * w) / 2),
                  (g = Math["round"](2 * g) / 2),
                  (w = Math["max"](0, Math["min"](n["paper"].widthMm - 1, w))),
                  (g = Math["max"](
                    0,
                    Math["min"](n["paper"]["heightMm"] - 1, g),
                  )),
                  (a.x = w),
                  (a.y = g),
                  (e["style"]["left"] = w + "mm"),
                  (e.style["top"] = g + "mm"));
              },
              w = async () => {
                const t = o;
                (document.removeEventListener("mousemove", m),
                  document["removeEventListener"]("mouseup", w),
                  (e.style["outlineColor"] = "#409eff"),
                  M(),
                  await ne(),
                  await Vue.nextTick());
                const l = ue;
                l && c["value"] && ce(l);
              };
            (document.addEventListener("mousemove", m),
              document["addEventListener"]("mouseup", w));
          };
          (e["addEventListener"]("mousedown", r),
            re["push"](() => e.removeEventListener("mousedown", r)));
        });
      },
      se = () => {
        ((c["value"] = !1), ie());
      },
      de = async (e) => {
        const t = l,
          o = r["value"],
          a = await ae(e);
        return (
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义合格标签</title>\n  <style>html,body{margin:0;padding:0;background:#fff;}' +
          R(o) +
          "</style>\n  </head><body>" +
          a +
          "</body></html>"
        );
      };
    return (
      Vue.onMounted(() => {
        ((() => {
          const e = l;
          try {
            const t = localStorage["getItem"](Aa);
            if (!t) return void (r["value"] = N(a()));
            const l = JSON.parse(t);
            r.value = N(l);
          } catch (t) {
            r.value = N(a());
          }
        })(),
          (() => {
            const e = l;
            try {
              h["value"] = localStorage["getItem"](ka) || "";
            } catch (t) {}
          })(),
          (() => {
            const e = l;
            try {
              ((C["value"] = "1" === localStorage["getItem"](Pa)),
                (z["value"] = L(localStorage.getItem(Ia) || 1)));
            } catch (t) {
              ((C["value"] = !1), (z.value = 1));
            }
          })());
      }),
      t({
        buildQualifiedLabelHtml: ae,
        refreshPreview: ne,
        openSettingsDialog: () => {
          const e = l;
          ((i["value"] = JSON["parse"](JSON["stringify"](r["value"]))),
            (x["value"] = C["value"]),
            (B.value = L(z["value"])),
            (u["value"] = "paper"),
            (n.value = !0));
        },
        openLayoutEditor: () => {
          var e;
          const t = l;
          ((d["value"] = N(JSON["parse"](JSON["stringify"](r.value)))),
            (m["value"] =
              (null == (e = d["value"]["fields"][0]) ? void 0 : e["key"]) ||
              ""),
            W(),
            (s["value"] = !0));
        },
        enterEditMode: ce,
        exitEditMode: se,
        toggleEditMode: (e) => {
          c.value ? se() : ce(e);
        },
        isEditMode: () => c["value"],
        getFixedQuantitySetting: () => ({
          enabled: C.value,
          value: L(z["value"]),
        }),
        printDirect: async () => {
          const e = l,
            t = ElementPlus.ElLoading.service({
              lock: !0,
              text: "正在生成标签...",
              background: "rgba(0,0,0,0.7)",
            });
          try {
            const t = await de(),
              l = r["value"]["paper"],
              o = document["createElement"]("iframe");
            ((o["style"]["cssText"] =
              "position:fixed;top:-9999px;left:-9999px;width:" +
              l["widthMm"] +
              "mm;height:" +
              l["heightMm"] +
              "mm;border:none;visibility:hidden;"),
              document["body"]["appendChild"](o));
            const a = o["contentWindow"],
              n = o["contentDocument"] || a["document"];
            (n["open"](),
              n.write(t),
              n["close"](),
              await new Promise((t) => {
                const l = e,
                  o = Array["from"](n["querySelectorAll"]("img"));
                if (0 === o["length"]) return void t();
                let a = 0;
                o["forEach"]((e) => {
                  const n = l,
                    u = () => {
                      (a++, a === o["length"] && t());
                    };
                  e["complete"] ? u() : ((e["onload"] = u), (e.onerror = u));
                });
              }),
              setTimeout(() => {
                const t = e;
                (a.focus(),
                  a["print"](),
                  setTimeout(() => {
                    const e = t;
                    document["body"].contains(o) &&
                      document["body"]["removeChild"](o);
                  }, 1e3));
              }, 300),
              ElementPlus.ElMessage["success"]("已打开打印对话框"));
          } catch (o) {
            ElementPlus.ElMessage.error(
              "打印失败: " + ((null == o ? void 0 : o["message"]) || o),
            );
          } finally {
            t["close"]();
          }
        },
        printSilent: async () => {
          var e, t;
          const a = l;
          if (!v["value"])
            return (
              ElementPlus.ElMessage["warning"](
                "直接打印仅在Electron客户端可用",
              ),
              !1
            );
          const n = r["value"],
            u = (null == (e = o["getLabels"]) ? void 0 : e.call(o)) || [];
          if (0 === u["length"])
            return (ElementPlus.ElMessage.warning("没有可打印的标签"), !1);
          const i = ElementPlus.ElLoading["service"]({
            lock: !0,
            text: "正在发送到打印机(0/" + u["length"] + ")...",
            background: "rgba(0,0,0,0.7)",
          });
          try {
            const e = n["paper"]["printRotate90"],
              l = {
                landscape: !e && n["paper"].orientation === "landscape",
                copies: n["print"]["copies"],
                pageWidthMm: e ? n["paper"]["heightMm"] : n["paper"]["widthMm"],
                pageHeightMm: e
                  ? n["paper"]["widthMm"]
                  : n["paper"]["heightMm"],
              };
            for (let o = 0; o < u.length; o++) {
              null == (t = i["setText"]) ||
                t.call(
                  i,
                  "正在发送到打印机(" + (o + 1) + "/" + u["length"] + ")...",
                );
              const e = await de([u[o]]),
                n = await window["electronAPI"].silentPrint(
                  e,
                  h["value"] || "",
                  l,
                );
              if (!(null == n ? void 0 : n["success"]))
                return (
                  ElementPlus.ElMessage["error"](
                    "第" +
                      (o + 1) +
                      "张打印失败：" +
                      ((null == n ? void 0 : n["reason"]) || "未知错误"),
                  ),
                  !1
                );
            }
            return (
              ElementPlus.ElMessage["success"](
                "已发送 " +
                  u.length +
                  " 张至打印机：" +
                  (h["value"] || "系统默认"),
              ),
              !0
            );
          } catch (c) {
            return (
              ElementPlus.ElMessage["error"](
                "直接打印失败: " + ((null == c ? void 0 : c["message"]) || c),
              ),
              !1
            );
          } finally {
            i["close"]();
          }
        },
        isElectronEnv: Vue.computed(() => v["value"]),
      }),
      (e, t) => {
        const o = l,
          a = Vue.resolveComponent("el-input-number"),
          r = Vue.resolveComponent("el-form-item"),
          c = Vue.resolveComponent("el-option"),
          g = Vue.resolveComponent("el-select"),
          y = Vue.resolveComponent("el-button"),
          C = Vue.resolveComponent("el-form"),
          z = Vue.resolveComponent("el-tab-pane"),
          M = Vue.resolveComponent("el-switch"),
          N = Vue.resolveComponent("el-alert"),
          L = Vue.resolveComponent("el-tabs"),
          I = Vue.resolveComponent("el-dialog"),
          U = Vue.resolveComponent("el-checkbox"),
          W = Vue.resolveComponent("el-table-column"),
          j = Vue.resolveComponent("el-table");
        return (
          Vue.openBlock(),
          Vue.createElementBlock(
            Vue.Fragment,
            null,
            [
              Vue.createVNode(
                I,
                {
                  modelValue: n.value,
                  "onUpdate:modelValue":
                    t[22] || (t[22] = (e) => (n["value"] = e)),
                  title: "自定义合格标签 - 设置",
                  width: "640px",
                  "destroy-on-close": !1,
                  onOpen: D,
                },
                {
                  footer: Vue.withCtx(() => [
                    Vue.createVNode(
                      y,
                      { onClick: A },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[64] ||
                            (t[64] = [Vue.createTextVNode("重置默认")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      y,
                      { onClick: t[21] || (t[21] = (e) => (n.value = !1)) },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[65] || (t[65] = [Vue.createTextVNode("取消")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      y,
                      { type: "primary", onClick: k },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[66] ||
                            (t[66] = [Vue.createTextVNode("保存并应用")]),
                        ),
                        _: 1,
                      },
                    ),
                  ]),
                  default: Vue.withCtx(() => [
                    Vue.createVNode(
                      L,
                      {
                        modelValue: u["value"],
                        "onUpdate:modelValue":
                          t[20] || (t[20] = (e) => (u["value"] = e)),
                      },
                      {
                        default: Vue.withCtx(() => [
                          Vue.createVNode(
                            z,
                            { label: "纸张", name: "paper" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  C,
                                  { "label-width": "110px" },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        r,
                                        { label: "纸张宽度(mm)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"]["paper"].widthMm,
                                                "onUpdate:modelValue":
                                                  t[0] ||
                                                  (t[0] = (e) =>
                                                    (i["value"][
                                                      "paper"
                                                    ].widthMm = e)),
                                                min: 20,
                                                max: 300,
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
                                        r,
                                        { label: "纸张高度(mm)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"]["paper"].heightMm,
                                                "onUpdate:modelValue":
                                                  t[1] ||
                                                  (t[1] = (e) =>
                                                    (i["value"]["paper"][
                                                      "heightMm"
                                                    ] = e)),
                                                min: 20,
                                                max: 400,
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
                                        r,
                                        { label: "方向" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              g,
                                              {
                                                modelValue:
                                                  i["value"]["paper"]
                                                    .orientation,
                                                "onUpdate:modelValue":
                                                  t[2] ||
                                                  (t[2] = (e) =>
                                                    (i["value"][
                                                      "paper"
                                                    ].orientation = e)),
                                                style: { width: "200px" },
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(c, {
                                                    label: "纵向",
                                                    value: "portrait",
                                                  }),
                                                  Vue.createVNode(c, {
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
                                        r,
                                        { label: "内边距(mm)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"]["paper"].paddingMm,
                                                "onUpdate:modelValue":
                                                  t[3] ||
                                                  (t[3] = (e) =>
                                                    (i.value["paper"][
                                                      "paddingMm"
                                                    ] = e)),
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
                                        r,
                                        { label: "常用尺寸" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              y,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[4] ||
                                                  (t[4] = (e) => P(40, 30)),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[53] ||
                                                    (t[53] = [
                                                      Vue.createTextVNode(
                                                        "40×30",
                                                      ),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                            Vue.createVNode(
                                              y,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[5] ||
                                                  (t[5] = (e) => P(50, 30)),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[54] ||
                                                    (t[54] = [
                                                      Vue.createTextVNode(
                                                        "50×30",
                                                      ),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                            Vue.createVNode(
                                              y,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[6] ||
                                                  (t[6] = (e) => P(50, 40)),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[55] ||
                                                    (t[55] = [
                                                      Vue.createTextVNode(
                                                        "50×40",
                                                      ),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                            Vue.createVNode(
                                              y,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[7] ||
                                                  (t[7] = (e) => P(60, 40)),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[56] ||
                                                    (t[56] = [
                                                      Vue.createTextVNode(
                                                        "60×40",
                                                      ),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                            Vue.createVNode(
                                              y,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[8] ||
                                                  (t[8] = (e) => P(70, 50)),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[57] ||
                                                    (t[57] = [
                                                      Vue.createTextVNode(
                                                        "70×50",
                                                      ),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                            Vue.createVNode(
                                              y,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[9] ||
                                                  (t[9] = (e) => P(80, 60)),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[58] ||
                                                    (t[58] = [
                                                      Vue.createTextVNode(
                                                        "80×60",
                                                      ),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                            Vue.createVNode(
                                              y,
                                              {
                                                size: "small",
                                                onClick:
                                                  t[10] ||
                                                  (t[10] = (e) => P(100, 80)),
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[59] ||
                                                    (t[59] = [
                                                      Vue.createTextVNode(
                                                        "100×80",
                                                      ),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        r,
                                        { label: "整体自适应" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              y,
                                              {
                                                type: "warning",
                                                size: "small",
                                                onClick: q,
                                              },
                                              {
                                                default: Vue.withCtx(
                                                  () =>
                                                    t[60] ||
                                                    (t[60] = [
                                                      Vue.createTextVNode(
                                                        "按当前纸张比例自适应",
                                                      ),
                                                    ]),
                                                ),
                                                _: 1,
                                              },
                                            ),
                                            t[61] ||
                                              (t[61] = Vue.createElementVNode(
                                                "div",
                                                {
                                                  style: {
                                                    color: "#999",
                                                    "font-size": "12px",
                                                    "margin-top": "4px",
                                                  },
                                                },
                                                "以 70×90mm 为基准，按比例缩放所有字段位置、宽度、字号及二维码",
                                                -1,
                                              )),
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
                            z,
                            { label: "字体", name: "font" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  C,
                                  { "label-width": "110px" },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        r,
                                        { label: "字体" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              g,
                                              {
                                                modelValue:
                                                  i.value["globalFont"][
                                                    "fontFamily"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[11] ||
                                                  (t[11] = (e) =>
                                                    (i["value"][
                                                      "globalFont"
                                                    ].fontFamily = e)),
                                                style: { width: "240px" },
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(c, {
                                                    label: "微软雅黑",
                                                    value:
                                                      '"Microsoft YaHei", sans-serif',
                                                  }),
                                                  Vue.createVNode(c, {
                                                    label: "宋体",
                                                    value: '"SimSun", serif',
                                                  }),
                                                  Vue.createVNode(c, {
                                                    label: "黑体",
                                                    value:
                                                      '"SimHei", sans-serif',
                                                  }),
                                                  Vue.createVNode(c, {
                                                    label: "苹方",
                                                    value:
                                                      '"PingFang SC", sans-serif',
                                                  }),
                                                  Vue.createVNode(c, {
                                                    label: "Arial",
                                                    value: "Arial, sans-serif",
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
                                        r,
                                        { label: "默认字号(pt)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"]["globalFont"][
                                                    "fontSize"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[12] ||
                                                  (t[12] = (e) =>
                                                    (i["value"]["globalFont"][
                                                      "fontSize"
                                                    ] = e)),
                                                min: 5,
                                                max: 30,
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
                                        r,
                                        { label: "默认粗细" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              g,
                                              {
                                                modelValue:
                                                  i["value"]["globalFont"][
                                                    "fontWeight"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[13] ||
                                                  (t[13] = (e) =>
                                                    (i[
                                                      "value"
                                                    ].globalFont.fontWeight =
                                                      e)),
                                                style: { width: "160px" },
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(c, {
                                                    label: "正常",
                                                    value: "normal",
                                                  }),
                                                  Vue.createVNode(c, {
                                                    label: "加粗",
                                                    value: "bold",
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
                                        r,
                                        { label: "行高" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"]["globalFont"][
                                                    "lineHeight"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[14] ||
                                                  (t[14] = (e) =>
                                                    (i["value"]["globalFont"][
                                                      "lineHeight"
                                                    ] = e)),
                                                min: 1,
                                                max: 2,
                                                step: 0.05,
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
                                        r,
                                        { label: "自动隐藏空字段" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              M,
                                              {
                                                modelValue:
                                                  i["value"]["autoHideEmpty"],
                                                "onUpdate:modelValue":
                                                  t[15] ||
                                                  (t[15] = (e) =>
                                                    (i["value"][
                                                      "autoHideEmpty"
                                                    ] = e)),
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
                          Vue.createVNode(
                            z,
                            { label: "打印机", name: "printer" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  C,
                                  { "label-width": "110px" },
                                  {
                                    default: Vue.withCtx(() => [
                                      v.value
                                        ? Vue.createCommentVNode("", !0)
                                        : (Vue.openBlock(),
                                          Vue.createBlock(
                                            r,
                                            { key: 0, label: "" },
                                            {
                                              default: Vue.withCtx(() => [
                                                Vue.createVNode(N, {
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
                                        r,
                                        { label: "选择打印机" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              g,
                                              {
                                                modelValue: h.value,
                                                "onUpdate:modelValue":
                                                  t[16] ||
                                                  (t[16] = (e) =>
                                                    (h.value = e)),
                                                placeholder:
                                                  "使用系统默认打印机",
                                                clearable: "",
                                                style: { width: "100%" },
                                                onChange: E,
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  (Vue.openBlock(!0),
                                                  Vue.createElementBlock(
                                                    Vue.Fragment,
                                                    null,
                                                    Vue.renderList(
                                                      f.value,
                                                      (e) => {
                                                        const t = o;
                                                        return (
                                                          Vue.openBlock(),
                                                          Vue.createBlock(
                                                            c,
                                                            {
                                                              key: e["name"],
                                                              label: e[
                                                                "isDefault"
                                                              ]
                                                                ? e[
                                                                    "displayName"
                                                                  ] + "（默认）"
                                                                : e[
                                                                    "displayName"
                                                                  ],
                                                              value: e["name"],
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
                                      Vue.createVNode(r, null, {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            y,
                                            {
                                              size: "small",
                                              loading: p.value,
                                              onClick: b,
                                            },
                                            {
                                              default: Vue.withCtx(
                                                () =>
                                                  t[62] ||
                                                  (t[62] = [
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
                                            za,
                                            "已选：" +
                                              Vue.toDisplayString(
                                                h.value || "系统默认",
                                              ),
                                            1,
                                          ),
                                        ]),
                                        _: 1,
                                      }),
                                      Vue.createVNode(
                                        r,
                                        { label: "打印份数" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"]["print"]["copies"],
                                                "onUpdate:modelValue":
                                                  t[17] ||
                                                  (t[17] = (e) =>
                                                    (i["value"][
                                                      "print"
                                                    ].copies = e)),
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
                                      Vue.createVNode(
                                        r,
                                        { label: "固定标签数" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              M,
                                              {
                                                modelValue: x["value"],
                                                "onUpdate:modelValue":
                                                  t[18] ||
                                                  (t[18] = (e) =>
                                                    (x["value"] = e)),
                                              },
                                              null,
                                              8,
                                              ["modelValue"],
                                            ),
                                            t[63] ||
                                              (t[63] = Vue.createElementVNode(
                                                "span",
                                                {
                                                  style: {
                                                    "margin-left": "8px",
                                                    color: "#999",
                                                    "font-size": "12px",
                                                  },
                                                },
                                                "开启后按指定页数生成标签",
                                                -1,
                                              )),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      x["value"]
                                        ? (Vue.openBlock(),
                                          Vue.createBlock(
                                            r,
                                            { key: 1, label: "打印数量" },
                                            {
                                              default: Vue.withCtx(() => [
                                                Vue.createVNode(
                                                  a,
                                                  {
                                                    modelValue: B["value"],
                                                    "onUpdate:modelValue":
                                                      t[19] ||
                                                      (t[19] = (e) =>
                                                        (B["value"] = e)),
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
                I,
                {
                  modelValue: s["value"],
                  "onUpdate:modelValue":
                    t[52] || (t[52] = (e) => (s["value"] = e)),
                  title: "自定义合格标签 - 布局编辑",
                  width: "980px",
                  "destroy-on-close": !1,
                },
                {
                  footer: Vue.withCtx(() => [
                    Vue.createVNode(
                      y,
                      { onClick: t[51] || (t[51] = (e) => (s["value"] = !1)) },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[75] || (t[75] = [Vue.createTextVNode("取消")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      y,
                      { onClick: le },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[76] ||
                            (t[76] = [Vue.createTextVNode("重置默认")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      y,
                      { type: "primary", onClick: oe },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[77] ||
                            (t[77] = [Vue.createTextVNode("保存布局")]),
                        ),
                        _: 1,
                      },
                    ),
                  ]),
                  default: Vue.withCtx(() => [
                    Vue.createElementVNode("div", xa, [
                      Vue.createElementVNode("div", Ba, [
                        Vue.createVNode(
                          C,
                          { "label-width": "98px", size: "small" },
                          {
                            default: Vue.withCtx(() => [
                              Vue.createVNode(
                                r,
                                { label: "纸张宽(mm)" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue:
                                          d["value"]["paper"]["widthMm"],
                                        "onUpdate:modelValue":
                                          t[23] ||
                                          (t[23] = (e) =>
                                            (d["value"]["paper"]["widthMm"] =
                                              e)),
                                        min: 20,
                                        max: 300,
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
                                r,
                                { label: "纸张高(mm)" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue:
                                          d["value"]["paper"]["heightMm"],
                                        "onUpdate:modelValue":
                                          t[24] ||
                                          (t[24] = (e) =>
                                            (d.value.paper["heightMm"] = e)),
                                        min: 20,
                                        max: 400,
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
                                r,
                                { label: "内边距(mm)" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue:
                                          d.value["paper"]["paddingMm"],
                                        "onUpdate:modelValue":
                                          t[25] ||
                                          (t[25] = (e) =>
                                            (d["value"].paper["paddingMm"] =
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
                                r,
                                { label: "默认字号(pt)" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue:
                                          d.value["globalFont"]["fontSize"],
                                        "onUpdate:modelValue":
                                          t[26] ||
                                          (t[26] = (e) =>
                                            (d["value"]["globalFont"].fontSize =
                                              e)),
                                        min: 5,
                                        max: 30,
                                        step: 0.5,
                                      },
                                      null,
                                      8,
                                      ["modelValue"],
                                    ),
                                    Vue.createVNode(
                                      y,
                                      {
                                        size: "small",
                                        style: { "margin-left": "4px" },
                                        onClick: ee,
                                      },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[67] ||
                                            (t[67] = [
                                              Vue.createTextVNode("应用到全部"),
                                            ]),
                                        ),
                                        _: 1,
                                      },
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(
                                r,
                                { label: "字段宽度" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      y,
                                      {
                                        size: "small",
                                        type: "info",
                                        onClick: te,
                                      },
                                      {
                                        default: Vue.withCtx(
                                          () =>
                                            t[68] ||
                                            (t[68] = [
                                              Vue.createTextVNode(
                                                "适应纸张宽度",
                                              ),
                                            ]),
                                        ),
                                        _: 1,
                                      },
                                    ),
                                    t[69] ||
                                      (t[69] = Vue.createElementVNode(
                                        "span",
                                        {
                                          style: {
                                            "margin-left": "4px",
                                            "font-size": "11px",
                                            color: "#999",
                                          },
                                        },
                                        "(宽-边距×2)",
                                        -1,
                                      )),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(
                                r,
                                { label: "默认粗细" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      g,
                                      {
                                        modelValue:
                                          d["value"]["globalFont"][
                                            "fontWeight"
                                          ],
                                        "onUpdate:modelValue":
                                          t[27] ||
                                          (t[27] = (e) =>
                                            (d["value"]["globalFont"][
                                              "fontWeight"
                                            ] = e)),
                                        style: { width: "140px" },
                                      },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(c, {
                                            label: "正常",
                                            value: "normal",
                                          }),
                                          Vue.createVNode(c, {
                                            label: "加粗",
                                            value: "bold",
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
                                r,
                                { label: "自动隐藏空" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      M,
                                      {
                                        modelValue: d["value"]["autoHideEmpty"],
                                        "onUpdate:modelValue":
                                          t[28] ||
                                          (t[28] = (e) =>
                                            (d["value"]["autoHideEmpty"] = e)),
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
                                r,
                                { label: "打印旋转90°" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      M,
                                      {
                                        modelValue:
                                          d["value"].paper["printRotate90"],
                                        "onUpdate:modelValue":
                                          t[29] ||
                                          (t[29] = (e) =>
                                            (d["value"]["paper"][
                                              "printRotate90"
                                            ] = e)),
                                      },
                                      null,
                                      8,
                                      ["modelValue"],
                                    ),
                                    t[70] ||
                                      (t[70] = Vue.createElementVNode(
                                        "span",
                                        {
                                          style: {
                                            "margin-left": "6px",
                                            "font-size": "11px",
                                            color: "#999",
                                          },
                                        },
                                        "布局60×90→打印输出到90×60纸",
                                        -1,
                                      )),
                                  ]),
                                  _: 1,
                                },
                              ),
                            ]),
                            _: 1,
                          },
                        ),
                        w.value
                          ? (Vue.openBlock(),
                            Vue.createElementBlock("div", Ma, [
                              Vue.createElementVNode(
                                "div",
                                Na,
                                "字段设置：" +
                                  Vue.toDisplayString(w.value["label"]),
                                1,
                              ),
                              Vue.createVNode(
                                C,
                                { "label-width": "98px", size: "small" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      r,
                                      { label: "X(mm)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue: w["value"].x,
                                              "onUpdate:modelValue":
                                                t[30] ||
                                                (t[30] = (e) =>
                                                  (w["value"].x = e)),
                                              min: 0,
                                              max: 300,
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
                                      r,
                                      { label: "Y(mm)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue: w["value"].y,
                                              "onUpdate:modelValue":
                                                t[31] ||
                                                (t[31] = (e) =>
                                                  (w["value"].y = e)),
                                              min: 0,
                                              max: 400,
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
                                      r,
                                      { label: "宽(mm)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue: w["value"].width,
                                              "onUpdate:modelValue":
                                                t[32] ||
                                                (t[32] = (e) =>
                                                  (w.value.width = e)),
                                              min: 4,
                                              max: 300,
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
                                    "qrcode" !== w.value["key"]
                                      ? (Vue.openBlock(),
                                        Vue.createElementBlock(
                                          Vue.Fragment,
                                          { key: 0 },
                                          [
                                            Vue.createVNode(
                                              r,
                                              { label: "字号(pt)" },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(
                                                    a,
                                                    {
                                                      modelValue:
                                                        w["value"]["fontSize"],
                                                      "onUpdate:modelValue":
                                                        t[33] ||
                                                        (t[33] = (e) =>
                                                          (w["value"][
                                                            "fontSize"
                                                          ] = e)),
                                                      min: 5,
                                                      max: 30,
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
                                              r,
                                              { label: "粗细" },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(
                                                    g,
                                                    {
                                                      modelValue:
                                                        w["value"].fontWeight,
                                                      "onUpdate:modelValue":
                                                        t[34] ||
                                                        (t[34] = (e) =>
                                                          (w["value"][
                                                            "fontWeight"
                                                          ] = e)),
                                                      style: { width: "140px" },
                                                    },
                                                    {
                                                      default: Vue.withCtx(
                                                        () => [
                                                          Vue.createVNode(c, {
                                                            label: "正常",
                                                            value: "normal",
                                                          }),
                                                          Vue.createVNode(c, {
                                                            label: "加粗",
                                                            value: "bold",
                                                          }),
                                                        ],
                                                      ),
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
                                              r,
                                              { label: "换行" },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(
                                                    M,
                                                    {
                                                      modelValue:
                                                        w["value"].wrap,
                                                      "onUpdate:modelValue":
                                                        t[35] ||
                                                        (t[35] = (e) =>
                                                          (w["value"]["wrap"] =
                                                            e)),
                                                    },
                                                    null,
                                                    8,
                                                    ["modelValue"],
                                                  ),
                                                ]),
                                                _: 1,
                                              },
                                            ),
                                            w.value["wrap"]
                                              ? (Vue.openBlock(),
                                                Vue.createBlock(
                                                  r,
                                                  { key: 0, label: "最多行数" },
                                                  {
                                                    default: Vue.withCtx(() => [
                                                      Vue.createVNode(
                                                        a,
                                                        {
                                                          modelValue:
                                                            w.value["maxLines"],
                                                          "onUpdate:modelValue":
                                                            t[36] ||
                                                            (t[36] = (e) =>
                                                              (w["value"][
                                                                "maxLines"
                                                              ] = e)),
                                                          min: 1,
                                                          max: 10,
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
                                            Vue.createVNode(
                                              r,
                                              { label: "对齐" },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(
                                                    g,
                                                    {
                                                      modelValue:
                                                        w["value"]["textAlign"],
                                                      "onUpdate:modelValue":
                                                        t[37] ||
                                                        (t[37] = (e) =>
                                                          (w.value[
                                                            "textAlign"
                                                          ] = e)),
                                                      style: { width: "130px" },
                                                    },
                                                    {
                                                      default: Vue.withCtx(
                                                        () => [
                                                          Vue.createVNode(c, {
                                                            label: "左对齐",
                                                            value: "left",
                                                          }),
                                                          Vue.createVNode(c, {
                                                            label: "居中",
                                                            value: "center",
                                                          }),
                                                          Vue.createVNode(c, {
                                                            label: "右对齐",
                                                            value: "right",
                                                          }),
                                                        ],
                                                      ),
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
                                              r,
                                              { label: "显示前缀" },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(
                                                    M,
                                                    {
                                                      modelValue:
                                                        w["value"][
                                                          "showPrefix"
                                                        ],
                                                      "onUpdate:modelValue":
                                                        t[38] ||
                                                        (t[38] = (e) =>
                                                          (w["value"][
                                                            "showPrefix"
                                                          ] = e)),
                                                    },
                                                    null,
                                                    8,
                                                    ["modelValue"],
                                                  ),
                                                ]),
                                                _: 1,
                                              },
                                            ),
                                          ],
                                          64,
                                        ))
                                      : Vue.createCommentVNode("", !0),
                                  ]),
                                  _: 1,
                                },
                              ),
                            ]))
                          : Vue.createCommentVNode("", !0),
                        Vue.createElementVNode("div", Ea, [
                          t[73] ||
                            (t[73] = Vue.createElementVNode(
                              "div",
                              { class: "layout-fields-title" },
                              "快捷批量调整",
                              -1,
                            )),
                          Vue.createVNode(
                            C,
                            { "label-width": "88px", size: "small" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  r,
                                  { label: "整体自适应" },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        y,
                                        {
                                          type: "warning",
                                          size: "small",
                                          onClick: J,
                                        },
                                        {
                                          default: Vue.withCtx(
                                            () =>
                                              t[71] ||
                                              (t[71] = [
                                                Vue.createTextVNode(
                                                  "按当前纸张比例",
                                                ),
                                              ]),
                                          ),
                                          _: 1,
                                        },
                                      ),
                                      t[72] ||
                                        (t[72] = Vue.createElementVNode(
                                          "span",
                                          {
                                            style: {
                                              "margin-left": "4px",
                                              "font-size": "11px",
                                              color: "#999",
                                            },
                                          },
                                          "基准 70×90mm",
                                          -1,
                                        )),
                                    ]),
                                    _: 1,
                                  },
                                ),
                                Vue.createVNode(
                                  r,
                                  { label: "正文字号(pt)" },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        a,
                                        {
                                          modelValue: S["value"],
                                          "onUpdate:modelValue":
                                            t[39] ||
                                            (t[39] = (e) => (S["value"] = e)),
                                          min: 5,
                                          max: 30,
                                          step: 0.5,
                                          onChange: O,
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
                                  r,
                                  { label: "正文行宽(mm)" },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        a,
                                        {
                                          modelValue: T["value"],
                                          "onUpdate:modelValue":
                                            t[40] ||
                                            (t[40] = (e) => (T["value"] = e)),
                                          min: 10,
                                          max: 200,
                                          step: 1,
                                          onChange: H,
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
                                  r,
                                  { label: "客户/单号宽" },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        a,
                                        {
                                          modelValue: Y.value,
                                          "onUpdate:modelValue":
                                            t[41] ||
                                            (t[41] = (e) => (Y["value"] = e)),
                                          min: 10,
                                          max: 200,
                                          step: 1,
                                          onChange: G,
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
                      ]),
                      Vue.createElementVNode("div", La, [
                        Vue.createElementVNode("div", ba, [
                          Vue.createElementVNode(
                            "div",
                            {
                              class: "layout-canvas",
                              style: Vue.normalizeStyle(F.value),
                            },
                            [
                              (Vue.openBlock(!0),
                              Vue.createElementBlock(
                                Vue.Fragment,
                                null,
                                Vue.renderList(d["value"]["fields"], (e) => {
                                  const t = o;
                                  return (
                                    Vue.openBlock(),
                                    Vue.createElementBlock(
                                      Vue.Fragment,
                                      { key: e.key },
                                      [
                                        e["visible"]
                                          ? (Vue.openBlock(),
                                            Vue.createElementBlock(
                                              "div",
                                              {
                                                key: 0,
                                                class: Vue.normalizeClass([
                                                  "layout-node",
                                                  e["key"] === "qrcode"
                                                    ? "layout-node-qr"
                                                    : "layout-node-text",
                                                ]),
                                                style: Vue.normalizeStyle($(e)),
                                                onMousedown: (t) =>
                                                  ((e, t) => {
                                                    const o = l;
                                                    e.preventDefault();
                                                    const a = e.clientX,
                                                      n = e["clientY"],
                                                      u = t.x,
                                                      r = t.y,
                                                      i = V.value,
                                                      c = d["value"]["paper"],
                                                      s = (e) => {
                                                        const l = o,
                                                          s =
                                                            (e.clientX - a) / i,
                                                          d =
                                                            (e["clientY"] - n) /
                                                            i;
                                                        let V = u + s,
                                                          m = r + d;
                                                        ((V =
                                                          Math["round"](2 * V) /
                                                          2),
                                                          (m =
                                                            Math["round"](
                                                              2 * m,
                                                            ) / 2),
                                                          (V = Math["max"](
                                                            0,
                                                            Math["min"](
                                                              c["widthMm"] - 1,
                                                              V,
                                                            ),
                                                          )),
                                                          (m = Math["max"](
                                                            0,
                                                            Math.min(
                                                              c["heightMm"] - 1,
                                                              m,
                                                            ),
                                                          )),
                                                          (t.x = V),
                                                          (t.y = m));
                                                      },
                                                      m = () => {
                                                        const e = o;
                                                        (document.removeEventListener(
                                                          "mousemove",
                                                          s,
                                                        ),
                                                          document[
                                                            "removeEventListener"
                                                          ]("mouseup", m));
                                                      };
                                                    (document[
                                                      "addEventListener"
                                                    ]("mousemove", s),
                                                      document.addEventListener(
                                                        "mouseup",
                                                        m,
                                                      ));
                                                  })(t, e),
                                              },
                                              [
                                                e.key === "qrcode"
                                                  ? (Vue.openBlock(),
                                                    Vue.createElementBlock(
                                                      Vue.Fragment,
                                                      { key: 0 },
                                                      [
                                                        Vue.createTextVNode(
                                                          "二维码",
                                                        ),
                                                      ],
                                                      64,
                                                    ))
                                                  : (Vue.openBlock(),
                                                    Vue.createElementBlock(
                                                      Vue.Fragment,
                                                      { key: 1 },
                                                      [
                                                        Vue.createTextVNode(
                                                          Vue.toDisplayString(
                                                            e.label,
                                                          ),
                                                          1,
                                                        ),
                                                      ],
                                                      64,
                                                    )),
                                              ],
                                              46,
                                              Da,
                                            ))
                                          : Vue.createCommentVNode("", !0),
                                      ],
                                      64,
                                    )
                                  );
                                }),
                                128,
                              )),
                            ],
                            4,
                          ),
                        ]),
                        t[74] ||
                          (t[74] = Vue.createElementVNode(
                            "div",
                            {
                              class: "layout-fields-title",
                              style: { "margin-top": "0" },
                            },
                            "字段列表（点击行选中可调位置）",
                            -1,
                          )),
                        Vue.createVNode(
                          j,
                          {
                            data: d["value"]["fields"],
                            size: "small",
                            border: "",
                            "highlight-current-row": "",
                            "row-key": "key",
                            style: { width: "100%" },
                            onRowClick:
                              t[50] ||
                              (t[50] = (e) => {
                                return ((t = e["key"]), void (m["value"] = t));
                                var t;
                              }),
                          },
                          {
                            default: Vue.withCtx(() => [
                              Vue.createVNode(
                                W,
                                { label: "显", width: "38" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      U,
                                      {
                                        modelValue: e.visible,
                                        "onUpdate:modelValue": (t) =>
                                          (e["visible"] = t),
                                        onClick:
                                          t[42] ||
                                          (t[42] = Vue.withModifiers(() => {}, [
                                            "stop",
                                          ])),
                                      },
                                      null,
                                      8,
                                      ["modelValue", "onUpdate:modelValue"],
                                    ),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(W, {
                                prop: "label",
                                label: "字段",
                                width: "46",
                              }),
                              Vue.createVNode(
                                W,
                                { label: "X", width: "72" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue: e.x,
                                        "onUpdate:modelValue": (t) => (e.x = t),
                                        min: 0,
                                        max: 300,
                                        step: 0.5,
                                        size: "small",
                                        "controls-position": "right",
                                        onClick:
                                          t[43] ||
                                          (t[43] = Vue.withModifiers(() => {}, [
                                            "stop",
                                          ])),
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
                                W,
                                { label: "Y", width: "72" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue: e.y,
                                        "onUpdate:modelValue": (t) => (e.y = t),
                                        min: 0,
                                        max: 400,
                                        step: 0.5,
                                        size: "small",
                                        "controls-position": "right",
                                        onClick:
                                          t[44] ||
                                          (t[44] = Vue.withModifiers(() => {}, [
                                            "stop",
                                          ])),
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
                                W,
                                { label: "宽(mm)", width: "82" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue: e.width,
                                        "onUpdate:modelValue": (t) =>
                                          (e["width"] = t),
                                        min: 1,
                                        max: 300,
                                        step: 0.5,
                                        size: "small",
                                        "controls-position": "right",
                                        onClick:
                                          t[45] ||
                                          (t[45] = Vue.withModifiers(() => {}, [
                                            "stop",
                                          ])),
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
                                W,
                                { label: "字号", width: "78" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    e["key"] !== "qrcode"
                                      ? (Vue.openBlock(),
                                        Vue.createBlock(
                                          a,
                                          {
                                            key: 0,
                                            modelValue: e["fontSize"],
                                            "onUpdate:modelValue": (t) =>
                                              (e["fontSize"] = t),
                                            min: 5,
                                            max: 30,
                                            step: 0.5,
                                            size: "small",
                                            "controls-position": "right",
                                            onClick:
                                              t[46] ||
                                              (t[46] =
                                                Vue.withModifiers(() => {}, [
                                                  "stop",
                                                ])),
                                          },
                                          null,
                                          8,
                                          ["modelValue", "onUpdate:modelValue"],
                                        ))
                                      : Vue.createCommentVNode("", !0),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(
                                W,
                                { label: "对齐", width: "74" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    e["key"] !== "qrcode"
                                      ? (Vue.openBlock(),
                                        Vue.createBlock(
                                          g,
                                          {
                                            key: 0,
                                            modelValue: e["textAlign"],
                                            "onUpdate:modelValue": (t) =>
                                              (e["textAlign"] = t),
                                            size: "small",
                                            style: { width: "68px" },
                                            onClick:
                                              t[47] ||
                                              (t[47] =
                                                Vue.withModifiers(() => {}, [
                                                  "stop",
                                                ])),
                                          },
                                          {
                                            default: Vue.withCtx(() => [
                                              Vue.createVNode(c, {
                                                label: "左",
                                                value: "left",
                                              }),
                                              Vue.createVNode(c, {
                                                label: "中",
                                                value: "center",
                                              }),
                                              Vue.createVNode(c, {
                                                label: "右",
                                                value: "right",
                                              }),
                                            ]),
                                            _: 2,
                                          },
                                          1032,
                                          ["modelValue", "onUpdate:modelValue"],
                                        ))
                                      : Vue.createCommentVNode("", !0),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(
                                W,
                                { label: "换行", width: "52" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    "qrcode" !== e["key"]
                                      ? (Vue.openBlock(),
                                        Vue.createBlock(
                                          U,
                                          {
                                            key: 0,
                                            modelValue: e.wrap,
                                            "onUpdate:modelValue": (t) =>
                                              (e["wrap"] = t),
                                            onClick:
                                              t[48] ||
                                              (t[48] =
                                                Vue.withModifiers(() => {}, [
                                                  "stop",
                                                ])),
                                          },
                                          null,
                                          8,
                                          ["modelValue", "onUpdate:modelValue"],
                                        ))
                                      : Vue.createCommentVNode("", !0),
                                  ]),
                                  _: 1,
                                },
                              ),
                              Vue.createVNode(
                                W,
                                { label: "前缀", width: "52" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    e["key"] !== "qrcode"
                                      ? (Vue.openBlock(),
                                        Vue.createBlock(
                                          U,
                                          {
                                            key: 0,
                                            modelValue: e["showPrefix"],
                                            "onUpdate:modelValue": (t) =>
                                              (e.showPrefix = t),
                                            onClick:
                                              t[49] ||
                                              (t[49] =
                                                Vue.withModifiers(() => {}, [
                                                  "stop",
                                                ])),
                                          },
                                          null,
                                          8,
                                          ["modelValue", "onUpdate:modelValue"],
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
                          ["data"],
                        ),
                      ]),
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
