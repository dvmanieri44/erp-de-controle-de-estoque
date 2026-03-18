import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export function exportarMovimentosPDF(movimentos) {
  const doc = new jsPDF()

  doc.text("Relatório de Movimentações", 14, 15)

  autoTable(doc, {
    startY: 20,
    head: [["Tipo", "Produto", "Quantidade"]],
    body: movimentos.map((m) => [m.tipo, m.produto, m.quantidade])
  })

  doc.save("relatorio_movimentos.pdf")
}