import React, { useEffect, useState } from "react"
import estoqueService from "../services/estoqueService"
import { exportarMovimentosPDF } from "../utils/exportarPDF"

function Relatorios() {
  const [movimentos, setMovimentos] = useState([])

  useEffect(() => {
    setMovimentos([...estoqueService.listarMovimentos()])
  }, [])

  function exportarCSV(dados) {
    let csv = "Tipo,Produto,Quantidade\n"

    dados.forEach((d) => {
      csv += `${d.tipo},${d.produto},${d.quantidade}\n`
    })

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "relatorio.csv"
    a.click()
  }

  return (
    <div className="pagina">
      <div className="topo">
        <h1>Relatórios</h1>
        <p>Exportação e acompanhamento de movimentações</p>
      </div>

      <div className="card">
        <div className="actions">
          <button onClick={() => exportarCSV(movimentos)}>Exportar CSV</button>
          <button onClick={() => exportarMovimentosPDF(movimentos)}>Exportar PDF</button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Produto</th>
              <th>Quantidade</th>
            </tr>
          </thead>

          <tbody>
            {movimentos.map((m, i) => (
              <tr key={i}>
                <td>{m.tipo}</td>
                <td>{m.produto}</td>
                <td>{m.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Relatorios