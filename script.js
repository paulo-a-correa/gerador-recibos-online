const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1jqNNxHx9zbaKCFzK-RZXvL5CmZX317GVX5XFIk9bcDUszNwnXs3pYGnfhUA6htob7A/exec";
const STORAGE_KEY = "recibos_online_config";
window.reciboEditandoId = "";
const $ = (id) => document.getElementById(id);

const modalConfig = $("modalConfig"), modalRecibo = $("modalRecibo"), toast = $("toast");
const btnConfig = $("btnConfig"), btnFecharConfig = $("btnFecharConfig"), btnAbrirRecibo = $("btnAbrirRecibo"), btnFecharRecibo = $("btnFecharRecibo");
const btnLimparConfig = $("btnLimparConfig"), btnLimparRecibo = $("btnLimparRecibo"), btnImprimir = $("btnImprimir");
const formConfig = $("formConfig"), formRecibo = $("formRecibo");
const cfgNome = $("cfgNome"), cfgTipo = $("cfgTipo"), cfgDocumento = $("cfgDocumento"), cfgLogo = $("cfgLogo");
const logoHomeBox = $("logoHomeBox"), logoHomeImg = $("logoHomeImg"), logoConfigBox = $("logoConfigBox"), logoConfigImg = $("logoConfigImg"), logoPrintBox = $("logoPrintBox"), logoPrintImg = $("logoPrintImg");
const emitenteNomeTela = $("emitenteNomeTela"), emitenteDocTela = $("emitenteDocTela");
const recebiDe = $("recebiDe"), pagadorDoc = $("pagadorDoc"), valor = $("valor"), formaPagamento = $("formaPagamento"), dataRecibo = $("dataRecibo"), cidade = $("cidade"), referente = $("referente"), observacoes = $("observacoes");
const previewArea = $("previewArea"), printEmitenteNome = $("printEmitenteNome"), printEmitenteDoc = $("printEmitenteDoc"), printNum = $("printNum"), printRecebiDe = $("printRecebiDe"), printPagadorDoc = $("printPagadorDoc"), printValor = $("printValor"), printExtenso = $("printExtenso"), printReferente = $("printReferente"), printForma = $("printForma"), printData = $("printData"), printCidade = $("printCidade"), printObsBox = $("printObsBox"), printObs = $("printObs"), printAssinatura = $("printAssinatura");

window.addEventListener("DOMContentLoaded", () => { carregarConfigLocal(); buscarConfigNaPlanilha(); preencherDataAtual(); });
btnConfig.addEventListener("click", () => abrirModal(modalConfig));
btnFecharConfig.addEventListener("click", () => fecharModal(modalConfig));
btnFecharRecibo.addEventListener("click", () => fecharModal(modalRecibo));
btnAbrirRecibo.addEventListener("click", () => {
  const cfg = getConfigLocal();
  if (!cfg.nome || !cfg.documento) { mostrarToast("Antes de gerar recibos, salve as configurações do emitente."); abrirModal(modalConfig); return; }
  window.reciboEditandoId = ""; formRecibo.reset(); previewArea.classList.remove("active"); atualizarEmitente(cfg); preencherDataAtual(); abrirModal(modalRecibo);
});
modalConfig.addEventListener("click", (e) => { if (e.target === modalConfig) fecharModal(modalConfig); });
modalRecibo.addEventListener("click", (e) => { if (e.target === modalRecibo) fecharModal(modalRecibo); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { fecharModal(modalConfig); fecharModal(modalRecibo); } });
cfgTipo.addEventListener("change", () => { cfgDocumento.value = ""; cfgDocumento.placeholder = cfgTipo.value === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"; });
cfgDocumento.addEventListener("input", () => cfgDocumento.value = maskDoc(cfgDocumento.value, cfgTipo.value));
pagadorDoc.addEventListener("input", () => pagadorDoc.value = maskDocAuto(pagadorDoc.value));
valor.addEventListener("input", () => valor.value = maskMoney(valor.value));
cfgLogo.addEventListener("input", () => aplicarLogo(cfgLogo.value.trim()));

formConfig.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = cfgNome.value.trim();
  const tipoDocumento = cfgTipo.value;
  const documento = cfgDocumento.value.trim();
  const logoUrl = cfgLogo.value.trim();
  if (!nome) return focarComAviso(cfgNome, "Preencha o Nome / Razão Social.");
  if (!documento) return focarComAviso(cfgDocumento, "Preencha o CPF ou CNPJ.");
  if (!validarDocPorTipo(documento, tipoDocumento)) return focarComAviso(cfgDocumento, `${tipoDocumento} inválido. Confira a quantidade de números.`);
  const cpf = tipoDocumento === "CPF" ? documento : "";
  const cnpj = tipoDocumento === "CNPJ" ? documento : "";
  const botao = formConfig.querySelector(".btn-primary");
  const texto = botao.textContent;
  try {
    botao.disabled = true; botao.textContent = "Salvando...";
    const resposta = await chamarBackend({ action:"salvarConfiguracoes", nome, cpf, cnpj, tipoDocumento, documento, logoUrl });
    if (!resposta.ok) throw new Error(resposta.message || "Erro ao salvar configurações.");
    const cfg = { nome, cpf, cnpj, tipoDocumento, documento, logoUrl };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    aplicarConfigNaTela(cfg);
    mostrarToast("Configurações salvas na planilha com sucesso!");
    fecharModal(modalConfig);
  } catch (error) { console.error(error); mostrarToast(error.message || "Não foi possível salvar as configurações."); }
  finally { botao.disabled = false; botao.textContent = texto; }
});

