"use client";

export default function Header() {
  return (
    <div
      style={{
        height: "70px",
        background: "#1e293b",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        color: "#fff",
        borderBottom: "1px solid #334155",
      }}
    >
      <h2>Dashboard</h2>

      <div>
        <span>João 👋</span>
      </div>
    </div>
  );
}