export default function LoginPage() {
  return (
    <div
      style={{
        backgroundColor: "#e5e7eb",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "12px",
          width: "350px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        {/* Ícone */}
        <div
          style={{
            backgroundColor: "#2563eb",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            margin: "0 auto 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "20px",
          }}
        >
          →
        </div>

        <h2>Controle de Estoque</h2>
        <p style={{ color: "#6b7280", marginBottom: "20px" }}>
          Faça login para continuar
        </p>

        {/* Usuário */}
        <div style={{ textAlign: "left", marginBottom: "10px" }}>
          <label>Usuário</label>
          <input
            type="text"
            placeholder="Digite seu usuário"
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        {/* Senha */}
        <div style={{ textAlign: "left", marginBottom: "15px" }}>
          <label>Senha</label>
          <input
            type="password"
            placeholder="Digite sua senha"
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        {/* Botão */}
        <button
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            marginBottom: "15px",
          }}
        >
          Entrar
        </button>

        {/* Box de usuários */}
        <div
          style={{
            backgroundColor: "#f3f4f6",
            padding: "10px",
            borderRadius: "8px",
            fontSize: "12px",
            textAlign: "left",
          }}
        >
          <strong>Usuários de teste:</strong>
          <ul style={{ marginTop: "5px", paddingLeft: "15px" }}>
            <li>admin / admin123</li>
            <li>joao / 123456</li>
            <li>maria / 123456</li>
          </ul>
        </div>
      </div>
      <button
  style={{
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    border: "none",
    backgroundColor: "#374151",
    color: "white",
    fontSize: "18px",
    cursor: "pointer",
  }}
>
  ?
</button>
    </div>
  );
}