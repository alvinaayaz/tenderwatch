import { createElement as h } from "react";
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  const panel = (title: string, subtitle: string, accent: string) =>
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: "220px",
          padding: "22px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "2px solid #dce3ed",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px", color: "#50617b", fontSize: "18px", fontWeight: 700 } },
        h("div", { style: { width: "12px", height: "12px", borderRadius: "6px", background: accent } }),
        title
      ),
      h("div", { style: { marginTop: "30px", color: "#0f1d35", fontSize: "24px", fontWeight: 700 } }, subtitle),
      h("div", { style: { marginTop: "auto", color: "#50617b", fontSize: "15px" } }, "Snapshot comparison")
    );

  const image = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: "46px",
        padding: "58px",
        background: "#f7f8fa",
        color: "#0f1d35",
        fontFamily: "Arial, sans-serif",
      },
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", width: "54%" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "12px" } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "13px", background: "#0f1d35", color: "#ffffff", fontSize: "30px", fontWeight: 700 } }, "T"),
        h("div", { style: { fontSize: "24px", fontWeight: 700 } }, "TenderWatch")
      ),
      h("div", { style: { marginTop: "34px", fontSize: "16px", fontWeight: 700, letterSpacing: "2px", color: "#50617b" } }, "TENDER CHANGE TRACKING"),
      h("div", { style: { marginTop: "18px", fontSize: "52px", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-1px" } }, "Spot changes on a tender page."),
      h("div", { style: { marginTop: "26px", fontSize: "22px", color: "#50617b", lineHeight: 1.4 } }, "Compare page snapshots. Keep a history of manual checks."),
      h("div", { style: { marginTop: "36px", display: "flex", alignItems: "center", gap: "10px", color: "#0f9f87", fontSize: "17px", fontWeight: 700 } },
        h("div", { style: { width: "10px", height: "10px", borderRadius: "5px", background: "#0f9f87" }),
        "A lightweight procurement monitoring prototype"
      )
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", width: "42%", gap: "18px" } },
      h("div", { style: { display: "flex", gap: "14px" } },
        panel("Baseline", "Original page", "#6488ed"),
        panel("Latest check", "Current page", "#0f9f87")
      ),
      h("div", { style: { display: "flex", alignItems: "center", gap: "12px", padding: "18px", borderRadius: "14px", background: "#e7f6f2", color: "#087d6d", fontSize: "17px", fontWeight: 700 } },
        h("div", { style: { width: "12px", height: "12px", borderRadius: "6px", background: "#0f9f87" }),
        "Review what changed"
      )
    )
  );

  return new ImageResponse(image, { width: 1200, height: 630 });
}
