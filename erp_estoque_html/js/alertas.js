document.addEventListener("DOMContentLoaded",()=>{

const tabela = document.getElementById("tabelaAlertas");

const produtos = getProdutos();

const alertas = produtos.filter(p=>p.quantidade <= p.estoqueMinimo);

if(alertas.length === 0){

tabela.innerHTML = "<tr><td colspan='3'>Nenhum alerta de estoque</td></tr>";

return;

}

alertas.forEach(p=>{

const tr = document.createElement("tr");

tr.innerHTML = `
<td>${p.nome}</td>
<td>${p.quantidade}</td>
<td>${p.estoqueMinimo}</td>
`;

tabela.appendChild(tr);

});

});