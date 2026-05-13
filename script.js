/*
 * GERADOR DE RECIBOS ON-LINE
 * ETAPA 4.1 - AUTO PREENCHER EMITENTE NO RECIBO + SALVAR NA ABA RECIBOS
 */

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1jqNNxHx9zbaKCFzK-RZXvL5CmZX317GVX5XFIk9bcDUszNwnXs3pYGnfhUA6htob7A/exec";
const STORAGE_KEY = "gerador_recibos_config";

const $ = (id) => document.getElementById(id);

const settingsModal = $("settingsModal");
const receiptModal = $("receiptModal");
const settingsForm = $("settingsForm");
const receiptForm = $("receiptForm");
const toast = $("toast");
const receiptPreviewSection = $("receiptPreviewSection");

let logoBase64 = "";

const fields = {
  companyName: $("companyName"),
  companyDocument: $("companyDocument"),
  companyAddress: $("companyAddress"),
  companyLogo: $("companyLogo"),
  logoPreviewBox: $("logoPreviewBox"),
  logoPreview: $("logoPreview"),
  homeLogoBox: $("homeLogoBox"),
  homeLogoImg: $("homeLogoImg"),
  recebiDe: $("recebiDe"),
  pagadorDocumento: $("pagadorDocumento"),
  valorRecibo: $("valorRecibo"),
  formaPagamento: $("formaPagamento"),
  dataRecibo: $("dataRecibo"),
  referente: $("referente"),
  observacoes: $("observacoes"),
  issuerName: $("issuerName"),
  issuerDocument: $("issuerDocument"),
  issuerAddress: $("issuerAddress"),
  printLogoBox: $("printLogoBox"),
  printLogoImg: $("printLogoImg"),
  printCompanyName: $("printCompanyName"),
  printCompanyDocument: $("printCompanyDocument"),
  printCompanyAddress: $("printCompanyAddress"),
  printReceiptNumber: $("printReceiptNumber"),
  printRecebiDe: $("printRecebiDe"),
  printPagadorDocumento: $("printPagadorDocumento"),
  printValor: $("printValor"),
  printValorExtenso: $("printValorExtenso"),
  printReferente: $("printReferente"),
  printFormaPagamento: $("printFormaPagamento"),
  printDataRecibo: $("printDataRecibo"),
  printObservacoesBox: $("printObservacoesBox"),
  printObservacoes: $("printObservacoes")
};

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  buscarConfiguracoesDaPlanilha();
  preencherDataAtual();
});

$("openSettings").addEventListener("click", () => openModal(settingsModal, fields.companyName));
$("closeSettings").addEventListener("click", () => closeModal(settingsModal));
$("generateReceipt").addEventListener("click", abrirFormularioRecibo);
$("closeReceipt").addEventListener("click", () => closeModal(receiptModal));
$("printReceiptButton").addEventListener("click", () => window.print());

settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeModal(settingsModal);
});

receiptModal.addEventListener("click", (event) => {
  if (event.target === receiptModal) closeModal(receiptModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal(settingsModal);
    closeModal(receiptModal);
  }
});

fields.companyDocument.addEventListener("input", () => {
  fields.companyDocument.value = formatCpfCnpj(fields.companyDocument.value);
});

fields.pagadorDocumento.addEventListener("input", () => {
  fields.pagadorDocumento.value = formatCpfCnpj(fields.pagadorDocumento.value);
});

fields.valorRecibo.addEventListener("input", () => {
  fields.valorRecibo.value = formatMoneyBR(fields.valorRecibo.value);
});

fields.companyLogo.addEventListener("change", handleLogoUpload);

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nome = fields.companyName.value.trim();
  const documento = fields.companyDocument.value.trim();
  const endereco = fields.companyAddress.value.trim();

  if (!nome) return alertField("Preencha o nome ou razão social.", fields.companyName);
  if (!documento) return alertField("Preencha o CPF ou CNPJ.", fields.companyDocument);
  if (!validarCpfCnpj(documento)) return alertField("CPF ou CNPJ inválido. Use 11 ou 14 números.", fields.companyDocument);
  if (!endereco) return alertField("Preencha o endereço.", fields.companyAddress);

  const button = settingsForm.querySelector(".save-button");
  const oldText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = "Salvando...";

    const resposta = await chamarBackend({
      action: "salvarConfiguracoes",
      nome,
      documento,
      endereco,
      logoUrl: ""
    });

    if (!resposta.ok) throw new Error(resposta.message || "Erro ao salvar configurações.");

    const settings = { companyName: nome, companyDocument: documento, companyAddress: endereco, logo: logoBase64 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applySettings(settings);
    preencherDadosEmitenteNoRecibo(settings);

    showToast("Configurações salvas na aba CONFIGURACOES.");
    closeModal(settingsModal);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível salvar na planilha.");
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});

