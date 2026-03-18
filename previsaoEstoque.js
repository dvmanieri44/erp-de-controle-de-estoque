export function preverDias(produto){

if(!produto.consumoMedio) return null

return Math.floor(
produto.estoque/produto.consumoMedio
)

}