btnLimparConfig.addEventListener("click", () => {
  if (!confirm("Deseja limpar as configurações apenas deste navegador?")) return;
  localStorage.removeItem(STORAGE_KEY); formConfig.reset(); aplicarConfigNaTela({}); mostrarToast("Configurações locais limpas.");
});

formRecibo.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cfg = getConfigLocal();
  if (!cfg.nome || !cfg.documento) { mostrarToast("Salve as configurações do emitente antes de salvar recibos."); fecharModal(modalRecibo); abrirModal(modalConfig); return; }
  const dados = {
    recebiDe: recebiDe.value.trim(),
    pagadorDocumento: pagadorDoc.value.trim(),
    valor: valor.value.trim(),
    valorExtenso: valorExtensoBR(valor.value.trim()),
    referente: referente.value.trim(),
    formaPagamento: formaPagamento.value.trim(),
    dataRecibo: dataRecibo.value,
    cidade: cidade.value.trim(),
    observacoes: observacoes.value.trim()
  };
  if (!dados.recebiDe) return focarComAviso(recebiDe, "Preencha o campo 'Recebi de'.");
  if (dados.pagadorDocumento && !validarDocAuto(dados.pagadorDocumento)) return focarComAviso(pagadorDoc, "CPF/CNPJ do pagador inválido.");
  if (!dados.valor || dados.valor === "R$ 0,00") return focarComAviso(valor, "Preencha o valor do recibo.");
  if (!dados.referente) return focarComAviso(referente, "Preencha o campo 'Referente a'.");
  if (!dados.dataRecibo) return focarComAviso(dataRecibo, "Preencha a data do recibo.");
  const botao = formRecibo.querySelector(".btn-primary");
  const texto = botao.textContent;
  try {
    botao.disabled = true; botao.textContent = "Salvando recibo...";
    const resposta = await chamarBackend({
      action: window.reciboEditandoId ? "atualizarRecibo" : "salvarRecibo", id: window.reciboEditandoId || "", emitenteNome:cfg.nome, emitenteCpf:cfg.cpf || "", emitenteCnpj:cfg.cnpj || "", emitenteLogoUrl:cfg.logoUrl || "",
      recebiDe:dados.recebiDe, pagadorDocumento:dados.pagadorDocumento, valor:dados.valor, valorExtenso:dados.valorExtenso,
      referente:dados.referente, formaPagamento:dados.formaPagamento, dataRecibo:formatDateBR(dados.dataRecibo), cidadeRecibo:dados.cidade, observacoes:dados.observacoes
    });
    if (!resposta.ok) throw new Error(resposta.message || "Erro ao salvar recibo.");
    preencherPreview({ numero:resposta.recibo.numRecibo, config:cfg, dados, dataBR:formatDateBR(dados.dataRecibo) });
    previewArea.classList.add("active");
    window.reciboEditandoId = "";
    pesquisarRecibosSeExistir();
    mostrarToast("Recibo salvo com sucesso na aba RECIBOS!");
  } catch (error) { console.error(error); mostrarToast(error.message || "Não foi possível salvar o recibo."); }
  finally { botao.disabled = false; botao.textContent = texto; }
});