$("clearSettings").addEventListener("click", () => {
  if (!confirm("Deseja limpar as configurações salvas apenas neste navegador?")) return;

  localStorage.removeItem(STORAGE_KEY);
  fields.companyName.value = "";
  fields.companyDocument.value = "";
  fields.companyAddress.value = "";
  fields.companyLogo.value = "";
  logoBase64 = "";
  applySettings({});
  preencherDadosEmitenteNoRecibo({});
  showToast("Configurações locais limpas.");
});

receiptForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const settings = getSettings();
  if (!settings.companyName || !settings.companyDocument || !settings.companyAddress) {
    showToast("Antes de salvar recibos, preencha as configurações da empresa.");
    closeModal(receiptModal);
    openModal(settingsModal, fields.companyName);
    return;
  }

  const dados = {
    recebiDe: fields.recebiDe.value.trim(),
    pagadorDocumento: fields.pagadorDocumento.value.trim(),
    valor: fields.valorRecibo.value.trim(),
    formaPagamento: fields.formaPagamento.value.trim(),
    dataRecibo: fields.dataRecibo.value,
    referente: fields.referente.value.trim(),
    observacoes: fields.observacoes.value.trim()
  };

  if (!dados.recebiDe) return alertField("Preencha o campo Recebi de.", fields.recebiDe);
  if (dados.pagadorDocumento && !validarCpfCnpj(dados.pagadorDocumento)) return alertField("CPF/CNPJ do pagador inválido.", fields.pagadorDocumento);
  if (!dados.valor || dados.valor === "R$ 0,00") return alertField("Preencha o valor do recibo.", fields.valorRecibo);
  if (!dados.referente) return alertField("Preencha o campo Referente a.", fields.referente);
  if (!dados.dataRecibo) return alertField("Informe a data do recibo.", fields.dataRecibo);

  const button = receiptForm.querySelector(".save-button");
  const oldText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = "Salvando recibo...";

    const empresaDoc = separarCpfCnpj(settings.companyDocument);
    const valorExtenso = numeroParaRealExtenso(dados.valor);

    const resposta = await chamarBackend({
      action: "salvarRecibo",
      empresaNome: settings.companyName,
      empresaCpf: empresaDoc.cpf,
      empresaCnpj: empresaDoc.cnpj,
      empresaEndereco: settings.companyAddress,
      recebiDe: dados.recebiDe,
      pagadorDocumento: dados.pagadorDocumento,
      valor: dados.valor,
      valorExtenso,
      referente: dados.referente,
      formaPagamento: dados.formaPagamento,
      dataRecibo: formatDateBR(dados.dataRecibo),
      observacoes: dados.observacoes
    });

    if (!resposta.ok) throw new Error(resposta.message || "Erro ao salvar recibo.");

    preencherPreviewRecibo({
      numeroRecibo: resposta.recibo.numeroRecibo,
      empresaNome: settings.companyName,
      empresaDocumento: settings.companyDocument,
      empresaEndereco: settings.companyAddress,
      logo: settings.logo,
      valorExtenso,
      ...dados,
      dataRecibo: formatDateBR(dados.dataRecibo)
    });

    receiptPreviewSection.classList.add("active");
    showToast("Recibo salvo na aba RECIBOS com sucesso.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível salvar o recibo na planilha.");
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});

$("clearReceiptForm").addEventListener("click", () => {
  receiptForm.reset();
  preencherDataAtual();
  receiptPreviewSection.classList.remove("active");
  showToast("Formulário limpo.");
});

