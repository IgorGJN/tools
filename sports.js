const API_URL = 'https://script.google.com/macros/s/AKfycbxvMgp9AEEPmbkqRCVT3jkeiVBaxt1OMrfMIyZIgriz6LHkICjntqTzVcTTKcZ8O0eFAw/exec';

const categoriaEl = document.getElementById('categoria');
const atividadeEl = document.getElementById('atividade');
const distanciaEl = document.getElementById('distancia');
const dataEl = document.getElementById('data');
const observacaoEl = document.getElementById('observacao');
const valorCalculadoEl = document.getElementById('valorCalculado');
const atividadeCamposEl = document.getElementById('atividadeCampos');
const despesaCamposEl = document.getElementById('despesaCampos');
const descricaoDespesaEl = document.getElementById('descricaoDespesa');
const valorDespesaEl = document.getElementById('valorDespesa');
const btnAdicionar = document.getElementById('btnAdicionar');
const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
const btnSincronizar = document.getElementById('btnSincronizar');
const listaLancamentosEl = document.getElementById('listaLancamentos');
const totalEntradasEl = document.getElementById('totalEntradas');
const totalDespesasEl = document.getElementById('totalDespesas');
const saldoFinalEl = document.getElementById('saldoFinal');
const btnLimpar = document.getElementById('btnLimpar');
const btnExportar = document.getElementById('btnExportar');
const statusEdicaoEl = document.getElementById('statusEdicao');
const tituloFormularioEl = document.getElementById('tituloFormulario');
const ultimaSyncEl = document.getElementById('ultimaSync');
const barraSyncWrapEl = document.getElementById('barraSyncWrap');
const barraSyncFillEl = document.getElementById('barraSyncFill');
const textoSyncEl = document.getElementById('textoSync');

const STORAGE_KEY = 'caixinhaLancamentos';
const STORAGE_SYNC_KEY = 'caixinhaUltimaSync';

let lancamentos = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let editandoId = null;

function hojeFormatoInput() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarData(data) {
  if (!data) return '-';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(dataIso) {
  if (!dataIso) return 'Ainda não sincronizado';

  const data = new Date(dataIso);
  if (isNaN(data.getTime())) return 'Ainda não sincronizado';

  return data.toLocaleString('pt-BR');
}

function gerarId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function salvarLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lancamentos));
}

function salvarUltimaSyncLocal(dataIso) {
  localStorage.setItem(STORAGE_SYNC_KEY, dataIso);
  atualizarStatusSync(dataIso);
}

function carregarUltimaSyncLocal() {
  const valor = localStorage.getItem(STORAGE_SYNC_KEY);
  atualizarStatusSync(valor);
}

function atualizarStatusSync(dataIso) {
  ultimaSyncEl.textContent = formatarDataHora(dataIso);
}

function mostrarBarraSync(texto = 'Sincronizando...') {
  barraSyncWrapEl.style.display = 'block';
  barraSyncFillEl.style.width = '20%';
  textoSyncEl.textContent = texto;

  setTimeout(() => {
    barraSyncFillEl.style.width = '55%';
  }, 120);
}

function atualizarBarraSync(percentual, texto) {
  barraSyncFillEl.style.width = `${percentual}%`;
  textoSyncEl.textContent = texto;
}

function esconderBarraSync() {
  setTimeout(() => {
    barraSyncFillEl.style.width = '100%';
    textoSyncEl.textContent = 'Concluído';

    setTimeout(() => {
      barraSyncWrapEl.style.display = 'none';
      barraSyncFillEl.style.width = '0%';
      textoSyncEl.textContent = 'Sincronizando...';
    }, 700);
  }, 150);
}

function calcularValorAtual() {
  const categoria = categoriaEl.value;

  if (categoria === 'despesa') {
    const valor = Number(valorDespesaEl.value || 0);
    valorCalculadoEl.value = formatarMoeda(valor);
    return valor;
  }

  const atividade = atividadeEl.value;
  const distancia = Number(distanciaEl.value || 0);
  let valor = 0;

  if (atividade === 'corrida') {
    valor = distancia * 1;
  } else if (atividade === 'pedal') {
    valor = 3 + (distancia * 0.25);
  }

  valorCalculadoEl.value = formatarMoeda(valor);
  return valor;
}

function atualizarResumo() {
  const entradas = lancamentos
    .filter(item => item.tipoRegistro === 'atividade')
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);

  const despesas = lancamentos
    .filter(item => item.tipoRegistro === 'despesa')
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);

  const saldo = entradas - despesas;

  totalEntradasEl.textContent = formatarMoeda(entradas);
  totalDespesasEl.textContent = formatarMoeda(despesas);
  saldoFinalEl.textContent = formatarMoeda(saldo);
  saldoFinalEl.className = saldo > 0 ? 'positivo' : saldo < 0 ? 'negativo' : 'neutro';
}

function badgeClasse(item) {
  if (item.tipoRegistro === 'despesa') return 'badge-despesa';
  if (item.atividade === 'corrida') return 'badge-corrida';
  return 'badge-pedal';
}

