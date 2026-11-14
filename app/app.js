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
  let deferredPrompt = null;

  // ---------------------------------------------------------------- util
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

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
    const hours = eq.hours || 0;
    return (eq.powerW / 1000) * (eq.qty || 1) * hours * (eq.days || 30) * (eq.factor ?? 1);
  }
  const costOf = (eq, p) => monthlyKwh(eq) * (p?.tariff || 0);

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
          compact: norm(`${type} ${variant} ${category}`).replace(/ /g, "")
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
    const out = [];
    for (const item of catalog) {
      if (item.search.includes(q) || item.compact.includes(compact)) {
        out.push(item);
        if (out.length >= limit) break;
      }
    }
    return out;
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
          <div class="circle">⚡</div>
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
        <div class="tile"><div class="icon">⚡</div><div class="value">${num2.format(t.kwh)} kWh</div><div class="label">Consumo mensal</div></div>
        <div class="tile"><div class="icon g">📈</div><div class="value">${num2.format(t.kwh / (p.days || 30))} kWh</div><div class="label">Média diária</div></div>
        <div class="tile"><div class="icon g">🔌</div><div class="value">${p.equipments.length}</div><div class="label">Aparelhos</div></div>
        <div class="tile"><div class="icon">💰</div><div class="value">${brl.format(t.cost / (p.days || 30))}</div><div class="label">Custo diário</div></div>
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
            <div class="avatar g">🔌</div>
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
      return `<div class="card center"><div class="empty"><div class="circle">🏠</div><h2>Nenhum ambiente</h2><p>Crie cômodos ou setores para organizar os aparelhos.</p></div>
        <button class="btn primary block" id="addEnv">Criar ambiente</button></div>`;
    }
    return `
      <div class="list">
        ${p.environments.map((env) => {
          const list = p.equipments.filter((e) => e.envId === env.id);
          const kwh = list.reduce((a, e) => a + monthlyKwh(e), 0);
          return `<div class="item">
            <div class="avatar">${env.icon || "🏠"}</div>
            <div class="grow clickable" data-env="${env.id}">
              <div class="item-title">${esc(env.name)}</div>
              <div class="item-sub">${list.length} aparelho${list.length === 1 ? "" : "s"} • ${num2.format(kwh)} kWh</div>
            </div>
            <div class="item-end green">${brl.format(kwh * p.tariff)}</div>
            <button class="icon-btn" data-edit-env="${env.id}" aria-label="Editar">✎</button>
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
    view.querySelectorAll("[data-env]").forEach((n) => n.addEventListener("click", () => {
      tab = "equipment";
      render();
    }));
  }

  function equipmentView(p) {
    if (!p.equipments.length) {
      return `<div class="card center"><div class="empty"><div class="circle">🔌</div><h2>Nenhum aparelho</h2><p>Adicione aparelhos da biblioteca ou cadastre manualmente.</p></div>
        <button class="btn primary block" id="addEq">Adicionar aparelho</button></div>`;
    }
    const sorted = [...p.equipments].sort((a, b) => monthlyKwh(b) - monthlyKwh(a));
    return `
      <div class="list">
        ${sorted.map((eq) => `
          <div class="item">
            <div class="avatar g">${iconFor(eq)}</div>
            <div class="grow" data-eq="${eq.id}">
              <div class="item-title ellipsis">${esc(eq.name)}</div>
              <div class="item-sub">${esc(envName(p, eq.envId))} • ${eq.qty}x • ${fmtDuration((eq.hours || 0) * 60)}/dia</div>
            </div>
            <div class="item-end">${num2.format(monthlyKwh(eq))} kWh<br><span class="green">${brl.format(costOf(eq, p))}</span></div>
          </div>`).join("")}
      </div>
      <button class="btn primary block" id="addEq">Adicionar aparelho</button>`;
  }

  function iconFor(eq) {
    const n = norm(eq.name);
    if (n.includes("ar condicionado") || n.includes("climatiz")) return "❄️";
    if (n.includes("geladeira") || n.includes("freezer")) return "🧊";
    if (n.includes("micro") || n.includes("forno") || n.includes("fogao")) return "🔥";
    if (n.includes("lampada") || n.includes("ilumin")) return "💡";
    if (n.includes("tv") || n.includes("televisor") || n.includes("monitor")) return "📺";
    if (n.includes("ventilador")) return "🌀";
    if (n.includes("maquina de lavar") || n.includes("lava")) return "🧺";
    if (n.includes("chuveiro")) return "🚿";
    if (n.includes("computador") || n.includes("notebook")) return "💻";
    if (n.includes("motor") || n.includes("bomba")) return "⚙️";
    return "🔌";
  }

  function bindEquipment(p) {
    $("#addEq")?.addEventListener("click", () => catalogModal(p));
    view.querySelectorAll("[data-eq]").forEach((n) => n.addEventListener("click", () => {
      equipmentModal(p, p.equipments.find((x) => x.id === n.dataset.eq));
    }));
  }

  function simulateView(p, t) {
    if (!p.equipments.length) {
      return `<div class="card center"><div class="empty"><div class="circle">📊</div><h2>Nada para simular</h2><p>Adicione aparelhos para comparar cenários.</p></div></div>`;
    }
    const sim = p.equipments.map((eq) => ({ ...eq, simHours: eq.hours || 0 }));
    const simKwh = sim.reduce((a, eq) => a + monthlyKwh(eq), 0);
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
              <div class="avatar g">${iconFor(eq)}</div>
              <div class="grow"><div class="item-title ellipsis">${esc(eq.name)}</div>
                <div class="item-sub">${eq.qty}x • ${num2.format(eq.powerW)} W</div></div>
              <div class="item-end green">${num2.format(monthlyKwh(eq))} kWh</div>
            </div>
            <div class="row" style="margin-top:10px">
              <span class="tiny muted" style="width:82px">Minutos/dia</span>
              <input type="number" min="0" max="1440" step="0.1" value="${((eq.hours || 0) * 60).toFixed(1)}"
                     data-sim="${eq.id}" style="flex:1;background:#101013;border:1px solid var(--line);border-radius:10px;padding:9px">
              <span class="tiny muted" style="width:76px;text-align:right">${fmtDuration((eq.hours || 0) * 60)}</span>
            </div>
          </div>`).join("")}
      </div>`;
  }

  function bindSimulate(p) {
    const baseline = new Map(p.equipments.map((eq) => [eq.id, eq.hours || 0]));

    view.querySelectorAll("[data-sim]").forEach((input) => input.addEventListener("input", () => {
      const eq = p.equipments.find((x) => x.id === input.dataset.sim);
      if (!eq) return;
      eq.hours = Math.max(0, Math.min(1440, parseFloat(input.value) || 0)) / 60;
      save();

      const total = totals(p);
      const originalKwh = p.equipments.reduce((acc, item) => {
        const baseHours = baseline.has(item.id) ? baseline.get(item.id) : (item.hours || 0);
        if (item.monthlyKwh != null) return acc + item.monthlyKwh * (item.qty || 1);
        return acc + (item.powerW / 1000) * (item.qty || 1) * baseHours * (item.days || 30) * (item.factor ?? 1);
      }, 0);
      const originalCost = originalKwh * p.tariff;
      const simKwh = p.equipments.reduce((a, e) => a + monthlyKwh(e), 0);
      const simCost = simKwh * p.tariff;
      const saving = originalCost - simCost;
      const pct = originalCost > 0 ? (saving / originalCost) * 100 : 0;
      const positive = saving > 0.005;

      const label = document.getElementById("simLabel");
      const amount = document.getElementById("simAmount");
      const sub = document.getElementById("simSub");
      const chip = document.getElementById("simChip");
      const now = document.getElementById("simNow");
      const bar = document.getElementById("simBar");

      if (label) label.textContent = positive ? "Economia potencial" : "Custo atual";
      if (amount) {
        amount.textContent = brl.format(positive ? saving : originalCost);
        amount.style.color = positive ? "var(--green)" : "var(--text)";
      }
      if (sub) sub.textContent = positive ? `${num1.format(pct)}% menos consumo` : "por mês, com o uso atual";
      if (chip) {
        chip.hidden = !positive;
        chip.textContent = `−${num1.format(pct)}%`;
      }
      if (now) now.textContent = `${num2.format(simKwh)} kWh`;
      if (bar) bar.style.width = `${originalKwh > 0 ? Math.max(2, (simKwh / originalKwh) * 100) : 0}%`;

      const row = input.closest(".item");
      const rowEnd = row?.querySelector(".item-end");
      if (rowEnd) rowEnd.textContent = `${num2.format(monthlyKwh(eq))} kWh`;
    }));

    $("#resetSim")?.addEventListener("click", () => {
      p.equipments.forEach((eq) => { if (baseline.has(eq.id)) eq.hours = baseline.get(eq.id); });
      save();
      render();
      toast("Cenário restaurado.");
    });
  }

  function settingsView(p) {
    return `
      <div class="card">
        <div class="row">
          <div class="avatar">${p.type === "INDUSTRIAL" ? "🏭" : p.type === "COMMERCIAL" ? "🏪" : p.type === "RURAL" ? "🚜" : p.type === "CONSTRUCTION" ? "🛠️" : "🏠"}</div>
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
        <button class="item" id="copySummary"><div class="avatar">📋</div><div class="grow" style="text-align:left"><div class="item-title">Copiar resumo</div><div class="item-sub">Texto com emojis para WhatsApp</div></div><span class="chev">›</span></button>
        <button class="item" id="printPdf"><div class="avatar">🖨️</div><div class="grow" style="text-align:left"><div class="item-title">Salvar em PDF</div><div class="item-sub">Abre a impressão do navegador</div></div><span class="chev">›</span></button>
        <button class="item" id="exportCsv"><div class="avatar">📄</div><div class="grow" style="text-align:left"><div class="item-title">Exportar CSV</div><div class="item-sub">Planilha com todos os aparelhos</div></div><span class="chev">›</span></button>
      </div>

      <div class="section-title"><span>Dados</span></div>
      <div class="list">
        <button class="item" id="switchProject"><div class="avatar">🔄</div><div class="grow" style="text-align:left"><div class="item-title">Trocar de instalação</div><div class="item-sub">${state.projects.length} cadastrada(s)</div></div><span class="chev">›</span></button>
        <button class="item" id="wipe"><div class="avatar" style="background:rgba(255,92,92,.12);color:var(--red)">🗑️</div><div class="grow" style="text-align:left"><div class="item-title">Apagar dados</div><div class="item-sub">Remove instalações deste navegador</div></div><span class="chev">›</span></button>
      </div>
      <p class="tiny muted center" style="margin:8px 0">Consumo Consciente • versão web • funciona offline</p>`;
  }

  const typeLabel = (t) => (TYPES.find(([k]) => k === t)?.[1]) || t;

  function bindSettings(p) {
    $("#editProject")?.addEventListener("click", () => projectModal(p));
    $("#copySummary")?.addEventListener("click", () => copySummary(p));
    $("#printPdf")?.addEventListener("click", () => printReport(p));
    $("#exportCsv")?.addEventListener("click", () => exportCsv(p));
    $("#switchProject")?.addEventListener("click", () => projectsModal());
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
            <div class="avatar">🏠</div>
            <div class="grow" style="text-align:left"><div class="item-title">${esc(p.name)}</div><div class="item-sub">${typeLabel(p.type)} • ${p.equipments.length} aparelhos</div></div>
            ${p.id === state.currentId ? '<span class="chip active">Atual</span>' : ""}
          </button>`).join("")}
      </div>
      <div class="sheet-actions"><button class="btn ghost" data-close>Fechar</button><button class="btn primary" id="newProjectBtn">Nova instalação</button></div>
    `, (sheet) => {
      sheet.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
        state.currentId = b.dataset.pick;
        save();
        closeModal();
        render();
      }));
      sheet.querySelector("#newProjectBtn").addEventListener("click", () => projectModal(null));
    });
  }

  function environmentModal(p, existing) {
    const env = existing || { name: "", icon: "🏠" };
    const icons = ["🏠", "🛏️", "🛋️", "🍳", "🚿", "🧺", "🚗", "🏭", "🏪", "🌾", "🛠️", "🏢"];
    openModal(`
      <h2>${existing ? "Editar ambiente" : "Novo ambiente"}</h2>
      <p class="sub">Cômodo ou setor da instalação.</p>
      <div class="field" style="margin-bottom:12px"><label>Nome</label><input id="eName" value="${esc(env.name)}" placeholder="Quarto 01"></div>
      <label class="tiny muted">Ícone</label>
      <div class="chips" id="iconRow" style="margin:8px 0 16px">
        ${icons.map((i) => `<button class="chip ${i === env.icon ? "active" : ""}" data-icon="${i}" style="font-size:18px">${i}</button>`).join("")}
      </div>
      <div class="sheet-actions">
        ${existing ? '<button class="btn danger" id="delEnv">Excluir</button>' : ""}
        <button class="btn primary" id="saveEnv">Salvar</button>
      </div>
    `, (sheet) => {
      let icon = env.icon;
      sheet.querySelectorAll("[data-icon]").forEach((b) => b.addEventListener("click", () => {
        icon = b.dataset.icon;
        sheet.querySelectorAll("[data-icon]").forEach((x) => x.classList.toggle("active", x === b));
      }));
      sheet.querySelector("#saveEnv").addEventListener("click", () => {
        const name = sheet.querySelector("#eName").value.trim();
        if (!name) return;
        if (existing) Object.assign(existing, { name, icon });
        else p.environments.push({ id: uid(), name, icon });
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

  function catalogModal(p) {
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
            <div class="avatar">${iconFor(item)}</div>
            <div class="grow"><b class="ellipsis">${esc(item.type)}</b><small>${esc(item.variant || item.category)} • ${num2.format(item.power)} W</small></div>
          </button>`).join("") : '<p class="muted small center" style="padding:20px">Nenhum resultado.</p>';
        results.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
          const chosen = catalog[parseInt(b.dataset.i, 10)];
          closeModal();
          equipmentModal(p, null, chosen);
        }));
      };
      q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(paint, 120); });
      paint();
      sheet.querySelector("#manual").addEventListener("click", () => { closeModal(); equipmentModal(p, null, null); });
    });
  }

  function equipmentModal(p, existing, fromCatalog) {
    const base = existing || (fromCatalog ? {
      name: fromCatalog.name, category: fromCatalog.category, powerW: fromCatalog.power || 100,
      qty: 1, hours: fromCatalog.hours || 1, days: fromCatalog.days || p.days,
      factor: fromCatalog.factor ?? 1, monthlyKwh: null
    } : { name: "", category: "Outros", powerW: 100, qty: 1, hours: 8, days: p.days, factor: 1, monthlyKwh: null });
    const envOptions = p.environments.map((e) => `<option value="${e.id}" ${existing?.envId === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("");
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
        <div class="field"><label>Minutos por dia</label><input id="eqMinutes" type="number" min="0" max="1440" step="0.1" value="${((base.hours || 0) * 60).toFixed(1)}"></div>
        <div class="field"><label>Dias no mês</label><input id="eqDays" type="number" min="1" max="31" value="${base.days}"></div>
      </div>
      <div class="field" style="margin-bottom:6px"><label>Fator médio de uso (0–1)</label><input id="eqFactor" type="number" min="0" max="1" step="0.05" value="${base.factor}"></div>
      <p class="hint" id="eqPreview"></p>
      <div class="sheet-actions">
        ${existing ? '<button class="btn danger" id="delEq">Excluir</button>' : ""}
        <button class="btn primary" id="saveEq">Salvar</button>
      </div>
    `, (sheet) => {
      const preview = sheet.querySelector("#eqPreview");
      const refresh = () => {
        const power = parseFloat(sheet.querySelector("#eqPower").value) || 0;
        const qty = parseInt(sheet.querySelector("#eqQty").value) || 1;
        const minutes = parseFloat(sheet.querySelector("#eqMinutes").value) || 0;
        const days = parseInt(sheet.querySelector("#eqDays").value) || 30;
        const factor = Math.min(1, Math.max(0, parseFloat(sheet.querySelector("#eqFactor").value) || 1));
        const kwh = (power / 1000) * qty * (minutes / 60) * days * factor;
        preview.textContent = `${num2.format(kwh)} kWh/mês • ${brl.format(kwh * p.tariff)} • ${fmtDuration(minutes)}/dia`;
      };
      sheet.querySelectorAll("input").forEach((i) => i.addEventListener("input", refresh));
      refresh();
      sheet.querySelector("#saveEq").addEventListener("click", () => {
        const envId = sheet.querySelector("#eqEnv").value || p.environments[0]?.id;
        if (!envId) { toast("Crie um ambiente primeiro."); return; }
        const data = {
          name: sheet.querySelector("#eqName").value.trim() || "Aparelho",
          category: sheet.querySelector("#eqCat").value.trim() || "Outros",
          envId,
          powerW: parseFloat(sheet.querySelector("#eqPower").value) || 0,
          qty: Math.max(1, parseInt(sheet.querySelector("#eqQty").value) || 1),
          hours: (parseFloat(sheet.querySelector("#eqMinutes").value) || 0) / 60,
          days: Math.min(31, Math.max(1, parseInt(sheet.querySelector("#eqDays").value) || 30)),
          factor: Math.min(1, Math.max(0, parseFloat(sheet.querySelector("#eqFactor").value) || 1)),
          monthlyKwh: null
        };
        if (existing) Object.assign(existing, data);
        else p.equipments.push({ id: uid(), ...data });
        save(); closeModal(); render();
      });
      sheet.querySelector("#delEq")?.addEventListener("click", () => {
        if (!confirm(`Excluir "${existing.name}"?`)) return;
        p.equipments = p.equipments.filter((e) => e.id !== existing.id);
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
    const top = [...p.equipments].sort((a, b) => monthlyKwh(b) - monthlyKwh(a));
    $("#printArea").innerHTML = `
      <div class="p-head">
        <h1>Consumo Consciente</h1>
        <p>${esc(p.name)} • ${typeLabel(p.type)} • ${new Date().toLocaleString("pt-BR")}</p>
      </div>
      <div class="p-kpi">
        <div><span>Custo mensal</span><b>${brl.format(t.cost)}</b></div>
        <div><span>Consumo</span><b>${num2.format(t.kwh)} kWh</b></div>
        <div><span>Tarifa</span><b>${brl.format(p.tariff)}/kWh</b></div>
      </div>
      <h3>Consumo por ambiente</h3>
      <table><thead><tr><th>Ambiente</th><th>kWh</th><th>Custo</th></tr></thead><tbody>
        ${envs.map(({ env, kwh }) => `<tr><td>${esc(env.name)}</td><td>${num2.format(kwh)}</td><td>${brl.format(kwh * p.tariff)}</td></tr>`).join("")}
      </tbody></table>
      <h3>Aparelhos</h3>
      <table><thead><tr><th>Aparelho</th><th>Ambiente</th><th>W</th><th>Horas/dia</th><th>kWh</th><th>Custo</th></tr></thead><tbody>
        ${top.map((eq) => `<tr><td>${esc(eq.name)}</td><td>${esc(envName(p, eq.envId))}</td><td>${num2.format(eq.powerW)}</td><td>${num1.format((eq.hours || 0))}</td><td>${num2.format(monthlyKwh(eq))}</td><td>${brl.format(costOf(eq, p))}</td></tr>`).join("")}
      </tbody></table>
      <p class="p-note">Valores estimados a partir dos dados informados. Confirme a potência na etiqueta do aparelho.</p>`;
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
      if (p.environments.length) catalogModal(p);
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
  });

  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
    } else {
      openModal(`
        <h2>Instalar no celular</h2>
        <p class="sub">Adicione à tela inicial para abrir como aplicativo.</p>
        <p class="small muted">No Android (Chrome): menu ⋮ → <b>Instalar aplicativo</b>.<br>
        No iPhone (Safari): botão Compartilhar → <b>Adicionar à Tela de Início</b>.</p>
        <div class="sheet-actions"><button class="btn primary" data-close>Entendi</button></div>`);
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
    });
  }

  render();
  loadCatalog();
})();
