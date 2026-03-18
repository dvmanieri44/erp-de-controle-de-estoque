export function sugerirCompras(produtos){

return produtos
.filter(p=>p.estoque<=p.estoqueMinimo)
.map(p=>({

produto:p.nome,
comprar:(p.estoqueMinimo*2)-p.estoque

}))

}