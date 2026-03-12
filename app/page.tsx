export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-200 px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-3xl rounded-[2rem] border border-lime-300 bg-gradient-to-br from-lime-300 via-lime-200 to-neutral-100 p-10 shadow-sm">
          <div className="space-y-4 rounded-[1.5rem] bg-neutral-800 p-8 text-neutral-100">
            <span className="inline-flex rounded-full bg-lime-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-900">
              Pagina inicial
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-lime-300">
              ERP de Controle de Estoque
            </h1>
            <p className="max-w-2xl text-base leading-7 text-neutral-300">
              Esta e a tela inicial do projeto. Ela existe apenas para marcar o
              ponto de entrada da aplicacao enquanto as demais areas sao
              estruturadas.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