btnLimparRecibo.addEventListener("click", () => { window.reciboEditandoId = ""; formRecibo.reset(); preencherDataAtual(); previewArea.classList.remove("active"); mostrarToast("Formulário limpo."); });
btnImprimir.addEventListener("click", () => {
  const numero = cleanFileName(printNum.textContent || "000");
  const nome = cleanFileName(printRecebiDe.textContent || "cliente");
  const data = cleanFileName((printData.textContent || "data").replaceAll("/", "-"));
  const original = document.title;
  document.title = `Recibo Nº ${numero} - ${nome} - ${data}`;
  window.print();
  setTimeout(() => document.title = original, 1000);
});

function chamarBackend(params) {
  return new Promise((resolve, reject) => {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("COLE_AQUI")) { reject(new Error("Configure a URL do Apps Script no arquivo script.js.")); return; }
    const callbackName = "jsonp_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const script = document.createElement("script");
    const url = new URL(APPS_SCRIPT_URL);
    const timeout = setTimeout(() => {
      delete window[callbackName]; script.remove();
      reject(new Error("Não foi possível conectar no Apps Script. Confira a URL e a implantação como 'Qualquer pessoa'."));
    }, 15000);
    window[callbackName] = (response) => { clearTimeout(timeout); delete window[callbackName]; script.remove(); resolve(response); };
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value ?? ""));
    url.searchParams.append("callback", callbackName);
    script.src = url.toString();
    script.onerror = () => { clearTimeout(timeout); delete window[callbackName]; script.remove(); reject(new Error("Erro de conexão com o Apps Script.")); };
    document.body.appendChild(script);
  });
}

