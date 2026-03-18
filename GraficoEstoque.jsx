import React from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

function GraficoEstoque({ dados }) {
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={dados}>
          <XAxis dataKey="nome" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="estoque" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default GraficoEstoque