function chamarBackend(params) {
  return new Promise((resolve, reject) => {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("COLE_AQUI")) {
      reject(new Error("URL do Apps Script não configurada."));
      return;
    }

    const callbackName = "jsonpCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    const script = document.createElement("script");
    const url = new URL(APPS_SCRIPT_URL);

    const timer = setTimeout(() => {
      delete window[callbackName];
      script.remove();
      reject(new Error("Não foi possível conectar no Apps Script. Confira se o Web App está publicado como: Quem pode acessar = Qualquer pessoa."));
    }, 15000);

    window[callbackName] = (response) => {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
      resolve(response);
    };

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value ?? "");
    });

    url.searchParams.append("callback", callbackName);
    script.src = url.toString();

    script.onerror = () => {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
      reject(new Error("Não foi possível conectar no Apps Script. Confira a URL do Web App e as permissões da implantação."));
    };

    document.body.appendChild(script);
  });
}

async function buscarConfiguracoesDaPlanilha() {
  try {
    const resposta = await chamarBackend({ action: "buscarConfiguracoes" });
    if (!resposta.ok || !resposta.dados) return;

    const dados = resposta.dados;
    const documento = dados.cpf || dados.cnpj || "";
    const localSettings = getSettings();

    fields.companyName.value = dados.nome || "";
    fields.companyDocument.value = documento || "";
    fields.companyAddress.value = dados.endereco || "";

    const settings = {
      companyName: dados.nome || "",
      companyDocument: documento || "",
      companyAddress: dados.endereco || "",
      logo: localSettings.logo || ""
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    logoBase64 = settings.logo || "";
    applySettings(settings);
    preencherDadosEmitenteNoRecibo(settings);
  } catch (error) {
    console.warn("Não foi possível buscar configurações da planilha:", error);
  }
}

function abrirFormularioRecibo() {
  const settings = getSettings();

  if (!settings.companyName || !settings.companyDocument || !settings.companyAddress) {
    showToast("Antes de gerar recibos, preencha as configurações da empresa.");
    openModal(settingsModal, fields.companyName);
    return;
  }

  preencherDataAtual();
  preencherDadosEmitenteNoRecibo(settings);
  openModal(receiptModal, fields.recebiDe);
}

function openModal(modal, focusElement) {
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => focusElement?.focus(), 100);
}

function closeModal(modal) {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function loadSettings() {
  const settings = getSettings();
  fields.companyName.value = settings.companyName || "";
  fields.companyDocument.value = settings.companyDocument || "";
  fields.companyAddress.value = settings.companyAddress || "";
  logoBase64 = settings.logo || "";
  applySettings(settings);
  preencherDadosEmitenteNoRecibo(settings);
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function applySettings(settings) {
  const logo = settings.logo || "";
  const boxes = [fields.logoPreviewBox, fields.homeLogoBox, fields.printLogoBox];
  const imgs = [fields.logoPreview, fields.homeLogoImg, fields.printLogoImg];

  imgs.forEach((img) => {
    if (logo) img.src = logo;
    else img.removeAttribute("src");
  });

  boxes.forEach((box) => box.classList.toggle("has-logo", Boolean(logo)));
}

function preencherDadosEmitenteNoRecibo(settings = getSettings()) {
  const nome = settings.companyName || "Nome não configurado";
  const documento = settings.companyDocument || "CPF/CNPJ não configurado";
  const endereco = settings.companyAddress || "Endereço não configurado";

  if (fields.issuerName) fields.issuerName.textContent = nome;
  if (fields.issuerDocument) fields.issuerDocument.textContent = documento;
  if (fields.issuerAddress) fields.issuerAddress.textContent = endereco;

  // Estes campos são o cabeçalho do recibo impresso.
  // Portanto, sempre recebem automaticamente os dados salvos nas configurações.
  if (fields.printCompanyName) fields.printCompanyName.textContent = settings.companyName || "Gerador de Recibos On-Line";
  if (fields.printCompanyDocument) fields.printCompanyDocument.textContent = settings.companyDocument || "CPF/CNPJ";
  if (fields.printCompanyAddress) fields.printCompanyAddress.textContent = settings.companyAddress || "Endereço";
}

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(file.type)) return showToast("Use uma imagem PNG, JPG ou WEBP.");
  if (file.size > 2 * 1024 * 1024) return showToast("A logo deve ter no máximo 2 MB.");

  const reader = new FileReader();
  reader.onload = () => {
    logoBase64 = reader.result;
    applySettings({ logo: logoBase64 });
    showToast("Logo carregada. Clique em salvar configurações.");
  };
  reader.onerror = () => showToast("Não foi possível carregar a logo.");
  reader.readAsDataURL(file);
}

