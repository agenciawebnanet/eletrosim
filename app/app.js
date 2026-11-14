(() => {
  "use strict";

  const KEY = "cc_web_v2";
  const $ = (sel) => document.querySelector(sel);
  const view = $("#view");
  const modalRoot = $("#modalRoot");
  const pageTitle = $("#pageTitle");
  const pageSubtitle = $("#pageSubtitle");
  const installBtn = $("#installBtn");

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const num1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const num2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const COLORS = ["#ffd60a", "#3ddc97", "#5b8def", "#b98bff", "#ff9f45", "#4dd0e1", "#ff6f91", "#a3e635"];

  const UF = {
    AC: ["Energisa Acre"], AL: ["Equatorial Alagoas"], AP: ["Equatorial Amapá"],
    AM: ["Amazonas Energia"], BA: ["Neoenergia Coelba"], CE: ["Enel Ceará"],
    DF: ["Neoenergia Brasília"], ES: ["EDP Espírito Santo"], GO: ["Equatorial Goiás"],
    MA: ["Equatorial Maranhão"], MT: ["Energisa Mato Grosso"], MS: ["Energisa Mato Grosso do Sul"],
    MG: ["CEMIG Distribuição"], PA: ["Equatorial Pará"], PB: ["Energisa Paraíba"],
    PR: ["COPEL Distribuição"], PE: ["Neoenergia Pernambuco"], PI: ["Equatorial Piauí"],
    RJ: ["Enel Rio", "Light"], RN: ["Neoenergia Cosern"], RS: ["CEEE Equatorial", "RGE"],
    RO: ["Energisa Rondônia"], RR: ["Energisa Roraima"], SC: ["Celesc Distribuição"],
    SP: ["Enel São Paulo", "CPFL Paulista", "CPFL Piratininga", "EDP São Paulo", "Elektro"],
    SE: ["Energisa Sergipe"], TO: ["Energisa Tocantins"]
  };
  const UF_NAMES = {
    AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
    DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
    MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
    PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
    RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
    SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins"
  };
  const TYPES = [
    ["RESIDENTIAL", "Residência"], ["COMMERCIAL", "Comércio"], ["INDUSTRIAL", "Indústria"],
    ["RURAL", "Rural"], ["CONSTRUCTION", "Construção"]
  ];

  let state = load();
  let catalog = [];
  let catalogError = false;
  let tab = "home";
  let envFilter = null;
  let simOverrides = new Map();
  let deferredPrompt = null;

  // ---------------------------------------------------------------- util
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

  const icon = (name, cls = "mi") =>
    `<svg class="${cls}" aria-hidden="true"><use href="assets/icons.svg#${name}"></use></svg>`;

  const ENV_ICONS = ["meeting_room", "bed", "weekend", "kitchen", "bathtub", "local_laundry_service",
    "directions_car", "factory", "storefront", "agriculture", "construction", "business_center"];
  const ENV_EMOJI = {
    "🏠": "meeting_room", "🛏️": "bed", "🛋️": "weekend", "🍳": "kitchen", "🚿": "bathtub",
    "🧺": "local_laundry_service", "🚗": "directions_car", "🏭": "factory", "🏪": "storefront",
    "🌾": "agriculture", "🛠️": "construction", "🏢": "business_center", "💡": "lightbulb", "📺": "tv"
  };
  const envIcon = (env) => ENV_ICONS.includes(env.icon) ? env.icon : (ENV_EMOJI[env.icon] || "meeting_room");

  function fmtDuration(minutes) {
    const total = Math.max(0, Math.min(1440, minutes || 0));
    const h = Math.floor(total / 60);
    const m = total - h * 60;
    if (h <= 0) return `${num1.format(m)} min`;
    if (m < 0.05) return `${h} h`;
    return `${h} h ${num1.format(m)} min`;
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2600);
  }

  // ---------------------------------------------------------------- estado
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.projects)) return parsed;
      }
    } catch (e) { /* ignora */ }
    return { projects: [], currentId: null };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("Não foi possível salvar."); }
  }

  function project() {
    return state.projects.find((p) => p.id === state.currentId) || null;
  }

  function ensureProjectShape(p) {
    p.environments = Array.isArray(p.environments) ? p.environments : [];
    p.equipments = Array.isArray(p.equipments) ? p.equipments : [];
    p.environments.forEach((env) => {
      if (!ENV_ICONS.includes(env.icon)) env.icon = ENV_EMOJI[env.icon] || "meeting_room";
    });
    p.equipments.forEach((eq) => {
      if (Array.isArray(eq.weeklyMinutes) && eq.weeklyMinutes.length !== 7) delete eq.weeklyMinutes;
    });
    return p;
  }

  function newProject(data) {
    const p = ensureProjectShape({
      id: uid(), name: "Minha instalação", type: "RESIDENTIAL", tariff: 0.75,
      days: 30, state: "", utility: "",
      environments: [], equipments: [], ...data
    });
    state.projects.push(p);
    state.currentId = p.id;
    save();
    return p;
  }

  // ---------------------------------------------------------------- calculos
  function monthlyKwh(eq) {
    if (eq.monthlyKwh != null) return eq.monthlyKwh * (eq.qty || 1);
    const weekly = Array.isArray(eq.weeklyMinutes) && eq.weeklyMinutes.length === 7 ? eq.weeklyMinutes : null;
    if (weekly) {
      const total = weekly.reduce((a, b) => a + (Number(b) || 0), 0);
      if (total > 0) {
        return (eq.powerW / 1000) * (total / 60) * ((eq.days || 30) / 7) * (eq.qty || 1);
      }
    }
    const hours = eq.hours || 0;
    return (eq.powerW / 1000) * (eq.qty || 1) * hours * (eq.days || 30) * (eq.factor ?? 1);
  }
  const costOf = (eq, p) => monthlyKwh(eq) * (p?.tariff || 0);

  /** Minutos/dia equivalentes (média semanal quando há rotina por dia). */
  function baseMinutes(eq) {
    if (Array.isArray(eq.weeklyMinutes) && eq.weeklyMinutes.length === 7) {
      const total = eq.weeklyMinutes.reduce((a, b) => a + (Number(b) || 0), 0);
      return total > 0 ? total / 7 : (eq.hours || 0) * 60;
    }
    return (eq.hours || 0) * 60;
  }

  /** Consumo para um valor de minutos informado na simulação (não altera o cadastro). */
  function simKwhOf(eq, minutes) {
    const factor = Array.isArray(eq.weeklyMinutes) ? 1 : (eq.factor ?? 1);
    return (eq.powerW / 1000) * (eq.qty || 1) * ((minutes || 0) / 60) * (eq.days || 30) * factor;
  }

  function totals(p) {
    const kwh = p.equipments.reduce((acc, eq) => acc + monthlyKwh(eq), 0);
    return { kwh, cost: kwh * (p.tariff || 0) };
  }

  function byCategory(p) {
    const map = new Map();
    p.equipments.forEach((eq) => {
      map.set(eq.category, (map.get(eq.category) || 0) + monthlyKwh(eq));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function byEnvironment(p) {
    return p.environments.map((env) => {
      const kwh = p.equipments.filter((eq) => eq.envId === env.id).reduce((a, eq) => a + monthlyKwh(eq), 0);
      return { env, kwh };
    }).sort((a, b) => b.kwh - a.kwh);
  }

  // ---------------------------------------------------------------- catalogo
  async function loadCatalog() {
    try {
      const res = await fetch("catalogo.json", { cache: "force-cache" });
      const data = await res.json();
      catalog = data.itens.map((row) => {
        const category = data.categorias[row[0]][0];
        const type = row[1];
        const variant = row[2] || "";
        const name = variant ? `${type} — ${variant}` : type;
        return {
          category, type, variant, name,
          power: row[3] || 0,
          hours: row[6] || 1,
          days: row[7] || 30,
          factor: row[8] ?? 1,
          voltage: row[9] || 0,
          estimated: row[11] === 1,
          search: norm(`${type} ${variant} ${category}`),
          compact: norm(`${type} ${variant} ${category}`).replace(/ /g, ""),
          typeNorm: norm(type),
          typeCompact: norm(type).replace(/ /g, ""),
          typeWords: norm(type).split(" ").filter(Boolean),
          variantNorm: norm(variant),
          variantWords: norm(variant).split(" ").filter(Boolean)
        };
      });
    } catch (e) {
      catalogError = true;
    }
    render();
  }

  function searchCatalog(query, limit = 60) {
    const q = norm(query);
    if (!q) return catalog.slice(0, limit);
    const compact = q.replace(/ /g, "");
    const tokens = q.split(" ").filter(Boolean);
    const scored = [];
    for (const item of catalog) {
      const direct = item.search.includes(q) || item.compact.includes(compact);
      const everyWord = tokens.length > 1 && tokens.every((t) => item.compact.includes(t));
      if (!direct && !everyWord) continue;

      let score = 0;
      if (item.typeNorm.includes(q)) score += 100;
      if (item.typeCompact.includes(compact)) score += 80;
      if (item.search.includes(q)) score += 60;
      if (tokens.length > 1 && tokens.every((t) => item.typeCompact.includes(t))) score += 50;
      if (tokens.length && item.typeNorm.startsWith(tokens[0])) score += 12;
      tokens.forEach((t) => {
        const inTypeWord = item.typeWords.some((w) => w.startsWith(t));
        const inVariantWord = item.variantWords.some((w) => w.startsWith(t));
        if (inTypeWord) score += 8;
        else if (item.typeCompact.includes(t)) score += 2;
        if (inVariantWord) score += 5;
      });
      scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((x) => x.item);
  }

  // ---------------------------------------------------------------- modal
  function openModal(html, onMount) {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-close></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    modalRoot.classList.add("open");
    modalRoot.setAttribute("aria-hidden", "false");
    modalRoot.querySelectorAll("[data-close]").forEach((n) => n.addEventListener("click", closeModal));
    if (onMount) onMount(modalRoot.querySelector(".sheet"));
    const first = modalRoot.querySelector("input, select, textarea");
    if (first) setTimeout(() => first.focus(), 60);
  }

  function closeModal() {
    modalRoot.classList.remove("open");
    modalRoot.setAttribute("aria-hidden", "true");
    modalRoot.innerHTML = "";
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // ---------------------------------------------------------------- render
  function setHeader(title, subtitle) {
    pageTitle.textContent = title;
    pageSubtitle.textContent = subtitle;
  }

  function render() {
    const p = project();
    if (p && envFilter && !p.environments.some((e) => e.id === envFilter)) envFilter = null;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));

    if (!p) {
      setHeader("Consumo Consciente", "Comece criando sua instalação");
      view.innerHTML = onboarding();
      bindOnboarding();
      return;
    }

    const t = totals(p);
    if (tab === "home") { setHeader("Resumo", p.name); view.innerHTML = homeView(p, t); }
    else if (tab === "environments") { setHeader("Ambientes", `${p.environments.length} cadastrados`); view.innerHTML = environmentsView(p, t); bindEnvironments(p); }
    else if (tab === "equipment") { setHeader("Aparelhos", `${p.equipments.length} cadastrados`); view.innerHTML = equipmentView(p, t); bindEquipment(p); }
    else if (tab === "simulate") { setHeader("Economize energia", "Ajuste o tempo de uso"); view.innerHTML = simulateView(p, t); bindSimulate(p); }
    else { setHeader("Ajustes", p.name); view.innerHTML = settingsView(p); bindSettings(p); }
  }

  function onboarding() {
    return `
      <div class="card hero center">
        <div class="empty">
          <div class="circle">${icon("bolt")}</div>
          <h2>Bem-vindo</h2>
          <p>Cadastre sua instalação para calcular o consumo e o custo dos seus aparelhos.</p>
        </div>
        <button class="btn primary block" id="createProject">Criar instalação</button>
        <p class="tiny muted" style="margin:12px 0 0">Funciona offline e não envia dados.</p>
      </div>`;
  }

  function bindOnboarding() {
    $("#createProject")?.addEventListener("click", () => projectModal(null));
  }

  function homeView(p, t) {
    if (!p.equipments.length) {
      return `
        <div class="card hero center">
          <div class="empty">
            <div class="circle">＋</div>
            <h2>Adicione seu primeiro aparelho</h2>
            <p>${p.environments.length
              ? "Escolha um equipamento na biblioteca e informe o tempo de uso."
              : "Crie um ambiente (quarto, sala, cozinha) e depois adicione os aparelhos."}</p>
          </div>
          <button class="btn primary block" id="firstAction">
            ${p.environments.length ? "Adicionar aparelho" : "Criar ambiente"}
          </button>
          ${p.environments.length ? '<p class="tiny muted" style="margin:12px 0 0">Biblioteca com 4.998 aparelhos.</p>' : ""}
        </div>`;
    }

    const cats = byCategory(p);
    const envs = byEnvironment(p);
    const top = [...p.equipments].sort((a, b) => monthlyKwh(b) - monthlyKwh(a)).slice(0, 5);
    const maxTop = monthlyKwh(top[0]) || 1;
    const total = cats.reduce((a, c) => a + c[1], 0) || 1;

    return `
      <div class="card hero">
        ${ring(cats, t)}
        <div class="legend" style="justify-content:center">
          ${cats.slice(0, 3).map(([c, v], i) => `
            <span class="legend-item"><i class="dot" style="background:${COLORS[i % COLORS.length]}"></i>${esc(c)} ${num1.format((v / total) * 100)}%</span>
          `).join("")}
        </div>
      </div>

      <div class="tiles">
        <div class="tile"><div class="icon">${icon("bolt")}</div><div class="value">${num2.format(t.kwh)} kWh</div><div class="label">Consumo mensal</div></div>
        <div class="tile"><div class="icon g">${icon("trending_up")}</div><div class="value">${num2.format(t.kwh / (p.days || 30))} kWh</div><div class="label">Média diária</div></div>
        <div class="tile"><div class="icon g">${icon("electrical_services")}</div><div class="value">${p.equipments.length}</div><div class="label">Aparelhos</div></div>
        <div class="tile"><div class="icon">${icon("payments")}</div><div class="value">${brl.format(t.cost / (p.days || 30))}</div><div class="label">Custo diário</div></div>
      </div>

      <div class="section-title"><span>Consumo por ambiente</span><button class="link-btn" data-goto="environments">Gerenciar ›</button></div>
      <div class="card">
        ${envs.length ? envs.slice(0, 6).map(({ env, kwh }, i) => `
          <div style="margin-bottom:14px">
            <div class="row spread"><span>${esc(env.name)}</span><span class="strong">${num2.format(kwh)} kWh</span></div>
            <div class="bar ${i === 0 ? "g" : ""}"><i style="width:${Math.max(2, (kwh / (envs[0].kwh || 1)) * 100)}%"></i></div>
          </div>`).join("") : '<p class="muted small">Nenhum ambiente.</p>'}
      </div>

      <div class="section-title"><span>Maiores consumidores</span><button class="link-btn" data-goto="equipment">Ver todos ›</button></div>
      <div class="list">
        ${top.map((eq) => `
          <div class="item">
            <div class="avatar g">${icon(iconFor(eq))}</div>
            <div class="grow">
              <div class="item-title ellipsis">${esc(eq.name)}</div>
              <div class="item-sub ellipsis">${esc(envName(p, eq.envId))}</div>
              <div class="bar"><i style="width:${Math.max(2, (monthlyKwh(eq) / maxTop) * 100)}%"></i></div>
            </div>
            <div class="item-end">${num2.format(monthlyKwh(eq))} kWh<br><span class="green">${brl.format(costOf(eq, p))}</span></div>
          </div>`).join("")}
      </div>

      <p class="tiny muted center" style="margin:4px 0 8px">Valores estimados; podem diferir da fatura real.</p>`;
  }

  function ring(cats, t) {
    const size = 200, r = 78, c = 2 * Math.PI * r;
    let offset = 0;
    const total = cats.reduce((a, x) => a + x[1], 0) || 1;
    const segs = cats.map(([_, v], i) => {
      const len = (v / total) * c;
      const seg = `<circle cx="100" cy="100" r="${r}" stroke="${COLORS[i % COLORS.length]}" stroke-width="20"
        stroke-dasharray="${Math.max(0, len - 3)} ${c - Math.max(0, len - 3)}" stroke-dashoffset="${-offset}"></circle>`;
      offset += len;
      return seg;
    }).join("");
    return `
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="${r}" stroke="rgba(255,255,255,.07)" stroke-width="20"></circle>
          ${segs}
        </svg>
        <div class="ring-center">
          <div>
            <div class="label">Custo mensal</div>
            <div class="value">${brl.format(t.cost)}</div>
            <div class="sub">${num2.format(t.kwh)} kWh</div>
          </div>
        </div>
      </div>`;
  }

  const envName = (p, id) => p.environments.find((e) => e.id === id)?.name || "Sem ambiente";

  function environmentsView(p) {
    if (!p.environments.length) {
      return `<div class="card center"><div class="empty"><div class="circle">${icon("meeting_room")}</div><h2>Nenhum ambiente</h2><p>Crie cômodos ou setores para organizar os aparelhos.</p></div>
        <button class="btn primary block" id="addEnv">Criar ambiente</button></div>`;
    }
    return `
      <div class="list">
        ${p.environments.map((env) => {
          const list = p.equipments.filter((e) => e.envId === env.id);
          const kwh = list.reduce((a, e) => a + monthlyKwh(e), 0);
          return `<div class="item">
            <div class="avatar">${icon(envIcon(env))}</div>
            <div class="grow clickable" data-env="${env.id}">
              <div class="item-title">${esc(env.name)}</div>
              <div class="item-sub">${list.length} aparelho${list.length === 1 ? "" : "s"} • ${num2.format(kwh)} kWh</div>
            </div>
            <div class="item-end green">${brl.format(kwh * p.tariff)}</div>
            <button class="icon-btn" data-add-env="${env.id}" aria-label="Adicionar aparelho">${icon("add")}</button>
            <button class="icon-btn" data-edit-env="${env.id}" aria-label="Editar">${icon("edit")}</button>
          </div>`;
        }).join("")}
      </div>
      <button class="btn primary block" id="addEnv">Novo ambiente</button>`;
  }

  function bindEnvironments(p) {
    $("#addEnv")?.addEventListener("click", () => environmentModal(p, null));
    view.querySelectorAll("[data-edit-env]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      environmentModal(p, p.environments.find((x) => x.id === b.dataset.editEnv));
    }));
    view.querySelectorAll("[data-add-env]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      catalogModal(p, b.dataset.addEnv);
    }));
    view.querySelectorAll("[data-env]").forEach((n) => n.addEventListener("click", () => {
      envFilter = n.dataset.env;
      tab = "equipment";
      render();
    }));
  }

  function equipmentView(p) {
    const filterEnv = envFilter ? p.environments.find((e) => e.id === envFilter) : null;
    const list = p.equipments.filter((eq) => !filterEnv || eq.envId === filterEnv.id);
    const sorted = [...list].sort((a, b) => monthlyKwh(b) - monthlyKwh(a));
    const filterChips = p.environments.length > 1
      ? `<div class="chips">
          <button class="chip ${filterEnv ? "" : "active"}" data-filter="">Todos</button>
          ${p.environments.map((e) => `<button class="chip ${filterEnv?.id === e.id ? "active" : ""}" data-filter="${e.id}">${esc(e.name)}</button>`).join("")}
        </div>`
      : "";
    const addLabel = filterEnv ? `Adicionar em ${esc(filterEnv.name)}` : "Adicionar aparelho";

    if (!sorted.length) {
      return `${filterChips}
        <div class="card center"><div class="empty"><div class="circle">${icon("electrical_services")}</div>
        <h2>${filterEnv ? "Nenhum aparelho neste ambiente" : "Nenhum aparelho"}</h2>
        <p>${filterEnv ? `Adicione o primeiro aparelho em ${esc(filterEnv.name)}.` : "Adicione aparelhos da biblioteca ou cadastre manualmente."}</p></div>
        <button class="btn primary block" id="addEq">${addLabel}</button></div>`;
    }
    return `${filterChips}
      <div class="list">
        ${sorted.map((eq) => `
          <div class="item">
            <div class="avatar g">${icon(iconFor(eq))}</div>
            <div class="grow" data-eq="${eq.id}">
              <div class="item-title ellipsis">${esc(eq.name)}</div>
              <div class="item-sub">${esc(envName(p, eq.envId))} • ${eq.qty}x • ${fmtDuration((eq.hours || 0) * 60)}/dia</div>
            </div>
            <div class="item-end">${num2.format(monthlyKwh(eq))} kWh<br><span class="green">${brl.format(costOf(eq, p))}</span></div>
          </div>`).join("")}
      </div>
      <button class="btn primary block" id="addEq">${addLabel}</button>`;
  }

  function iconFor(item) {
    const n = norm(item.name || item.type || "");
    if (n.includes("ar condicionado") || n.includes("split") || n.includes("climatiz")) return "ac_unit";
    if (n.includes("ventilador") || n.includes("exaustor")) return "air";
    if (n.includes("geladeira") || n.includes("freezer") || n.includes("frigobar")) return "kitchen";
    if (n.includes("micro") || n.includes("forno") || n.includes("fogao") || n.includes("air fryer")) return "local_fire_department";
    if (n.includes("lampada") || n.includes("ilumin") || n.includes("refletor")) return "lightbulb";
    if (n.includes("tv") || n.includes("televisor") || n.includes("monitor")) return "tv";
    if (n.includes("maquina de lavar") || n.includes("lava") || n.includes("secadora")) return "local_laundry_service";
    if (n.includes("chuveiro") || n.includes("torneira")) return "bathtub";
    if (n.includes("computador") || n.includes("notebook")) return "computer";
    if (n.includes("motor") || n.includes("bomba") || n.includes("compressor")) return "engineering";
    if (n.includes("cafeteira") || n.includes("chaleira")) return "coffee";
    if (n.includes("liquidificador") || n.includes("batedeira") || n.includes("panela")) return "restaurant";
    if (n.includes("roteador")) return "router";
    if (n.includes("impressora")) return "print";
    if (n.includes("caixa de som") || n.includes("som")) return "speaker";
    if (n.includes("videogame")) return "sports_esports";
    if (n.includes("carregador") || n.includes("wallbox")) return "power";
    if (n.includes("aspirador")) return "cleaning_services";
    if (n.includes("ferro")) return "checkroom";
    if (n.includes("umidificador") || n.includes("climatizador")) return "water_drop";
    if (n.includes("aquecedor") || n.includes("almofada")) return "thermostat";
    return "bolt";
  }

  function bindEquipment(p) {
    $("#addEq")?.addEventListener("click", () => catalogModal(p, envFilter));
    view.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
      envFilter = b.dataset.filter || null;
      render();
    }));
    view.querySelectorAll("[data-eq]").forEach((n) => n.addEventListener("click", () => {
      equipmentModal(p, p.equipments.find((x) => x.id === n.dataset.eq));
    }));
  }

  function simulateView(p, t) {
    if (!p.equipments.length) {
      return `<div class="card center"><div class="empty"><div class="circle">${icon("trending_up")}</div><h2>Nada para simular</h2><p>Adicione aparelhos para comparar cenários.</p></div></div>`;
    }
    const sim = p.equipments.map((eq) => ({
      ...eq,
      simMinutes: simOverrides.has(eq.id) ? simOverrides.get(eq.id) : baseMinutes(eq)
    }));
    const simKwh = sim.reduce((a, eq) => a + simKwhOf(eq, eq.simMinutes), 0);
    const simCost = simKwh * p.tariff;
    const saving = t.cost - simCost;
    const pct = t.cost > 0 ? (saving / t.cost) * 100 : 0;
    const positive = saving > 0.005;

    return `
      <div class="card hero">
        <div class="row spread">
          <div>
            <div class="tiny muted" id="simLabel">${positive ? "Economia potencial" : "Custo atual"}</div>
            <div class="strong" id="simAmount" style="font-size:26px;color:${positive ? "var(--green)" : "var(--text)"}">${brl.format(positive ? saving : t.cost)}</div>
            <div class="tiny muted" id="simSub">${positive ? `${num1.format(pct)}% menos consumo` : "por mês, com o uso atual"}</div>
          </div>
          <span class="chip ${positive ? "active" : ""}" id="simChip" ${positive ? "" : "hidden"}>−${num1.format(pct)}%</span>
        </div>
        <div style="margin-top:16px">
          <div class="row spread small"><span>Original</span><b id="simOriginal">${num2.format(t.kwh)} kWh</b></div>
          <div class="bar"><i style="width:100%;background:var(--red)"></i></div>
          <div class="row spread small" style="margin-top:10px"><span>Simulado</span><b id="simNow">${num2.format(simKwh)} kWh</b></div>
          <div class="bar g"><i id="simBar" style="width:${t.kwh > 0 ? Math.max(2, (simKwh / t.kwh) * 100) : 0}%"></i></div>
        </div>
      </div>

      <div class="section-title"><span>Ajustar por aparelho</span><button class="link-btn" id="resetSim">Restaurar</button></div>
      <div class="list" id="simList">
        ${sim.map((eq) => `
          <div class="item" style="display:block">
            <div class="row">
              <div class="avatar g">${icon(iconFor(eq))}</div>
              <div class="grow"><div class="item-title ellipsis">${esc(eq.name)}</div>
                <div class="item-sub">${eq.qty}x • ${num2.format(eq.powerW)} W</div></div>
              <div class="item-end green" data-sim-kwh="${eq.id}">${num2.format(simKwhOf(eq, eq.simMinutes))} kWh</div>
            </div>
            <div class="row" style="margin-top:10px">
              <span class="tiny muted" style="width:82px">Minutos/dia</span>
              <input type="number" min="0" max="1440" step="0.1" value="${eq.simMinutes.toFixed(1)}"
                     data-sim="${eq.id}" style="flex:1;background:#101013;border:1px solid var(--line);border-radius:10px;padding:9px">
              <span class="tiny muted" style="width:76px;text-align:right" data-sim-label="${eq.id}">${fmtDuration(eq.simMinutes)}</span>
            </div>
          </div>`).join("")}
      </div>`;
  }

  function bindSimulate(p) {
    view.querySelectorAll("[data-sim]").forEach((input) => input.addEventListener("input", () => {
      const id = input.dataset.sim;
      const eq = p.equipments.find((x) => x.id === id);
      if (!eq) return;
      const minutes = Math.max(0, Math.min(1440, parseFloat(input.value) || 0));
      simOverrides.set(id, minutes);

      const total = totals(p);
      const simKwh = p.equipments.reduce((acc, item) => {
        const value = simOverrides.has(item.id) ? simOverrides.get(item.id) : baseMinutes(item);
        return acc + simKwhOf(item, value);
      }, 0);
      const simCost = simKwh * p.tariff;
      const saving = total.cost - simCost;
      const pct = total.cost > 0 ? (saving / total.cost) * 100 : 0;
      const positive = saving > 0.005;

      const label = document.getElementById("simLabel");
      const amount = document.getElementById("simAmount");
      const sub = document.getElementById("simSub");
      const chip = document.getElementById("simChip");
      const now = document.getElementById("simNow");
      const bar = document.getElementById("simBar");

      if (label) label.textContent = positive ? "Economia potencial" : "Custo atual";
      if (amount) {
        amount.textContent = brl.format(positive ? saving : total.cost);
        amount.style.color = positive ? "var(--green)" : "var(--text)";
      }
      if (sub) sub.textContent = positive ? `${num1.format(pct)}% menos consumo` : "por mês, com o uso atual";
      if (chip) {
        chip.hidden = !positive;
        chip.textContent = `−${num1.format(pct)}%`;
      }
      if (now) now.textContent = `${num2.format(simKwh)} kWh`;
      if (bar) bar.style.width = `${total.kwh > 0 ? Math.max(2, (simKwh / total.kwh) * 100) : 0}%`;

      const rowKwh = document.querySelector(`[data-sim-kwh="${id}"]`);
      if (rowKwh) rowKwh.textContent = `${num2.format(simKwhOf(eq, minutes))} kWh`;
      const rowLabel = document.querySelector(`[data-sim-label="${id}"]`);
      if (rowLabel) rowLabel.textContent = fmtDuration(minutes);
    }));

    $("#resetSim")?.addEventListener("click", () => {
      simOverrides.clear();
      render();
      toast("Cenário restaurado.");
    });
  }

  function settingsView(p) {
    return `
      <div class="card">
        <div class="row">
          <div class="avatar">${icon(typeIcon(p.type))}</div>
          <div class="grow"><div class="item-title">${esc(p.name)}</div><div class="item-sub">${typeLabel(p.type)}</div></div>
          <button class="btn sm ghost" id="editProject">Editar</button>
        </div>
        <div class="row spread" style="margin-top:14px">
          <div><div class="tiny muted">Tarifa</div><div class="strong">${brl.format(p.tariff)}/kWh</div></div>
          <div><div class="tiny muted">Dias/mês</div><div class="strong">${p.days}</div></div>
          <div><div class="tiny muted">Estado</div><div class="strong">${p.state || "—"}</div></div>
        </div>
        ${p.utility ? `<p class="tiny muted" style="margin:10px 0 0">${esc(p.utility)}</p>` : ""}
      </div>

      <div class="section-title"><span>Relatório</span></div>
      <div class="list">
        <button class="item" id="copySummary"><div class="avatar">${icon("content_copy")}</div><div class="grow" style="text-align:left"><div class="item-title">Copiar resumo</div><div class="item-sub">Texto com emojis para WhatsApp</div></div><span class="chev">›</span></button>
        <button class="item" id="printPdf"><div class="avatar">${icon("picture_as_pdf")}</div><div class="grow" style="text-align:left"><div class="item-title">Salvar em PDF</div><div class="item-sub">Abre a impressão do navegador</div></div><span class="chev">›</span></button>
        <button class="item" id="exportCsv"><div class="avatar">${icon("description")}</div><div class="grow" style="text-align:left"><div class="item-title">Exportar CSV</div><div class="item-sub">Planilha com todos os aparelhos</div></div><span class="chev">›</span></button>
      </div>

      ${isStandalone() ? "" : `
      <div class="section-title"><span>Aplicativo</span></div>
      <div class="list">
        <button class="item" id="installApp"><div class="avatar">${icon("download")}</div><div class="grow" style="text-align:left"><div class="item-title">Instalar aplicativo</div><div class="item-sub">Adicionar à tela inicial e usar offline</div></div><span class="chev">›</span></button>
      </div>`}

      <div class="section-title"><span>Dados</span></div>
      <div class="list">
        <button class="item" id="switchProject"><div class="avatar">${icon("refresh")}</div><div class="grow" style="text-align:left"><div class="item-title">Trocar de instalação</div><div class="item-sub">${state.projects.length} cadastrada(s)</div></div><span class="chev">›</span></button>
        <button class="item" id="wipe"><div class="avatar" style="background:rgba(255,92,92,.12);color:var(--red)">${icon("delete")}</div><div class="grow" style="text-align:left"><div class="item-title">Apagar dados</div><div class="item-sub">Remove instalações deste navegador</div></div><span class="chev">›</span></button>
      </div>
      <p class="tiny muted center" style="margin:8px 0">Consumo Consciente • versão web • funciona offline</p>`;
  }

  const typeLabel = (t) => (TYPES.find(([k]) => k === t)?.[1]) || t;
  const typeIcon = (t) => t === "INDUSTRIAL" ? "factory" : t === "COMMERCIAL" ? "storefront"
    : t === "RURAL" ? "agriculture" : t === "CONSTRUCTION" ? "construction" : "home";

  function bindSettings(p) {
    $("#editProject")?.addEventListener("click", () => projectModal(p));
    $("#copySummary")?.addEventListener("click", () => copySummary(p));
    $("#printPdf")?.addEventListener("click", () => printReport(p));
    $("#exportCsv")?.addEventListener("click", () => exportCsv(p));
    $("#switchProject")?.addEventListener("click", () => projectsModal());
    $("#installApp")?.addEventListener("click", promptInstall);
    $("#wipe")?.addEventListener("click", () => {
      if (confirm("Apagar todas as instalações deste navegador?")) {
        state = { projects: [], currentId: null };
        save();
        render();
      }
    });
  }

  // ---------------------------------------------------------------- modais
  function projectModal(existing) {
    const p = existing || { name: "", type: "RESIDENTIAL", tariff: 0.75, days: 30, state: "", utility: "" };
    openModal(`
      <h2>${existing ? "Editar instalação" : "Nova instalação"}</h2>
      <p class="sub">Esses dados são usados em todos os cálculos.</p>
      <div class="field" style="margin-bottom:12px"><label>Nome</label><input id="pName" value="${esc(p.name)}" placeholder="Casa, loja, fábrica…"></div>
      <div class="field" style="margin-bottom:12px"><label>Tipo</label>
        <select id="pType">${TYPES.map(([k, v]) => `<option value="${k}" ${p.type === k ? "selected" : ""}>${v}</option>`).join("")}</select>
      </div>
      <div class="grid2" style="margin-bottom:12px">
        <div class="field"><label>Tarifa (R$/kWh)</label><input id="pTariff" type="number" step="0.01" value="${p.tariff}"></div>
        <div class="field"><label>Dias no mês</label><input id="pDays" type="number" min="1" max="31" value="${p.days}"></div>
      </div>
      <div class="grid2" style="margin-bottom:12px">
        <div class="field"><label>Estado</label>
          <select id="pState"><option value="">—</option>${Object.keys(UF).map((s) => `<option value="${s}" ${p.state === s ? "selected" : ""}>${UF_NAMES[s]}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Concessionária</label><input id="pUtility" value="${esc(p.utility || "")}" placeholder="Opcional" list="utilityList"><datalist id="utilityList"></datalist></div>
      </div>
      <div class="sheet-actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="saveProject">Salvar</button></div>
    `, (sheet) => {
      const stateSel = sheet.querySelector("#pState");
      const util = sheet.querySelector("#pUtility");
      const list = sheet.querySelector("#utilityList");
      const sync = () => { list.innerHTML = (UF[stateSel.value] || []).map((u) => `<option value="${u}">`).join(""); };
      stateSel.addEventListener("change", sync);
      sync();
      sheet.querySelector("#saveProject").addEventListener("click", () => {
        const name = sheet.querySelector("#pName").value.trim() || "Minha instalação";
        const tariff = parseFloat(sheet.querySelector("#pTariff").value) || 0;
        const days = Math.min(31, Math.max(1, parseInt(sheet.querySelector("#pDays").value) || 30));
        const data = {
          name, tariff, days,
          type: sheet.querySelector("#pType").value,
          state: stateSel.value,
          utility: util.value.trim()
        };
        if (existing) Object.assign(existing, data);
        else newProject(data);
        save();
        closeModal();
        render();
      });
    });
  }

  function projectsModal() {
    openModal(`
      <h2>Instalações</h2>
      <p class="sub">Escolha ou crie uma nova.</p>
      <div class="list">
        ${state.projects.map((p) => `
          <button class="item" data-pick="${p.id}">
            <div class="avatar">${icon(typeIcon(p.type))}</div>
            <div class="grow" style="text-align:left"><div class="item-title">${esc(p.name)}</div><div class="item-sub">${typeLabel(p.type)} • ${p.equipments.length} aparelhos</div></div>
            ${p.id === state.currentId ? '<span class="chip active">Atual</span>' : ""}
          </button>`).join("")}
      </div>
      <div class="sheet-actions"><button class="btn ghost" data-close>Fechar</button><button class="btn primary" id="newProjectBtn">Nova instalação</button></div>
    `, (sheet) => {
      sheet.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
        state.currentId = b.dataset.pick;
        envFilter = null;
        simOverrides.clear();
        save();
        closeModal();
        render();
      }));
      sheet.querySelector("#newProjectBtn").addEventListener("click", () => projectModal(null));
    });
  }

  function environmentModal(p, existing) {
    const env = existing || { name: "", icon: "meeting_room" };
    const currentIcon = envIcon(env);
    openModal(`
      <h2>${existing ? "Editar ambiente" : "Novo ambiente"}</h2>
      <p class="sub">Cômodo ou setor da instalação.</p>
      <div class="field" style="margin-bottom:12px"><label>Nome</label><input id="eName" value="${esc(env.name)}" placeholder="Quarto 01"></div>
      <label class="tiny muted">Ícone</label>
      <div class="chips" id="iconRow" style="margin:8px 0 16px">
        ${ENV_ICONS.map((name) => `<button class="chip ${name === currentIcon ? "active" : ""}" data-icon="${name}" aria-label="${name}">${icon(name)}</button>`).join("")}
      </div>
      <div class="sheet-actions">
        ${existing ? '<button class="btn danger" id="delEnv">Excluir</button>' : ""}
        <button class="btn primary" id="saveEnv">Salvar</button>
      </div>
    `, (sheet) => {
      let selectedIcon = currentIcon;
      sheet.querySelectorAll("[data-icon]").forEach((b) => b.addEventListener("click", () => {
        selectedIcon = b.dataset.icon;
        sheet.querySelectorAll("[data-icon]").forEach((x) => x.classList.toggle("active", x === b));
      }));
      sheet.querySelector("#saveEnv").addEventListener("click", () => {
        const name = sheet.querySelector("#eName").value.trim();
        if (!name) return;
        if (existing) Object.assign(existing, { name, icon: selectedIcon });
        else p.environments.push({ id: uid(), name, icon: selectedIcon });
        save(); closeModal(); render();
      });
      sheet.querySelector("#delEnv")?.addEventListener("click", () => {
        if (!confirm(`Excluir "${existing.name}" e seus aparelhos?`)) return;
        p.environments = p.environments.filter((e) => e.id !== existing.id);
        p.equipments = p.equipments.filter((e) => e.envId !== existing.id);
        save(); closeModal(); render();
      });
    });
  }

  function catalogModal(p, defaultEnvId = null) {
    openModal(`
      <h2>Adicionar aparelho</h2>
      <p class="sub">${catalogError ? "Biblioteca indisponível offline. Cadastre manualmente." : "Busque na biblioteca (4.998 itens)."}</p>
      <div class="search-row"><input id="q" placeholder="Nome, tipo ou potência…" style="width:100%;background:#101013;border:1px solid var(--line);border-radius:12px;padding:12px"></div>
      <div class="results" id="results"></div>
      <div class="sheet-actions">
        <button class="btn ghost" data-close>Cancelar</button>
        <button class="btn" id="manual">Cadastrar manual</button>
      </div>
    `, (sheet) => {
      const results = sheet.querySelector("#results");
      const q = sheet.querySelector("#q");
      let timer;
      const paint = () => {
        const items = searchCatalog(q.value, 50);
        results.innerHTML = items.length ? items.map((item, i) => `
          <button class="result" data-i="${catalog.indexOf(item)}">
            <div class="avatar">${icon(iconFor(item))}</div>
            <div class="grow"><b class="ellipsis">${esc(item.type)}</b><small>${esc(item.variant || item.category)} • ${num2.format(item.power)} W</small></div>
          </button>`).join("") : '<p class="muted small center" style="padding:20px">Nenhum resultado.</p>';
        results.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
          const chosen = catalog[parseInt(b.dataset.i, 10)];
          closeModal();
          equipmentModal(p, null, chosen, defaultEnvId);
        }));
      };
      q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(paint, 120); });
      paint();
      sheet.querySelector("#manual").addEventListener("click", () => { closeModal(); equipmentModal(p, null, null, defaultEnvId); });
    });
  }

  function equipmentModal(p, existing, fromCatalog, defaultEnvId = null) {
    const base = existing || (fromCatalog ? {
      name: fromCatalog.name, category: fromCatalog.category, powerW: fromCatalog.power || 100,
      qty: 1, hours: fromCatalog.hours || 1, days: fromCatalog.days || p.days,
      factor: fromCatalog.factor ?? 1, monthlyKwh: null
    } : { name: "", category: "Outros", powerW: 100, qty: 1, hours: 8, days: p.days, factor: 1, monthlyKwh: null });
    const preselectedEnv = existing?.envId || defaultEnvId || p.environments[0]?.id;
    const envOptions = p.environments
      .map((e) => `<option value="${e.id}" ${preselectedEnv === e.id ? "selected" : ""}>${esc(e.name)}</option>`)
      .join("");
    const hasWeekly = Array.isArray(base.weeklyMinutes) && base.weeklyMinutes.length === 7;
    const weekLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const dailyMinutes = ((base.hours || 0) * 60).toFixed(1);
    const weeklyRows = weekLabels.map((label, index) => {
      const value = hasWeekly ? base.weeklyMinutes[index] : dailyMinutes;
      return `<div class="row" style="margin-bottom:6px">
        <span class="tiny muted" style="width:34px">${label}</span>
        <input class="wk" data-i="${index}" type="number" min="0" max="1440" step="0.1" value="${value}"
          style="flex:1;background:#101013;border:1px solid var(--line);border-radius:10px;padding:8px">
        <span class="tiny muted" style="width:70px;text-align:right" data-wk-label="${index}">${fmtDuration(Number(value))}</span>
      </div>`;
    }).join("");

    openModal(`
      <h2>${existing ? "Editar aparelho" : "Novo aparelho"}</h2>
      <p class="sub">${fromCatalog?.estimated ? "Potência estimada: confirme na etiqueta." : "Informe os dados de uso."}</p>
      <div class="field" style="margin-bottom:10px"><label>Nome</label><input id="eqName" value="${esc(base.name)}" placeholder="Ar-condicionado"></div>
      <div class="grid2" style="margin-bottom:10px">
        <div class="field"><label>Categoria</label><input id="eqCat" value="${esc(base.category)}"></div>
        <div class="field"><label>Ambiente</label><select id="eqEnv">${envOptions || '<option value="">Crie um ambiente</option>'}</select></div>
      </div>
      <div class="grid2" style="margin-bottom:10px">
        <div class="field"><label>Potência (W)</label><input id="eqPower" type="number" step="1" value="${base.powerW}"></div>
        <div class="field"><label>Quantidade</label><input id="eqQty" type="number" min="1" value="${base.qty}"></div>
      </div>
      <div class="grid2" style="margin-bottom:10px">
        <div class="field"><label>Minutos por dia</label><input id="eqMinutes" type="number" min="0" max="1440" step="0.1" value="${dailyMinutes}" ${hasWeekly ? "disabled" : ""}></div>
        <div class="field"><label>Dias no mês</label><input id="eqDays" type="number" min="1" max="31" value="${base.days}"></div>
      </div>

      <label class="row spread" style="margin:4px 0 8px">
        <span>
          <span class="item-title" style="font-size:14px">Rotina por dia da semana</span>
          <span class="item-sub" style="display:block">Ex.: 3h na terça, 4h no domingo, 0h no sábado.</span>
        </span>
        <input id="eqWeekly" type="checkbox" ${hasWeekly ? "checked" : ""} style="width:20px;height:20px">
      </label>
      <div id="weeklyBox" ${hasWeekly ? "" : "hidden"} style="margin-bottom:10px">${weeklyRows}</div>

      <div class="field" style="margin-bottom:6px"><label>Fator médio de uso (0–1)</label><input id="eqFactor" type="number" min="0" max="1" step="0.05" value="${base.factor}" ${hasWeekly ? "disabled" : ""}></div>
      <p class="hint" id="eqPreview"></p>
      <div class="sheet-actions">
        ${existing ? '<button class="btn danger" id="delEq">Excluir</button>' : ""}
        <button class="btn primary" id="saveEq">Salvar</button>
      </div>
    `, (sheet) => {
      const preview = sheet.querySelector("#eqPreview");
      const weeklyToggle = sheet.querySelector("#eqWeekly");
      const weeklyBox = sheet.querySelector("#weeklyBox");
      const dailyInput = sheet.querySelector("#eqMinutes");
      const factorInput = sheet.querySelector("#eqFactor");

      const weeklyValues = () => [...sheet.querySelectorAll(".wk")].map((i) => Math.max(0, Math.min(1440, parseFloat(i.value) || 0)));

      const refresh = () => {
        const power = parseFloat(sheet.querySelector("#eqPower").value) || 0;
        const qty = Math.max(1, parseInt(sheet.querySelector("#eqQty").value) || 1);
        const days = parseInt(sheet.querySelector("#eqDays").value) || 30;
        let kwh;
        if (weeklyToggle.checked) {
          const total = weeklyValues().reduce((a, b) => a + b, 0);
          kwh = (power / 1000) * (total / 60) * (days / 7) * qty;
          preview.textContent = `${num2.format(kwh)} kWh/mês • ${brl.format(kwh * p.tariff)} • ${fmtDuration(total)}/semana`;
        } else {
          const minutes = parseFloat(dailyInput.value) || 0;
          const factor = Math.min(1, Math.max(0, parseFloat(factorInput.value) || 1));
          kwh = (power / 1000) * qty * (minutes / 60) * days * factor;
          preview.textContent = `${num2.format(kwh)} kWh/mês • ${brl.format(kwh * p.tariff)} • ${fmtDuration(minutes)}/dia`;
        }
        sheet.querySelectorAll(".wk").forEach((input, index) => {
          const label = sheet.querySelector(`[data-wk-label="${index}"]`);
          if (label) label.textContent = fmtDuration(parseFloat(input.value) || 0);
        });
      };

      weeklyToggle.addEventListener("change", () => {
        weeklyBox.hidden = !weeklyToggle.checked;
        dailyInput.disabled = weeklyToggle.checked;
        factorInput.disabled = weeklyToggle.checked;
        refresh();
      });

      sheet.querySelectorAll("input").forEach((i) => i.addEventListener("input", refresh));
      refresh();

      sheet.querySelector("#saveEq").addEventListener("click", () => {
        const envId = sheet.querySelector("#eqEnv").value || p.environments[0]?.id;
        if (!envId) { toast("Crie um ambiente primeiro."); return; }
        const weekly = weeklyToggle.checked ? weeklyValues() : null;
        const weeklyTotal = weekly ? weekly.reduce((a, b) => a + b, 0) : 0;
        const data = {
          name: sheet.querySelector("#eqName").value.trim() || "Aparelho",
          category: sheet.querySelector("#eqCat").value.trim() || "Outros",
          envId,
          powerW: parseFloat(sheet.querySelector("#eqPower").value) || 0,
          qty: Math.max(1, parseInt(sheet.querySelector("#eqQty").value) || 1),
          hours: weekly ? (weeklyTotal / 7 / 60) : ((parseFloat(dailyInput.value) || 0) / 60),
          days: Math.min(31, Math.max(1, parseInt(sheet.querySelector("#eqDays").value) || 30)),
          factor: Math.min(1, Math.max(0, parseFloat(sheet.querySelector("#eqFactor").value) || 1)),
          monthlyKwh: null,
          weeklyMinutes: weekly
        };
        if (!weekly) delete data.weeklyMinutes;
        if (existing) Object.assign(existing, data);
        else p.equipments.push({ id: uid(), ...data });
        simOverrides.delete(existing?.id);
        save(); closeModal(); render();
      });
      sheet.querySelector("#delEq")?.addEventListener("click", () => {
        if (!confirm(`Excluir "${existing.name}"?`)) return;
        p.equipments = p.equipments.filter((e) => e.id !== existing.id);
        simOverrides.delete(existing.id);
        save(); closeModal(); render();
      });
    });
  }

  // ---------------------------------------------------------------- exportacao
  function summaryText(p) {
    const t = totals(p);
    const envs = byEnvironment(p);
    const top = [...p.equipments].sort((a, b) => monthlyKwh(b) - monthlyKwh(a)).slice(0, 10);
    const lines = [];
    lines.push("⚡ *RELATÓRIO CONSUMO CONSCIENTE*");
    lines.push("");
    lines.push(`🏠 Projeto: ${p.name}`);
    lines.push(`🏷️ Tipo: ${typeLabel(p.type)}`);
    lines.push(`📅 Dias no mês: ${p.days}`);
    if (p.utility) lines.push(`🏢 Concessionária: ${p.utility}`);
    if (p.state) lines.push(`📍 Estado: ${UF_NAMES[p.state] || p.state}`);
    lines.push(`💡 Tarifa: ${brl.format(p.tariff)}/kWh`);
    lines.push("");
    lines.push("📊 *Resumo*");
    lines.push(`⚡ Consumo total: ${num2.format(t.kwh)} kWh`);
    lines.push(`💰 Custo estimado: ${brl.format(t.cost)}`);
    lines.push("");
    if (envs.length) {
      lines.push("🛋️ *Consumo por ambiente*");
      envs.forEach(({ env, kwh }, i) => lines.push(`${i + 1}. ${env.name} — ${num2.format(kwh)} kWh • ${brl.format(kwh * p.tariff)}`));
      lines.push("");
    }
    if (top.length) {
      lines.push("🔌 *Maiores consumidores*");
      top.forEach((eq, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
        lines.push(`${medal} ${eq.name} (${envName(p, eq.envId)}) — ${num2.format(monthlyKwh(eq))} kWh • ${brl.format(costOf(eq, p))}`);
      });
      lines.push("");
    }
    lines.push("⚠️ Valores estimados; podem diferir da fatura real.");
    lines.push("📱 Gerado no Consumo Consciente (web)");
    return lines.join("\n");
  }

  async function copySummary(p) {
    const text = summaryText(p);
    try {
      await navigator.clipboard.writeText(text);
      toast("Resumo copiado.");
    } catch (e) {
      openModal(`<h2>Resumo</h2><p class="sub">Selecione e copie o texto.</p><textarea rows="12" style="width:100%;background:#101013;border:1px solid var(--line);border-radius:12px;padding:12px">${esc(text)}</textarea><div class="sheet-actions"><button class="btn primary" data-close>Fechar</button></div>`);
    }
  }

  function exportCsv(p) {
    const rows = [["Equipamento", "Ambiente", "Categoria", "W", "Qtd", "Horas/dia", "Dias", "Fator", "kWh", "Custo"]];
    p.equipments.forEach((eq) => rows.push([
      eq.name, envName(p, eq.envId), eq.category, eq.powerW, eq.qty,
      (eq.hours || 0).toFixed(2), eq.days, eq.factor,
      monthlyKwh(eq).toFixed(3), costOf(eq, p).toFixed(2)
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `consumo-consciente-${p.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printReport(p) {
    const t = totals(p);
    const envs = byEnvironment(p);
    const maxEnv = envs[0]?.kwh || 1;
    const top = [...p.equipments].sort((a, b) => monthlyKwh(b) - monthlyKwh(a));
    const date = new Date().toLocaleString("pt-BR");
    $("#printArea").innerHTML = `
      <div class="p-band">
        <div class="p-mark">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z"/></svg>
        </div>
        <div>
          <h1>Consumo Consciente</h1>
          <p>Relatório de consumo de energia</p>
        </div>
        <div class="p-date">Gerado em<br>${date}</div>
      </div>

      <div class="p-project">PROJETO<b>${esc(p.name)}</b></div>
      <div class="p-sub">${typeLabel(p.type)} • ${p.days} dias/mês${p.utility ? ` • ${esc(p.utility)}` : ""}${p.state ? ` • ${UF_NAMES[p.state] || p.state}` : ""}</div>

      <div class="p-kpi">
        <div><span>CUSTO MENSAL</span><b>${brl.format(t.cost)}</b></div>
        <div><span>CONSUMO MENSAL</span><b>${num2.format(t.kwh)} kWh</b></div>
        <div><span>TARIFA</span><b>${brl.format(p.tariff)}/kWh</b></div>
      </div>

      <h3>Consumo por ambiente</h3>
      <table><thead><tr><th>Ambiente</th><th>Participação</th><th class="num">kWh</th><th class="num">Custo</th></tr></thead><tbody>
        ${envs.map(({ env, kwh }) => `<tr>
          <td>${esc(env.name)}</td>
          <td><div class="p-bar"><i style="width:${Math.max(2, (kwh / maxEnv) * 100)}%"></i></div></td>
          <td class="num">${num2.format(kwh)}</td>
          <td class="num">${brl.format(kwh * p.tariff)}</td>
        </tr>`).join("")}
      </tbody></table>

      <h3>Aparelhos</h3>
      <table><thead><tr><th>Aparelho</th><th>Ambiente</th><th class="num">W</th><th class="num">Horas/dia</th><th class="num">kWh</th><th class="num">Custo</th></tr></thead><tbody>
        ${top.map((eq) => `<tr>
          <td>${esc(eq.name)}</td>
          <td>${esc(envName(p, eq.envId))}</td>
          <td class="num">${num2.format(eq.powerW)}</td>
          <td class="num">${num1.format((eq.hours || 0))}</td>
          <td class="num">${num2.format(monthlyKwh(eq))}</td>
          <td class="num">${brl.format(costOf(eq, p))}</td>
        </tr>`).join("")}
      </tbody></table>

      <p class="p-note">Valores estimados a partir dos dados informados. Confirme a potência na etiqueta do aparelho.
      Bandeiras tarifárias, impostos e consumo real variam por distribuidora.</p>`;
    window.print();
  }

  // ---------------------------------------------------------------- init
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    render();
    window.scrollTo({ top: 0 });
  }));

  view.addEventListener("click", (e) => {
    const goto = e.target.closest("[data-goto]");
    if (goto) { tab = goto.dataset.goto; render(); return; }
    if (e.target.id === "firstAction") {
      const p = project();
      if (!p) return;
      if (p.environments.length) catalogModal(p, envFilter || p.environments[0]?.id);
      else environmentModal(p, null);
    }
  });

  window.addEventListener("scroll", () => {
    document.querySelector(".topbar")?.classList.toggle("scrolled", window.scrollY > 8);
  }, { passive: true });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
    showInstallBanner();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installBtn.hidden = true;
    document.querySelector(".install-banner")?.remove();
    toast("Aplicativo instalado.");
  });

  function isStandalone() {
    return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function showInstallBanner() {
    if (isStandalone() || document.querySelector(".install-banner")) return;
    const banner = document.createElement("div");
    banner.className = "install-banner";
    banner.innerHTML = `
      <div class="text"><b>Instalar aplicativo</b><small>Fica na tela inicial e abre offline.</small></div>
      <button class="btn primary" id="bannerInstall">Instalar</button>
      <button class="icon-btn" id="bannerClose" aria-label="Fechar">${icon("arrow_back")}</button>`;
    document.body.appendChild(banner);
    banner.querySelector("#bannerInstall").addEventListener("click", promptInstall);
    banner.querySelector("#bannerClose").addEventListener("click", () => banner.remove());
  }

  async function promptInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice.outcome === "accepted") {
        installBtn.hidden = true;
        document.querySelector(".install-banner")?.remove();
        toast("Instalando aplicativo…");
      }
      return;
    }
    if (isStandalone()) {
      toast("O aplicativo já está instalado.");
      return;
    }
    openModal(`
      <h2>Instalar aplicativo</h2>
      <p class="sub">O navegador atual não mostrou a instalação automática.</p>
      <p class="small muted">No Android, use o menu ⋮ do Chrome e toque em <b>Instalar aplicativo</b>.
      No iPhone, toque em Compartilhar → <b>Adicionar à Tela de Início</b>.</p>
      <div class="sheet-actions"><button class="btn primary" data-close>Entendi</button></div>`);
  }

  installBtn.addEventListener("click", promptInstall);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
    });
  }

  if (new URLSearchParams(location.search).get("install") === "1") {
    showInstallBanner();
  }

  if (isStandalone()) installBtn.hidden = true;

  render();
  loadCatalog();
})();
