/* صفحات لوحة تحكم «قيمي». كل صفحة تستدعي boot ثم ترسم من دوال qm_* فقط. */
const kpi = (i, v, t, k) => `<div class="kpi k${k}"><div class="ic">${ico(i)}</div><div><b>${v ?? 0}</b><span>${esc(t)}</span></div></div>`;
const opt = (rows, f = (r) => r.name_ar) => rows.map((r) => `<option value="${r.id}">${esc(f(r))}</option>`).join("");
const types = (tbl, extra) => sb.from(tbl).select("*").eq("is_active", true).order("sort_order").then(({ data, error }) => { if (error) throw new Error(mapErr(error)); return extra ? data.filter(extra) : data; });
function pickerField(root, state, key) {
  const draw = () => {
    if (state[key]) { root.classList.remove("pick"); root.innerHTML = chosenHTML(state[key]); $("[data-clear]", root).onclick = () => { state[key] = null; draw(); }; }
    else studentPicker(root, (s) => { state[key] = s; draw(); });
  }; draw();
}
const bars = (series) => { const mx = Math.max(1, ...series.map((s) => s.n)); return `<div class="bars" role="img" aria-label="التعزيزات اليومية">${series.map((s) => `<i style="height:${Math.round((s.n / mx) * 100)}%" data-t="${s.n} · ${esc(fmtShort(s.d))}"></i>`).join("")}</div><div class="axl"><span>${esc(fmtShort(series[0]?.d))}</span><span>${esc(fmtShort(series[series.length - 1]?.d))}</span></div>`; };
const rankRows = (rows, key, val) => { const mx = Math.max(1, ...rows.map((r) => r[val])); return rows.length ? rows.map((r, i) => `<div class="rank"><span class="n ${i === 0 ? "g" : ""}">${i + 1}</span><b>${esc(r[key])}</b><span class="v">${r[val]}</span><span class="track"><i style="width:${Math.round((r[val] / mx) * 100)}%"></i></span></div>`).join("") : '<p class="sub">لا بيانات بعد.</p>'; };