function badgeTexto(item) {
  if (item.tipoRegistro === 'despesa') return 'Despesa';
  return item.atividade === 'corrida' ? 'Corrida' : 'Pedal';
}

function detalhamento(item) {
  if (item.tipoRegistro === 'despesa') {
    return item.descricao || '-';
  }

  const distancia = Number(item.distancia || 0);

  return item.atividade === 'corrida'
    ? `${distancia.toFixed(2).replace('.', ',')} km × R$ 1,00`
    : `R$ 3,00 + ${distancia.toFixed(2).replace('.', ',')} km × R$ 0,25`;
}

function renderizarLancamentos() {
  if (lancamentos.length === 0) {
    listaLancamentosEl.innerHTML = '<div class="vazio">Nenhum lançamento registrado ainda.</div>';
    atualizarResumo();
    return;
  }

  const ordenados = [...lancamentos].sort((a, b) => {
    const dataA = new Date(a.data || '1900-01-01').getTime();
    const dataB = new Date(b.data || '1900-01-01').getTime();
    return dataB - dataA;
  });

  listaLancamentosEl.innerHTML = `
    <div class="lista-cards">
      ${ordenados.map(item => `
        <div class="item-lancamento">
          <div class="item-topo">
            <div class="item-esquerda">
              <span class="tipo-badge ${badgeClasse(item)}">${badgeTexto(item)}</span>
              <span class="item-data">${formatarData(item.data)}</span>
            </div>
            <div class="item-valor ${item.tipoRegistro === 'despesa' ? 'negativo' : 'positivo'}">
              ${item.tipoRegistro === 'despesa' ? '-' : '+'}${formatarMoeda(item.valor)}
            </div>
          </div>

          <div class="item-detalhes">
            <div class="detalhe-box">
              <small>Detalhe</small>
              <span>${item.tipoRegistro === 'despesa' ? (item.descricao || '-') : item.atividade}</span>
            </div>
            <div class="detalhe-box">
              <small>Cálculo</small>
              <span>${detalhamento(item)}</span>
            </div>
            <div class="detalhe-box">
              <small>Observação</small>
              <span>${item.observacao || '-'}</span>
            </div>
          </div>

          <div class="item-acoes">
            <button class="btn btn-warning" onclick="editarLancamento('${item.id}')">Editar</button>
            <button class="btn btn-danger" onclick="excluirLancamento('${item.id}')">Excluir</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  atualizarResumo();
}

function atualizarCamposVisiveis() {
  const isDespesa = categoriaEl.value === 'despesa';
  atividadeCamposEl.style.display = isDespesa ? 'none' : 'block';
  despesaCamposEl.style.display = isDespesa ? 'block' : 'none';
  calcularValorAtual();
}

function limparFormulario() {
  editandoId = null;
  tituloFormularioEl.textContent = 'Novo lançamento';
  statusEdicaoEl.style.display = 'none';
  btnAdicionar.textContent = 'Adicionar lançamento';
  btnCancelarEdicao.style.display = 'none';

  categoriaEl.value = 'atividade';
  atividadeEl.value = 'corrida';
  distanciaEl.value = '';
  descricaoDespesaEl.value = '';
  valorDespesaEl.value = '';
  observacaoEl.value = '';
  dataEl.value = hojeFormatoInput();

  atualizarCamposVisiveis();
}

function carregarParaEdicao(item) {
  editandoId = item.id;
  tituloFormularioEl.textContent = 'Editar lançamento';
  statusEdicaoEl.style.display = 'block';
  btnAdicionar.textContent = 'Salvar alterações';
  btnCancelarEdicao.style.display = 'inline-block';

  categoriaEl.value = item.tipoRegistro;
  dataEl.value = item.data || hojeFormatoInput();
  observacaoEl.value = item.observacao || '';

  if (item.tipoRegistro === 'despesa') {
    descricaoDespesaEl.value = item.descricao || '';
    valorDespesaEl.value = item.valor || '';
    distanciaEl.value = '';
  } else {
    atividadeEl.value = item.atividade || 'corrida';
    distanciaEl.value = item.distancia || '';
    descricaoDespesaEl.value = '';
    valorDespesaEl.value = '';
  }

  atualizarCamposVisiveis();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function editarLancamento(id) {
  const item = lancamentos.find(l => l.id === id);
  if (!item) return;
  carregarParaEdicao(item);
}

async function excluirLancamento(id) {
  const item = lancamentos.find(l => l.id === id);
  if (!item) return;

  const confirmar = confirm('Deseja excluir este lançamento?');
  if (!confirmar) return;

  lancamentos = lancamentos.filter(l => l.id !== id);

  if (editandoId === id) {
    limparFormulario();
  }

  salvarLocal();
  renderizarLancamentos();

  try {
    mostrarBarraSync('Excluindo da planilha...');
    await salvarTudoNaPlanilha();
    atualizarBarraSync(100, 'Exclusão sincronizada');
    esconderBarraSync();
  } catch (error) {
    console.error(error);
    alert('O item foi removido localmente, mas houve erro ao sincronizar com a planilha.');
  }
}

function validarFormulario() {
  const categoria = categoriaEl.value;
  const data = dataEl.value;

  if (!data) {
    alert('Informe a data.');
    return null;
  }

  if (categoria === 'despesa') {
    const descricao = descricaoDespesaEl.value.trim();
    const valor = Number(valorDespesaEl.value || 0);

    if (!descricao) {
      alert('Informe a descrição da despesa.');
      return null;
    }

    if (valor <= 0) {
      alert('Informe um valor de despesa maior que zero.');
      return null;
    }

    return {
      tipoRegistro: 'despesa',
      descricao,
      valor,
      data,
      observacao: observacaoEl.value.trim(),
      atividade: '',
      distancia: 0
    };
  }

  const atividade = atividadeEl.value;
  const distancia = Number(distanciaEl.value || 0);
  const valor = calcularValorAtual();

  if (distancia <= 0) {
    alert('Informe uma distância maior que zero.');
    return null;
  }

  return {
    tipoRegistro: 'atividade',
    atividade,
    distancia,
    valor,
    data,
    observacao: observacaoEl.value.trim(),
    descricao: ''
  };
}

async function apiGet(action) {
  const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Erro na requisição GET.');
  }

  return data;
}