function preencherPreviewRecibo(dados) {
  fields.printCompanyName.textContent = dados.empresaNome || "Gerador de Recibos On-Line";
  fields.printCompanyDocument.textContent = dados.empresaDocumento || "CPF/CNPJ";
  fields.printCompanyAddress.textContent = dados.empresaEndereco || "Endereço";
  fields.printReceiptNumber.textContent = dados.numeroRecibo || "---";
  fields.printRecebiDe.textContent = dados.recebiDe || "---";
  fields.printPagadorDocumento.textContent = dados.pagadorDocumento || "---";
  fields.printValor.textContent = dados.valor || "R$ 0,00";
  fields.printValorExtenso.textContent = dados.valorExtenso ? `(${dados.valorExtenso})` : "";
  fields.printReferente.textContent = dados.referente || "---";
  fields.printFormaPagamento.textContent = dados.formaPagamento || "---";
  fields.printDataRecibo.textContent = dados.dataRecibo || "---";

  if (dados.observacoes) {
    fields.printObservacoes.textContent = dados.observacoes;
    fields.printObservacoesBox.style.display = "block";
  } else {
    fields.printObservacoes.textContent = "";
    fields.printObservacoesBox.style.display = "none";
  }

  applySettings({ logo: dados.logo || "" });
}

function preencherDataAtual() {
  if (fields.dataRecibo.value) return;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  fields.dataRecibo.value = `${ano}-${mes}-${dia}`;
}

function alertField(message, field) {
  showToast(message);
  field.focus();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("active");
  setTimeout(() => toast.classList.remove("active"), 3800);
}

function formatCpfCnpj(value) {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);
  }

  return numbers
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function validarCpfCnpj(value) {
  const numbers = value.replace(/\D/g, "");
  return numbers.length === 11 || numbers.length === 14;
}

function separarCpfCnpj(value) {
  const numbers = value.replace(/\D/g, "");
  return numbers.length <= 11 ? { cpf: value, cnpj: "" } : { cpf: "", cnpj: value };
}

function formatMoneyBR(value) {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  return (Number(numbers) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function moneyToNumber(value) {
  return Number(value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function formatDateBR(dateValue) {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function numeroParaRealExtenso(value) {
  const numero = moneyToNumber(value);
  const reais = Math.floor(numero);
  const centavos = Math.round((numero - reais) * 100);

  let texto = reais === 1 ? "um real" : `${numeroInteiroPorExtenso(reais)} reais`;

  if (reais === 0) texto = "zero real";

  if (centavos > 0) {
    texto += centavos === 1 ? " e um centavo" : ` e ${numeroInteiroPorExtenso(centavos)} centavos`;
  }

  return texto;
}

function numeroInteiroPorExtenso(numero) {
  if (numero > 999999) return "valor superior ao limite automático";

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function ate999(n) {
    if (n === 0) return "";
    if (n === 100) return "cem";

    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    const partes = [];

    if (c > 0) partes.push(centenas[c]);

    if (d === 1) partes.push(especiais[u]);
    else {
      if (d > 1) partes.push(dezenas[d]);
      if (u > 0) partes.push(unidades[u]);
    }

    return partes.join(" e ");
  }

  if (numero === 0) return "zero";
  if (numero < 1000) return ate999(numero);

  const milhar = Math.floor(numero / 1000);
  const resto = numero % 1000;
  const textoMilhar = milhar === 1 ? "mil" : `${ate999(milhar)} mil`;

  if (resto === 0) return textoMilhar;
  return `${textoMilhar} e ${ate999(resto)}`;
}

//PRELOADER
// Remove o Preloader após o carregamento completo da página
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');

    // Pequeno delay para garantir que a renderização foi concluída
    setTimeout(() => {
        preloader.classList.add('loaded');
    }, 1000);
});