const PAGES = {
  dashboard: () => boot("dashboard.html", async (m, c) => {
    const [d, mine] = await Promise.all([rpc("qm_dashboard", { p_days: 14 }), rpc("qm_incidents_list", { p_scope: "mine", p_limit: 5 })]);
    const sens = d.incidents_new !== null && d.incidents_new !== undefined;
    const kp = [kpi("users", d.students, "متعلماً مرتبطاً بالنواة", 0), kpi("check", d.reinforcements, "عملية تعزيز", 1), kpi("star", d.points, "نقطة ممنوحة (الرصيد الصافي)", 3), kpi("trophy", d.badges, "وسام ممنوح", 4)];
    const mk = [kpi("plus", d.my_reinforcements, "تعزيزاً سجّلتُه", 1), kpi("inbox", d.my_incidents, "واقعة رفعتُها", 0), kpi("help", d.my_needs_action, "تنتظر استكمالك", 2)];
    const wk = sens ? [kpi("inbox", d.incidents_new, "وقائع جديدة مرصودة", 2), kpi("clock", d.incidents_with_agent, "لدى وكيل شؤون الطلاب", 0), kpi("users", d.incidents_referred, "محالة للموجه الطلابي", 3), ...(d.incidents_overdue !== null ? [kpi("hourglass", d.incidents_overdue, "تأخرت أكثر من 3 أيام", 4)] : [])] : [];
    m.innerHTML = `<section class="dash-hero"><div><h2>مرحباً ${esc(c.who.name)}</h2><p>${esc(fmtDay(todayISO()))} · ${esc(fmtHijri(todayISO()))}</p></div><span class="yr"><i></i>${esc(c.role)}</span></section>
    ${d.my_needs_action ? `<div class="alert mt"><b>${d.my_needs_action} واقعة تنتظر استكمالك للمعلومات.</b> <a href="incidents.html">افتح وقائعي</a></div>` : ""}
    <h3 class="sec">مهامي</h3><div class="grid">${mk.join("")}</div>
    ${sens ? `<h3 class="sec">الوقائع السلوكية</h3><div class="grid">${wk.join("")}</div>` : ""}
    <h3 class="sec">المدرسة</h3><div class="grid">${kp.join("")}</div>
    <div class="grid mt"><div class="card"><h4 style="margin-top:0">التعزيز اليومي (آخر 14 يوماً)</h4>${bars(d.series)}</div>
      <div class="card"><h4 style="margin-top:0">حسب نوع التعزيز</h4>${rankRows(d.by_type, "type", "n")}</div>
      <div class="card"><h4 style="margin-top:0">حسب الصف</h4>${rankRows(d.by_grade, "grade", "n")}</div></div>
    <h3 class="sec">أحدث العمليات</h3>${d.recent.length ? d.recent.map((r) => `<div class="item"><div class="row2"><div><b>${esc(r.student)}</b> · ${esc(r.type)}</div><span>${r.points ? pts(r.points) : ""} <small>${esc(ago(r.created_at))}</small></span></div></div>`).join("") : empty("check", "لا تعزيزات بعد", "ابدأ بتسجيل أول تعزيز.")}
    <h3 class="sec">آخر وقائعي</h3><div id="mi">${mine.length ? mine.map(incidentCard).join("") : '<p class="sub">لم ترفع وقائع.</p>'}</div>
    <div class="acts mt"><a class="btn" href="reinforce.html">${ico("plus")}تسجيل تعزيز</a><a class="btn sec" href="behavior.html">تسجيل سلوك</a></div>
    <p class="sub">المؤشرات من قاعدة البيانات مباشرة، وتغطي ${esc(fmtShort(d.since))} إلى اليوم في المخططات. حالات الإنجاز والدعم التربوي تُضاف مع مراحلها.</p>`;
    bindIncidents($("#mi"), () => location.reload());
  }),

  reinforce: () => boot("reinforce.html", async (m, c) => {
    const T = await types("qm_reinforcement_types"), st = { s: null };
    const S = (await sb.from("qm_settings").select("max_points_per_award").single()).data || { max_points_per_award: 50 };
    m.innerHTML = `<form class="card form" id="f"><div><label>المتعلم</label><div id="pk"></div></div>
      <div class="two"><div><label for="ty">نوع التعزيز</label><select id="ty" required>${T.map((t) => `<option value="${t.id}" data-p="${t.default_points}">${esc(t.name_ar)}</option>`).join("")}</select></div>
      <div><label for="pt">النقاط (اتركها 0 لتعزيز بلا نقاط)</label><input id="pt" type="number" min="0" max="${S.max_points_per_award}" value="${T[0]?.default_points || 0}"></div></div>
      <div><label for="ds">وصف مختصر للموقف</label><textarea id="ds" maxlength="500"></textarea></div>
      <div><label for="fl">مرفق (صورة أو PDF، اختياري)</label><input id="fl" type="file" accept="image/png,image/jpeg,image/webp,application/pdf"></div>
      <p class="err" id="er" role="alert"></p><div class="acts"><button class="btn" id="go">حفظ التعزيز</button></div>
      <p class="sub">يُحفظ مباشرة دون اعتماد، ويُسجَّل التاريخ تلقائياً، ويُضاف إلى سجل المتعلم ودفتر النقاط عند وجود نقاط.</p></form>
      <h3 class="sec">آخر ما سجّلتُه</h3><div id="rc"></div>`;
    pickerField($("#pk"), st, "s");
    $("#ty").onchange = (e) => { $("#pt").value = e.target.selectedOptions[0].dataset.p || 0; };
    const loadRec = async () => { const r = await rpc("qm_reinforcements_list", { p_mine: true, p_limit: 8 }); $("#rc").innerHTML = r.length ? r.map(reinfItem).join("") : '<p class="sub">لم تسجّل تعزيزات بعد.</p>'; bindVoid($("#rc"), loadRec); };
    $("#f").onsubmit = async (ev) => { ev.preventDefault(); const er = $("#er"), go = $("#go"); er.textContent = "";
      if (!st.s) { er.textContent = "اختر المتعلم أولاً."; return; } go.disabled = true;
      try { const path = await uploadFile($("#fl").files[0], c.uid);
        await rpc("qm_give_reinforcement", { p_student: st.s.id, p_type: $("#ty").value, p_description: $("#ds").value, p_points: +$("#pt").value || 0, p_attachment: path });
        toast("تم حفظ التعزيز"); st.s = null; pickerField($("#pk"), st, "s"); $("#ds").value = ""; $("#fl").value = ""; await loadRec();
      } catch (e) { er.textContent = mapErr(e); } go.disabled = false; };
    await loadRec();
  }),

  behavior: () => boot("behavior.html", async (m, c) => {
    const [P, Ng] = await Promise.all([types("qm_behavior_categories", (x) => x.kind === "positive"), types("qm_behavior_categories", (x) => x.kind === "negative")]);
    const sp = { s: null }, sn = { s: null };
    m.innerHTML = `<div class="tabs" role="tablist"><button class="on" data-t="p" role="tab">موقف إيجابي</button><button data-t="n" role="tab">واقعة سلبية (إحالة للوكيل)</button></div>
    <form class="card form" id="fp"><div><label>المتعلم</label><div id="pkp"></div></div><div><label for="cp">التصنيف</label><select id="cp">${opt(P)}</select></div>
      <div><label for="dp">وصف الموقف</label><textarea id="dp" maxlength="500" required></textarea></div><p class="err" id="ep" role="alert"></p>
      <div class="acts"><button class="btn" id="gp">حفظ الموقف الإيجابي</button></div><p class="sub">لا يشترط أن ينتج عن الموقف نقاط. للتعزيز بنقاط استخدم «تسجيل تعزيز».</p></form>
    <form class="card form" id="fn" hidden><div><label>المتعلم</label><div id="pkn"></div></div>
      <div class="two"><div><label for="dt">تاريخ الواقعة</label><input id="dt" type="date" max="${todayISO()}" value="${todayISO()}" required></div><div><label for="tm">الوقت</label><input id="tm" type="time"></div></div>
      <div class="two"><div><label for="lc">موقع الحدوث</label><input id="lc" maxlength="120"></div><div><label for="cn">تصنيف السلوك</label><select id="cn">${opt(Ng)}</select></div></div>
      <div><label for="dn">وصف موضوعي للواقعة</label><textarea id="dn" maxlength="1500" required></textarea></div>
      <div><label for="nt">ملاحظات المعلم</label><textarea id="nt" maxlength="800"></textarea></div>
      <div><label for="pr">الأطراف ذات العلاقة عند الضرورة</label><input id="pr" maxlength="300"></div>
      <div><label for="fn2">مرفقات (حتى 3، صور أو PDF)</label><input id="fn2" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf"></div>
      <p class="err" id="en" role="alert"></p><div class="acts"><button class="btn" id="gn">رفع الواقعة إلى وكيل شؤون الطلاب</button></div>
      <p class="sub">تُسجَّل الواقعة بحالة «مرصودة» وتصل إلى صندوق الوكيل. وليست مخالفة معتمدة ولا يُخصم بها شيء. صِف ما حدث دون أحكام.</p></form>`;
    pickerField($("#pkp"), sp, "s"); pickerField($("#pkn"), sn, "s");
    $$(".tabs button", m).forEach((b) => (b.onclick = () => { $$(".tabs button", m).forEach((x) => x.classList.toggle("on", x === b)); $("#fp").hidden = b.dataset.t !== "p"; $("#fn").hidden = b.dataset.t !== "n"; }));
    $("#fp").onsubmit = async (ev) => { ev.preventDefault(); $("#ep").textContent = ""; if (!sp.s) { $("#ep").textContent = "اختر المتعلم أولاً."; return; } $("#gp").disabled = true;
      try { await rpc("qm_record_positive", { p_student: sp.s.id, p_category: $("#cp").value, p_description: $("#dp").value }); toast("تم حفظ الموقف الإيجابي"); sp.s = null; pickerField($("#pkp"), sp, "s"); $("#dp").value = ""; }
      catch (e) { $("#ep").textContent = mapErr(e); } $("#gp").disabled = false; };
    $("#fn").onsubmit = async (ev) => { ev.preventDefault(); const er = $("#en"); er.textContent = ""; if (!sn.s) { er.textContent = "اختر المتعلم أولاً."; return; }
      const files = [...$("#fn2").files]; if (files.length > 3) { er.textContent = "الحد الأقصى 3 مرفقات."; return; } $("#gn").disabled = true;
      try { const paths = []; for (const f of files) paths.push(await uploadFile(f, c.uid));
        const r = await rpc("qm_report_incident", { p_student: sn.s.id, p_category: $("#cn").value, p_description: $("#dn").value, p_date: $("#dt").value || null, p_time: $("#tm").value || null, p_location: $("#lc").value, p_notes: $("#nt").value, p_parties: $("#pr").value, p_attachments: paths });
        toast(`رُفعت الواقعة برقم ${r.no} وحالتها: مرصودة`); location.href = "incidents.html";
      } catch (e) { er.textContent = mapErr(e); $("#gn").disabled = false; } };
  }),

  incidents: () => boot("incidents.html", async (m) => {
    let f = "all"; const root = document.createElement("div");
    const draw = async () => { const rows = await rpc("qm_incidents_list", { p_scope: "mine" });
      const sel = rows.filter((i) => f === "all" || (f === "act" && i.needs_my_action) || (f === "open" && !i.is_closed) || (f === "closed" && i.is_closed));
      root.innerHTML = `<div class="tabs">${[["all", "الكل"], ["act", "مطلوب مني"], ["open", "قيد المعالجة"], ["closed", "المغلقة"]].map(([k, l]) => `<button data-f="${k}" class="${f === k ? "on" : ""}">${l}${k === "act" ? ` (${rows.filter((i) => i.needs_my_action).length})` : ""}</button>`).join("")}</div>
      <div id="li">${sel.length ? sel.map(incidentCard).join("") : empty("inbox", "لا وقائع", "ستظهر هنا الوقائع التي ترفعها وحالة كل منها.")}</div>`;
      $$("[data-f]", root).forEach((b) => (b.onclick = () => { f = b.dataset.f; draw(); }));
    };
    m.appendChild(root); bindIncidents(root, draw); await draw();
  }),

  reinforcements: () => boot("reinforcements.html", async (m, c) => {
    let mine = false, q = "";
    m.innerHTML = `<div class="tabs"><button data-m="0" class="on">كل التعزيزات</button><button data-m="1">ما سجّلتُه أنا</button></div><div class="form" style="max-width:420px;margin-bottom:12px"><input id="q" type="search" placeholder="تصفية بالاسم أو الصف" aria-label="تصفية"></div><div id="li"></div>`;
    const draw = async () => { let r = await rpc("qm_reinforcements_list", { p_mine: mine, p_limit: 300 }); const k = q.trim(); if (k) r = r.filter((x) => (x.student + x.grade + x.type).includes(k));
      $("#li").innerHTML = r.length ? r.map(reinfItem).join("") : empty("list", "لا تعزيزات مطابقة"); bindVoid($("#li"), draw, c); };
    $$(".tabs button", m).forEach((b) => (b.onclick = () => { mine = b.dataset.m === "1"; $$(".tabs button", m).forEach((x) => x.classList.toggle("on", x === b)); draw(); }));
    $("#q").oninput = (e) => { q = e.target.value; draw(); }; await draw();
  }),

  balances: () => boot("balances.html", async (m) => {
    const ex = await rpc("qm_excellence", { p_limit: 10 });
    m.innerHTML = `<div class="grid"><div class="card"><h4 style="margin-top:0">لوحة التميز</h4>${ex.length ? ex.map((r, i) => `<div class="rank"><span class="n ${i === 0 ? "g" : ""}">${i + 1}</span><b><a href="#" data-c="${r.id}">${esc(r.name)}</a></b><span class="v">${r.balance}</span><span class="track"><i style="width:${Math.round((r.balance / ex[0].balance) * 100)}%"></i></span></div>`).join("") : '<p class="sub">لا أرصدة بعد.</p>'}<p class="sub">للتكريم والتحفيز، وليست ترتيباً رسمياً.</p></div>
    <div class="card" style="grid-column:span 2"><h4 style="margin-top:0">أرصدة المتعلمين</h4><input id="q" type="search" placeholder="ابحث باسم المتعلم أو رقمه" aria-label="بحث"><div id="li" style="margin-top:10px"></div></div></div>`;
    $$("[data-c]", m).forEach((a) => (a.onclick = (e) => { e.preventDefault(); openStudentCard(a.dataset.c); }));
    let t = 0; const draw = async () => { const r = await rpc("qm_balances", { p_q: $("#q").value, p_limit: 60 });
      $("#li").innerHTML = r.length ? `<table class="tbl"><thead><tr><th>المتعلم</th><th>الصف</th><th>التعزيزات</th><th>الرصيد</th></tr></thead><tbody>${r.map((x) => `<tr data-c="${x.id}" style="cursor:pointer"><td>${esc(x.name)}</td><td>${esc(x.grade || "")}${x.section ? " · " + esc(x.section) : ""}</td><td>${x.awards}</td><td>${pts(x.balance)}</td></tr>`).join("")}</tbody></table>` : '<p class="sub">لا نتائج.</p>';
      $$("tr[data-c]", $("#li")).forEach((tr) => (tr.onclick = () => openStudentCard(tr.dataset.c))); };
    $("#q").oninput = () => { clearTimeout(t); t = setTimeout(draw, 250); }; await draw();
  }),

  students: () => boot("students.html", async (m) => {
    const st = { s: null };
    m.innerHTML = `<div class="card form"><label>ابحث عن متعلم</label><div id="pk"></div><p class="sub">البيانات مرجعها النواة الرقمية، ولا تُنسخ داخل النظام. تعرض البطاقة ما تسمح به صلاحيتك.</p></div>`;
    studentPicker($("#pk"), (s) => openStudentCard(s.id), { placeholder: "اكتب حرفين على الأقل من الاسم أو الرقم" });
  }),

  agent: () => boot("agent.html", async (m) => {
    let sc = "inbox"; const root = document.createElement("div");
    const draw = async () => { const rows = await rpc("qm_incidents_list", { p_scope: sc });
      root.innerHTML = `<div class="tabs"><button data-s="inbox" class="${sc === "inbox" ? "on" : ""}">صندوق الاستقبال</button><button data-s="agent_all" class="${sc === "agent_all" ? "on" : ""}">كل الوقائع</button></div><div>${rows.length ? rows.map(incidentCard).join("") : empty("inbox", "الصندوق فارغ", "تظهر هنا الوقائع الجديدة المحالة من المعلمين.")}</div>`;
      $$("[data-s]", root).forEach((b) => (b.onclick = () => { sc = b.dataset.s; draw(); })); };
    m.appendChild(root); bindIncidents(root, draw); await draw();
  }, { role: "agent" }),

  counselor: () => boot("counselor.html", async (m) => {
    let f = "open"; const root = document.createElement("div");
    const draw = async () => { const rows = (await rpc("qm_incidents_list", { p_scope: "counselor" })).filter((i) => (f === "open" ? !i.is_closed : i.is_closed));
      root.innerHTML = `<div class="tabs"><button data-f="open" class="${f === "open" ? "on" : ""}">قيد المتابعة</button><button data-f="closed" class="${f === "closed" ? "on" : ""}">المغلقة</button></div><div>${rows.length ? rows.map(incidentCard).join("") : empty("help", "لا حالات", "تصل هنا الحالات التي يحيلها وكيل شؤون الطلاب.")}</div>`;
      $$("[data-f]", root).forEach((b) => (b.onclick = () => { f = b.dataset.f; draw(); })); };
    m.appendChild(root); bindIncidents(root, draw); await draw();
  }, { role: "counselor" }),
};

