document.addEventListener("DOMContentLoaded",()=>{

const form = document.getElementById("formCliente");

const tabela = document.getElementById("tabelaClientes");

function render(){

const clientes = getClientes();

tabela.innerHTML="";

clientes.forEach(c=>{

const tr = document.createElement("tr");

tr.innerHTML = `
<td>${c.nome}</td>
<td>${c.telefone}</td>
`;

tabela.appendChild(tr);

});

}

form.addEventListener("submit",(e)=>{

e.preventDefault();

const nome = document.getElementById("clienteNome").value;
const telefone = document.getElementById("clienteTelefone").value;

const clientes = getClientes();

clientes.push({

id:gerarId(),
nome,
telefone

});

saveClientes(clientes);

form.reset();

render();

});

render();

});