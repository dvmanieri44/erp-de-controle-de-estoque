import React from "react"
import { PieChart, Pie, Cell, Tooltip } from "recharts"

const cores = ["#2563eb", "#ef4444", "#f59e0b"]

function GraficoMovimentacoes({ dados }) {
  const entradas = dados.filter((m) => m.tipo === "Entrada").length
  const saidas = dados.filter((m) => m.tipo === "Saída").length
  const producao = dados.filter((m) => m.tipo === "Produção").length

  const data = [
    { nome: "Entradas", valor: entradas },
    { nome: "Saídas", valor: saidas },
    { nome: "Produção", valor: producao }
  ]

  return (
    <PieChart width={320} height={260}>
      <Pie
        data={data}
        dataKey="valor"
        cx="50%"
        cy="50%"
        outerRadius={85}
        label
      >
        {data.map((entry, index) => (
          <Cell key={index} fill={cores[index % cores.length]} />
        ))}
      </Pie>
      <Tooltip />
    </PieChart>
  )
}

export default GraficoMovimentacoes