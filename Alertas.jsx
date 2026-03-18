import React from "react"
import { getProdutos } from "../services/estoqueService"

function Alertas(){

const produtos = getProdutos()

const alertas = produtos.filter(p => p.quantidade < 5)

return(

<div className="page-box">

<h2>Alertas de Estoque</h2>

<table>

<thead>

<tr>
<th>Produto</th>
<th>Quantidade</th>
</tr>

</thead>

<tbody>

{alertas.map(p => (

<tr key={p.id}>
<td>{p.nome}</td>
<td>{p.quantidade}</td>
</tr>

))}

</tbody>

</table>

</div>

)

}

export default Alertas