async function apiPost(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Erro na requisição POST.');
  }

  return data;
}

async function carregarDaPlanilha() {
  mostrarBarraSync('Carregando dados da planilha...');
  atualizarBarraSync(35, 'Buscando aba sports...');

  const data = await apiGet('sports-list');

  atualizarBarraSync(75, 'Atualizando tela...');
  lancamentos = Array.isArray(data.items) ? data.items : [];
  salvarLocal();
  renderizarLancamentos();

  const syncTime = data.serverTime || new Date().toISOString();
  salvarUltimaSyncLocal(syncTime);

  atualizarBarraSync(100, 'Dados carregados com sucesso');
  esconderBarraSync();
}

async function salvarTudoNaPlanilha() {
  mostrarBarraSync('Enviando dados para a planilha...');
  atualizarBarraSync(30, 'Preparando envio...');

  const payloadItems = lancamentos.map(item => ({
    ...item,
    updatedAt: new Date().toISOString(),
    createdAt: item.createdAt || new Date().toISOString()
  }));

  const data = await apiPost({
    action: 'sports-save-all',
    items: payloadItems
  });

  atualizarBarraSync(80, 'Confirmando sincronização...');

  const syncTime = data.serverTime || new Date().toISOString();
  salvarUltimaSyncLocal(syncTime);

  atualizarBarraSync(100, 'Sincronização concluída');
  esconderBarraSync();
}

async function sincronizarAgora() {
  try {
    await salvarTudoNaPlanilha();
    await carregarDaPlanilha();
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    alert('Não foi possível sincronizar com a planilha.');
    barraSyncWrapEl.style.display = 'none';
  }
}

btnAdicionar.addEventListener('click', async () => {
  const dados = validarFormulario();
  if (!dados) return;

  const agoraIso = new Date().toISOString();

  if (editandoId) {
    lancamentos = lancamentos.map(item =>
      item.id === editandoId
        ? {
            ...item,
            ...dados,
            updatedAt: agoraIso
          }
        : item
    );
  } else {
    lancamentos.push({
      id: gerarId(),
      ...dados,
      createdAt: agoraIso,
      updatedAt: agoraIso
    });
  }

  salvarLocal();
  renderizarLancamentos();

  try {
    await salvarTudoNaPlanilha();
    limparFormulario();
  } catch (error) {
    console.error(error);
    alert('O lançamento foi salvo localmente, mas houve erro ao enviar para a planilha.');
  }
});

btnCancelarEdicao.addEventListener('click', limparFormulario);

btnLimpar.addEventListener('click', async () => {
  const confirmar = confirm('Deseja apagar todos os lançamentos?');
  if (!confirmar) return;

  lancamentos = [];
  salvarLocal();
  renderizarLancamentos();
  limparFormulario();

  try {
    mostrarBarraSync('Limpando planilha...');
    await apiPost({ action: 'sports-clear-all' });
    salvarUltimaSyncLocal(new Date().toISOString());
    atualizarBarraSync(100, 'Tudo removido');
    esconderBarraSync();
  } catch (error) {
    console.error(error);
    alert('Os dados foram apagados localmente, mas houve erro ao limpar a planilha.');
  }
});

btnExportar.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(lancamentos, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'caixinha-lancamentos.json';
  link.click();
  URL.revokeObjectURL(link.href);
});

btnSincronizar.addEventListener('click', sincronizarAgora);

categoriaEl.addEventListener('change', atualizarCamposVisiveis);
atividadeEl.addEventListener('change', calcularValorAtual);
distanciaEl.addEventListener('input', calcularValorAtual);
valorDespesaEl.addEventListener('input', calcularValorAtual);

window.editarLancamento = editarLancamento;
window.excluirLancamento = excluirLancamento;

dataEl.value = hojeFormatoInput();
atualizarCamposVisiveis();
renderizarLancamentos();
carregarUltimaSyncLocal();
carregarDaPlanilha().catch(error => {
  console.error('Erro ao carregar dados iniciais:', error);
});