type Props = {
  title: string;
  value: string;
};

export default function Card({ title, value }: Props) {
  return (
    <div
      style={{
        background: "#1e293b",
        padding: "20px",
        borderRadius: "12px",
        color: "#fff",
        width: "200px",
      }}
    >
      <p style={{ color: "#94a3b8" }}>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}