export function exportarProdutosCSV(produtos) {
  let csv = "Nome,Categoria,Fornecedor,Preço,Estoque,Estoque Mínimo,Validade\n"

  produtos.forEach((p) => {
    csv += `${p.nome},${p.categoria},${p.fornecedor || ""},${p.preco},${p.estoque},${p.estoqueMinimo},${p.validade || ""}\n`
  })

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "produtos.csv"
  a.click()
}