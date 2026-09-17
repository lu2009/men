export default {
  __name: "ProductionSheetPrintManager",
  props: {
    getData: { type: Function },
    isActive: { type: Function },
    onPreviewHtmlChange: { type: Function },
  },
  setup(e, { expose: t }) {
    const l = Ga,
      o = e;
    ("material",
      "型材：",
      "size",
      "尺寸：",
      "color",
      "颜色：",
      "glass",
      "玻璃：",
      "client",
      "制单：",
      "lockway",
      "开向：",
      "orderID",
      "单号：",
      "address",
      "地址：",
      "remark",
      "备注：",
      "qrcode",
      "doorframe",
      "windows",
      "亮窗/扣板");
    const a = () => ({
        paper: {
          widthMm: 210,
          heightMm: 148,
          orientation: "portrait",
          paddingMm: 5,
        },
        globalHeaderFont: {
          fontFamily: "Microsoft YaHei",
          fontSize: 19,
          fontColor: "#000000",
          fontWeight: "normal",
        },
        headerFields: [
          {
            key: "material",
            label: "型材",
            prefix: "型材：",
            visible: !0,
            x: 5,
            y: 3.5,
            width: 75,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#F70505",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
          {
            key: "size",
            label: "尺寸",
            prefix: "尺寸：",
            visible: !0,
            x: 85.5,
            y: 3.5,
            width: 93.5,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
          {
            key: "color",
            label: "颜色",
            prefix: "颜色：",
            visible: !0,
            x: 5,
            y: 10,
            width: 75,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
          {
            key: "glass",
            label: "玻璃",
            prefix: "玻璃：",
            visible: !0,
            x: 85.5,
            y: 10.5,
            width: 94,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
          {
            key: "client",
            label: "客户",
            prefix: "客户：",
            visible: !0,
            x: 5,
            y: 17,
            width: 75,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
          {
            key: "maker",
            label: "制单",
            prefix: "制单：",
            visible: !0,
            x: 164.5,
            y: 36,
            width: 40,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
          {
            key: "lockway",
            label: "开向",
            prefix: "开向：",
            visible: !0,
            x: 85.5,
            y: 17,
            width: 90,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
          {
            key: "orderID",
            label: "单号",
            prefix: "单号：",
            visible: !0,
            x: 5,
            y: 24,
            width: 75,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
          {
            key: "address",
            label: "地址",
            prefix: "地址：",
            visible: !0,
            x: 85.5,
            y: 24,
            width: 94,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !0,
            lineHeight: 1.4,
          },
          {
            key: "remark",
            label: "备注",
            prefix: "备注：",
            visible: !0,
            x: 5,
            y: 31,
            width: 180,
            fontSize: 15,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !0,
            lineHeight: 1.4,
          },
          {
            key: "lockImg",
            label: "锁图",
            prefix: "",
            visible: !0,
            x: 187.5,
            y: 24,
            width: 14,
            fontSize: 11,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
          {
            key: "qrcode",
            label: "二维码",
            prefix: "",
            visible: !0,
            x: 186,
            y: 3.5,
            width: 18,
            fontSize: 11,
            fontFamily: "Microsoft YaHei",
            fontColor: "#000000",
            fontWeight: "normal",
            wrap: !1,
            lineHeight: 1.4,
          },
        ],
        tableConfig: {
          showBodyBorder: !0,
          underlineBrElements: !0,
          rowHeight: 37,
          tableFontSize: 16.5,
          tableTopMm: 42.5,
          columns: [
            { key: "doorsheet", label: "门扇", visible: !0, width: 50 },
            { key: "doorframe", label: "外框", visible: !0, width: 50 },
            { key: "windows", label: "亮窗/扣板", visible: !0, width: 50 },
            { key: "doorImg", label: "门图", visible: !0, width: 50 },
          ],
        },
        doorImgBox: { enabled: !1, x: 128.5, y: 80.5, width: 43, height: 50 },
        print: { copies: 1, itemsPerPage: 1 },
      }),
      n = Vue.ref(!1),
      u = Vue.ref("paper"),
      r = Vue.ref(a()),
      i = Vue.ref(a()),
      c = Vue.ref(!1),
      s = Vue.ref(a()),
      d = Vue.ref(""),
      V = Vue.ref(""),
      m = Vue.ref(null),
      w = Vue.computed(() => {
        const e = l;
        return "field" !== V["value"]
          ? null
          : s["value"]["headerFields"]["find"](
              (t) => t["key"] === d["value"],
            ) || null;
      }),
      v = Vue.computed(() => !!window["electronAPI"]),
      f = Vue.ref([]),
      h = Vue.ref(""),
      p = Vue.ref(!1),
      C = () => {
        const e = l;
        try {
          localStorage["setItem"](on, JSON["stringify"](r["value"]));
        } catch (t) {}
      },
      z = (e) => {
        var t, o, n, u, r, i, c, s, d, V, m, w, g, y, v, f, h, p, C, z, x;
        const B = l,
          M = a(),
          N = (e, t, l, o) => {
            const a = Ha,
              n = Number(e);
            return Number.isFinite(n) ? Math["max"](t, Math["min"](l, n)) : o;
          },
          E = {
            paper: {
              widthMm: N(
                null == (t = null == e ? void 0 : e.paper)
                  ? void 0
                  : t["widthMm"],
                50,
                400,
                M["paper"]["widthMm"],
              ),
              heightMm: N(
                null == (o = null == e ? void 0 : e["paper"])
                  ? void 0
                  : o["heightMm"],
                50,
                400,
                M["paper"]["heightMm"],
              ),
              orientation:
                "landscape" ===
                (null == (n = null == e ? void 0 : e["paper"])
                  ? void 0
                  : n["orientation"])
                  ? "landscape"
                  : "portrait",
              paddingMm: N(
                null == (u = null == e ? void 0 : e.paper)
                  ? void 0
                  : u["paddingMm"],
                0,
                30,
                M["paper"]["paddingMm"],
              ),
            },
            globalHeaderFont: {
              fontFamily:
                (null == (r = null == e ? void 0 : e["globalHeaderFont"])
                  ? void 0
                  : r["fontFamily"]) || M.globalHeaderFont["fontFamily"],
              fontSize: N(
                null == (i = null == e ? void 0 : e["globalHeaderFont"])
                  ? void 0
                  : i["fontSize"],
                6,
                36,
                M.globalHeaderFont["fontSize"],
              ),
              fontColor:
                (null == (c = null == e ? void 0 : e["globalHeaderFont"])
                  ? void 0
                  : c["fontColor"]) || M.globalHeaderFont["fontColor"],
              fontWeight:
                "bold" ===
                (null == (s = null == e ? void 0 : e["globalHeaderFont"])
                  ? void 0
                  : s["fontWeight"])
                  ? "bold"
                  : "normal",
            },
            headerFields: [],
            tableConfig: {
              showBodyBorder:
                void 0 !==
                (null == (d = null == e ? void 0 : e["tableConfig"])
                  ? void 0
                  : d["showBodyBorder"])
                  ? !!e["tableConfig"]["showBodyBorder"]
                  : M["tableConfig"]["showBodyBorder"],
              underlineBrElements:
                void 0 !==
                (null == (V = null == e ? void 0 : e["tableConfig"])
                  ? void 0
                  : V.underlineBrElements)
                  ? !!e["tableConfig"].underlineBrElements
                  : M.tableConfig.underlineBrElements,
              rowHeight: N(
                null == (m = null == e ? void 0 : e.tableConfig)
                  ? void 0
                  : m["rowHeight"],
                16,
                60,
                M.tableConfig["rowHeight"],
              ),
              tableFontSize: N(
                null == (w = null == e ? void 0 : e.tableConfig)
                  ? void 0
                  : w["tableFontSize"],
                6,
                24,
                M["tableConfig"]["tableFontSize"],
              ),
              tableTopMm: N(
                null == (g = null == e ? void 0 : e["tableConfig"])
                  ? void 0
                  : g["tableTopMm"],
                -1,
                400,
                M.tableConfig["tableTopMm"],
              ),
              columns: [],
            },
            doorImgBox: {
              enabled: !!(null == (y = null == e ? void 0 : e.doorImgBox)
                ? void 0
                : y["enabled"]),
              x: N(
                null == (v = null == e ? void 0 : e["doorImgBox"])
                  ? void 0
                  : v.x,
                0,
                400,
                M["doorImgBox"].x,
              ),
              y: N(
                null == (f = null == e ? void 0 : e["doorImgBox"])
                  ? void 0
                  : f.y,
                0,
                400,
                M["doorImgBox"].y,
              ),
              width: N(
                null == (h = null == e ? void 0 : e["doorImgBox"])
                  ? void 0
                  : h["width"],
                10,
                200,
                M["doorImgBox"].width,
              ),
              height: N(
                null == (p = null == e ? void 0 : e["doorImgBox"])
                  ? void 0
                  : p.height,
                10,
                200,
                M.doorImgBox["height"],
              ),
            },
            print: {
              copies: Math["max"](
                1,
                Math["min"](
                  99,
                  Number(
                    null == (C = null == e ? void 0 : e["print"])
                      ? void 0
                      : C.copies,
                  ) || M["print"]["copies"],
                ),
              ),
              itemsPerPage:
                2 ===
                Number(
                  null == (z = null == e ? void 0 : e.print)
                    ? void 0
                    : z.itemsPerPage,
                )
                  ? 2
                  : M.print["itemsPerPage"],
            },
          },
          L = Array["isArray"](null == e ? void 0 : e["headerFields"])
            ? e["headerFields"]
            : [],
          b = new Map(L["map"]((e) => [null == e ? void 0 : e["key"], e]));
        for (const l of M["headerFields"]) {
          const e = b["get"](l["key"]),
            t = {
              ...l,
              ...(e || {}),
              key: l["key"],
              label: l.label,
              prefix: l["prefix"],
              visible:
                void 0 !== (null == e ? void 0 : e["visible"])
                  ? !!e["visible"]
                  : l.visible,
              x: N(null == e ? void 0 : e.x, 0, 400, l.x),
              y: N(null == e ? void 0 : e.y, 0, 400, l.y),
              width: N(null == e ? void 0 : e["width"], 5, 300, l.width),
              fontSize: N(
                null == e ? void 0 : e["fontSize"],
                6,
                36,
                l["fontSize"],
              ),
              fontFamily: (null == e ? void 0 : e.fontFamily) || l.fontFamily,
              fontColor: (null == e ? void 0 : e["fontColor"]) || l.fontColor,
              fontWeight:
                (null == e ? void 0 : e["fontWeight"]) === "bold"
                  ? "bold"
                  : "normal",
              wrap:
                void 0 !== (null == e ? void 0 : e.wrap)
                  ? !!e["wrap"]
                  : l["wrap"],
              lineHeight: Number["isFinite"](
                Number(null == e ? void 0 : e["lineHeight"]),
              )
                ? Math["max"](0.8, Math.min(3, Number(e.lineHeight)))
                : l["lineHeight"],
            };
          E["headerFields"]["push"](t);
        }
        const D = Array["isArray"](
          null == (x = null == e ? void 0 : e["tableConfig"])
            ? void 0
            : x["columns"],
        )
          ? e.tableConfig["columns"]
          : [];
        if (D["length"] > 0) {
          new Map(D["map"]((e) => [null == e ? void 0 : e.key, e]));
          const e = new Set();
          for (const t of D) {
            const l = M.tableConfig["columns"]["find"](
              (e) => e["key"] === (null == t ? void 0 : t.key),
            );
            l &&
              (E["tableConfig"].columns.push({
                ...l,
                visible: void 0 !== t["visible"] ? !!t.visible : l["visible"],
                width: N(t["width"], 5, 300, l["width"]),
              }),
              e["add"](l["key"]));
          }
          for (const t of M.tableConfig["columns"])
            e["has"](t.key) || E["tableConfig"]["columns"]["push"]({ ...t });
        } else
          E["tableConfig"]["columns"] = M["tableConfig"]["columns"]["map"](
            (e) => ({ ...e }),
          );
        return E;
      },
      x = () => {
        const e = l;
        try {
          localStorage.setItem(an, h["value"]);
        } catch (t) {}
      },
      B = async () => {
        const e = l;
        if (v["value"]) {
          p["value"] = !0;
          try {
            f["value"] = await window.electronAPI["getPrinters"]();
          } catch (t) {
            ElementPlus.ElMessage["error"]("获取打印机列表失败");
          } finally {
            p["value"] = !1;
          }
        }
      },
      M = async () => {
        const e = l;
        v.value && 0 === f["value"]["length"] && (await B());
      },
      N = () => {
        i["value"] = a();
      },
      E = async () => {
        var e;
        const t = l;
        ((r.value = z(JSON["parse"](JSON["stringify"](i["value"])))),
          C(),
          (n["value"] = !1),
          (null == (e = o["isActive"]) ? void 0 : e.call(o)) && (await ae()));
      },
      L = (e, t, o = "portrait") => {
        const a = l;
        ((i["value"]["paper"].widthMm = e),
          (i["value"]["paper"].heightMm = t),
          (i.value.paper.orientation = o));
      },
      b = () => {
        const e = l,
          t = i["value"]["globalHeaderFont"];
        (i["value"]["headerFields"]["forEach"]((l) => {
          const o = e;
          l["key"] !== "qrcode" &&
            l["key"] !== "lockImg" &&
            ((l["fontFamily"] = t.fontFamily),
            (l["fontSize"] = t["fontSize"]),
            (l["fontColor"] = t["fontColor"]),
            (l["fontWeight"] = t.fontWeight));
        }),
          ElementPlus.ElMessage["success"]("已统一应用到所有头部字段"));
      },
      D = Vue.ref(null),
      A = Vue.ref({ w: 800, h: 600 }),
      k = Vue.computed(() => {
        const e = l,
          t = s["value"]["paper"],
          o = A.value.w,
          a = A["value"].h;
        return Math["min"](
          o / Math.max(1, t["widthMm"]),
          a / Math["max"](1, t["heightMm"]),
        );
      }),
      P = Vue.computed(() => {
        const e = l,
          t = s["value"]["paper"];
        return {
          width: Math.max(120, t["widthMm"] * k["value"]) + "px",
          height: Math["max"](120, t["heightMm"] * k["value"]) + "px",
          padding: t.paddingMm * k["value"] + "px",
        };
      }),
      I = (e) => {
        const t = l,
          o = k["value"],
          a = e.key === "qrcode" || e["key"] === "lockImg",
          n = Math["max"](7, 0.3528 * e["fontSize"] * o),
          u = a ? e["width"] * o + "px" : e.wrap ? "auto" : n + 2 + "px";
        return {
          left: e.x * o + "px",
          top: e.y * o + "px",
          width: Math.max(8, e["width"] * o) + "px",
          height: u,
          fontSize: n + "px",
          fontWeight: e["fontWeight"],
          color: e["fontColor"],
          lineHeight: "1",
          overflow: e.wrap ? "visible" : "hidden",
          whiteSpace: e.wrap ? "normal" : "nowrap",
          wordBreak: e.wrap ? "break-all" : "normal",
        };
      },
      U = (e, t) => {
        const o = l;
        ((V.value = e), "field" === e && (d["value"] = t));
      },
      S = Vue.computed(() => {
        const e = l,
          t = s["value"]["headerFields"]["filter"]((e) => e.visible);
        return 0 === t["length"]
          ? 45
          : Math["max"](...t["map"]((e) => e.y)) + 12;
      }),
      T = Vue.computed({
        get: () => {
          const e = l,
            t = s["value"]["tableConfig"]["tableTopMm"];
          return t < 0 ? S["value"] : t;
        },
        set: (e) => {
          const t = l;
          s["value"]["tableConfig"].tableTopMm = e;
        },
      }),
      Y = () => {
        const e = l;
        ((s["value"]["doorImgBox"]["enabled"] = !s["value"].doorImgBox.enabled),
          s["value"]["doorImgBox"]["enabled"] && U("doorImgBox", ""));
      },
      W = (e) => {
        const t = l,
          o = m.value;
        if (!o) return e.label;
        const a = R(o, e["key"]);
        return e["key"] === "qrcode"
          ? "QR"
          : e["key"] === "lockImg"
            ? "锁图"
            : a
              ? e["prefix"] + a
              : e["label"];
      },
      O = Vue.computed(() => {
        const e = l,
          t = k["value"],
          o = s["value"]["doorImgBox"];
        return {
          left: o.x * t + "px",
          top: o.y * t + "px",
          width: o.width * t + "px",
          height: o["height"] * t + "px",
        };
      }),
      H = Vue.computed(() => {
        const e = l,
          t = k["value"],
          o = s["value"].paper,
          a = T["value"];
        if (a >= o.heightMm - o["paddingMm"]) return null;
        const n = o["paddingMm"] * t,
          u = a * t,
          r = s.value.tableConfig["columns"]
            ["filter"]((e) => e.visible)
            .reduce((e, t) => e + t.width, 0),
          i = Math.max(10, r * t),
          c = Math["max"](10, (o["heightMm"] - o.paddingMm - a) * t);
        return {
          position: "absolute",
          left: n + "px",
          top: u + "px",
          width: Math.max(10, i) + "px",
          height: c + "px",
        };
      }),
      G = Vue.computed(() => {
        const e = l,
          t = m.value;
        if (
          !(null == t ? void 0 : t["oldSheet"]) ||
          !Array["isArray"](t.oldSheet) ||
          0 === t["oldSheet"]["length"]
        )
          return '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#999;font-size:11px;">表格区域（无数据）</div>';
        const o = s["value"],
          a = $(t.oldSheet, o);
        if (!a) return "";
        const n = k["value"] / 3.78,
          u =
            o["tableConfig"]["columns"]
              ["filter"]((t) => t["visible"])
              ["reduce"]((t, l) => t + l["width"], 0) ||
            o.paper["widthMm"] - 2 * o.paper["paddingMm"];
        return (
          '<div style="transform-origin:top left;transform:scale(' +
          n +
          ");width:" +
          3.78 * u +
          "px;font-size:" +
          o["tableConfig"]["tableFontSize"] +
          'pt;">' +
          a +
          "</div>"
        );
      }),
      j = (e) => {
        const t = l;
        (e["preventDefault"](), e["stopPropagation"](), U("table", ""));
        const o = e["clientY"],
          a = T["value"],
          n = k.value,
          u = s.value["paper"],
          r = (e) => {
            const l = t,
              r = (e["clientY"] - o) / n;
            let i = a + r;
            ((i = Math["round"](2 * i) / 2),
              (i = Math["max"](
                0,
                Math.min(u["heightMm"] - u.paddingMm - 10, i),
              )),
              (s["value"].tableConfig.tableTopMm = i));
          },
          i = () => {
            const e = t;
            (document["removeEventListener"]("mousemove", r),
              document.removeEventListener("mouseup", i));
          };
        (document["addEventListener"]("mousemove", r),
          document["addEventListener"]("mouseup", i));
      },
      q = (e) => {
        const t = l;
        (e["preventDefault"](), e.stopPropagation(), U("doorImgBox", ""));
        const o = e.clientX,
          a = e["clientY"],
          n = s["value"].doorImgBox,
          u = n.x,
          r = n.y,
          i = k["value"],
          c = s.value["paper"],
          d = (e) => {
            const l = t,
              s = (e["clientX"] - o) / i,
              d = (e["clientY"] - a) / i;
            let V = u + s,
              m = r + d;
            ((V = Math.round(2 * V) / 2),
              (m = Math["round"](2 * m) / 2),
              (V = Math.max(0, Math["min"](c["widthMm"] - n["width"], V))),
              (m = Math["max"](0, Math["min"](c.heightMm - n.height, m))),
              (n.x = V),
              (n.y = m));
          },
          V = () => {
            const e = t;
            (document["removeEventListener"]("mousemove", d),
              document.removeEventListener("mouseup", V));
          };
        (document.addEventListener("mousemove", d),
          document["addEventListener"]("mouseup", V));
      },
      J = () => {
        s["value"] = a();
      },
      _ = async () => {
        var e;
        const t = l;
        ((r["value"] = z(JSON["parse"](JSON["stringify"](s["value"])))),
          C(),
          (c["value"] = !1),
          (null == (e = o.isActive) ? void 0 : e.call(o)) && (await ae()));
      },
      K = (e) =>
        e["replace"](/&/g, "&amp;")
          .replace(/</g, "&lt;")
          ["replace"](/>/g, "&gt;")
          ["replace"](/"/g, "&quot;")
          ["replace"](/'/g, "&#39;"),
      Z = new y(),
      X = new Map([[g.MARGIN, 1]]),
      Q = new Map(),
      R = (e, t) => {
        var o, a, n;
        const u = l;
        if (t === "qrcode")
          return String(
            null !=
              (a =
                null != (o = null == e ? void 0 : e.orderID)
                  ? o
                  : null == e
                    ? void 0
                    : e["qrcode"])
              ? a
              : "",
          );
        if (t === "size") {
          const t = null == e ? void 0 : e["size"];
          return Array["isArray"](t)
            ? t["join"](",")
            : String(null != t ? t : "");
        }
        return String(null != (n = null == e ? void 0 : e[t]) ? n : "");
      },
      F = (e, t) => {
        const o = l;
        return t["headerFields"]
          ["filter"]((e) => e.visible)
          .map((t) => {
            const a = o,
              n = R(e, t["key"]);
            if (!n && "remark" !== t["key"] && "address" !== t["key"])
              return "";
            if (t["key"] === "qrcode") {
              const e = ((e) => {
                const t = l;
                if (!e) return null;
                const o = 200,
                  a = e + "::m1";
                if (Q.has(a)) return JSON["parse"](Q["get"](a));
                try {
                  const l = Z.write(e, o, o, X),
                    n = {
                      viewBox: l["getAttribute"]("viewBox") || "0 0 200 " + o,
                      inner: l["innerHTML"],
                    };
                  return (Q["set"](a, JSON["stringify"](n)), n);
                } catch (n) {
                  return null;
                }
              })(n);
              if (!e) return "";
              const o =
                "position:absolute;left:" +
                t.x +
                "mm;top:" +
                t.y +
                "mm;width:" +
                t["width"] +
                "mm;height:" +
                t["width"] +
                "mm;display:block;";
              return (
                '<svg style="' +
                o +
                '" viewBox="' +
                e["viewBox"] +
                '" preserveAspectRatio="xMidYMid meet">' +
                e["inner"] +
                "</svg>"
              );
            }
            if (t["key"] === "lockImg") {
              if (!n) return "";
              const e =
                "position:absolute;left:" +
                t.x +
                "mm;top:" +
                t.y +
                "mm;width:" +
                t.width +
                "mm;height:auto;";
              return '<img src="' + n + '" style="' + e + '" />';
            }
            const u = t["prefix"] + K(n),
              r = [
                "position:absolute",
                "left:" + t.x + "mm",
                "top:" + t.y + "mm",
                "width:" + t["width"] + "mm",
                "font-size:" + t["fontSize"] + "pt",
                "font-family:'" + t["fontFamily"] + "', sans-serif",
                "color:" + t["fontColor"],
                "font-weight:" + t["fontWeight"],
                t["wrap"]
                  ? "white-space:normal;word-break:break-all"
                  : "white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
                "line-height:" + t["lineHeight"],
              ].join(";");
            return '<div style="' + r + '">' + u + "</div>";
          })
          ["filter"](Boolean)
          ["join"]("");
      },
      $ = (e, t, o = 0) => {
        var a;
        const n = l;
        if (!Array.isArray(e) || 0 === e["length"]) return "";
        const u = t["tableConfig"]["columns"]["filter"]((e) => e["visible"]);
        if (0 === u["length"]) return "";
        const r = t["tableConfig"]["showBodyBorder"]
            ? "border:1px solid #000;"
            : "border:none;",
          i = u["reduce"]((e, t) => e + t["width"], 0);
        let c =
          '<table style="width:' +
          i +
          "mm;border-collapse:collapse;table-layout:fixed;margin-top:2mm;font-size:" +
          t["tableConfig"].tableFontSize +
          'pt;">';
        c += "<thead><tr>";
        for (const l of u)
          c +=
            '<th style="border:1px solid #000;padding:2px 4px;text-align:center;width:' +
            l["width"] +
            'mm;box-sizing:border-box;">' +
            K(l["label"]) +
            "</th>";
        ((c += "</tr></thead>"), (c += "<tbody>"));
        for (const l of e) {
          c += "<tr>";
          for (const e of u) {
            const u = String(
              null != (a = null == l ? void 0 : l[e["key"]]) ? a : "",
            );
            let i = "";
            if ("doorImg" === e["key"])
              u &&
                (i =
                  '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="' +
                  u +
                  '" style="height:100%;width:auto;max-width:100%;display:block;object-fit:contain;" /></div>');
            else {
              const e = u["split"](/<br\s*\/?>/),
                l =
                  "line-height:" +
                  t["tableConfig"]["rowHeight"] +
                  "px;min-height:" +
                  t["tableConfig"]["rowHeight"] +
                  "px;";
              i = e
                .map((e) => {
                  const o = n,
                    a = e["trim"]();
                  return a
                    ? t.tableConfig["underlineBrElements"]
                      ? '<div style="text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:1px;line-height:' +
                        t["tableConfig"]["rowHeight"] +
                        'px;">' +
                        K(a) +
                        "</div>"
                      : '<div style="line-height:' +
                        t["tableConfig"]["rowHeight"] +
                        'px;">' +
                        K(a) +
                        "</div>"
                    : '<div style="' + l + '">&nbsp;</div>';
                })
                ["join"]("");
            }
            const s =
              "doorImg" === e["key"] ? "padding:0;" : "padding:1px 4px;";
            c +=
              '<td style="' +
              (e["key"] === "doorImg"
                ? "" +
                  r +
                  s +
                  "position:relative;vertical-align:middle;text-align:center;width:" +
                  e["width"] +
                  "mm;box-sizing:border-box;overflow:hidden;" +
                  (o > 0 && u ? "height:" + o + "mm;" : "")
                : "" +
                  r +
                  s +
                  "vertical-align:top;line-height:" +
                  t.tableConfig["rowHeight"] +
                  "px;width:" +
                  e["width"] +
                  "mm;box-sizing:border-box;") +
              '">' +
              i +
              "</td>";
          }
          c += "</tr>";
        }
        return ((c += "</tbody></table>"), c);
      },
      ee = (e, t) => {
        var o, a;
        const n = l;
        if (!t["doorImgBox"]["enabled"]) return "";
        const u =
            (null == e ? void 0 : e["doorImg"]) ||
            (null ==
            (a =
              null == (o = null == e ? void 0 : e["oldSheet"]) ? void 0 : o[0])
              ? void 0
              : a.doorImg) ||
            "",
          r = t["doorImgBox"],
          i = [
            "position:absolute",
            "left:" + r.x + "mm",
            "top:" + r.y + "mm",
            "width:" + r.width + "mm",
            "height:" + r.height + "mm",
            "border:1px dashed #333",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "overflow:hidden",
          ].join(";"),
          c = u
            ? '<img src="' + u + '" style="max-width:100%;max-height:100%;" />'
            : "";
        return '<div style="' + i + '">' + c + "</div>";
      },
      te = (e, t) => {
        const o = l;
        if ("" === t) return e;
        const a = {};
        if (!e || "object" != typeof e) return a;
        for (const l of Object["keys"](e))
          l["endsWith"](t) && (a[l["slice"](0, -t["length"])] = e[l]);
        return a;
      },
      le = (e) => {
        const t = l,
          o = e["paper"]["widthMm"],
          a = e["paper"]["heightMm"];
        return (
          "\n  .ps-root { background:#fff; color:#000; }\n  .ps-sheet { background:#fff; display:block; }\n  @page { size: " +
          o +
          "mm " +
          a +
          "mm; margin: 0; }\n  @media screen {\n    .ps-root { background:#c0c0c0; padding:12mm; display:flex; flex-wrap:wrap; gap:8mm; align-items:flex-start; justify-content:flex-start; min-width:fit-content; }\n    .ps-sheet { box-shadow:0 2px 10px rgba(0,0,0,0.25); }\n  }\n  @media print {\n    html, body { margin:0 !important; padding:0 !important; background:#fff; }\n    .ps-root { background:#fff !important; padding:0 !important; gap:0 !important; display:block !important; }\n    .ps-sheet { box-shadow:none !important; }\n    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  }\n"
        );
      },
      oe = async (e) => {
        var t;
        const a = l,
          n = Array.isArray(e)
            ? e
            : (null == (t = o["getData"]) ? void 0 : t.call(o)) || [],
          u = r["value"],
          i = n
            .map((e) =>
              ((e, t) => {
                const o = l,
                  a = t["paper"],
                  n = [
                    "width:" + a["widthMm"] + "mm",
                    "height:" + a.heightMm + "mm",
                    "padding:" + a.paddingMm + "mm",
                    "position:relative",
                    "box-sizing:border-box",
                    "background:#fff",
                    "color:#000",
                    "overflow:hidden",
                    "page-break-after:always",
                    "font-family:'" +
                      t.globalHeaderFont["fontFamily"] +
                      "', sans-serif",
                    "font-size:" + t["globalHeaderFont"]["fontSize"] + "pt",
                  ]["join"](";");
                if (
                  2 === t["print"]["itemsPerPage"] &&
                  (void 0 !== (null == e ? void 0 : e["orderID1"]) ||
                    void 0 !== (null == e ? void 0 : e["oldSheet1"]) ||
                    void 0 !== (null == e ? void 0 : e["size1"]))
                ) {
                  const l = a["heightMm"] / 2,
                    u = te(e, ""),
                    r = te(e, "1"),
                    i = t.tableConfig["columns"]["filter"]((e) => e["visible"]),
                    c = 0.2646 * t["tableConfig"]["rowHeight"],
                    s = c + 2,
                    d = i.some((e) => e.key === "doorImg"),
                    V = (e) => {
                      var t, l;
                      const a = o;
                      if (
                        d &&
                        String(
                          null != (t = null == e ? void 0 : e["doorImg"])
                            ? t
                            : "",
                        )
                      ) {
                        const e =
                          i["length"] > 0
                            ? i["reduce"]((e, t) => e + t["width"], 0) /
                              i["length"]
                            : 40;
                        return Math["min"](1.5 * e, 60);
                      }
                      let n = 1;
                      for (const o of i) {
                        if (o["key"] === "doorImg") continue;
                        const t = String(
                          null != (l = null == e ? void 0 : e[o["key"]])
                            ? l
                            : "",
                        )["split"](/<br\s*\/?>/)["length"];
                        t > n && (n = t);
                      }
                      return n * c + 1;
                    },
                    m = (e, t, l) => {
                      const a = o;
                      if (!Array.isArray(e) || 0 === e["length"]) return [[]];
                      const n = [];
                      let u = [],
                        r = 0,
                        i = !0;
                      for (const o of e) {
                        const e = V(o);
                        (r + e > (i ? t : l) &&
                          u.length > 0 &&
                          (n.push(u), (u = []), (r = 0), (i = !1)),
                          u["push"](o),
                          (r += e));
                      }
                      return (
                        u.length > 0 && n.push(u),
                        n.length > 0 ? n : [[]]
                      );
                    },
                    w = (e, n) => {
                      const u = o,
                        r = F(e, t),
                        c = ee(e, t),
                        d =
                          t.tableConfig.tableTopMm >= 0
                            ? t["tableConfig"]["tableTopMm"]
                            : Math["max"](
                                ...t["headerFields"]
                                  ["filter"]((e) => e["visible"])
                                  ["map"]((e) => e.y),
                              ) + 12,
                        V = a["paddingMm"] + 2,
                        w = l - d - s - 4,
                        g = l - V - s - 6,
                        y = Array["isArray"](null == e ? void 0 : e["oldSheet"])
                          ? e["oldSheet"]
                          : [],
                        v = i.length > 0 ? m(y, w, g) : [[]],
                        f = t["tableConfig"]["columns"]
                          ["filter"]((e) => e["visible"])
                          ["reduce"]((e, t) => e + t["width"], 0),
                        h =
                          f > 0
                            ? f + "mm"
                            : "calc(100% - " + 2 * a["paddingMm"] + "mm)";
                      return v["map"]((e, o) => {
                        const i = u,
                          s = 0 === o,
                          m = s ? d : V,
                          y = Math["max"](10, (s ? w : g) - 6),
                          v = e["length"] > 0 ? $(e, t, y) : "",
                          f = v
                            ? '<div style="position:absolute;left:' +
                              a.paddingMm +
                              "mm;top:" +
                              m +
                              "mm;width:" +
                              h +
                              ';">' +
                              v +
                              "</div>"
                            : "",
                          p = s ? "" + r + c : "";
                        return (
                          '<div style="position:absolute;left:0;top:' +
                          n +
                          "mm;width:100%;height:" +
                          l +
                          'mm;overflow:hidden;box-sizing:border-box;">' +
                          p +
                          f +
                          "</div>"
                        );
                      });
                    },
                    g = w(u, 0),
                    y = w(r, l),
                    v = Math["max"](g["length"], y.length);
                  let f = "";
                  for (let e = 0; e < v; e++) {
                    const t = g[e] || "";
                    let a = y[e] || "";
                    (!t &&
                      a &&
                      (a = a["replace"]("top:" + l + "mm;", "top:0mm;")),
                      (f +=
                        '<section class="ps-sheet" style="' +
                        n +
                        '">' +
                        t +
                        a +
                        "</section>"));
                  }
                  return f;
                }
                const u = F(e, t),
                  r = ee(e, t),
                  i =
                    t.tableConfig.tableTopMm >= 0
                      ? t["tableConfig"]["tableTopMm"]
                      : Math["max"](
                          ...t["headerFields"]
                            .filter((e) => e["visible"])
                            ["map"]((e) => e.y),
                        ) + 12,
                  c = (null == e ? void 0 : e["oldSheet"]) || [];
                if (!Array["isArray"](c) || 0 === c["length"])
                  return (
                    '<section class="ps-sheet" style="' +
                    n +
                    '">' +
                    u +
                    r +
                    "</section>"
                  );
                const s = t["tableConfig"].columns["filter"](
                  (e) => e["visible"],
                );
                if (0 === s.length)
                  return (
                    '<section class="ps-sheet" style="' +
                    n +
                    '">' +
                    u +
                    r +
                    "</section>"
                  );
                const d = 0.2646 * t["tableConfig"]["rowHeight"],
                  V = d + 2,
                  m = s["some"]((e) => "doorImg" === e["key"]),
                  w = (e) => {
                    var t, l;
                    const n = o;
                    if (
                      m &&
                      String(
                        null != (t = null == e ? void 0 : e["doorImg"])
                          ? t
                          : "",
                      )
                    ) {
                      const e = (a.widthMm - 2 * a["paddingMm"]) / s["length"];
                      return Math["min"](1.5 * e, 60);
                    }
                    let u = 1;
                    for (const o of s) {
                      if (o.key === "doorImg") continue;
                      const t = String(
                        null != (l = null == e ? void 0 : e[o["key"]]) ? l : "",
                      ).split(/<br\s*\/?>/)["length"];
                      t > u && (u = t);
                    }
                    return u * d + 1;
                  },
                  g = a.heightMm - 2 * a.paddingMm - i - V - 4,
                  y = a["heightMm"] - 2 * a["paddingMm"] - V - 6,
                  v = [];
                let f = [],
                  h = 0,
                  p = !0;
                for (const l of c) {
                  const e = w(l);
                  (h + e > (p ? g : y) &&
                    f.length > 0 &&
                    (v["push"](f), (f = []), (h = 0), (p = !1)),
                    f["push"](l),
                    (h += e));
                }
                f["length"] > 0 && v["push"](f);
                let C = "";
                for (let l = 0; l < v["length"]; l++) {
                  const e = v[l],
                    c = 0 === l,
                    s = c ? i : a["paddingMm"] + 2,
                    d = Math["max"](10, (c ? g : y) - 6),
                    V = $(e, t, d),
                    m = t["tableConfig"].columns["filter"]((e) => e["visible"])[
                      "reduce"
                    ]((e, t) => e + t["width"], 0),
                    w =
                      m > 0
                        ? m + "mm"
                        : "calc(100% - " + 2 * a["paddingMm"] + "mm)",
                    f = V
                      ? '<div style="position:absolute;left:' +
                        a.paddingMm +
                        "mm;top:" +
                        s +
                        "mm;width:" +
                        w +
                        ';">' +
                        V +
                        "</div>"
                      : "";
                  C += c
                    ? '<section class="ps-sheet" style="' +
                      n +
                      '">' +
                      u +
                      f +
                      r +
                      "</section>"
                    : '<section class="ps-sheet" style="' +
                      n +
                      '">' +
                      f +
                      "</section>";
                }
                return C;
              })(e, u),
            )
            ["join"]("");
        return (
          '<div class="ps-root"><style>' + le(u) + "</style>" + i + "</div>"
        );
      },
      ae = async () => {
        const e = await oe();
        await o.onPreviewHtmlChange(e);
      },
      ne = async () => {
        const e = l,
          t = r["value"],
          o = await oe();
        return (
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义生产单</title>\n  <style>html,body{margin:0;padding:0;background:#fff;}' +
          le(t) +
          "</style>\n  </head><body>" +
          o +
          "</body></html>"
        );
      };
    return (
      Vue.onMounted(() => {
        ((() => {
          const e = l;
          try {
            const t = localStorage["getItem"](on);
            if (!t) return void (r["value"] = a());
            r["value"] = z(JSON["parse"](t));
          } catch (t) {
            r.value = a();
          }
        })(),
          (() => {
            const e = l;
            try {
              h["value"] = localStorage["getItem"](an) || "";
            } catch (t) {}
          })());
      }),
      t({
        buildProductionSheetHtml: oe,
        refreshPreview: ae,
        openSettingsDialog: () => {
          const e = l;
          ((i.value = JSON.parse(JSON["stringify"](r["value"]))),
            (u["value"] = "paper"),
            (n["value"] = !0));
        },
        openLayoutEditor: async () => {
          var e, t;
          const a = l;
          ((s["value"] = z(JSON["parse"](JSON["stringify"](r.value)))),
            (d["value"] =
              (null == (e = s["value"]["headerFields"][0])
                ? void 0
                : e["key"]) || ""),
            (V.value = "field"));
          const n = (null == (t = o["getData"]) ? void 0 : t.call(o)) || [];
          ((m["value"] = n.length > 0 ? n[0] : null),
            (c.value = !0),
            await Vue.nextTick(),
            (() => {
              const e = l,
                t = D["value"];
              t
                ? (A.value = {
                    w: t.clientWidth - 32,
                    h: t["clientHeight"] - 32,
                  })
                : (A["value"] = {
                    w: Math["max"](600, window["innerWidth"] - 440),
                    h: Math["max"](400, window["innerHeight"] - 200),
                  });
            })());
        },
        printDirect: async () => {
          const e = l,
            t = ElementPlus.ElLoading["service"]({
              lock: !0,
              text: "正在生成生产单...",
              background: "rgba(0,0,0,0.7)",
            });
          try {
            const t = await ne(),
              l = document["createElement"]("iframe");
            ((l.style.cssText =
              "position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;"),
              document["body"].appendChild(l));
            const o = l["contentWindow"],
              a = l.contentDocument || o.document;
            (a.open(),
              a["write"](t),
              a["close"](),
              await new Promise((t) => {
                const l = e,
                  o = Array["from"](a.querySelectorAll("img"));
                if (0 === o["length"]) return void t();
                let n = 0;
                o.forEach((e) => {
                  const a = l,
                    u = () => {
                      (n++, n === o["length"] && t());
                    };
                  e["complete"] ? u() : ((e.onload = u), (e["onerror"] = u));
                });
              }),
              setTimeout(() => {
                (o.focus(),
                  o.print(),
                  setTimeout(() => {
                    const e = Ha;
                    document["body"]["contains"](l) &&
                      document["body"]["removeChild"](l);
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
          const e = l;
          if (!v.value)
            return (
              ElementPlus.ElMessage["warning"](
                "直接打印仅在Electron客户端可用",
              ),
              !1
            );
          const t = ElementPlus.ElLoading.service({
            lock: !0,
            text: "正在发送到打印机...",
            background: "rgba(0,0,0,0.7)",
          });
          try {
            const t = r["value"],
              l = await ne(),
              o = await window.electronAPI["silentPrint"](l, h["value"] || "", {
                landscape: t["paper"]["widthMm"] > t["paper"].heightMm,
                copies: t.print["copies"],
                pageWidthMm: t.paper["widthMm"],
                pageHeightMm: t.paper["heightMm"],
              });
            return (null == o ? void 0 : o["success"])
              ? (ElementPlus.ElMessage.success(
                  "已发送至打印机：" + (h["value"] || "系统默认"),
                ),
                !0)
              : (ElementPlus.ElMessage["error"](
                  "打印失败：" +
                    ((null == o ? void 0 : o["reason"]) || "未知错误"),
                ),
                !1);
          } catch (o) {
            return (
              ElementPlus.ElMessage["error"](
                "直接打印失败: " + ((null == o ? void 0 : o["message"]) || o),
              ),
              !1
            );
          } finally {
            t["close"]();
          }
        },
        getItemsPerPage: () => r["value"].print["itemsPerPage"],
        isElectronEnv: Vue.computed(() => v["value"]),
      }),
      (e, t) => {
        const o = l,
          a = Vue.resolveComponent("el-input-number"),
          r = Vue.resolveComponent("el-form-item"),
          m = Vue.resolveComponent("el-option"),
          g = Vue.resolveComponent("el-select"),
          y = Vue.resolveComponent("el-button"),
          C = Vue.resolveComponent("el-form"),
          z = Vue.resolveComponent("el-tab-pane"),
          A = Vue.resolveComponent("el-color-picker"),
          S = Vue.resolveComponent("el-checkbox"),
          K = Vue.resolveComponent("el-table-column"),
          Z = Vue.resolveComponent("el-table"),
          X = Vue.resolveComponent("el-switch"),
          Q = Vue.resolveComponent("el-alert"),
          R = Vue.resolveComponent("el-tabs"),
          F = Vue.resolveComponent("el-dialog");
        return (
          Vue.openBlock(),
          Vue.createElementBlock(
            Vue.Fragment,
            null,
            [
              Vue.createVNode(
                F,
                {
                  modelValue: n["value"],
                  "onUpdate:modelValue":
                    t[24] || (t[24] = (e) => (n["value"] = e)),
                  title: "自定义生产单 - 设置",
                  width: "720px",
                  "destroy-on-close": !1,
                  onOpen: M,
                },
                {
                  footer: Vue.withCtx(() => [
                    Vue.createVNode(
                      y,
                      { onClick: N },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[70] ||
                            (t[70] = [Vue.createTextVNode("重置默认")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      y,
                      { onClick: t[23] || (t[23] = (e) => (n["value"] = !1)) },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[71] || (t[71] = [Vue.createTextVNode("取消")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      y,
                      { type: "primary", onClick: E },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[72] ||
                            (t[72] = [Vue.createTextVNode("保存并应用")]),
                        ),
                        _: 1,
                      },
                    ),
                  ]),
                  default: Vue.withCtx(() => [
                    Vue.createVNode(
                      R,
                      {
                        modelValue: u["value"],
                        "onUpdate:modelValue":
                          t[22] || (t[22] = (e) => (u.value = e)),
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
                                                  i["value"]["paper"][
                                                    "widthMm"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[0] ||
                                                  (t[0] = (e) =>
                                                    (i["value"].paper.widthMm =
                                                      e)),
                                                min: 50,
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
                                        { label: "纸张高度(mm)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"]["paper"][
                                                    "heightMm"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[1] ||
                                                  (t[1] = (e) =>
                                                    (i["value"]["paper"][
                                                      "heightMm"
                                                    ] = e)),
                                                min: 50,
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
                                                  i["value"]["paper"][
                                                    "orientation"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[2] ||
                                                  (t[2] = (e) =>
                                                    (i[
                                                      "value"
                                                    ].paper.orientation = e)),
                                                style: { width: "200px" },
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(m, {
                                                    label: "纵向",
                                                    value: "portrait",
                                                  }),
                                                  Vue.createVNode(m, {
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
                                                  i.value.paper["paddingMm"],
                                                "onUpdate:modelValue":
                                                  t[3] ||
                                                  (t[3] = (e) =>
                                                    (i["value"]["paper"][
                                                      "paddingMm"
                                                    ] = e)),
                                                min: 0,
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
                                        { label: "常用尺寸" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createElementVNode("div", ja, [
                                              Vue.createVNode(
                                                y,
                                                {
                                                  size: "small",
                                                  onClick:
                                                    t[4] ||
                                                    (t[4] = (e) =>
                                                      L(200, 140, "landscape")),
                                                },
                                                {
                                                  default: Vue.withCtx(
                                                    () =>
                                                      t[56] ||
                                                      (t[56] = [
                                                        Vue.createTextVNode(
                                                          "pin1 (200×140)",
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
                                                    (t[5] = (e) =>
                                                      L(148, 210, "portrait")),
                                                },
                                                {
                                                  default: Vue.withCtx(
                                                    () =>
                                                      t[57] ||
                                                      (t[57] = [
                                                        Vue.createTextVNode(
                                                          "A5纵向",
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
                                                    (t[6] = (e) =>
                                                      L(210, 148, "landscape")),
                                                },
                                                {
                                                  default: Vue.withCtx(
                                                    () =>
                                                      t[58] ||
                                                      (t[58] = [
                                                        Vue.createTextVNode(
                                                          "A5横向",
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
                                                    (t[7] = (e) =>
                                                      L(210, 297, "portrait")),
                                                },
                                                {
                                                  default: Vue.withCtx(
                                                    () =>
                                                      t[59] ||
                                                      (t[59] = [
                                                        Vue.createTextVNode(
                                                          "A4纵向",
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
                                                    (t[8] = (e) =>
                                                      L(297, 210, "landscape")),
                                                },
                                                {
                                                  default: Vue.withCtx(
                                                    () =>
                                                      t[60] ||
                                                      (t[60] = [
                                                        Vue.createTextVNode(
                                                          "A4横向",
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
                                                    (t[9] = (e) =>
                                                      L(105, 148, "portrait")),
                                                },
                                                {
                                                  default: Vue.withCtx(
                                                    () =>
                                                      t[61] ||
                                                      (t[61] = [
                                                        Vue.createTextVNode(
                                                          "A6",
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
                                                    (t[10] = (e) =>
                                                      L(182, 257, "portrait")),
                                                },
                                                {
                                                  default: Vue.withCtx(
                                                    () =>
                                                      t[62] ||
                                                      (t[62] = [
                                                        Vue.createTextVNode(
                                                          "B5",
                                                        ),
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
                            { label: "头部字段", name: "headerFields" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createElementVNode("div", qa, [
                                  Vue.createVNode(
                                    y,
                                    {
                                      size: "small",
                                      type: "primary",
                                      onClick: b,
                                    },
                                    {
                                      default: Vue.withCtx(
                                        () =>
                                          t[63] ||
                                          (t[63] = [
                                            Vue.createTextVNode(
                                              "统一应用下方设置到所有字段",
                                            ),
                                          ]),
                                      ),
                                      _: 1,
                                    },
                                  ),
                                ]),
                                Vue.createVNode(
                                  C,
                                  {
                                    "label-width": "90px",
                                    size: "small",
                                    style: {
                                      "margin-bottom": "12px",
                                      "border-bottom": "1px dashed #ddd",
                                      "padding-bottom": "10px",
                                    },
                                  },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        r,
                                        { label: "统一字体" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              g,
                                              {
                                                modelValue:
                                                  i.value["globalHeaderFont"][
                                                    "fontFamily"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[11] ||
                                                  (t[11] = (e) =>
                                                    (i["value"][
                                                      "globalHeaderFont"
                                                    ].fontFamily = e)),
                                                style: { width: "200px" },
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(m, {
                                                    label: "微软雅黑",
                                                    value: "Microsoft YaHei",
                                                  }),
                                                  Vue.createVNode(m, {
                                                    label: "宋体",
                                                    value: "SimSun",
                                                  }),
                                                  Vue.createVNode(m, {
                                                    label: "黑体",
                                                    value: "SimHei",
                                                  }),
                                                  Vue.createVNode(m, {
                                                    label: "楷体",
                                                    value: "KaiTi",
                                                  }),
                                                  Vue.createVNode(m, {
                                                    label: "Arial",
                                                    value: "Arial",
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
                                        { label: "统一字号(pt)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"][
                                                    "globalHeaderFont"
                                                  ]["fontSize"],
                                                "onUpdate:modelValue":
                                                  t[12] ||
                                                  (t[12] = (e) =>
                                                    (i["value"][
                                                      "globalHeaderFont"
                                                    ].fontSize = e)),
                                                min: 6,
                                                max: 36,
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
                                        { label: "统一颜色" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              A,
                                              {
                                                modelValue:
                                                  i.value["globalHeaderFont"]
                                                    .fontColor,
                                                "onUpdate:modelValue":
                                                  t[13] ||
                                                  (t[13] = (e) =>
                                                    (i.value.globalHeaderFont[
                                                      "fontColor"
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
                                      Vue.createVNode(
                                        r,
                                        { label: "统一粗细" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              g,
                                              {
                                                modelValue:
                                                  i["value"][
                                                    "globalHeaderFont"
                                                  ]["fontWeight"],
                                                "onUpdate:modelValue":
                                                  t[14] ||
                                                  (t[14] = (e) =>
                                                    (i[
                                                      "value"
                                                    ].globalHeaderFont[
                                                      "fontWeight"
                                                    ] = e)),
                                                style: { width: "120px" },
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(m, {
                                                    label: "正常",
                                                    value: "normal",
                                                  }),
                                                  Vue.createVNode(m, {
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
                                    ]),
                                    _: 1,
                                  },
                                ),
                                Vue.createVNode(
                                  Z,
                                  {
                                    data: i["value"]["headerFields"],
                                    size: "small",
                                    border: "",
                                    style: { width: "100%" },
                                  },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        K,
                                        { label: "显", width: "42" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            Vue.createVNode(
                                              S,
                                              {
                                                modelValue: e["visible"],
                                                "onUpdate:modelValue": (t) =>
                                                  (e["visible"] = t),
                                              },
                                              null,
                                              8,
                                              [
                                                "modelValue",
                                                "onUpdate:modelValue",
                                              ],
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(K, {
                                        prop: "label",
                                        label: "字段",
                                        width: "60",
                                      }),
                                      Vue.createVNode(
                                        K,
                                        { label: "字号", width: "80" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue: e["fontSize"],
                                                "onUpdate:modelValue": (t) =>
                                                  (e["fontSize"] = t),
                                                min: 6,
                                                max: 36,
                                                step: 0.5,
                                                size: "small",
                                                "controls-position": "right",
                                              },
                                              null,
                                              8,
                                              [
                                                "modelValue",
                                                "onUpdate:modelValue",
                                              ],
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        K,
                                        { label: "颜色", width: "60" },
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
                                              [
                                                "modelValue",
                                                "onUpdate:modelValue",
                                              ],
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        K,
                                        { label: "粗细", width: "80" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            Vue.createVNode(
                                              g,
                                              {
                                                modelValue: e.fontWeight,
                                                "onUpdate:modelValue": (t) =>
                                                  (e["fontWeight"] = t),
                                                size: "small",
                                                style: { width: "70px" },
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(m, {
                                                    label: "正常",
                                                    value: "normal",
                                                  }),
                                                  Vue.createVNode(m, {
                                                    label: "粗",
                                                    value: "bold",
                                                  }),
                                                ]),
                                                _: 2,
                                              },
                                              1032,
                                              [
                                                "modelValue",
                                                "onUpdate:modelValue",
                                              ],
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        K,
                                        { label: "X(mm)", width: "75" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue: e.x,
                                                "onUpdate:modelValue": (t) =>
                                                  (e.x = t),
                                                min: 0,
                                                max: 400,
                                                step: 0.5,
                                                size: "small",
                                                "controls-position": "right",
                                              },
                                              null,
                                              8,
                                              [
                                                "modelValue",
                                                "onUpdate:modelValue",
                                              ],
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        K,
                                        { label: "Y(mm)", width: "75" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue: e.y,
                                                "onUpdate:modelValue": (t) =>
                                                  (e.y = t),
                                                min: 0,
                                                max: 400,
                                                step: 0.5,
                                                size: "small",
                                                "controls-position": "right",
                                              },
                                              null,
                                              8,
                                              [
                                                "modelValue",
                                                "onUpdate:modelValue",
                                              ],
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        K,
                                        { label: "宽(mm)", width: "75" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue: e["width"],
                                                "onUpdate:modelValue": (t) =>
                                                  (e["width"] = t),
                                                min: 5,
                                                max: 300,
                                                step: 0.5,
                                                size: "small",
                                                "controls-position": "right",
                                              },
                                              null,
                                              8,
                                              [
                                                "modelValue",
                                                "onUpdate:modelValue",
                                              ],
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        K,
                                        { label: "字体", width: "100" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            e["key"] !== "qrcode" &&
                                            "lockImg" !== e.key
                                              ? (Vue.openBlock(),
                                                Vue.createBlock(
                                                  g,
                                                  {
                                                    key: 0,
                                                    modelValue: e.fontFamily,
                                                    "onUpdate:modelValue": (
                                                      t,
                                                    ) => (e.fontFamily = t),
                                                    size: "small",
                                                    style: { width: "90px" },
                                                  },
                                                  {
                                                    default: Vue.withCtx(() => [
                                                      Vue.createVNode(m, {
                                                        label: "雅黑",
                                                        value:
                                                          "Microsoft YaHei",
                                                      }),
                                                      Vue.createVNode(m, {
                                                        label: "宋体",
                                                        value: "SimSun",
                                                      }),
                                                      Vue.createVNode(m, {
                                                        label: "黑体",
                                                        value: "SimHei",
                                                      }),
                                                      Vue.createVNode(m, {
                                                        label: "楷体",
                                                        value: "KaiTi",
                                                      }),
                                                      Vue.createVNode(m, {
                                                        label: "Arial",
                                                        value: "Arial",
                                                      }),
                                                    ]),
                                                    _: 2,
                                                  },
                                                  1032,
                                                  [
                                                    "modelValue",
                                                    "onUpdate:modelValue",
                                                  ],
                                                ))
                                              : Vue.createCommentVNode("", !0),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        K,
                                        { label: "换行", width: "42" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            "qrcode" !== e["key"] &&
                                            "lockImg" !== e.key
                                              ? (Vue.openBlock(),
                                                Vue.createBlock(
                                                  S,
                                                  {
                                                    key: 0,
                                                    modelValue: e["wrap"],
                                                    "onUpdate:modelValue": (
                                                      t,
                                                    ) => (e["wrap"] = t),
                                                  },
                                                  null,
                                                  8,
                                                  [
                                                    "modelValue",
                                                    "onUpdate:modelValue",
                                                  ],
                                                ))
                                              : Vue.createCommentVNode("", !0),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        K,
                                        { label: "行距", width: "65" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            "qrcode" !== e["key"] &&
                                            e["key"] !== "lockImg"
                                              ? (Vue.openBlock(),
                                                Vue.createBlock(
                                                  a,
                                                  {
                                                    key: 0,
                                                    modelValue: e["lineHeight"],
                                                    "onUpdate:modelValue": (
                                                      t,
                                                    ) => (e["lineHeight"] = t),
                                                    min: 0.8,
                                                    max: 3,
                                                    step: 0.1,
                                                    size: "small",
                                                    "controls-position":
                                                      "right",
                                                  },
                                                  null,
                                                  8,
                                                  [
                                                    "modelValue",
                                                    "onUpdate:modelValue",
                                                  ],
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
                              _: 1,
                            },
                          ),
                          Vue.createVNode(
                            z,
                            { label: "表格", name: "table" },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createVNode(
                                  C,
                                  { "label-width": "130px", size: "small" },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        r,
                                        { label: "表体外边框" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              X,
                                              {
                                                modelValue:
                                                  i.value["tableConfig"]
                                                    .showBodyBorder,
                                                "onUpdate:modelValue":
                                                  t[15] ||
                                                  (t[15] = (e) =>
                                                    (i["value"]["tableConfig"][
                                                      "showBodyBorder"
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
                                      Vue.createVNode(
                                        r,
                                        { label: "换行元素加下划线" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              X,
                                              {
                                                modelValue:
                                                  i["value"]["tableConfig"][
                                                    "underlineBrElements"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[16] ||
                                                  (t[16] = (e) =>
                                                    (i.value["tableConfig"][
                                                      "underlineBrElements"
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
                                      Vue.createVNode(
                                        r,
                                        { label: "表体行高(px)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"]["tableConfig"][
                                                    "rowHeight"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[17] ||
                                                  (t[17] = (e) =>
                                                    (i.value["tableConfig"][
                                                      "rowHeight"
                                                    ] = e)),
                                                min: 16,
                                                max: 60,
                                                step: 1,
                                              },
                                              null,
                                              8,
                                              ["modelValue"],
                                            ),
                                            t[64] ||
                                              (t[64] = Vue.createElementVNode(
                                                "span",
                                                {
                                                  style: {
                                                    "margin-left": "6px",
                                                    "font-size": "11px",
                                                    color: "#999",
                                                  },
                                                },
                                                "默认22",
                                                -1,
                                              )),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(
                                        r,
                                        { label: "表体字号(pt)" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              a,
                                              {
                                                modelValue:
                                                  i["value"].tableConfig[
                                                    "tableFontSize"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[18] ||
                                                  (t[18] = (e) =>
                                                    (i["value"]["tableConfig"][
                                                      "tableFontSize"
                                                    ] = e)),
                                                min: 6,
                                                max: 24,
                                                step: 0.5,
                                              },
                                              null,
                                              8,
                                              ["modelValue"],
                                            ),
                                            t[65] ||
                                              (t[65] = Vue.createElementVNode(
                                                "span",
                                                {
                                                  style: {
                                                    "margin-left": "6px",
                                                    "font-size": "11px",
                                                    color: "#999",
                                                  },
                                                },
                                                "默认10",
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
                                t[68] ||
                                  (t[68] = Vue.createElementVNode(
                                    "div",
                                    {
                                      style: {
                                        "margin-top": "12px",
                                        "font-size": "13px",
                                        color: "#666",
                                      },
                                    },
                                    "列显示与排序（拖拽行调整顺序）：",
                                    -1,
                                  )),
                                Vue.createVNode(
                                  Z,
                                  {
                                    data: i["value"].tableConfig.columns,
                                    size: "small",
                                    border: "",
                                    "row-key": "key",
                                    style: {
                                      width: "100%",
                                      "margin-top": "6px",
                                    },
                                  },
                                  {
                                    default: Vue.withCtx(() => [
                                      Vue.createVNode(
                                        K,
                                        { label: "显", width: "42" },
                                        {
                                          default: Vue.withCtx(({ row: e }) => [
                                            Vue.createVNode(
                                              S,
                                              {
                                                modelValue: e["visible"],
                                                "onUpdate:modelValue": (t) =>
                                                  (e["visible"] = t),
                                              },
                                              null,
                                              8,
                                              [
                                                "modelValue",
                                                "onUpdate:modelValue",
                                              ],
                                            ),
                                          ]),
                                          _: 1,
                                        },
                                      ),
                                      Vue.createVNode(K, {
                                        prop: "label",
                                        label: "列名",
                                        width: "100",
                                      }),
                                      Vue.createVNode(
                                        K,
                                        { label: "排序", width: "100" },
                                        {
                                          default: Vue.withCtx(
                                            ({ $index: e }) => [
                                              Vue.createVNode(
                                                y,
                                                {
                                                  size: "small",
                                                  disabled: 0 === e,
                                                  onClick: (t) =>
                                                    ((e) => {
                                                      const t = l;
                                                      if (e <= 0) return;
                                                      const o =
                                                          i["value"][
                                                            "tableConfig"
                                                          ]["columns"],
                                                        a = o[e];
                                                      ((o[e] = o[e - 1]),
                                                        (o[e - 1] = a));
                                                    })(e),
                                                },
                                                {
                                                  default: Vue.withCtx(
                                                    () =>
                                                      t[66] ||
                                                      (t[66] = [
                                                        Vue.createTextVNode(
                                                          "↑",
                                                        ),
                                                      ]),
                                                  ),
                                                  _: 2,
                                                },
                                                1032,
                                                ["disabled", "onClick"],
                                              ),
                                              Vue.createVNode(
                                                y,
                                                {
                                                  size: "small",
                                                  disabled:
                                                    e ===
                                                    i.value["tableConfig"][
                                                      "columns"
                                                    ].length -
                                                      1,
                                                  onClick: (t) =>
                                                    ((e) => {
                                                      const t = l,
                                                        o =
                                                          i["value"][
                                                            "tableConfig"
                                                          ]["columns"];
                                                      if (e >= o["length"] - 1)
                                                        return;
                                                      const a = o[e];
                                                      ((o[e] = o[e + 1]),
                                                        (o[e + 1] = a));
                                                    })(e),
                                                },
                                                {
                                                  default: Vue.withCtx(
                                                    () =>
                                                      t[67] ||
                                                      (t[67] = [
                                                        Vue.createTextVNode(
                                                          "↓",
                                                        ),
                                                      ]),
                                                  ),
                                                  _: 2,
                                                },
                                                1032,
                                                ["disabled", "onClick"],
                                              ),
                                            ],
                                          ),
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
                                      v["value"]
                                        ? Vue.createCommentVNode("", !0)
                                        : (Vue.openBlock(),
                                          Vue.createBlock(
                                            r,
                                            { key: 0, label: "" },
                                            {
                                              default: Vue.withCtx(() => [
                                                Vue.createVNode(Q, {
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
                                                modelValue: h["value"],
                                                "onUpdate:modelValue":
                                                  t[19] ||
                                                  (t[19] = (e) =>
                                                    (h.value = e)),
                                                placeholder:
                                                  "使用系统默认打印机",
                                                clearable: "",
                                                style: { width: "100%" },
                                                onChange: x,
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  (Vue.openBlock(!0),
                                                  Vue.createElementBlock(
                                                    Vue.Fragment,
                                                    null,
                                                    Vue.renderList(
                                                      f["value"],
                                                      (e) => {
                                                        const t = o;
                                                        return (
                                                          Vue.openBlock(),
                                                          Vue.createBlock(
                                                            m,
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
                                      Vue.createVNode(r, null, {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            y,
                                            {
                                              size: "small",
                                              loading: p["value"],
                                              onClick: B,
                                            },
                                            {
                                              default: Vue.withCtx(
                                                () =>
                                                  t[69] ||
                                                  (t[69] = [
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
                                            Ja,
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
                                                  t[20] ||
                                                  (t[20] = (e) =>
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
                                        { label: "每页数据数" },
                                        {
                                          default: Vue.withCtx(() => [
                                            Vue.createVNode(
                                              g,
                                              {
                                                modelValue:
                                                  i["value"].print[
                                                    "itemsPerPage"
                                                  ],
                                                "onUpdate:modelValue":
                                                  t[21] ||
                                                  (t[21] = (e) =>
                                                    (i["value"].print[
                                                      "itemsPerPage"
                                                    ] = e)),
                                                style: { width: "200px" },
                                              },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(m, {
                                                    label: "1 条/页",
                                                    value: 1,
                                                  }),
                                                  Vue.createVNode(m, {
                                                    label: "2 条/页",
                                                    value: 2,
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
                F,
                {
                  modelValue: c.value,
                  "onUpdate:modelValue":
                    t[55] || (t[55] = (e) => (c["value"] = e)),
                  title: "自定义生产单 - 布局编辑",
                  fullscreen: "",
                  "destroy-on-close": !1,
                },
                {
                  footer: Vue.withCtx(() => [
                    Vue.createVNode(
                      y,
                      { onClick: t[54] || (t[54] = (e) => (c["value"] = !1)) },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[77] || (t[77] = [Vue.createTextVNode("取消")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      y,
                      { onClick: J },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[78] ||
                            (t[78] = [Vue.createTextVNode("重置默认")]),
                        ),
                        _: 1,
                      },
                    ),
                    Vue.createVNode(
                      y,
                      { type: "primary", onClick: _ },
                      {
                        default: Vue.withCtx(
                          () =>
                            t[79] ||
                            (t[79] = [Vue.createTextVNode("保存布局")]),
                        ),
                        _: 1,
                      },
                    ),
                  ]),
                  default: Vue.withCtx(() => [
                    Vue.createElementVNode("div", _a, [
                      Vue.createElementVNode("div", Ka, [
                        Vue.createVNode(
                          C,
                          { "label-width": "80px", size: "small" },
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
                                          s["value"]["paper"]["widthMm"],
                                        "onUpdate:modelValue":
                                          t[25] ||
                                          (t[25] = (e) =>
                                            (s["value"].paper["widthMm"] = e)),
                                        min: 50,
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
                                { label: "纸张高(mm)" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue:
                                          s["value"]["paper"].heightMm,
                                        "onUpdate:modelValue":
                                          t[26] ||
                                          (t[26] = (e) =>
                                            (s["value"].paper["heightMm"] = e)),
                                        min: 50,
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
                                          s["value"].paper["paddingMm"],
                                        "onUpdate:modelValue":
                                          t[27] ||
                                          (t[27] = (e) =>
                                            (s["value"].paper["paddingMm"] =
                                              e)),
                                        min: 0,
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
                            ]),
                            _: 1,
                          },
                        ),
                        w["value"]
                          ? (Vue.openBlock(),
                            Vue.createElementBlock("div", Za, [
                              Vue.createElementVNode(
                                "div",
                                Xa,
                                "字段设置：" +
                                  Vue.toDisplayString(w["value"].label),
                                1,
                              ),
                              Vue.createVNode(
                                C,
                                { "label-width": "70px", size: "small" },
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
                                                t[28] ||
                                                (t[28] = (e) =>
                                                  (w["value"].x = e)),
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
                                      { label: "Y(mm)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue: w["value"].y,
                                              "onUpdate:modelValue":
                                                t[29] ||
                                                (t[29] = (e) =>
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
                                              modelValue: w["value"]["width"],
                                              "onUpdate:modelValue":
                                                t[30] ||
                                                (t[30] = (e) =>
                                                  (w["value"]["width"] = e)),
                                              min: 5,
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
                                    w.value.key !== "qrcode" &&
                                    w["value"]["key"] !== "lockImg"
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
                                                        w["value"].fontSize,
                                                      "onUpdate:modelValue":
                                                        t[31] ||
                                                        (t[31] = (e) =>
                                                          (w["value"][
                                                            "fontSize"
                                                          ] = e)),
                                                      min: 6,
                                                      max: 36,
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
                                              { label: "颜色" },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(
                                                    A,
                                                    {
                                                      modelValue:
                                                        w["value"].fontColor,
                                                      "onUpdate:modelValue":
                                                        t[32] ||
                                                        (t[32] = (e) =>
                                                          (w.value[
                                                            "fontColor"
                                                          ] = e)),
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
                                            Vue.createVNode(
                                              r,
                                              { label: "粗细" },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(
                                                    g,
                                                    {
                                                      modelValue:
                                                        w["value"][
                                                          "fontWeight"
                                                        ],
                                                      "onUpdate:modelValue":
                                                        t[33] ||
                                                        (t[33] = (e) =>
                                                          (w["value"][
                                                            "fontWeight"
                                                          ] = e)),
                                                      style: { width: "100px" },
                                                    },
                                                    {
                                                      default: Vue.withCtx(
                                                        () => [
                                                          Vue.createVNode(m, {
                                                            label: "正常",
                                                            value: "normal",
                                                          }),
                                                          Vue.createVNode(m, {
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
                                                    X,
                                                    {
                                                      modelValue:
                                                        w["value"]["wrap"],
                                                      "onUpdate:modelValue":
                                                        t[34] ||
                                                        (t[34] = (e) =>
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
                                            Vue.createVNode(
                                              r,
                                              { label: "行距" },
                                              {
                                                default: Vue.withCtx(() => [
                                                  Vue.createVNode(
                                                    a,
                                                    {
                                                      modelValue:
                                                        w["value"].lineHeight,
                                                      "onUpdate:modelValue":
                                                        t[35] ||
                                                        (t[35] = (e) =>
                                                          (w["value"][
                                                            "lineHeight"
                                                          ] = e)),
                                                      min: 0.8,
                                                      max: 3,
                                                      step: 0.1,
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
                        "table" === V["value"]
                          ? (Vue.openBlock(),
                            Vue.createElementBlock("div", Qa, [
                              t[73] ||
                                (t[73] = Vue.createElementVNode(
                                  "div",
                                  { class: "ps-layout-fields-title" },
                                  "表格设置",
                                  -1,
                                )),
                              Vue.createVNode(
                                C,
                                { "label-width": "80px", size: "small" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      r,
                                      { label: "Y位置(mm)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue: T["value"],
                                              "onUpdate:modelValue":
                                                t[36] ||
                                                (t[36] = (e) =>
                                                  (T["value"] = e)),
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
                                      { label: "字号(pt)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue:
                                                s.value.tableConfig[
                                                  "tableFontSize"
                                                ],
                                              "onUpdate:modelValue":
                                                t[37] ||
                                                (t[37] = (e) =>
                                                  (s["value"].tableConfig[
                                                    "tableFontSize"
                                                  ] = e)),
                                              min: 6,
                                              max: 24,
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
                                      { label: "行高(px)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue:
                                                s.value["tableConfig"]
                                                  .rowHeight,
                                              "onUpdate:modelValue":
                                                t[38] ||
                                                (t[38] = (e) =>
                                                  (s.value["tableConfig"][
                                                    "rowHeight"
                                                  ] = e)),
                                              min: 16,
                                              max: 60,
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
                                      { label: "外边框" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            X,
                                            {
                                              modelValue:
                                                s["value"]["tableConfig"][
                                                  "showBodyBorder"
                                                ],
                                              "onUpdate:modelValue":
                                                t[39] ||
                                                (t[39] = (e) =>
                                                  (s["value"].tableConfig[
                                                    "showBodyBorder"
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
                                    Vue.createVNode(
                                      r,
                                      { label: "加下划线" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            X,
                                            {
                                              modelValue:
                                                s["value"]["tableConfig"][
                                                  "underlineBrElements"
                                                ],
                                              "onUpdate:modelValue":
                                                t[40] ||
                                                (t[40] = (e) =>
                                                  (s["value"][
                                                    "tableConfig"
                                                  ].underlineBrElements = e)),
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
                              t[74] ||
                                (t[74] = Vue.createElementVNode(
                                  "div",
                                  {
                                    class: "ps-layout-fields-title",
                                    style: { "margin-top": "6px" },
                                  },
                                  "列宽设置",
                                  -1,
                                )),
                              Vue.createVNode(
                                Z,
                                {
                                  data: s.value["tableConfig"]["columns"],
                                  size: "small",
                                  border: "",
                                  style: { width: "100%" },
                                  "max-height": 160,
                                },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      K,
                                      { label: "显", width: "36" },
                                      {
                                        default: Vue.withCtx(({ row: e }) => [
                                          Vue.createVNode(
                                            S,
                                            {
                                              modelValue: e["visible"],
                                              "onUpdate:modelValue": (t) =>
                                                (e.visible = t),
                                            },
                                            null,
                                            8,
                                            [
                                              "modelValue",
                                              "onUpdate:modelValue",
                                            ],
                                          ),
                                        ]),
                                        _: 1,
                                      },
                                    ),
                                    Vue.createVNode(K, {
                                      prop: "label",
                                      label: "列名",
                                      width: "70",
                                    }),
                                    Vue.createVNode(
                                      K,
                                      { label: "宽(mm)", width: "80" },
                                      {
                                        default: Vue.withCtx(({ row: e }) => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue: e.width,
                                              "onUpdate:modelValue": (t) =>
                                                (e["width"] = t),
                                              min: 5,
                                              max: 300,
                                              step: 1,
                                              size: "small",
                                              "controls-position": "right",
                                            },
                                            null,
                                            8,
                                            [
                                              "modelValue",
                                              "onUpdate:modelValue",
                                            ],
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
                            ]))
                          : Vue.createCommentVNode("", !0),
                        "doorImgBox" === V["value"]
                          ? (Vue.openBlock(),
                            Vue.createElementBlock("div", Ra, [
                              t[75] ||
                                (t[75] = Vue.createElementVNode(
                                  "div",
                                  { class: "ps-layout-fields-title" },
                                  "门图框设置",
                                  -1,
                                )),
                              Vue.createVNode(
                                C,
                                { "label-width": "70px", size: "small" },
                                {
                                  default: Vue.withCtx(() => [
                                    Vue.createVNode(
                                      r,
                                      { label: "启用" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            X,
                                            {
                                              modelValue:
                                                s.value["doorImgBox"][
                                                  "enabled"
                                                ],
                                              "onUpdate:modelValue":
                                                t[41] ||
                                                (t[41] = (e) =>
                                                  (s["value"]["doorImgBox"][
                                                    "enabled"
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
                                    Vue.createVNode(
                                      r,
                                      { label: "X(mm)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue: s.value.doorImgBox.x,
                                              "onUpdate:modelValue":
                                                t[42] ||
                                                (t[42] = (e) =>
                                                  (s.value["doorImgBox"].x =
                                                    e)),
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
                                      { label: "Y(mm)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue:
                                                s["value"].doorImgBox.y,
                                              "onUpdate:modelValue":
                                                t[43] ||
                                                (t[43] = (e) =>
                                                  (s.value["doorImgBox"].y =
                                                    e)),
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
                                              modelValue:
                                                s.value["doorImgBox"]["width"],
                                              "onUpdate:modelValue":
                                                t[44] ||
                                                (t[44] = (e) =>
                                                  (s["value"]["doorImgBox"][
                                                    "width"
                                                  ] = e)),
                                              min: 10,
                                              max: 200,
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
                                      { label: "高(mm)" },
                                      {
                                        default: Vue.withCtx(() => [
                                          Vue.createVNode(
                                            a,
                                            {
                                              modelValue:
                                                s["value"]["doorImgBox"][
                                                  "height"
                                                ],
                                              "onUpdate:modelValue":
                                                t[45] ||
                                                (t[45] = (e) =>
                                                  (s.value["doorImgBox"][
                                                    "height"
                                                  ] = e)),
                                              min: 10,
                                              max: 200,
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
                            ]))
                          : Vue.createCommentVNode("", !0),
                        t[76] ||
                          (t[76] = Vue.createElementVNode(
                            "div",
                            {
                              class: "ps-layout-fields-title",
                              style: { "margin-top": "10px" },
                            },
                            "字段列表",
                            -1,
                          )),
                        Vue.createVNode(
                          Z,
                          {
                            data: s["value"]["headerFields"],
                            size: "small",
                            border: "",
                            "highlight-current-row": "",
                            "row-key": "key",
                            style: { width: "100%" },
                            "max-height": 240,
                            onRowClick:
                              t[50] || (t[50] = (e) => U("field", e.key)),
                          },
                          {
                            default: Vue.withCtx(() => [
                              Vue.createVNode(
                                K,
                                { label: "显", width: "36" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      S,
                                      {
                                        modelValue: e.visible,
                                        "onUpdate:modelValue": (t) =>
                                          (e["visible"] = t),
                                        onClick:
                                          t[46] ||
                                          (t[46] = Vue.withModifiers(() => {}, [
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
                              Vue.createVNode(K, {
                                prop: "label",
                                label: "字段",
                                width: "50",
                              }),
                              Vue.createVNode(
                                K,
                                { label: "X", width: "68" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue: e.x,
                                        "onUpdate:modelValue": (t) => (e.x = t),
                                        min: 0,
                                        max: 400,
                                        step: 0.5,
                                        size: "small",
                                        "controls-position": "right",
                                        onClick:
                                          t[47] ||
                                          (t[47] = Vue.withModifiers(() => {}, [
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
                                K,
                                { label: "Y", width: "68" },
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
                                          t[48] ||
                                          (t[48] = Vue.withModifiers(() => {}, [
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
                                K,
                                { label: "宽", width: "68" },
                                {
                                  default: Vue.withCtx(({ row: e }) => [
                                    Vue.createVNode(
                                      a,
                                      {
                                        modelValue: e["width"],
                                        "onUpdate:modelValue": (t) =>
                                          (e["width"] = t),
                                        min: 5,
                                        max: 300,
                                        step: 0.5,
                                        size: "small",
                                        "controls-position": "right",
                                        onClick:
                                          t[49] ||
                                          (t[49] = Vue.withModifiers(() => {}, [
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
                            ]),
                            _: 1,
                          },
                          8,
                          ["data"],
                        ),
                        Vue.createElementVNode("div", Fa, [
                          Vue.createVNode(
                            y,
                            {
                              size: "small",
                              type: s["value"]["doorImgBox"].enabled
                                ? "success"
                                : "default",
                              onClick: Y,
                            },
                            {
                              default: Vue.withCtx(() => [
                                Vue.createTextVNode(
                                  Vue.toDisplayString(
                                    s["value"].doorImgBox.enabled
                                      ? "门图框已启用"
                                      : "启用门图框",
                                  ),
                                  1,
                                ),
                              ]),
                              _: 1,
                            },
                            8,
                            ["type"],
                          ),
                        ]),
                      ]),
                      Vue.createElementVNode(
                        "div",
                        {
                          class: "ps-layout-editor-right",
                          ref_key: "layoutEditorRightRef",
                          ref: D,
                        },
                        [
                          Vue.createElementVNode("div", $a, [
                            Vue.createElementVNode(
                              "div",
                              {
                                class: "ps-layout-canvas",
                                style: Vue.normalizeStyle(P["value"]),
                                onClick:
                                  t[53] || (t[53] = (e) => (V["value"] = "")),
                              },
                              [
                                (Vue.openBlock(!0),
                                Vue.createElementBlock(
                                  Vue.Fragment,
                                  null,
                                  Vue.renderList(
                                    s["value"]["headerFields"],
                                    (e) => {
                                      const t = o;
                                      return (
                                        Vue.openBlock(),
                                        Vue.createElementBlock(
                                          Vue.Fragment,
                                          { key: e["key"] },
                                          [
                                            e["visible"]
                                              ? (Vue.openBlock(),
                                                Vue.createElementBlock(
                                                  "div",
                                                  {
                                                    key: 0,
                                                    class: Vue.normalizeClass([
                                                      "ps-layout-node",
                                                      {
                                                        "ps-layout-node-selected":
                                                          V.value === "field" &&
                                                          e["key"] ===
                                                            d["value"],
                                                      },
                                                    ]),
                                                    style: Vue.normalizeStyle(
                                                      I(e),
                                                    ),
                                                    onMousedown: (t) =>
                                                      ((e, t) => {
                                                        const o = l;
                                                        e["preventDefault"]();
                                                        const a = e.clientX,
                                                          n = e["clientY"],
                                                          u = t.x,
                                                          r = t.y,
                                                          i = k["value"],
                                                          c =
                                                            s["value"]["paper"],
                                                          d = (e) => {
                                                            const l = o,
                                                              s =
                                                                (e["clientX"] -
                                                                  a) /
                                                                i,
                                                              d =
                                                                (e["clientY"] -
                                                                  n) /
                                                                i;
                                                            let V = u + s,
                                                              m = r + d;
                                                            ((V =
                                                              Math["round"](
                                                                2 * V,
                                                              ) / 2),
                                                              (m =
                                                                Math["round"](
                                                                  2 * m,
                                                                ) / 2),
                                                              (V = Math["max"](
                                                                0,
                                                                Math["min"](
                                                                  c["widthMm"] -
                                                                    1,
                                                                  V,
                                                                ),
                                                              )),
                                                              (m = Math["max"](
                                                                0,
                                                                Math["min"](
                                                                  c.heightMm -
                                                                    1,
                                                                  m,
                                                                ),
                                                              )),
                                                              (t.x = V),
                                                              (t.y = m));
                                                          },
                                                          V = () => {
                                                            const e = o;
                                                            (document[
                                                              "removeEventListener"
                                                            ]("mousemove", d),
                                                              document[
                                                                "removeEventListener"
                                                              ]("mouseup", V));
                                                          };
                                                        (document[
                                                          "addEventListener"
                                                        ]("mousemove", d),
                                                          document[
                                                            "addEventListener"
                                                          ]("mouseup", V));
                                                      })(t, e),
                                                    onClick: Vue.withModifiers(
                                                      (l) =>
                                                        U("field", e["key"]),
                                                      ["stop"],
                                                    ),
                                                  },
                                                  Vue.toDisplayString(W(e)),
                                                  47,
                                                  en,
                                                ))
                                              : Vue.createCommentVNode("", !0),
                                          ],
                                          64,
                                        )
                                      );
                                    },
                                  ),
                                  128,
                                )),
                                s["value"]["doorImgBox"]["enabled"]
                                  ? (Vue.openBlock(),
                                    Vue.createElementBlock(
                                      "div",
                                      {
                                        key: 0,
                                        class: Vue.normalizeClass([
                                          "ps-layout-door-box",
                                          {
                                            "ps-layout-node-selected":
                                              V.value === "doorImgBox",
                                          },
                                        ]),
                                        style: Vue.normalizeStyle(O["value"]),
                                        onMousedown: q,
                                        onClick:
                                          t[51] ||
                                          (t[51] = Vue.withModifiers(
                                            (e) => U("doorImgBox", ""),
                                            ["stop"],
                                          )),
                                      },
                                      " 门图框 ",
                                      38,
                                    ))
                                  : Vue.createCommentVNode("", !0),
                                H["value"]
                                  ? (Vue.openBlock(),
                                    Vue.createElementBlock(
                                      "div",
                                      {
                                        key: 1,
                                        class: Vue.normalizeClass([
                                          "ps-layout-table-preview",
                                          {
                                            "ps-layout-node-selected":
                                              V["value"] === "table",
                                          },
                                        ]),
                                        style: Vue.normalizeStyle(H["value"]),
                                        onMousedown: j,
                                        onClick:
                                          t[52] ||
                                          (t[52] = Vue.withModifiers(
                                            (e) => U("table", ""),
                                            ["stop"],
                                          )),
                                        innerHTML: G.value,
                                      },
                                      null,
                                      46,
                                      tn,
                                    ))
                                  : Vue.createCommentVNode("", !0),
                              ],
                              4,
                            ),
                          ]),
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