async function buscarConfigNaPlanilha() {
  try {
    const resposta = await chamarBackend({ action: "buscarConfiguracoes" });
    if (!resposta.ok || !resposta.dados) return;
    const cfg = {
      nome: resposta.dados.nome || "",
      cpf: resposta.dados.cpf || "",
      cnpj: resposta.dados.cnpj || "",
      tipoDocumento: resposta.dados.tipoDocumento || (resposta.dados.cnpj ? "CNPJ" : "CPF"),
      documento: resposta.dados.documento || resposta.dados.cpf || resposta.dados.cnpj || "",
      logoUrl: resposta.dados.logoUrl || ""
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    aplicarConfigNaTela(cfg);
  } catch (error) { console.warn("Configurações não carregadas da planilha:", error); }
}

function abrirModal(modal) { modal.classList.add("active"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; }
function fecharModal(modal) { modal.classList.remove("active"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
function carregarConfigLocal() { aplicarConfigNaTela(getConfigLocal()); }
function getConfigLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function aplicarConfigNaTela(cfg) { cfgNome.value = cfg.nome || ""; cfgTipo.value = cfg.tipoDocumento || "CPF"; cfgDocumento.value = cfg.documento || ""; cfgLogo.value = cfg.logoUrl || ""; aplicarLogo(cfg.logoUrl || ""); atualizarEmitente(cfg); }
function atualizarEmitente(cfg) { emitenteNomeTela.textContent = cfg.nome || "Nenhum emitente cadastrado"; emitenteDocTela.textContent = cfg.documento || "CPF/CNPJ não informado"; }

function aplicarLogo(url) {
  const logoUrl = (url || "").trim();
  const boxes = [logoHomeBox, logoConfigBox, logoPrintBox];
  const imgs = [logoHomeImg, logoConfigImg, logoPrintImg];
  imgs.forEach((img) => { if (logoUrl) img.src = logoUrl; else img.removeAttribute("src"); });
  boxes.forEach((box) => { if (logoUrl) box.classList.add("has-logo"); else box.classList.remove("has-logo"); });
}

function preencherPreview({ numero, config, dados, dataBR }) {
  printEmitenteNome.textContent = config.nome || "Recibos On-Line";
  printEmitenteDoc.textContent = config.documento || "CPF/CNPJ";
  printNum.textContent = numero || "---";
  printRecebiDe.textContent = dados.recebiDe || "---";
  printPagadorDoc.textContent = dados.pagadorDocumento || "---";
  printValor.textContent = dados.valor || "R$ 0,00";
  printExtenso.textContent = dados.valorExtenso ? `(${dados.valorExtenso})` : "";
  printReferente.textContent = dados.referente || "---";
  printForma.textContent = dados.formaPagamento || "---";
  printData.textContent = dataBR || "---";
  printCidade.textContent = dados.cidade || "---";
  printAssinatura.textContent = config.nome || "Assinatura";
  if (dados.observacoes) { printObsBox.style.display = "block"; printObs.textContent = dados.observacoes; } else { printObsBox.style.display = "none"; printObs.textContent = ""; }
  aplicarLogo(config.logoUrl || "");
}

function preencherDataAtual() {
  if (dataRecibo.value) return;
  const hoje = new Date();
  dataRecibo.value = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;
}
function focarComAviso(campo, msg) { mostrarToast(msg); campo.focus(); }
function mostrarToast(msg) { toast.textContent = msg; toast.classList.add("active"); setTimeout(() => toast.classList.remove("active"), 3600); }

function maskDoc(value, tipo) {
  const n = value.replace(/\D/g, "");
  if (tipo === "CPF") {
    return n.slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return n.slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskDocAuto(value) {
  const n = value.replace(/\D/g, "");
  return n.length <= 11 ? maskDoc(n, "CPF") : maskDoc(n, "CNPJ");
}

function validarDocPorTipo(value, tipo) {
  const len = value.replace(/\D/g, "").length;
  return tipo === "CPF" ? len === 11 : len === 14;
}

function validarDocAuto(value) {
  const len = value.replace(/\D/g, "").length;
  return len === 11 || len === 14;
}

function maskMoney(value) {
  const n = value.replace(/\D/g, "");
  if (!n) return "";
  return (Number(n) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function moneyToNumber(value) {
  return Number(String(value).replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function valorExtensoBR(value) {
  const total = moneyToNumber(value);
  const reais = Math.floor(total);
  const centavos = Math.round((total - reais) * 100);

  if (reais > 999999) {
    return "valor superior ao limite do extenso automático";
  }

  let texto = "";

  if (reais === 0) {
    texto = "zero real";
  } else if (reais === 1) {
    texto = "um real";
  } else {
    texto = `${numeroPorExtensoCorrigido(reais)} reais`;
  }

  if (centavos > 0) {
    texto += centavos === 1
      ? " e um centavo"
      : ` e ${numeroPorExtensoCorrigido(centavos)} centavos`;
  }

  return texto;
}

function formatDateBR(value) {
  if (!value) return "";
  const [ano, mes, dia] = value.split("-");
  return `${dia}/${mes}/${ano}`;
}

function cleanFileName(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

(function corrigirCampoReferenteNoRecibo() {
  const formRecibo = document.getElementById("formRecibo");
  const campoReferente = document.getElementById("referente");
  const printReferente = document.getElementById("printReferente");
  const btnImprimir = document.getElementById("btnImprimir");

  function atualizarReferenteNaPrevia() {
    if (!campoReferente || !printReferente) {
      return;
    }

    const valorReferente = campoReferente.value.trim();

    printReferente.textContent = valorReferente || "---";
  }

  if (campoReferente) {
    campoReferente.addEventListener("input", atualizarReferenteNaPrevia);
    campoReferente.addEventListener("change", atualizarReferenteNaPrevia);
  }

  if (formRecibo) {
    formRecibo.addEventListener("submit", () => {
      setTimeout(atualizarReferenteNaPrevia, 100);
      setTimeout(atualizarReferenteNaPrevia, 600);
      setTimeout(atualizarReferenteNaPrevia, 1500);
    });
  }

  if (btnImprimir) {
    btnImprimir.addEventListener("click", atualizarReferenteNaPrevia, true);
  }
})();


/*
  FUNÇÕES DE APOIO PARA VALOR POR EXTENSO
  Usadas diretamente pela função valorExtensoBR().
*/

function numeroPorExtensoCorrigido(numero) {
  numero = Number(numero);

  if (numero === 0) return "zero";
  if (numero < 0 || numero > 999999) return String(numero);

  if (numero < 1000) {
    return centenasPorExtenso(numero);
  }

  const milhares = Math.floor(numero / 1000);
  const resto = numero % 1000;

  let texto = milhares === 1
    ? "mil"
    : `${centenasPorExtenso(milhares)} mil`;

  if (resto > 0) {
    texto += (resto < 100 || resto % 100 === 0)
      ? ` e ${centenasPorExtenso(resto)}`
      : ` ${centenasPorExtenso(resto)}`;
  }

  return texto;
}

function centenasPorExtenso(numero) {
  const unidades = [
    "",
    "um",
    "dois",
    "três",
    "quatro",
    "cinco",
    "seis",
    "sete",
    "oito",
    "nove"
  ];

  const especiais = [
    "dez",
    "onze",
    "doze",
    "treze",
    "quatorze",
    "quinze",
    "dezesseis",
    "dezessete",
    "dezoito",
    "dezenove"
  ];

  const dezenas = [
    "",
    "",
    "vinte",
    "trinta",
    "quarenta",
    "cinquenta",
    "sessenta",
    "setenta",
    "oitenta",
    "noventa"
  ];

  const centenas = [
    "",
    "cento",
    "duzentos",
    "trezentos",
    "quatrocentos",
    "quinhentos",
    "seiscentos",
    "setecentos",
    "oitocentos",
    "novecentos"
  ];

  numero = Number(numero);

  if (numero === 0) return "zero";
  if (numero === 100) return "cem";
  if (numero < 10) return unidades[numero];
  if (numero < 20) return especiais[numero - 10];

  if (numero < 100) {
    const dezena = Math.floor(numero / 10);
    const unidade = numero % 10;

    return unidade === 0
      ? dezenas[dezena]
      : `${dezenas[dezena]} e ${unidades[unidade]}`;
  }

  const centena = Math.floor(numero / 100);
  const resto = numero % 100;

  return resto === 0
    ? centenas[centena]
    : `${centenas[centena]} e ${centenasPorExtenso(resto)}`;
}

/* =========================================================
   PESQUISAR RECIBO - CONSULTA DINÂMICA NA PLANILHA
   ========================================================= */
const moduloPesquisaRecibos = {
  recibos: [],
  sortCampo: "dataCadastroOrdenacao",
  sortDirecao: "desc",
  debounceTimer: null
};

const btnPesquisarRecibo = document.getElementById("btnPesquisarRecibo");
const modalPesquisa = document.getElementById("modalPesquisa");
const btnFecharPesquisa = document.getElementById("btnFecharPesquisa");
const campoPesquisaRecibo = document.getElementById("campoPesquisaRecibo");
const tbodyPesquisaRecibos = document.getElementById("tbodyPesquisaRecibos");
const statusPesquisaRecibo = document.getElementById("statusPesquisaRecibo");

if (btnPesquisarRecibo) {
  btnPesquisarRecibo.addEventListener("click", () => {
    abrirModal(modalPesquisa);
    pesquisarRecibos();
    setTimeout(() => campoPesquisaRecibo?.focus(), 150);
  });
}

if (btnFecharPesquisa) {
  btnFecharPesquisa.addEventListener("click", () => fecharModal(modalPesquisa));
}

if (modalPesquisa) {
  modalPesquisa.addEventListener("click", (event) => {
    if (event.target === modalPesquisa) {
      fecharModal(modalPesquisa);
    }
  });
}

if (campoPesquisaRecibo) {
  campoPesquisaRecibo.addEventListener("input", () => {
    clearTimeout(moduloPesquisaRecibos.debounceTimer);

    moduloPesquisaRecibos.debounceTimer = setTimeout(() => {
      pesquisarRecibos(campoPesquisaRecibo.value.trim());
    }, 350);
  });
}

document.querySelectorAll(".recibos-table th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const campo = th.dataset.sort;

    if (moduloPesquisaRecibos.sortCampo === campo) {
      moduloPesquisaRecibos.sortDirecao = moduloPesquisaRecibos.sortDirecao === "asc" ? "desc" : "asc";
    } else {
      moduloPesquisaRecibos.sortCampo = campo;
      moduloPesquisaRecibos.sortDirecao = "asc";
    }

    renderizarTabelaRecibos();
  });
});

async function pesquisarRecibos(termo = "") {
  if (!tbodyPesquisaRecibos || !statusPesquisaRecibo) {
    return;
  }

  try {
    statusPesquisaRecibo.textContent = "Pesquisando na planilha...";

    const resposta = await chamarBackend({
      action: "pesquisarRecibos",
      termo
    });

    if (!resposta.ok) {
      throw new Error(resposta.message || "Erro ao pesquisar recibos.");
    }

    moduloPesquisaRecibos.recibos = resposta.recibos || [];
    renderizarTabelaRecibos();

    const total = moduloPesquisaRecibos.recibos.length;
    statusPesquisaRecibo.textContent = total === 1
      ? "1 recibo encontrado."
      : `${total} recibos encontrados.`;
  } catch (error) {
    console.error(error);
    statusPesquisaRecibo.textContent = error.message || "Não foi possível pesquisar recibos.";
    tbodyPesquisaRecibos.innerHTML = `<tr class="empty-row"><td colspan="6">Erro ao carregar recibos.</td></tr>`;
  }
}

function pesquisarRecibosSeExistir() {
  if (modalPesquisa && campoPesquisaRecibo) {
    pesquisarRecibos(campoPesquisaRecibo.value.trim());
  }
}

function renderizarTabelaRecibos() {
  if (!tbodyPesquisaRecibos) {
    return;
  }

  const recibos = ordenarRecibos([...moduloPesquisaRecibos.recibos]);
  const total = recibos.reduce((soma, recibo) => soma + (Number(recibo.valorNumero) || 0), 0);

  if (!recibos.length) {
    tbodyPesquisaRecibos.innerHTML = `
      <tr class="linha-total-fixa">
        <td></td>
        <td></td>
        <td></td>
        <td>TOTAL GERAL</td>
        <td></td>
        <td>${formatarMoedaNumero(total)}</td>
      </tr>
      <tr class="empty-row">
        <td colspan="6">Nenhum recibo encontrado.</td>
      </tr>
    `;
    return;
  }

  const linhas = recibos.map((recibo) => {
    const id = escapeHtml(recibo.id || "");
    const numRecibo = escapeHtml(recibo.numRecibo || "");
    const data = escapeHtml(recibo.dataCadastro || "");
    const recebi = escapeHtml(recibo.recebiDe || "");
    const valorLinha = escapeHtml(recibo.valor || "R$ 0,00");

    return `
      <tr>
        <td>
          <div class="action-buttons">
            <button class="btn-table-action" type="button" title="Visualizar" onclick="visualizarReciboPesquisa('${id}')">👁️‍🗨️</button>
            <button class="btn-table-action" type="button" title="Editar" onclick="editarReciboPesquisa('${id}')">✏️</button>
            <button class="btn-table-action delete" type="button" title="Excluir" onclick="excluirReciboPesquisa('${id}')">❌</button>
            <button class="btn-table-action" type="button" title="Imprimir/PDF" onclick="imprimirReciboPesquisa('${id}')">🖨️</button>
          </div>
        </td>
        <td>${numRecibo}</td>
        <td>${data}</td>
        <td>${recebi}</td>
        <td>${valorLinha}</td>
        <td></td>
      </tr>
    `;
  }).join("");

  tbodyPesquisaRecibos.innerHTML = `
    <tr class="linha-total-fixa">
      <td></td>
      <td></td>
      <td></td>
      <td>TOTAL GERAL</td>
      <td></td>
      <td>${formatarMoedaNumero(total)}</td>
    </tr>
    ${linhas}
  `;
}

function ordenarRecibos(recibos) {
  const campo = moduloPesquisaRecibos.sortCampo;
  const direcao = moduloPesquisaRecibos.sortDirecao === "asc" ? 1 : -1;

  return recibos.sort((a, b) => {
    let valorA = a[campo];
    let valorB = b[campo];

    if (campo === "valorNumero" || campo === "total") {
      valorA = Number(a.valorNumero) || 0;
      valorB = Number(b.valorNumero) || 0;
    } else {
      valorA = String(valorA || "").toLowerCase();
      valorB = String(valorB || "").toLowerCase();
    }

    if (valorA < valorB) return -1 * direcao;
    if (valorA > valorB) return 1 * direcao;
    return 0;
  });
}

async function buscarReciboCompleto(id) {
  const resposta = await chamarBackend({
    action: "buscarRecibo",
    id
  });

  if (!resposta.ok || !resposta.recibo) {
    throw new Error(resposta.message || "Recibo não encontrado.");
  }

  return resposta.recibo;
}

window.visualizarReciboPesquisa = async function visualizarReciboPesquisa(id) {
  try {
    const recibo = await buscarReciboCompleto(id);
    preencherPreviewComReciboDaPlanilha(recibo);
    previewArea.classList.add("active");
    fecharModal(modalPesquisa);
    abrirModal(modalRecibo);
    setTimeout(() => previewArea.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  } catch (error) {
    console.error(error);
    mostrarToast(error.message || "Não foi possível visualizar o recibo.");
  }
};

window.editarReciboPesquisa = async function editarReciboPesquisa(id) {
  try {
    const recibo = await buscarReciboCompleto(id);
    window.reciboEditandoId = recibo.id;
    preencherFormularioComReciboDaPlanilha(recibo);
    preencherPreviewComReciboDaPlanilha(recibo);
    previewArea.classList.add("active");
    fecharModal(modalPesquisa);
    abrirModal(modalRecibo);
    mostrarToast("Recibo carregado para edição. Altere os campos e clique em Salvar recibo.");
  } catch (error) {
    console.error(error);
    mostrarToast(error.message || "Não foi possível carregar o recibo para edição.");
  }
};

window.excluirReciboPesquisa = async function excluirReciboPesquisa(id) {
  const confirmar = confirm("Deseja realmente excluir este recibo?");

  if (!confirmar) {
    return;
  }

  try {
    const resposta = await chamarBackend({
      action: "excluirRecibo",
      id
    });

    if (!resposta.ok) {
      throw new Error(resposta.message || "Erro ao excluir recibo.");
    }

    mostrarToast("Recibo excluído com sucesso.");
    pesquisarRecibos(campoPesquisaRecibo.value.trim());
  } catch (error) {
    console.error(error);
    mostrarToast(error.message || "Não foi possível excluir o recibo.");
  }
};

window.imprimirReciboPesquisa = async function imprimirReciboPesquisa(id) {
  try {
    const recibo = await buscarReciboCompleto(id);
    preencherPreviewComReciboDaPlanilha(recibo);
    previewArea.classList.add("active");
    fecharModal(modalPesquisa);
    abrirModal(modalRecibo);

    setTimeout(() => {
      btnImprimir.click();
    }, 450);
  } catch (error) {
    console.error(error);
    mostrarToast(error.message || "Não foi possível imprimir o recibo.");
  }
};

function preencherFormularioComReciboDaPlanilha(recibo) {
  recebiDe.value = recibo.recebiDe || "";
  pagadorDoc.value = recibo.pagadorDocumento || "";
  valor.value = recibo.valor || "";
  formaPagamento.value = recibo.formaPagamento || "";
  dataRecibo.value = converterDataParaInput(recibo.dataRecibo || recibo.dataCadastro || "");
  cidade.value = recibo.cidadeRecibo || "";
  referente.value = recibo.referente || "";
  observacoes.value = recibo.observacoes || "";
}

function preencherPreviewComReciboDaPlanilha(recibo) {
  const config = {
    nome: recibo.emitenteNome || getConfigLocal().nome || "Recibos On-Line",
    documento: recibo.emitenteCpf || recibo.emitenteCnpj || getConfigLocal().documento || "CPF/CNPJ",
    logoUrl: recibo.emitenteLogoUrl || getConfigLocal().logoUrl || ""
  };

  const dados = {
    recebiDe: recibo.recebiDe || "",
    pagadorDocumento: recibo.pagadorDocumento || "",
    valor: recibo.valor || "",
    valorExtenso: recibo.valorExtenso || valorExtensoBR(recibo.valor || ""),
    referente: recibo.referente || "",
    formaPagamento: recibo.formaPagamento || "",
    cidade: recibo.cidadeRecibo || "",
    observacoes: recibo.observacoes || ""
  };

  preencherPreview({
    numero: recibo.numRecibo || "---",
    config,
    dados,
    dataBR: recibo.dataRecibo || recibo.dataCadastro || "---"
  });
}

function converterDataParaInput(data) {
  if (!data) {
    return "";
  }

  const texto = String(data).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split("/");
    return `${ano}-${mes}-${dia}`;
  }

  return "";
}

function formatarMoedaNumero(numero) {
  return (Number(numero) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

//PRELOADER
// Remove o Preloader após o carregamento completo da página
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');

    // Pequeno delay para garantir que a renderização foi concluída
    setTimeout(() => {
        preloader.classList.add('loaded');
    }, 700);
});