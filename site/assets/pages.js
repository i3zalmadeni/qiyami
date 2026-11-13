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
    const [d, mine, x] = await Promise.all([rpc("qm_dashboard", { p_days: 14 }), rpc("qm_incidents_list", { p_scope: "mine", p_limit: 5 }), rpc("qm_dashboard_ext").catch(() => ({}))]);
    const sens = d.incidents_new !== null && d.incidents_new !== undefined;
    const kp = [kpi("users", d.students, "متعلماً مرتبطاً بالنواة", 0), kpi("check", d.reinforcements, "عملية تعزيز", 1), kpi("star", d.points, "نقطة ممنوحة (الرصيد الصافي)", 3), kpi("trophy", d.badges, "وسام ممنوح", 4)];
    const mk = [kpi("plus", d.my_reinforcements, "تعزيزاً سجّلتُه", 1), kpi("inbox", d.my_incidents, "واقعة رفعتُها", 0), kpi("help", d.my_needs_action, "تنتظر استكمالك", 2)];
    const wk = sens ? [kpi("inbox", d.incidents_new, "وقائع جديدة مرصودة", 2), kpi("clock", d.incidents_with_agent, "لدى وكيل شؤون الطلاب", 0), kpi("users", d.incidents_referred, "محالة للموجه الطلابي", 3), ...(d.incidents_overdue !== null ? [kpi("hourglass", d.incidents_overdue, "تأخرت أكثر من 3 أيام", 4)] : [])] : [];
    m.innerHTML = `<section class="dash-hero"><div><h2>مرحباً ${esc(c.who.name)}</h2><p>${esc(fmtDay(todayISO()))} · ${esc(fmtHijri(todayISO()))}</p></div><span class="yr"><i></i>${esc(c.role)}</span></section>
    ${d.my_needs_action ? `<div class="alert mt"><b>${d.my_needs_action} واقعة تنتظر استكمالك للمعلومات.</b> <a href="incidents.html">افتح وقائعي</a></div>` : ""}
    <h3 class="sec">مهامي</h3><div class="grid">${mk.join("")}</div>
    ${sens ? `<h3 class="sec">الوقائع السلوكية</h3><div class="grid">${wk.join("")}</div>` : ""}
    <h3 class="sec">المدرسة</h3><div class="grid">${kp.join("")}</div>
    <h3 class="sec">الإنجاز والدعم</h3><div class="grid">${[kpi("trophy", x.achievements, "إنجازاً موثقاً", 4), kpi("star", x.talents, "موهبة مرصودة", 3), ...(x.achievements_pending != null ? [kpi("clock", x.achievements_pending, "إنجازاً بانتظار التحقق", 2)] : []), ...(x.support_active != null ? [kpi("help", x.support_active, "حالة دعم نشطة", 0), kpi("hourglass", x.support_due, "متابعة متأخرة", 2)] : [])].join("")}</div>
    <div class="grid mt"><div class="card"><h4 style="margin-top:0">التعزيز اليومي (آخر 14 يوماً)</h4>${bars(d.series)}</div>
      <div class="card"><h4 style="margin-top:0">حسب نوع التعزيز</h4>${rankRows(d.by_type, "type", "n")}</div>
      <div class="card"><h4 style="margin-top:0">حسب الصف</h4>${rankRows(d.by_grade, "grade", "n")}</div></div>
    <h3 class="sec">أحدث العمليات</h3>${d.recent.length ? d.recent.map((r) => `<div class="item"><div class="row2"><div><b>${esc(r.student)}</b> · ${esc(r.type)}</div><span>${r.points ? pts(r.points) : ""} <small>${esc(ago(r.created_at))}</small></span></div></div>`).join("") : empty("check", "لا تعزيزات بعد", "ابدأ بتسجيل أول تعزيز.")}
    <h3 class="sec">آخر وقائعي</h3><div id="mi">${mine.length ? mine.map(incidentCard).join("") : '<p class="sub">لم ترفع وقائع.</p>'}</div>
    <div class="acts mt"><a class="btn" href="reinforce.html">${ico("plus")}تسجيل تعزيز</a><a class="btn sec" href="behavior.html">تسجيل سلوك</a></div>
    <p class="sub">المؤشرات من قاعدة البيانات مباشرة، وتغطي ${esc(fmtShort(d.since))} إلى اليوم في المخططات.</p>`;
    bindIncidents($("#mi"), () => location.reload());
  }),

  reinforce: () => boot("reinforce.html", async (m, c) => {
    const [T, F, BQ, SQ] = await Promise.all([types("qm_reinforcement_types"), rpc("qm_pub_filters"),
      sb.from("qm_badges").select("id,name_ar,criteria,points,kind,icon,image_path").eq("is_active", true).order("sort_order"), sb.from("qm_settings").select("max_points_per_award").single()]);
    const B = (BQ.data || []).map((b) => ({ ...b, image: b.image_path })), maxP = SQ.data?.max_points_per_award || 50;
    const st = { grade: "", section: "", rows: [], sel: new Set() };
    m.innerHTML = `<div class="card gr-steps"><div class="gr-step"><span>المرحلة</span><div class="gr-chips"><button type="button" aria-pressed="true">المتوسطة</button></div></div>
        <div class="gr-step"><span>الصف</span><div class="gr-chips" id="gG">${F.grades.map((g) => `<button type="button" data-g="${esc(g.code)}" aria-pressed="false">${esc(g.name)}</button>`).join("")}</div></div>
        <div class="gr-step" id="gSw" hidden><span>الفصل</span><div class="gr-chips" id="gS"></div></div>
        <div class="acts"><button class="btn sec" id="one" type="button">${ico("search")}منح متعلم واحد بالبحث عن اسمه</button></div></div>
      <div id="ro" class="mt">${empty("users", "اختر الصف ثم الفصل", "تظهر أسماء متعلمي الفصل، وبجوار كل اسم زر النقاط وزر الوسام.")}</div>
      <h3 class="sec">آخر ما منحتُه من نقاط</h3><div id="rc"></div>`;
    const loadRec = async () => { const r = await rpc("qm_reinforcements_list", { p_mine: true, p_limit: 8 }); $("#rc").innerHTML = r.length ? r.map(reinfItem).join("") : '<p class="sub">لم تمنح نقاطاً بعد.</p>'; bindVoid($("#rc"), async () => { await loadRec(); await loadRoster(); }, c); };

    // نافذة المنح: تبويب للنقاط وتبويب للوسام، لمتعلم واحد أو لمجموعة
    const grant = (studs, kind) => {
      let k = kind || "points", ref = { points: T[0]?.id || "", badge: "" };
      const md = modal("", true);
      const paint = () => {
        const one = studs.length === 1;
        md.el.innerHTML = `<div class="row2"><div><h3 style="margin:0">${one ? "منح " + esc(studs[0].name) : "منح " + studs.length + " متعلماً"}</h3><p class="sub">${one ? klass(studs[0]) : "يُمنح الجميع الشيء نفسه دفعة واحدة."}</p></div><button class="btn sm sec" data-x type="button">إغلاق</button></div>
          ${one ? "" : `<div class="gr-who">${studs.map((s) => `<span>${esc(shortName(s.name))}</span>`).join("")}</div>`}
          <div class="tabs"><button type="button" data-k="points" class="${k === "points" ? "on" : ""}">${ico("star")} نقاط</button><button type="button" data-k="badge" class="${k === "badge" ? "on" : ""}">${ico("medal")} وسام</button></div>
          ${k === "points" ? `<label>سبب المنح</label><div class="gr-opts">${T.map((t) => `<button type="button" class="gr-opt" data-r="${t.id}" data-p="${t.default_points}" aria-pressed="${t.id === ref.points}"><b>${esc(t.name_ar)}</b><span class="pp">${t.default_points ? "<bdi>+" + t.default_points + "</bdi>" : "بلا نقاط"}</span></button>`).join("")}</div>
            <div class="two"><div><label for="gp">عدد النقاط (حتى ${maxP})</label><input id="gp" type="number" min="0" max="${maxP}" value="${T.find((t) => t.id === ref.points)?.default_points ?? 0}"></div><div><label for="gn">ملاحظة (اختياري)</label><input id="gn" maxlength="300"></div></div>`
          : (B.length ? `<label>الوسام</label><div class="gr-opts">${B.map((b) => `<button type="button" class="gr-opt" data-r="${b.id}" aria-pressed="${b.id === ref.badge}">${medal(b, "sm")}<b>${esc(b.name_ar)}</b><span class="pp">${b.points ? "<bdi>+" + b.points + "</bdi> نقطة" : "بلا نقاط"}</span><small>${KIND[b.kind] || ""}</small></button>`).join("")}</div>
            <p class="sub" id="gc"></p><label for="gn">سبب المنح (اختياري)</label><input id="gn" maxlength="300">` : `<p class="sub">لا أوسمة فعّالة. يضيفها مدير النظام من الإدارة ← الأوسمة.</p>`)}
          <p class="err" id="ge" role="alert"></p><div class="acts mt"><button class="btn" id="go" type="button">${k === "points" ? "منح النقاط" : "منح الوسام"}</button></div>`;
        $("[data-x]", md.el).onclick = md.close;
        $$("[data-k]", md.el).forEach((b) => (b.onclick = () => { k = b.dataset.k; paint(); }));
        const crit = () => { const g = $("#gc", md.el), b = B.find((x) => x.id === ref.badge); if (g) g.textContent = b?.criteria ? "سبب الاستحقاق: " + b.criteria : ""; };
        $$(".gr-opt", md.el).forEach((b) => (b.onclick = () => { ref[k] = b.dataset.r; $$(".gr-opt", md.el).forEach((x) => x.setAttribute("aria-pressed", x === b)); if (k === "points") $("#gp", md.el).value = b.dataset.p || 0; else crit(); }));
        crit();
        $("#go", md.el).onclick = async () => {
          const er = $("#ge", md.el), go = $("#go", md.el); er.textContent = "";
          if (!ref[k]) { er.textContent = k === "points" ? "اختر سبب المنح." : "اختر الوسام."; return; }
          go.disabled = true;
          try {
            const R = await rpc("qm_grant_bulk", { p_students: studs.map((s) => s.id), p_kind: k, p_ref: ref[k], p_points: k === "points" ? +$("#gp", md.el).value || 0 : 0, p_note: $("#gn", md.el)?.value || null });
            md.close();
            const sk = R.skipped.length, why = k === "badge" ? "يحملون الوسام من قبل" : "مُنحوا السبب نفسه قبل قليل";
            toast(R.ok ? `${k === "points" ? "مُنحت النقاط" : "مُنح الوسام"} لـ ${R.ok} متعلماً${sk ? `، وتُجوِّز ${sk} (${why})` : ""}` : `لم يُمنح أحد: ${why}.`, !R.ok);
            st.sel.clear(); await Promise.all([loadRoster(), loadRec()]);
          } catch (e) { er.textContent = mapErr(e); go.disabled = false; }
        };
      };
      paint();
    };

    const drawRoster = () => {
      const ro = $("#ro");
      if (!st.section) { ro.innerHTML = empty("users", st.grade ? "اختر الفصل" : "اختر الصف ثم الفصل", "تظهر أسماء متعلمي الفصل، وبجوار كل اسم زر النقاط وزر الوسام."); return; }
      if (!st.rows.length) { ro.innerHTML = empty("users", "لا متعلمين في هذا الفصل"); return; }
      const n = st.sel.size, all = n === st.rows.length;
      ro.innerHTML = `<div class="card gr-list"><div class="gr-bar"><label><input type="checkbox" id="all" ${all ? "checked" : ""}>تحديد الكل</label><span class="sub" style="margin:0">${n ? "المحدد: " + n : st.rows.length + " متعلماً"}</span><span class="sp"></span>
          <button class="btn sm" id="bp" type="button" ${n ? "" : "disabled"}>${ico("star")}نقاط للمحددين</button><button class="btn sm sec" id="bb" type="button" ${n ? "" : "disabled"}>${ico("medal")}وسام للمحددين</button></div>
        ${st.rows.map((s) => `<div class="gr-row${st.sel.has(s.id) ? " sel" : ""}" data-id="${s.id}"><input type="checkbox" aria-label="تحديد ${esc(s.name)}" ${st.sel.has(s.id) ? "checked" : ""}><div class="nm"><b>${esc(s.name)}</b><small>${s.badges.length ? s.badges.length + " وسام، " : ""}هذا الشهر ${s.month} نقطة</small></div><div class="bal">${s.balance}<small>الرصيد</small></div>
          <div class="gr-acts"><button class="gr-ib" type="button" data-a="points" title="منح نقاط" aria-label="منح نقاط لـ ${esc(s.name)}">${ico("star")}</button><button class="gr-ib gold" type="button" data-a="badge" title="منح وسام" aria-label="منح وسام لـ ${esc(s.name)}">${ico("medal")}</button></div></div>`).join("")}</div>`;
      const picked = () => st.rows.filter((s) => st.sel.has(s.id));
      $("#all").onchange = (e) => { st.sel = new Set(e.target.checked ? st.rows.map((s) => s.id) : []); drawRoster(); };
      $("#bp").onclick = () => grant(picked(), "points"); $("#bb").onclick = () => grant(picked(), "badge");
      $$(".gr-row", ro).forEach((row) => { const id = row.dataset.id, s = st.rows.find((x) => x.id === id);
        const tog = () => { st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id); drawRoster(); };
        $("input", row).onchange = tog; $(".nm", row).onclick = tog;
        $$("[data-a]", row).forEach((b) => (b.onclick = () => grant([s], b.dataset.a))); });
    };
    const loadRoster = async () => { if (!st.section) return drawRoster(); try { st.rows = await rpc("qm_section_roster", { p_section: st.section }); st.sel = new Set([...st.sel].filter((id) => st.rows.some((s) => s.id === id))); drawRoster(); } catch (e) { $("#ro").innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; } };
    const drawSecs = () => { const S = F.sections.filter((s) => s.grade === st.grade); $("#gSw").hidden = !st.grade;
      $("#gS").innerHTML = S.length ? S.map((s) => `<button type="button" data-s="${s.id}" aria-pressed="${s.id === st.section}">${esc(s.name)}</button>`).join("") : '<span class="sub">لا فصول لهذا الصف.</span>';
      $$("#gS button").forEach((b) => (b.onclick = () => { st.section = b.dataset.s; st.sel.clear(); $$("#gS button").forEach((x) => x.setAttribute("aria-pressed", x === b)); $("#ro").innerHTML = '<p class="sub">جارٍ التحميل…</p>'; loadRoster(); })); };
    $$("#gG button").forEach((b) => (b.onclick = () => { st.grade = b.dataset.g; st.section = ""; st.rows = []; st.sel.clear(); $$("#gG button").forEach((x) => x.setAttribute("aria-pressed", x === b)); drawSecs(); drawRoster(); }));
    $("#one").onclick = () => { const md = modal(`<div class="row2"><h3 style="margin:0">منح متعلم واحد</h3><button class="btn sm sec" data-x type="button">إغلاق</button></div><p class="sub">اكتب جزءاً من اسم المتعلم ثم اختره.</p><div id="opk" style="min-height:230px"></div>`);
      $("[data-x]", md.el).onclick = md.close; studentPicker($("#opk", md.el), (s) => { md.close(); grant([s], "points"); }); $("input", md.el).focus(); };
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
    $$("[data-c]", m).forEach((a) => (a.onclick = (e) => { e.preventDefault(); location.href = "student.html?id=" + a.dataset.c; }));
    let t = 0; const draw = async () => { const r = await rpc("qm_balances", { p_q: $("#q").value, p_limit: 60 });
      $("#li").innerHTML = r.length ? `<table class="tbl"><thead><tr><th>المتعلم</th><th>الصف</th><th>التعزيزات</th><th>الرصيد</th></tr></thead><tbody>${r.map((x) => `<tr data-c="${x.id}" style="cursor:pointer"><td>${esc(x.name)}</td><td>${esc(x.grade || "")}${x.section ? " · " + esc(x.section) : ""}</td><td>${x.awards}</td><td>${pts(x.balance)}</td></tr>`).join("")}</tbody></table>` : '<p class="sub">لا نتائج.</p>';
      $$("tr[data-c]", $("#li")).forEach((tr) => (tr.onclick = () => (location.href = "student.html?id=" + tr.dataset.c))); };
    $("#q").oninput = () => { clearTimeout(t); t = setTimeout(draw, 250); }; await draw();
  }),

  students: () => boot("students.html", async (m) => {
    const st = { s: null };
    m.innerHTML = `<div class="card form"><label>ابحث عن متعلم</label><div id="pk"></div><p class="sub">البيانات مرجعها النواة الرقمية، ولا تُنسخ داخل النظام. تعرض البطاقة ما تسمح به صلاحيتك.</p></div>`;
    studentPicker($("#pk"), (s) => (location.href = "student.html?id=" + s.id), { placeholder: "اكتب حرفين على الأقل من الاسم أو الرقم" });
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
// إعدادات الأوسمة: الاسم، سبب الاستحقاق، النقاط، النوع (تعليمي/عام)، وصورة يرفعها مدير النظام
async function badgeAdmin(root) {
  const draw = async () => {
    const { data: rows, error } = await sb.from("qm_badges").select("*").order("sort_order");
    if (error) { root.innerHTML = `<p class="err">${esc(mapErr(error))}</p>`; return; }
    root.innerHTML = `<div class="row2"><p class="sub" style="margin:0">لكل وسام سبب استحقاق ونقاط تُضاف إلى رصيد المتعلم عند منحه، ونوع يحدد تصنيفه في ملف المتعلم.</p><button class="btn" id="nb" type="button">${ico("plus")}إضافة وسام</button></div>
      ${rows.length ? `<div class="bd-g">${rows.map((b) => `<div class="bd-c${b.is_active ? "" : " off"}"><div class="hd">${medal({ ...b, image: b.image_path })}<div><b>${esc(b.name_ar)}</b><span class="badge ${b.kind === "educational" ? "info" : ""}">وسام ${KIND[b.kind]}</span> <span class="pts">${b.points ? "<bdi>+" + b.points + "</bdi> نقطة" : "بلا نقاط"}</span></div></div>
        <p><small>سبب الاستحقاق:</small> ${esc(b.criteria || "لم يُكتب بعد")}</p>${b.is_active ? "" : '<span class="badge">موقوف</span>'}<div class="acts"><button class="btn sm sec" data-e="${b.id}" type="button">تعديل</button></div></div>`).join("")}</div>` : empty("trophy", "لا أوسمة بعد", "أضف أول وسام ليتمكن المعلمون من منحه.")}`;
    $("#nb", root).onclick = () => form(null, rows.length);
    $$("[data-e]", root).forEach((x) => (x.onclick = () => form(rows.find((r) => r.id === x.dataset.e))));
  };
  const form = (b, n) => {
    const v = b || { name_ar: "", criteria: "", points: 0, kind: "general", is_active: true, image_path: null, icon: "trophy" };
    const md = modal(`<h3>${b ? "تعديل الوسام" : "إضافة وسام"}</h3><form id="bf">
      <label for="b_n">اسم الوسام</label><input id="b_n" required maxlength="80" value="${esc(v.name_ar)}">
      <div class="two"><div><label for="b_k">نوع الوسام</label><select id="b_k"><option value="educational">تعليمي</option><option value="administrative">إداري</option><option value="general">عام</option></select></div><div><label for="b_p">نقاط الوسام</label><input id="b_p" type="number" min="0" max="1000" value="${v.points}"></div></div>
      <label for="b_c">سبب استحقاق الوسام</label><textarea id="b_c" maxlength="400" placeholder="مثال: حفظ جزء كامل، أو المحافظة على الانضباط شهراً كاملاً">${esc(v.criteria || "")}</textarea>
      <label for="b_f">صورة الوسام (PNG أو JPG أو WebP، حتى 2 ميجابايت)</label><div class="bd-pv"><span id="b_v">${medal({ ...v, image: v.image_path }, "lg")}</span><div><input id="b_f" type="file" accept="image/png,image/jpeg,image/webp">${v.image_path ? '<label class="ck"><input type="checkbox" id="b_rm"> حذف الصورة والعودة للأيقونة</label>' : ""}</div></div>
      ${b ? `<label class="ck"><input type="checkbox" id="b_a" ${v.is_active ? "checked" : ""}> فعّال (يظهر للمعلمين عند المنح)</label>` : ""}
      <p class="err" id="b_e" role="alert"></p><div class="acts mt"><button class="btn" id="b_s">حفظ الوسام</button><button class="btn sec" type="button" id="b_x">رجوع</button></div></form>`);
    $("#b_k", md.el).value = v.kind; $("#b_x", md.el).onclick = md.close;
    $("#b_f", md.el).onchange = (e) => { const f = e.target.files[0]; if (!f) return; const u = URL.createObjectURL(f); $("#b_v", md.el).innerHTML = `<span class="mdl lg" data-k="${esc($("#b_k", md.el).value)}"><img src="${u}" alt=""></span>`; };
    $("#bf", md.el).onsubmit = async (ev) => { ev.preventDefault(); const er = $("#b_e", md.el), btn = $("#b_s", md.el); er.textContent = ""; btn.disabled = true;
      try {
        const f = $("#b_f", md.el).files[0]; let path = v.image_path;
        if (f) {
          if (f.size > 2 * 1024 * 1024) throw new Error("حجم الصورة يتجاوز 2 ميجابايت.");
          if (!/^image\/(png|jpeg|webp)$/.test(f.type)) throw new Error("الأنواع المسموحة: PNG أو JPG أو WebP.");
          path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${f.type.split("/")[1].replace("jpeg", "jpg")}`;
          const up = await sb.storage.from("qm-badges").upload(path, f, { contentType: f.type, cacheControl: "31536000" });
          if (up.error) throw new Error("تعذر رفع الصورة. تأكد من أنك مدير النظام ثم أعد المحاولة.");
        } else if ($("#b_rm", md.el)?.checked) path = null;
        const o = { name_ar: $("#b_n", md.el).value.trim(), kind: $("#b_k", md.el).value, points: Math.max(0, +$("#b_p", md.el).value || 0), criteria: $("#b_c", md.el).value.trim() || null, image_path: path };
        if (b) o.is_active = $("#b_a", md.el).checked; else o.sort_order = (n || 0) + 1;
        const q = b ? await sb.from("qm_badges").update(o).eq("id", b.id) : await sb.from("qm_badges").insert(o);
        if (q.error) throw new Error(mapErr(q.error));
        if (path !== v.image_path && v.image_path) sb.storage.from("qm-badges").remove([v.image_path]).catch(() => {});
        md.close(); toast("حُفظ الوسام"); draw();
      } catch (e) { er.textContent = mapErr(e); btn.disabled = false; } };
  };
  await draw();
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
      } else if (cur === "types") await crud(body, "qm_reinforcement_types", [{ k: "name_ar", l: "الاسم" }, { k: "domain", l: "المجال", t: "select", o: [["academic", "أكاديمي"], ["behavior", "سلوكي"], ["participation", "مشاركة"], ["leadership", "قيادي"], ["general", "عام"]] }, { k: "default_points", l: "النقاط المقترحة", t: "number" }, { k: "criteria", l: "طريقة الاستحقاق (تظهر للطلاب)" }, { k: "is_active", l: "فعّال", t: "bool" }], [{ k: "name_ar", l: "الاسم", req: 1 }, { k: "domain", l: "المجال", t: "select", o: [["general", "عام"], ["academic", "أكاديمي"], ["behavior", "سلوكي"], ["participation", "مشاركة"], ["leadership", "قيادي"]] }, { k: "default_points", l: "النقاط المقترحة", t: "number" }, { k: "criteria", l: "طريقة الاستحقاق (تظهر للطلاب)" }]);
      else if (cur === "badges") await badgeAdmin(body);
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

const LV = { school: "المدرسة", local: "محلي", national: "وطني", international: "دولي" };
const AST = { pending: ["بانتظار التحقق", "warn"], verified: ["موثّق", "ok"], needs_info: ["يحتاج استكمالاً", "warn"], rejected: ["غير معتمد", "bad"] };
const achItem = (a) => `<div class="item" data-ach="${a.id}" tabindex="0" role="button"><div class="row2"><div><b>${esc(a.title)}</b> ${tbadge(AST[a.status][0], AST[a.status][1])}<br><small>${esc(a.category)} · ${esc(LV[a.level])} · ${esc(fmtDay(a.achieved_on))}</small></div><small>${esc(a.students.map((s) => s.name).slice(0, 3).join("، "))}${a.students.length > 3 ? " +" + (a.students.length - 3) : ""}</small></div></div>`;
async function openAchievement(id, done) {
  const md = modal('<p class="sub">جارٍ التحميل…</p>', true);
  try {
    const a = await rpc("qm_achievement_get", { p_id: id });
    md.el.innerHTML = `<div class="row2"><div><h3 style="margin:0">${esc(a.title)}</h3><p class="sub">${esc(a.category)} · ${esc(LV[a.level])}${a.organizer ? " · " + esc(a.organizer) : ""} · ${esc(fmtDay(a.achieved_on))}</p></div><button class="btn sm sec" data-x>إغلاق</button></div>
    ${tbadge(AST[a.status][0], AST[a.status][1])} <small>سجّله: ${esc(a.recorded_by)}</small>
    ${a.description ? `<p>${esc(a.description)}</p>` : ""}${a.review_note ? `<p class="sub">ملاحظة المراجعة: ${esc(a.review_note)}</p>` : ""}
    <h4 class="sec">المتعلمون</h4>${a.students.map((s) => `<div class="item"><b>${esc(s.name)}</b> <small>${esc(s.grade || "")}${s.section ? " · " + esc(s.section) : ""}</small>${s.contribution ? `<p class="sub">${esc(s.contribution)}</p>` : ""}</div>`).join("")}
    ${a.attachments.length ? `<h4 class="sec">الشواهد</h4>${a.attachments.map((p, i) => `<button class="btn sm sec" data-at="${esc(p)}">${ico("list")}شاهد ${i + 1}</button> `).join("")}` : ""}
    <div class="acts mt" id="ac"></div>`;
    $("[data-x]", md.el).onclick = md.close;
    $$("[data-at]", md.el).forEach((b) => (b.onclick = () => openAttachment(b.dataset.at)));
    const ac = $("#ac", md.el), act = (label, cls, fn) => { const b = document.createElement("button"); b.className = "btn sm " + cls; b.textContent = label; b.onclick = fn; ac.appendChild(b); };
    const verify = (d, label, req) => act(label, d === "verified" ? "" : "sec", async () => { const n = await askNote(label, "الملاحظة", req); if (n === null) return; try { await rpc("qm_achievement_verify", { p_id: id, p_decision: d, p_note: n }); md.close(); toast("تم الحفظ"); done && done(); } catch (e) { toast(mapErr(e), true); } });
    if (a.can_review && a.status !== "verified") verify("verified", "توثيق الإنجاز", false);
    if (a.can_review && a.status !== "rejected") { verify("needs_info", "طلب استكمال", true); verify("rejected", "عدم الاعتماد", true); }
    if (a.mine && a.status === "needs_info") act("إرسال الاستكمال", "", async () => { const n = await askNote("استكمال الإنجاز", "وصف إضافي", true); if (n === null) return; try { await rpc("qm_achievement_resubmit", { p_id: id, p_desc: n }); md.close(); toast("أُعيد للتحقق"); done && done(); } catch (e) { toast(mapErr(e), true); } });
  } catch (e) { md.el.innerHTML = `<p class="err">${esc(mapErr(e))}</p><button class="btn sec" data-x>إغلاق</button>`; $("[data-x]", md.el).onclick = md.close; }
}
Object.assign(PAGES, {
  achievements: () => boot("achievements.html", async (m, ctx) => {
    const tabs = [["gallery", "معرض الإنجازات"], ["mine", "إنجازاتي"], ["add", "تسجيل إنجاز"], ["talents", "المواهب"]];
    if (ctx.isAdmin) tabs.splice(2, 0, ["review", "بانتظار التحقق"]);
    let cur = new URLSearchParams(location.search).get("t"); if (!tabs.some((t) => t[0] === cur)) cur = "gallery";
    const paint = async () => {
      m.innerHTML = `<div class="tabs">${tabs.map(([k, n]) => `<button type="button" class="${k === cur ? "on" : ""}" data-t="${k}">${n}</button>`).join("")}</div><div id="tb"></div>`;
      $$("[data-t]", m).forEach((b) => (b.onclick = () => { cur = b.dataset.t; paint(); }));
      const tb = $("#tb", m);
      if (["gallery", "mine", "review"].includes(cur)) {
        const L = await rpc("qm_achievements_list", { p_scope: cur });
        tb.innerHTML = L.length ? L.map(achItem).join("") : empty("trophy", "لا إنجازات هنا بعد", cur === "gallery" ? "تظهر هنا الإنجازات الموثقة فقط." : "");
        tb.onclick = (e) => { const el = e.target.closest("[data-ach]"); if (el) openAchievement(el.dataset.ach, paint); };
      } else if (cur === "talents") {
        const [L, st] = [await rpc("qm_talents_list", {}), { s: null }];
        tb.innerHTML = `<div class="card form"><h4 style="margin-top:0">رصد موهبة</h4><label>المتعلم</label><div id="pk"></div><label>المجال</label><input id="tf" maxlength="80" placeholder="مثل: الإلقاء، البرمجة، كرة القدم"><label>الموهبة أو القدرة</label><input id="tn" maxlength="120"><label>وصف (اختياري)</label><textarea id="td" maxlength="500"></textarea><p class="err" id="te"></p><button class="btn" id="ts">حفظ</button></div>
        <h4 class="sec">المواهب المرصودة</h4>${L.length ? L.map((t) => `<div class="item"><div class="row2"><div><b>${esc(t.student)}</b> <small>${esc(t.grade || "")}${t.section ? " · " + esc(t.section) : ""}</small><br>${esc(t.field)} · ${esc(t.name)}</div>${t.mine || ctx.isAdmin ? `<button class="btn sm sec" data-ar="${t.id}">أرشفة</button>` : ""}</div>${t.description ? `<p class="sub">${esc(t.description)}</p>` : ""}<small>رصدها: ${esc(t.noted_by)}</small></div>`).join("") : empty("star", "لا مواهب مرصودة")}`;
        pickerField($("#pk"), st, "s");
        $("#ts").onclick = async () => { try { if (!st.s) throw new Error("اختر المتعلم."); await rpc("qm_talent_add", { p_student: st.s.id, p_field: $("#tf").value, p_name: $("#tn").value, p_desc: $("#td").value }); toast("تم الحفظ"); paint(); } catch (e) { $("#te").textContent = mapErr(e); } };
        $$("[data-ar]", tb).forEach((b) => (b.onclick = async () => { const n = await askNote("أرشفة الموهبة", "السبب", false); if (n === null) return; try { await rpc("qm_talent_archive", { p_id: b.dataset.ar, p_reason: n }); paint(); } catch (e) { toast(mapErr(e), true); } }));
      } else {
        const C = await types("qm_achievement_categories"), S = [];
        tb.innerHTML = `<div class="card form"><label>عنوان الإنجاز</label><input id="at" maxlength="200"><div class="grid2"><div><label>التصنيف</label><select id="ac">${opt(C)}</select></div><div><label>المستوى</label><select id="al">${Object.entries(LV).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div><div><label>التاريخ</label><input id="ad" type="date" max="${todayISO()}" value="${todayISO()}"></div><div><label>الجهة المنظمة (اختياري)</label><input id="ao" maxlength="150"></div></div>
        <label>وصف الإنجاز</label><textarea id="ax" maxlength="1000"></textarea><label>المتعلمون المشاركون</label><div id="pk"></div><div id="sl"></div>
        <label>الشواهد (صورة أو PDF، حتى 3)</label><input id="af" type="file" accept="image/*,application/pdf" multiple><p class="sub">يُسجَّل الإنجاز بحالة «بانتظار التحقق»، ولا يظهر في المعرض إلا بعد توثيقه.</p><p class="err" id="ae"></p><button class="btn" id="asv">إرسال للتحقق</button></div>`;
        const drawS = () => { $("#sl").innerHTML = S.map((s, i) => `<div class="item"><div class="row2"><b>${esc(s.name)}</b><button class="btn sm sec" data-rm="${i}">إزالة</button></div><input data-c="${i}" maxlength="200" placeholder="دور المتعلم في الإنجاز (اختياري)" value="${esc(s.contribution || "")}"></div>`).join("");
          $$("[data-rm]", tb).forEach((b) => (b.onclick = () => { S.splice(+b.dataset.rm, 1); drawS(); })); $$("[data-c]", tb).forEach((i) => (i.oninput = () => (S[+i.dataset.c].contribution = i.value))); };
        studentPicker($("#pk"), (s) => { if (!S.some((x) => x.id === s.id)) S.push({ ...s, contribution: "" }); drawS(); });
        $("#asv").onclick = async () => { const b = $("#asv"); b.disabled = true; try {
          const files = [...$("#af").files].slice(0, 3), paths = []; for (const f of files) paths.push(await uploadFile(f, ctx.uid));
          await rpc("qm_achievement_create", { p_title: $("#at").value, p_category: $("#ac").value, p_date: $("#ad").value, p_level: $("#al").value, p_organizer: $("#ao").value, p_desc: $("#ax").value, p_students: S.map((s) => ({ student_id: s.id, contribution: s.contribution })), p_attachments: paths });
          toast("أُرسل للتحقق"); cur = "mine"; paint(); } catch (e) { $("#ae").textContent = mapErr(e); b.disabled = false; } };
      }
    }; await paint();
    const i = new URLSearchParams(location.search).get("i"); if (i) openAchievement(i, paint);
  }),

  support: () => boot("support.html", async (m, ctx) => {
    let scope = "active"; const T = await types("qm_support_types");
    const ST = { new: ["جديدة", "warn"], active: ["قيد المتابعة", ""], closed: ["مغلقة", "ok"] };
    const EVN = { opened: "فتح الحالة", plan: "خطة دعم", action: "إجراء", follow_up: "متابعة دورية", note: "ملاحظة", closed: "إغلاق الحالة", reopened: "إعادة فتح", assigned: "استلام الحالة" };
    const paint = async () => {
      const L = await rpc("qm_support_list", { p_scope: scope });
      m.innerHTML = `<div class="row2"><div class="tabs">${[["active", "النشطة"], ["new", "الجديدة"], ["closed", "المغلقة"], ["all", "الكل"]].map(([k, n]) => `<button type="button" class="${k === scope ? "on" : ""}" data-s="${k}">${n}</button>`).join("")}</div><button class="btn" id="nw">${ico("plus")}فتح حالة دعم</button></div>
      <p class="sub">تُفتح الحالة عند وجود حاجة فعلية فقط، ولا تُنشأ ملفات اجتماعية أو نفسية دائمة. تُحفظ الحالات المغلقة وفق مدة الاحتفاظ المحددة في الإعدادات.</p>
      ${L.length ? L.map((c) => `<div class="item" data-c="${c.id}" tabindex="0" role="button"><div class="row2"><div><b>حالة ${c.no} · ${esc(c.student)}</b> ${tbadge(ST[c.status][0], ST[c.status][1])}${c.overdue ? ' <span class="badge bad">متابعة متأخرة</span>' : ""}<br><small>${esc(c.grade || "")}${c.section ? " · " + esc(c.section) : ""} · ${esc(c.type)}${c.owner ? " · المسؤول: " + esc(c.owner) : ""}</small></div><small>${c.next_follow_up ? "المتابعة: " + esc(fmtShort(c.next_follow_up)) : ""}</small></div></div>`).join("") : empty("help", "لا حالات في هذا العرض")}`;
      $$("[data-s]", m).forEach((b) => (b.onclick = () => { scope = b.dataset.s; paint(); }));
      $$("[data-c]", m).forEach((el) => (el.onclick = () => openCase(el.dataset.c)));
      $("#nw").onclick = () => newCase();
    };
    function newCase(pre) {
      const st = { s: pre || null }, md = modal(`<h3>فتح حالة دعم</h3><label>المتعلم</label><div id="pk"></div><label>نوع الدعم</label><select id="ty">${opt(T)}</select><label>وصف الحاجة</label><textarea id="nd" maxlength="1000"></textarea><label>الهدف المرجو (اختياري)</label><input id="ng" maxlength="300"><p class="err" id="ne"></p><div class="acts mt"><button class="btn" id="ok">فتح الحالة</button><button class="btn sec" id="no">رجوع</button></div>`);
      pickerField($("#pk", md.el), st, "s"); $("#no", md.el).onclick = md.close;
      $("#ok", md.el).onclick = async () => { try { if (!st.s) throw new Error("اختر المتعلم."); await rpc("qm_support_open", { p_student: st.s.id, p_type: $("#ty", md.el).value, p_need: $("#nd", md.el).value, p_goal: $("#ng", md.el).value }); md.close(); toast("فُتحت الحالة"); paint(); } catch (e) { $("#ne", md.el).textContent = mapErr(e); } };
    }
    async function openCase(id) {
      const md = modal('<p class="sub">جارٍ التحميل…</p>', true);
      const load = async () => { try {
        const c = await rpc("qm_support_get", { p_id: id }), mg = c.can.manage && c.status !== "closed";
        md.el.innerHTML = `<div class="row2"><div><h3 style="margin:0">حالة ${c.no} · ${esc(c.student)}</h3><p class="sub">${esc(c.grade || "")}${c.section ? " · " + esc(c.section) : ""} · ${esc(c.type)} · منذ ${esc(fmtDay(c.started_on))}</p></div><button class="btn sm sec" data-x>إغلاق</button></div>
        ${tbadge(ST[c.status][0], ST[c.status][1])}${c.owner ? ` <small>المسؤول: ${esc(c.owner)}</small>` : ""}${c.next_follow_up ? ` <small>المتابعة القادمة: ${esc(fmtDay(c.next_follow_up))}</small>` : ""}
        <h4 class="sec">الحاجة</h4><p>${esc(c.need)}</p>${c.goal ? `<p class="sub">الهدف: ${esc(c.goal)}</p>` : ""}
        ${c.plans.length ? `<h4 class="sec">خطط الدعم</h4>${c.plans.map((p) => `<div class="item"><b>${esc(p.title)}</b>${p.review_on ? ` <small>مراجعة: ${esc(fmtShort(p.review_on))}</small>` : ""}${p.strategies ? `<p class="sub">${esc(p.strategies)}</p>` : ""}</div>`).join("")}` : ""}
        <h4 class="sec">سجل المتابعة</h4>${c.events.map((e) => `<div class="item"><div class="row2"><b>${esc(EVN[e.kind] || e.kind)}</b><small>${esc(fmtT(e.created_at))} · ${esc(e.by)}</small></div>${e.note ? `<p class="sub">${esc(e.note)}</p>` : ""}${e.improvement ? `<small>مستوى التحسن: ${e.improvement} من 5</small>` : ""}</div>`).join("")}
        ${c.status === "closed" ? `<p class="sub">النتيجة: ${esc(c.result || "")}${c.final_improvement ? ` · التحسن النهائي ${c.final_improvement} من 5` : ""} · يُحتفظ بها حتى ${esc(fmtDay(c.retention_until))}</p>` : ""}
        <div class="acts mt" id="ac"></div>`;
        $("[data-x]", md.el).onclick = () => { md.close(); paint(); };
        const ac = $("#ac", md.el), act = (n, cls, fn) => { const b = document.createElement("button"); b.className = "btn sm " + cls; b.textContent = n; b.onclick = fn; ac.appendChild(b); };
        const post = async (kind, title, label, req, imp) => { const f = await askCase(title, label, req, imp); if (!f) return; try { await rpc("qm_support_act", { p_id: id, p_kind: kind, p_note: f.note, p_improvement: f.imp, p_next: f.next }); load(); } catch (e) { toast(mapErr(e), true); } };
        if (mg) { act("إضافة خطة دعم", "", async () => { const f = await askPlan(); if (!f) return; try { await rpc("qm_support_add_plan", { p_case: id, p_title: f.t, p_strategies: f.s, p_review_on: f.r }); load(); } catch (e) { toast(mapErr(e), true); } });
          act("توثيق إجراء", "sec", () => post("action", "توثيق إجراء", "الإجراء المنفذ", true)); act("متابعة دورية", "sec", () => post("follow_up", "متابعة دورية", "ملخص المتابعة", true, true));
          act("ملاحظة", "sec", () => post("note", "ملاحظة", "الملاحظة", true)); act("استلام الحالة", "sec", () => post("take", "استلام الحالة", "ملاحظة (اختياري)", false));
          act("إغلاق الحالة", "sec", () => post("close", "إغلاق الحالة", "نتيجة الدعم", true, true)); }
        if (c.can.manage && c.status === "closed") act("إعادة فتح", "sec", () => post("reopen", "إعادة فتح الحالة", "سبب إعادة الفتح", true));
      } catch (e) { md.el.innerHTML = `<p class="err">${esc(mapErr(e))}</p><button class="btn sec" data-x>إغلاق</button>`; $("[data-x]", md.el).onclick = md.close; } };
      await load();
    }
    function askCase(title, label, req, imp) { return new Promise((res) => {
      const md = modal(`<h3>${esc(title)}</h3><label>${esc(label)}</label><textarea id="nt" maxlength="1000"></textarea>${imp ? `<label>مستوى التحسن (1 إلى 5، اختياري)</label><select id="im"><option value="">—</option>${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select>` : ""}<label>موعد المتابعة القادمة (اختياري)</label><input id="nx" type="date"><p class="err" id="ne"></p><div class="acts mt"><button class="btn" id="ok">حفظ</button><button class="btn sec" id="no">رجوع</button></div>`);
      $("#no", md.el).onclick = () => { md.close(); res(null); };
      $("#ok", md.el).onclick = () => { const note = $("#nt", md.el).value.trim(); if (req && !note) { $("#ne", md.el).textContent = "هذا الحقل مطلوب."; return; } md.close(); res({ note, imp: imp && $("#im", md.el).value ? +$("#im", md.el).value : null, next: $("#nx", md.el).value || null }); }; }); }
    function askPlan() { return new Promise((res) => {
      const md = modal(`<h3>خطة دعم</h3><label>عنوان الخطة</label><input id="pt" maxlength="200"><label>الاستراتيجيات والإجراءات</label><textarea id="ps" maxlength="1500"></textarea><label>موعد المراجعة (اختياري)</label><input id="pr" type="date"><p class="err" id="ne"></p><div class="acts mt"><button class="btn" id="ok">حفظ الخطة</button><button class="btn sec" id="no">رجوع</button></div>`);
      $("#no", md.el).onclick = () => { md.close(); res(null); };
      $("#ok", md.el).onclick = () => { const t = $("#pt", md.el).value.trim(); if (!t) { $("#ne", md.el).textContent = "عنوان الخطة مطلوب."; return; } md.close(); res({ t, s: $("#ps", md.el).value, r: $("#pr", md.el).value || null }); }; }); }
    await paint();
    const i = new URLSearchParams(location.search).get("i"); if (i) openCase(i);
  }, { role: "support" }),
});

Object.assign(PAGES, {
  reports: () => boot("reports.html", async (m) => {
    const d0 = new Date(Date.now() - 29 * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
    m.innerHTML = `<div class="card form"><div class="grid2"><div><label>من تاريخ</label><input id="rf" type="date" value="${d0}"></div><div><label>إلى تاريخ</label><input id="rt" type="date" value="${todayISO()}"></div></div><p class="sub">تقرير مجمّع بالأعداد فقط، ولا يتضمن أسماء متعلمين.</p><div class="acts"><button class="btn" id="go">عرض التقرير</button><button class="btn sec" id="csv" disabled>تصدير CSV</button><button class="btn sec" id="pr" disabled>طباعة</button></div><p class="err" id="er"></p></div><div id="out"></div>`;
    let R = null;
    const blk = (t, rows) => `<div class="card"><h4 style="margin-top:0">${esc(t)}</h4>${rows.length ? rankRows(rows, "name", "n") : '<p class="sub">لا بيانات في الفترة.</p>'}</div>`;
    const run = async () => { $("#er").textContent = ""; try {
      R = await rpc("qm_report", { p_from: $("#rf").value, p_to: $("#rt").value });
      const lv = (rows) => rows.map((r) => ({ ...r, name: LV[r.name] || r.name }));
      $("#out").innerHTML = `<h3 class="sec">${esc(fmtDay(R.from))} إلى ${esc(fmtDay(R.to))}</h3><div class="grid">${kpi("check", R.reinforcements.total, "تعزيزاً", 1)}${kpi("star", R.reinforcements.points, "نقطة ممنوحة", 3)}${kpi("inbox", R.incidents.total, "واقعة مرصودة", 2)}${kpi("trophy", R.achievements.total, "إنجازاً موثقاً", 4)}${kpi("help", R.support.opened, "حالة دعم مفتوحة", 0)}${kpi("check", R.support.closed, "حالة دعم مغلقة", 1)}</div>
      ${R.support.avg_improvement != null ? `<p class="sub">متوسط التحسن النهائي للحالات المغلقة: ${R.support.avg_improvement} من 5</p>` : ""}
      <div class="grid mt">${blk("التعزيز حسب النوع", R.reinforcements.by_type)}${blk("التعزيز حسب الصف", R.reinforcements.by_grade)}${blk("الوقائع حسب التصنيف", R.incidents.by_category)}${blk("الوقائع حسب الحالة", R.incidents.by_status)}${blk("الإنجازات حسب التصنيف", R.achievements.by_category)}${blk("الإنجازات حسب المستوى", lv(R.achievements.by_level))}${blk("حالات الدعم حسب النوع", R.support.by_type)}</div>`;
      $("#csv").disabled = $("#pr").disabled = false;
    } catch (e) { $("#er").textContent = mapErr(e); } };
    $("#go").onclick = run;
    $("#pr").onclick = () => window.print();
    $("#csv").onclick = () => {
      const rows = [["القسم", "البند", "العدد"]];
      const add = (s, a) => a.forEach((r) => rows.push([s, r.name, r.n]));
      rows.push(["ملخص", "تعزيزات", R.reinforcements.total], ["ملخص", "نقاط", R.reinforcements.points], ["ملخص", "وقائع", R.incidents.total], ["ملخص", "إنجازات موثقة", R.achievements.total], ["ملخص", "حالات دعم مفتوحة", R.support.opened], ["ملخص", "حالات دعم مغلقة", R.support.closed]);
      add("تعزيز حسب النوع", R.reinforcements.by_type); add("تعزيز حسب الصف", R.reinforcements.by_grade); add("وقائع حسب التصنيف", R.incidents.by_category); add("وقائع حسب الحالة", R.incidents.by_status);
      add("إنجازات حسب التصنيف", R.achievements.by_category); add("إنجازات حسب المستوى", R.achievements.by_level.map((r) => ({ ...r, name: LV[r.name] || r.name }))); add("دعم حسب النوع", R.support.by_type);
      const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `qiyami-report-${R.from}-${R.to}.csv`; a.click(); URL.revokeObjectURL(a.href);
    };
    await run();
  }, { role: "report" }),
});

Object.assign(PAGES, {
  student: () => boot("student.html", async (m, ctx) => {
    const id = new URLSearchParams(location.search).get("id");
    if (!id) { m.innerHTML = empty("users", "لم يُحدَّد متعلم", "افتح الملف من لوحة التميز أو من دليل المتعلمين."); return; }
    const s = await rpc("qm_student_profile", { p_student: id });
    const ini = (s.name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(" ");
    document.title = s.name + " – قيمي";
    m.innerHTML = `<section class="sp-hero"><div class="sp-av" aria-hidden="true">${esc(ini)}</div><div class="sp-id"><small>الملف الشخصي للمتعلم</small><h2>${esc(s.name)}</h2><p>المرحلة: المتوسطة · الصف: ${esc(s.grade || "—")}${s.section ? " · " + esc(s.section) : ""}${s.no ? " · رقم " + esc(s.no) : ""}</p>
        <div class="sp-chips">${s.badges.slice(0, 4).map((b) => `<span class="bdg-i">${ico(b.icon in ICONS ? b.icon : "trophy")}${esc(b.name)}</span>`).join("")}</div></div>
      <div class="sp-pts"><b>${s.balance}</b><span>نقطة</span>${s.balance > 0 ? `<small>الترتيب ${s.rank} في المدرسة</small>` : ""}</div></section>
      <div class="grid mt">${kpi("check", s.reinforcements, "تعزيزاً", 1)}${kpi("trophy", s.badges.length, "وساماً", 3)}${kpi("star", s.achievements.length, "إنجازاً موثقاً", 4)}${kpi("bulb", s.talents.length, "موهبة", 0)}</div>
      <div class="grid mt">
        <div class="card" style="grid-column:1/-1"><h4 style="margin-top:0">من أين حصل على نقاطه؟</h4>${(s.by_type || []).length ? `<table class="tbl"><thead><tr><th>جانب التعزيز</th><th>عدد المرات</th><th>النقاط</th></tr></thead><tbody>${s.by_type.map((t) => `<tr><td><b>${esc(t.type)}</b></td><td>${t.n}</td><td>${pts(t.points)}</td></tr>`).join("")}</tbody><tfoot><tr><td><b>المجموع</b></td><td>${s.by_type.reduce((a, t) => a + t.n, 0)}</td><td>${pts(s.by_type.reduce((a, t) => a + (t.points || 0), 0))}</td></tr></tfoot></table>` : '<p class="sub">لا تعزيزات بعد.</p>'}</div>
        <div class="card"><h4 style="margin-top:0">من منح النقاط</h4>${s.givers.length ? rankRows(s.givers.map((g) => ({ name: g.name + " (" + g.n + " تعزيز)", points: g.points })), "name", "points") : '<p class="sub">لا نقاط ممنوحة بعد.</p>'}</div>
        <div class="card"><h4 style="margin-top:0">الأوسمة</h4>${s.badges.length ? s.badges.map((b) => `<div class="item"><div class="row2"><b>${ico(b.icon in ICONS ? b.icon : "trophy")} ${esc(b.name)}</b><small>${esc(fmtShort(b.at))}</small></div><small>منحه: ${esc(b.by)}</small></div>`).join("") : '<p class="sub">لا أوسمة بعد.</p>'}</div>
        <div class="card"><h4 style="margin-top:0">المواهب والقدرات</h4>${s.talents.length ? s.talents.map((t) => `<div class="item"><b>${esc(t.name)}</b> <small>${esc(t.field)}</small>${t.description ? `<p class="sub">${esc(t.description)}</p>` : ""}</div>`).join("") : '<p class="sub">لا مواهب مرصودة.</p>'}</div></div>
      <h3 class="sec">الإنجازات</h3>${s.achievements.length ? s.achievements.map((a) => `<div class="item"><div class="row2"><b>${esc(a.title)}</b><small>${esc(fmtDay(a.achieved_on))}</small></div><small>${esc(a.category)} · ${esc(LV[a.level])}</small></div>`).join("") : '<p class="sub">لا إنجازات موثقة بعد.</p>'}
      <h3 class="sec">سجل التعزيز</h3>${s.reinforcement_list.length ? s.reinforcement_list.map((r) => `<div class="item"><div class="row2"><div><b>${esc(r.type)}</b><br><small>منحه: ${esc(r.by)} · ${esc(fmtT(r.created_at))}</small></div>${r.points ? pts(r.points) : ""}</div>${r.description ? `<p class="sub">${esc(r.description)}</p>` : ""}</div>`).join("") : empty("check", "لا تعزيزات بعد")}
      ${s.positive.length ? `<h3 class="sec">مواقف إيجابية</h3>${s.positive.map((p) => `<div class="item"><div class="row2"><b>${esc(p.category)}</b><small>${esc(fmtShort(p.created_at))}</small></div><p class="sub">${esc(p.description)}</p><small>سجّلها: ${esc(p.by)}</small></div>`).join("")}` : ""}
      <p class="sub">ملف تعريفي يعرض الجانب الإيجابي فقط، ولا يتضمن بيانات تواصل أو سلوكية.</p>
      <div class="acts mt"><a class="btn sec" href="profiles.html">${ico("arrow")}ملفات الطلاب</a>${ctx.isAdmin || ctx.isAgent || ctx.isCounselor ? `<button class="btn sec" id="card">البطاقة الكاملة</button>` : ""}</div>`;
    const c = $("#card"); if (c) c.onclick = () => openStudentCard(id);
  }, { title: "ملف المتعلم", desc: "الجانب الإيجابي: النقاط ومن منحها والأوسمة والإنجازات" }),
});

Object.assign(PAGES, {
  points: () => boot("points.html", async (m) => {
    const T = await types("qm_reinforcement_types"), st = { s: null };
    m.innerHTML = `<div class="card form"><label>المتعلم</label><div id="pk"></div></div><div id="pb" style="margin-top:16px"></div>
      <div class="card mt"><h4 style="margin-top:0">نقاط أنواع التعزيز الافتراضية</h4><p class="sub">تظهر هذه القيم في «كيف تكسب النقاط؟» بالصفحة الرئيسية مرتبة من الأعلى. عدّل أو أضف أو احذف الأنواع من <a href="admin.html">الإدارة ← أنواع التعزيز</a>.</p>
      <table class="tbl"><thead><tr><th>النوع</th><th>النقاط الافتراضية</th></tr></thead><tbody>${[...T].sort((a, b) => b.default_points - a.default_points).map((t) => `<tr><td><b>${esc(t.name_ar)}</b></td><td>${pts(t.default_points)}</td></tr>`).join("")}</tbody></table></div>`;
    const paint = async () => {
      const box = $("#pb");
      if (!st.s) { box.innerHTML = empty("star", "اختر متعلماً", "ابحث باسمه لإضافة نقاط أو تعديلها أو حذفها."); return; }
      let D; try { D = await rpc("qm_student_reinforcements_admin", { p_student: st.s.id }); } catch (e) { box.innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; return; }
      box.innerHTML = `<div class="card"><div class="row2"><div><h4 style="margin:0">${esc(st.s.name)}</h4><small>${esc(st.s.grade || "")}${st.s.section ? " · " + esc(st.s.section) : ""}</small></div><div>الرصيد الحالي: ${pts(D.balance)}</div></div>
        <div class="two mt"><div><label>إضافة نقاط (نوع التعزيز)</label><select id="ty">${T.map((t) => `<option value="${t.id}" data-p="${t.default_points}">${esc(t.name_ar)}</option>`).join("")}</select></div><div><label>عدد النقاط</label><input id="pt" type="number" min="1" max="1000" value="${T[0]?.default_points || 1}"></div></div>
        <label>ملاحظة (اختياري)</label><input id="ds" maxlength="300"><p class="err" id="pe"></p>
        <div class="acts mt"><button class="btn" id="ad">${ico("plus")}إضافة النقاط</button><button class="btn sec" id="adj">خصم / تصحيح الرصيد</button><button class="btn sec" id="bg">منح وسام</button><a class="btn sec" href="student.html?id=${st.s.id}">فتح الملف</a></div></div>
        <div class="card mt"><h4 style="margin-top:0">التعزيزات المسجّلة</h4>${D.rows.length ? `<table class="tbl"><thead><tr><th>النوع</th><th>النقاط</th><th>منحها</th><th>التاريخ</th><th></th></tr></thead><tbody>${D.rows.map((r) => `<tr><td><b>${esc(r.type)}</b>${r.description ? `<br><small>${esc(r.description)}</small>` : ""}</td><td>${pts(r.points)}</td><td>${esc(r.by)}</td><td>${esc(fmtShort(r.created_at))}</td><td><button class="btn sm sec" data-e="${r.id}" data-p="${r.points}">تعديل</button> <button class="btn sm sec" data-d="${r.id}">حذف</button></td></tr>`).join("")}</tbody></table>` : '<p class="sub">لا تعزيزات.</p>'}</div>`;
      $("#ty").onchange = (e) => ($("#pt").value = e.target.selectedOptions[0].dataset.p || 1);
      $("#ad").onclick = async () => { try { await rpc("qm_admin_add_points", { p_student: st.s.id, p_type: $("#ty").value, p_points: +$("#pt").value, p_description: $("#ds").value }); toast("أُضيفت النقاط"); paint(); } catch (e) { $("#pe").textContent = mapErr(e); } };
      $("#adj").onclick = () => adjustPoints(st.s.id, paint);
      $("#bg").onclick = () => awardBadge(st.s.id, paint);
      $$("[data-e]", box).forEach((b) => (b.onclick = async () => {
        const md = modal(`<h3>تعديل نقاط التعزيز</h3><label>النقاط الجديدة</label><input id="np" type="number" min="0" max="1000" value="${b.dataset.p}"><label>سبب التعديل (مطلوب)</label><textarea id="nr"></textarea><p class="err" id="ne"></p><div class="acts mt"><button class="btn" id="ok">حفظ</button><button class="btn sec" id="no">رجوع</button></div>`);
        $("#no", md.el).onclick = md.close;
        $("#ok", md.el).onclick = async () => { try { await rpc("qm_edit_reinforcement_points", { p_id: b.dataset.e, p_points: +$("#np", md.el).value, p_reason: $("#nr", md.el).value }); md.close(); toast("عُدّلت النقاط"); paint(); } catch (e) { $("#ne", md.el).textContent = mapErr(e); } };
      }));
      $$("[data-d]", box).forEach((b) => (b.onclick = async () => { const n = await askNote("حذف التعزيز", "سبب الحذف (مطلوب). تُعكس نقاطه ويبقى أثره في سجل العمليات.", true); if (!n) return; try { await rpc("qm_void_reinforcement", { p_id: b.dataset.d, p_reason: n }); toast("حُذف التعزيز وعُكست نقاطه"); paint(); } catch (e) { toast(mapErr(e), true); } }));
    };
    const pk = $("#pk");
    const drawPk = () => { if (st.s) { pk.classList.remove("pick"); pk.innerHTML = chosenHTML(st.s); $("[data-clear]", pk).onclick = () => { st.s = null; drawPk(); paint(); }; } else studentPicker(pk, (s) => { st.s = s; drawPk(); paint(); }); };
    drawPk(); paint();
  }, { title: "إدارة النقاط", desc: "إضافة النقاط وتعديلها وحذفها" }),
});
