import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "TenderWatch — tender change tracking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "64px",
          background: "#f7f8fa",
          color: "#0f1d35",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: "54%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "54px", height: "54px", borderRadius: "14px", background: "#0f1d35", color: "#ffffff", fontSize: "36px", fontWeight: 700 }}>T</div>
          </div>
          <div style={{ marginTop: "26px", fontSize: "17px", fontWeight: 700, letterSpacing: "2px", color: "#50617b" }}>TENDER CHANGE TRACKING</div>
          <div style={{ marginTop: "18px", fontSize: "58px", fontWeight: 700, letterSpacing: "-2px" }}>TenderWatch</div>
          <div style={{ marginTop: "14px", fontSize: "25px", color: "#50617b" }}>Spot changes on a tender page.</div>
          <div style={{ marginTop: "44px", fontSize: "18px", fontWeight: 700 }}>Compare page snapshots.</div>
          <div style={{ marginTop: "10px", fontSize: "17px", color: "#50617b" }}>Keep a history of manual checks.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: "42%", gap: "22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px" }}>
            {["Baseline", "Latest check"].map((label, index) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", width: "47%", height: "250px", padding: "20px", borderRadius: "18px", background: "#ffffff", border: "2px solid #dce3ed" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "15px", fontWeight: 700, color: "#50617b" }}>
                  <div style={{ width: "14px", height: "14px", borderRadius: "7px", background: index === 0 ? "#6488ed" : "#0f9f87" }} />
                  {label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginTop: "18px", padding: "16px", gap: "12px", flex: 1, borderRadius: "10px", background: "#f8f9fc", border: "1px solid #e6ebf3" }}>
                  <div style={{ width: "72%", height: "10px", borderRadius: "5px", background: "#aebbd0" }} />
                  {[84, 92, 88, 58, 68].map((width, i) => <div key={i} style={{ width: width + "%", height: "7px", borderRadius: "4px", background: index === 1 && i === 3 ? "#6dd2bd" : "#d9e0eb" }} />)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: "12px", borderRadius: "12px", background: "#e8f7f3", color: "#176f62", fontSize: "15px", fontWeight: 700 }}>
            <div style={{ width: "13px", height: "13px", borderRadius: "7px", background: "#0f9f87" }} />
            Manual checks · Possible changes
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