function reinfItem(r) {
  return `<div class="item ${r.voided_at ? "void" : ""}"><div class="row2"><div><b><a href="#" data-c="${r.student_id}">${esc(r.student)}</a></b> · ${esc(r.type)}<br><small>${esc(r.grade || "")}${r.section ? " · " + esc(r.section) : ""} · ${esc(r.given_by)} · ${esc(fmtT(r.created_at))}</small></div>
  <div class="acts">${r.points ? pts(r.points) : '<span class="badge">بلا نقاط</span>'}${r.voided_at ? '<span class="badge bad">ملغى</span>' : r.mine || window.__qmAdmin ? `<button class="btn sm sec" data-void="${r.id}">إلغاء</button>` : ""}</div></div>
  ${r.description ? `<p class="sub">${esc(r.description)}</p>` : ""}${r.voided_at ? `<p class="bk-n err"><small>سبب الإلغاء:</small> ${esc(r.void_reason || "")}</p>` : ""}</div>`;
}
function bindVoid(root, reload, c) {
  if (c) window.__qmAdmin = c.isAdmin;
  $$("[data-c]", root).forEach((a) => (a.onclick = (e) => { e.preventDefault(); openStudentCard(a.dataset.c); }));
  $$("[data-void]", root).forEach((b) => (b.onclick = async () => { const n = await askNote("إلغاء التعزيز", "سبب الإلغاء (يُحفظ في السجل، ولا يُحذف التعزيز)", true); if (n === null) return;
    try { await rpc("qm_void_reinforcement", { p_id: b.dataset.void, p_reason: n }); toast("أُلغي التعزيز وعُكست نقاطه"); await reload(); } catch (e) { toast(mapErr(e), true); } }));
}

// جدول إعدادات عام: يعدّل الصفوف مباشرة (RLS يسمح لمدير النواة فقط، وكل تعديل يُسجَّل في سجل التدقيق بمشغّل قاعدة البيانات)
async function crud(root, table, cols, add) {
  const load = async () => { const { data, error } = await sb.from(table).select("*").order("sort_order"); if (error) throw new Error(mapErr(error)); return data; };
  const cell = (c, r) => c.t === "bool" ? `<label class="tgl"><input type="checkbox" data-k="${c.k}" ${r[c.k] ? "checked" : ""} aria-label="${esc(c.l)}"><span></span></label>`
    : c.t === "select" ? `<select data-k="${c.k}">${c.o.map(([v, l]) => `<option value="${v}" ${r[c.k] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
    : c.ro ? `<small>${esc(r[c.k])}</small>` : `<input data-k="${c.k}" type="${c.t || "text"}" value="${esc(r[c.k] ?? "")}" ${c.t === "number" ? 'min="0"' : ""}>`;
  const draw = async () => { const rows = await load();
    root.innerHTML = `<div style="overflow:auto"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${esc(c.l)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr data-id="${r.id}">${cols.map((c) => `<td>${cell(c, r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <form class="card form mt" id="af"><h4 style="margin:0">إضافة</h4><div class="two">${add.map((c) => `<div><label>${esc(c.l)}</label>${c.t === "select" ? `<select name="${c.k}">${c.o.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select>` : `<input name="${c.k}" type="${c.t || "text"}" ${c.req ? "required" : ""}>`}</div>`).join("")}</div><p class="err" id="ae"></p><div class="acts"><button class="btn">إضافة</button></div></form>`;
    $$("tr[data-id] [data-k]", root).forEach((el) => (el.onchange = async () => { const k = el.dataset.k, id = el.closest("tr").dataset.id; let v = el.type === "checkbox" ? el.checked : el.type === "number" ? +el.value : el.value;
      const { error } = await sb.from(table).update({ [k]: v }).eq("id", id); if (error) { toast(mapErr(error), true); draw(); } else toast("تم الحفظ"); }));
    $("#af", root).onsubmit = async (e) => { e.preventDefault(); const o = {}; add.forEach((c) => { const v = e.target.elements[c.k].value.trim(); if (v !== "") o[c.k] = c.t === "number" ? +v : v; }); o.sort_order = rows.length + 1;
      const { error } = await sb.from(table).insert(o); if (error) { $("#ae", root).textContent = mapErr(error); return; } toast("تمت الإضافة"); draw(); };
  }; await draw();
}
PAGES.admin = () => boot("admin.html", async (m, c) => {
  const TABS = [["roles", "الأدوار"], ["types", "أنواع التعزيز"], ["badges", "الأوسمة"], ["cats", "تصنيفات السلوك"], ["stat", "حالات الواقعة"], ["set", "الإعدادات العامة"], ["audit", "سجل العمليات"]];
  let cur = new URLSearchParams(location.search).get("t") || "roles";
  m.innerHTML = `<div class="tabs" id="tb">${TABS.map(([k, l]) => `<button data-t="${k}" class="${k === cur ? "on" : ""}">${l}</button>`).join("")}</div><div id="bd"></div>`;
  const body = $("#bd"), kinds = [["positive", "إيجابي"], ["negative", "سلبي"]];
  const draw = async () => { body.innerHTML = '<p class="sub">جارٍ التحميل…</p>';
    try {
      if (cur === "roles") {
        const S = await rpc("qm_staff_list");
        body.innerHTML = `<p class="sub">المعلم هو أي منسوب فعّال في النواة. عيّن هنا وكيل شؤون الطلاب والموجه الطلابي. الوكيل هو من يستقبل الوقائع من المعلمين.</p><div style="overflow:auto"><table class="tbl"><thead><tr><th>المنسوب</th><th>الوظيفة في النواة</th><th>وكيل شؤون الطلاب</th><th>الموجه الطلابي</th></tr></thead><tbody>${S.map((s) => `<tr><td>${esc(s.name)}</td><td><small>${esc(s.job || "")}</small></td>${["agent", "counselor"].map((r) => `<td><label class="tgl"><input type="checkbox" data-s="${s.id}" data-r="${r}" ${s["is_" + r] ? "checked" : ""} aria-label="${r}"><span></span></label></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        $$("[data-s]", body).forEach((el) => (el.onchange = async () => { try { await rpc("qm_set_role", { p_staff: el.dataset.s, p_role: el.dataset.r, p_on: el.checked }); toast("تم الحفظ"); } catch (e) { toast(mapErr(e), true); el.checked = !el.checked; } }));
      } else if (cur === "types") await crud(body, "qm_reinforcement_types", [{ k: "name_ar", l: "الاسم" }, { k: "domain", l: "المجال", t: "select", o: [["academic", "أكاديمي"], ["behavior", "سلوكي"], ["participation", "مشاركة"], ["leadership", "قيادي"], ["general", "عام"]] }, { k: "default_points", l: "النقاط المقترحة", t: "number" }, { k: "is_active", l: "فعّال", t: "bool" }], [{ k: "name_ar", l: "الاسم", req: 1 }, { k: "domain", l: "المجال", t: "select", o: [["general", "عام"], ["academic", "أكاديمي"], ["behavior", "سلوكي"], ["participation", "مشاركة"], ["leadership", "قيادي"]] }, { k: "default_points", l: "النقاط المقترحة", t: "number" }]);
      else if (cur === "badges") await crud(body, "qm_badges", [{ k: "name_ar", l: "الاسم" }, { k: "description", l: "الوصف" }, { k: "criteria", l: "شروط الاستحقاق" }, { k: "icon", l: "الأيقونة" }, { k: "is_active", l: "فعّال", t: "bool" }], [{ k: "name_ar", l: "اسم الوسام", req: 1 }, { k: "description", l: "الوصف" }, { k: "criteria", l: "شروط الاستحقاق" }, { k: "icon", l: "الأيقونة (trophy, star, users, up, chart)" }]);
      else if (cur === "cats") await crud(body, "qm_behavior_categories", [{ k: "name_ar", l: "التصنيف" }, { k: "kind", l: "النوع", t: "select", o: kinds }, { k: "is_active", l: "فعّال", t: "bool" }], [{ k: "name_ar", l: "التصنيف", req: 1 }, { k: "kind", l: "النوع", t: "select", o: kinds }]);
      else if (cur === "stat") body.innerHTML = '<p class="sub">حالات الواقعة المسموح بها تحدد مسار الإجراءات في النظام. يمكن تعديل الاسم واللون والترتيب. الرموز البرمجية (code) ثابتة، وتغيير مسار الانتقال بين الحالات يحتاج تعديلاً برمجياً معتمداً.</p><div id="sc"></div>', await crud($("#sc", body), "qm_incident_statuses", [{ k: "code", l: "الرمز", ro: 1 }, { k: "name_ar", l: "الاسم" }, { k: "tone", l: "اللون", t: "select", o: [["ok", "أخضر: مكتمل"], ["info", "أزرق: قيد المعالجة"], ["warn", "برتقالي: يحتاج إجراء"], ["bad", "أحمر: تنبيه"], ["mute", "رمادي: غير نشط"]] }, { k: "sort_order", l: "الترتيب", t: "number" }], [{ k: "code", l: "الرمز (حروف إنجليزية)", req: 1 }, { k: "name_ar", l: "الاسم", req: 1 }]);
      else if (cur === "set") {
        const { data: s } = await sb.from("qm_settings").select("*").single();
        body.innerHTML = `<form class="card form" id="sf"><div class="two"><div><label>الحد الأقصى لنقاط التعزيز الواحد</label><input id="mp" type="number" min="1" value="${s.max_points_per_award}"></div><div><label>مهلة منع التكرار (دقائق)</label><input id="dw" type="number" min="0" value="${s.duplicate_window_minutes}"></div></div><p class="sub">تمنع المهلة تسجيل تعزيز مطابق (المتعلم والنوع والمسجِّل) خلال المدة، لتفادي التكرار غير المقصود.</p><div class="acts"><button class="btn">حفظ</button></div></form>`;
        $("#sf").onsubmit = async (e) => { e.preventDefault(); const { error } = await sb.from("qm_settings").update({ max_points_per_award: +$("#mp").value, duplicate_window_minutes: +$("#dw").value, updated_at: new Date().toISOString() }).eq("id", 1); toast(error ? mapErr(error) : "تم الحفظ", !!error); };
      } else if (cur === "audit") {
        const A = await rpc("qm_audit_list", { p_limit: 150 });
        body.innerHTML = `<p class="sub">آخر ${A.length} عملية. القيم السابقة واللاحقة محفوظة في القاعدة.</p><div style="overflow:auto"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>السجل</th><th>السبب</th></tr></thead><tbody>${A.map((a) => `<tr><td><small>${esc(fmtT(a.created_at))}</small></td><td>${esc(a.actor || "—")}</td><td>${esc(a.action)}</td><td><small>${esc(a.table_name)}</small></td><td><small>${esc(a.reason || "")}</small></td></tr>`).join("")}</tbody></table></div>`;
      }
    } catch (e) { body.innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; } };
  $$("#tb button", m).forEach((b) => (b.onclick = () => { cur = b.dataset.t; $$("#tb button", m).forEach((x) => x.classList.toggle("on", x === b)); draw(); }));
  await draw();
}, { role: "admin" });
