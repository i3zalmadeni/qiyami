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
    const nz = (p) => p.catch(() => null);
    const [d, x0, H0, mine, myR, inbox, cases, review] = await Promise.all([
      rpc("qm_dashboard", { p_days: 14 }), nz(rpc("qm_dashboard_ext")), nz(rpc("qm_pub_home")),
      null, null, null, null, null,
    ]);
    const x = x0 || {}, H = H0 || {}, hs = H.stats || {}, sup = c.isAgent || c.isCounselor;
    // المهام: ما ينتظر إجراء صاحب المكتب نفسه بحسب دوره
    const T = [], add = (n, ic, t, sb2, h) => { if (n > 0) T.push({ n, ic, t, s: sb2, h }); };
    add(d.my_needs_action, "help", "وقائع تنتظر استكمالك", "طُلبت منك معلومات إضافية عن وقائع رفعتَها", "negative.html?tab=incidents");
    add(x.my_achievements_needs, "trophy", "إنجازات تحتاج استكمالاً", "أُعيدت إليك لاستكمال بياناتها أو شواهدها", "positive.html?tab=achievements&t=mine");
    if (c.isAgent) { add(d.incidents_new, "inbox", "وقائع جديدة في صندوق الوكيل", "رفعها المعلمون وتنتظر بدء المراجعة", "agent.html"); add(d.incidents_overdue, "hourglass", "وقائع تأخرت أكثر من 3 أيام", "لم يُتخذ فيها إجراء منذ رصدها", "agent.html"); }
    if (c.isCounselor) add(d.incidents_referred, "users", "حالات محالة إلى الموجه الطلابي", "أحالها وكيل شؤون الطلاب للمتابعة الإرشادية", "counselor.html");
    if (c.isAdmin) add(x.achievements_pending, "clock", "إنجازات بانتظار التحقق", "سجّلها المعلمون وتنتظر التوثيق", "positive.html?tab=achievements&t=review");
    if (sup) { add(x.support_new, "help", "حالات دعم جديدة", "فُتحت ولم تُستلم بعد", "support.html"); add(x.support_due, "calendar", "متابعات دعم حان موعدها", "حالات تجاوزت موعد متابعتها", "support.html"); }
    const tasks = T.reduce((n, t) => n + (t.ic === "hourglass" ? 0 : t.n), 0); // المتأخرة محسوبة ضمن الجديدة
    const QA = [["positive.html", "plus", "منح نقاط أو وسام", "حسب الصف والفصل", 1], ["negative.html", "flag", "تسجيل سلوك سلبي", "يُرفع إلى الوكيل"], ["positive.html?tab=achievements&t=add", "trophy", "تسجيل إنجاز", "مع الشواهد"], ["students.html", "users", "دليل المتعلمين", "بحث وبطاقة المتعلم"]];
    // الاختصارات بحسب الصلاحية: التعزيز والسلوك السلبي
    for (let i = QA.length - 1; i >= 0; i--) { const h = QA[i][0]; if ((!c.canReinforce && /^positive\.html(\?tab=note)?$/.test(h)) || (!c.canBehavior && h.startsWith("negative.html"))) QA.splice(i, 1); }
    if (c.isAgent) { QA.forEach((q) => (q[0] = q[0].replace(/^(positive|negative)\.html(\?tab=)?/, (x, pg, t) => "teach.html?tab=" + (t ? "" : pg === "positive" ? "reinforce" : "behavior")))); 
      QA.unshift(["agent.html", "inbox", "صندوق الوكيل", "الوقائع الواردة"], ...(c.canReinforce ? [["award.html", "crown", "منح وسام", "أوسمة الوكيل العامة", 1]] : [])); }
    if (c.isCounselor) QA.push(["counselor.html", "help", "الحالات الإجرائية", "المحالة إليك"]);
    if (sup) QA.push([(c.isAgent ? "agent.html" : "counselor.html") + "?tab=support", "help", "المتابعة والدعم", "حالات الدعم التربوي"]);
    if (c.canReports) QA.push(["reports.html", "chart", "التقارير", "مؤشرات الفترة"]);
    // لوحة المنسق: لا اختصارات لما في القائمة (دليل المتعلمين، التقارير، الصلاحيات، إدارة البوابة)
    if (c.canSwitch && c.view === "coord") for (let i = QA.length - 1; i >= 0; i--) if (/^(students|reports|support|perms|admin)\.html/.test(QA[i][0])) QA.splice(i, 1);
    // آخر ما جرى: تُجمع عمليات المنح الجماعي (المانح والنوع والوقت نفسه) في سطر واحد
    const ev = [];
    (H.last_points || []).forEach((p) => { const k = ev.find((e) => e.k === "p" && e.at === p.at && e.by === p.by && e.type === p.type && e.points === p.points); if (k) k.n++; else ev.push({ k: "p", n: 1, ...p }); });
    (H.last_badges || []).forEach((bg) => ev.push({ k: "b", n: 1, ...bg }));
    ev.sort((a, b2) => new Date(b2.at) - new Date(a.at));
    const feed = ev.slice(0, 8).map((e) => `<div class="fd"><span class="fd-ic ${e.k}">${ico(e.k === "b" ? "medal" : "star")}</span><div>${e.k === "b"
      ? `<b><a href="learner.html?id=${e.id}">${esc(shortName(e.name))}</a></b> نال «${esc(e.badge)}»`
      : e.n > 1 ? `<b>${e.n} ${e.n > 10 ? "متعلماً" : "متعلمين"}</b> نالوا ${pts(e.points)} لكلٍّ منهم · ${esc(e.type)}` : `<b><a href="learner.html?id=${e.id}">${esc(shortName(e.name))}</a></b> نال ${pts(e.points)} · ${esc(e.type)}`}
      <small>${esc(e.by)} · ${esc(e.grade || "")}${e.section ? "، " + esc(e.section) : ""} · ${esc(ago(e.at))}</small></div></div>`).join("");
    const openCases = (cases || []).filter((i) => !i.is_closed).slice(0, 5);
    const queue = (t, href, rows, html) => (rows && rows.length ? `<div class="hd"><h3 class="sec">${t}</h3><a href="${href}">عرض الكل</a></div>${rows.map(html).join("")}` : "");
    const pl = (v, t) => `<div><b>${v ?? 0}</b><span>${t}</span></div>`;
    const sens = d.incidents_new !== null && d.incidents_new !== undefined;
    m.innerHTML = `
    <!-- اختصارات القائمة والقوائم المكررة حُذفت: المكتب للأعداد التي تنتظر الإجراء وما يدور في المنصة -->
    <div class="desk"><div>
      <h3 class="sec">بانتظار إجرائك</h3>
      ${T.length ? T.map((t) => `<a class="task" href="${t.h}"><span class="n">${t.n}</span><div><b>${t.t}</b><small>${t.s}</small></div><span class="go">فتح</span></a>`).join("") : empty("check", "لا شيء ينتظرك الآن", "تظهر هنا الوقائع والإنجازات والحالات التي تحتاج إجراءً منك.")}
    </div><aside>
      <h3 class="sec">ما يدور في المنصة</h3>
      <div class="card"><div class="pulse">${pl(hs.week, "عملية منح هذا الأسبوع")}${pl(hs.month_points, "نقطة هذا الشهر")}${pl(hs.students_awarded, "متعلماً نال تعزيزاً")}${pl(d.badges, "وساماً ممنوحاً")}${pl(x.achievements, "إنجازاً موثقاً")}${pl(x.talents, "موهبة مرصودة")}</div></div>
      ${sens ? `<div class="card"><h4 style="margin-top:0">مسار الوقائع السلوكية</h4><div class="pulse p3">${pl(d.incidents_new, "جديدة")}${pl(d.incidents_with_agent, "لدى الوكيل")}${pl(d.incidents_referred, "لدى الموجه")}</div></div>` : ""}
      <div class="card"><h4 style="margin-top:0">آخر ما جرى</h4>${feed || '<p class="sub">لا حركات بعد.</p>'}</div>
      <div class="card"><h4 style="margin-top:0">الأكثر منحاً</h4>${rankRows((H.givers || []).slice(0, 5), "name", "awards")}</div>
      <div class="card"><div class="hd"><h4 style="margin:0">متصدرو النقاط</h4><a href="leaderboard.html">لوحة الصدارة</a></div>${(H.top || []).slice(0, 5).map((r, i) => `<div class="rank"><span class="n ${i === 0 ? "g" : ""}">${i + 1}</span><b><a href="learner.html?id=${r.id}">${esc(shortName(r.name))}</a></b><span class="v">${r.balance}</span></div>`).join("") || '<p class="sub">لا أرصدة بعد.</p>'}</div>
    </aside></div>`;
    bindIncidents(m, () => location.reload());
    m.addEventListener("click", (e) => { const el = e.target.closest("[data-ach]"); if (el) openAchievement(el.dataset.ach, () => location.reload()); });
  }),

  reinforce: () => boot("positive.html", async (m, c) => {
    // من لا يمنح (المنسق في لوحته): الصفحة سجل التعزيز وحده
    if (!c.canReinforce) { m.innerHTML = '<div id="rc"></div>'; await reinfLog($("#rc"), c, false); return; }
    const [T, F, BQ, SQ] = await Promise.all([types("qm_reinforcement_types"), rpc("qm_pub_filters"),
      sb.from("qm_badges").select("id,name_ar,criteria,points,kind,category,icon,image_path").eq("is_active", true).order("sort_order"), sb.from("qm_settings").select("max_points_per_award").single()]);
    const B = (BQ.data || []).map((b) => ({ ...b, image: b.image_path })), maxP = SQ.data?.max_points_per_award || 50;
    const st = { grade: "", section: "", rows: [], sel: new Set() };
    F.sections = F.sections.filter((x) => canSection(x.id)); F.grades = F.grades.filter((g) => F.sections.some((x) => x.grade === g.code));
    if (!F.sections.length) { m.innerHTML = noSectionsMsg(); return; }
    m.innerHTML = `<div class="card gr-steps"><div class="gr-step"><span>المرحلة</span><div class="gr-chips"><button type="button" aria-pressed="true">المتوسطة</button></div></div>
        <div class="gr-step"><span>الصف</span><div class="gr-chips" id="gG">${F.grades.map((g) => `<button type="button" data-g="${esc(g.code)}" aria-pressed="false">${esc(g.name)}</button>`).join("")}</div></div>
        <div class="gr-step" id="gSw" hidden><span>الفصل</span><div class="gr-chips" id="gS"></div></div>
        <div class="acts"><button class="btn sec" id="one" type="button">${ico("search")}منح متعلم واحد بالبحث عن اسمه</button></div></div>
      <div id="ro" class="mt">${empty("users", "اختر الصف ثم الفصل", "تظهر أسماء متعلمي الفصل، وبجوار كل اسم زر النقاط وزر الوسام.")}</div>
      <h3 class="sec">سجل التعزيز</h3><div id="rc"></div>`;
    let logReload = null;
    const loadRec = async () => { if (logReload) return logReload(); logReload = await reinfLog($("#rc"), c, true, () => loadRoster()); };

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
          : (B.length ? `<label>الوسام</label>${badgeGroups(B, c.who?.specialty, c.isAdmin).map((g, i) => { const opt = (b) => `<button type="button" class="gr-opt" data-r="${b.id}" aria-pressed="${b.id === ref.badge}">${medal(b, "sm")}<b>${esc(b.name_ar)}</b><span class="pp">${b.points ? "<bdi>+" + b.points + "</bdi> نقطة" : "بلا نقاط"}</span></button>`;
              return `<details class="bg-g${g.mine ? " mine" : ""}" ${g.open || (ref.badge && g.items.some((b) => b.id === ref.badge)) || (i === 0 && !ref.badge) ? "open" : ""}><summary>${ico(g.icon)}<span>${esc(g.title)}</span><i>${g.items.length}</i></summary>${g.subs ? g.subs.map(([t, L]) => `<h5 class="bg-s">${esc(t)}</h5><div class="gr-opts">${L.map(opt).join("")}</div>`).join("") : `<div class="gr-opts">${g.items.map(opt).join("")}</div>`}</details>`; }).join("")}
            <p class="sub" id="gc"></p><label for="gn">سبب المنح (اختياري)</label><input id="gn" maxlength="300">` : `<p class="sub">لا أوسمة فعّالة. يضيفها مدير النظام من الإدارة ← الأوسمة.</p>`)}
          <p class="err" id="ge" role="alert"></p><div class="acts mt"><button class="btn" id="go" type="button">${k === "points" ? "منح النقاط" : "منح الوسام"}</button></div>`;
        $("[data-x]", md.el).onclick = md.close;
        $$("[data-k]", md.el).forEach((b) => (b.onclick = () => { k = b.dataset.k; paint(); }));
        const crit = () => { const g = $("#gc", md.el), b = B.find((x) => x.id === ref.badge); if (g) g.textContent = b ? "الوسام المختار: " + b.name_ar + (b.criteria ? ". سبب الاستحقاق: " + b.criteria : "") : ""; };
        $$(".gr-opt", md.el).forEach((b) => (b.onclick = () => { ref[k] = b.dataset.r; $$(".gr-opt", md.el).forEach((x) => x.setAttribute("aria-pressed", x === b)); if (k === "points") $("#gp", md.el).value = b.dataset.p || 0; else crit(); }));
        crit();
        $("#go", md.el).onclick = async () => {
          const er = $("#ge", md.el), go = $("#go", md.el); er.textContent = "";
          if (!ref[k]) { er.textContent = k === "points" ? "اختر سبب المنح." : "اختر الوسام."; return; }
          go.disabled = true;
          try {
            const R = await rpc("qm_grant_bulk", { p_students: studs.map((s) => s.id), p_kind: k, p_ref: ref[k], p_points: k === "points" ? +$("#gp", md.el).value || 0 : 0, p_note: $("#gn", md.el)?.value || null });
            md.close();
            const what = k === "points" ? "النقاط" : "الوسام", sk = R.skipped || [];
            if (R.ok) { const skId = new Set(sk.map((x) => x.id)), got = studs.filter((s) => !skId.has(s.id)), bd = B.find((x) => x.id === ref.badge), ty = T.find((x) => x.id === ref.points), np = +$("#gp", md.el)?.value || 0;
              const head = k === "badge" ? `تم منح وسام «${bd?.name_ar || ""}» بنجاح` : `تم منح ${np ? np + " نقطة" : "التعزيز"} (${ty?.name_ar || ""}) بنجاح`;
              notice(head, got.slice(0, 60).map((s) => [s.name, k === "badge" ? `نال وسام «${bd?.name_ar || ""}»` : `نال ${np ? np + " نقطة" : "التعزيز"}`]), "ok"); }
            if (sk.length) notice(R.ok ? `لم يُمنح ${what} لـ ${sk.length === 1 ? "متعلم واحد" : sk.length + " متعلمين"}` : `لم يُمنح ${what}`, sk.map((x) => [x.name, skipWhy(x.why, k)]));
            st.sel.clear(); await Promise.all([loadRoster(), loadRec()]);
          } catch (e) { er.textContent = mapErr(e); notice(k === "points" ? "لم تُمنح النقاط" : "لم يُمنح الوسام", [[null, mapErr(e)]]); go.disabled = false; }
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
      $("[data-x]", md.el).onclick = md.close; studentPicker($("#opk", md.el), (s) => { md.close(); grant([s], "points"); }, { filter: (s) => canSection(s.section_id) }); $("input", md.el).focus(); };
    await loadRec();
  }),

  // «موقف إيجابي» حُذف: منح النقاط أو الوسام هو توثيق الموقف الإيجابي (قرار المستخدم)
  note: () => location.replace(location.pathname.split("/").pop() + "?tab=reinforce"),

  behavior: () => boot("negative.html", async (m, c) => {
    const Ng = await types("qm_behavior_categories", (x) => x.kind === "negative"), sn = { s: null };
    const sec = (n, ic, t, d, body) => `<section class="ir-sec"><header><span class="ir-n">${n}</span>${ico(ic)}<div><h3>${t}</h3><p>${d}</p></div></header><div class="ir-b">${body}</div></section>`;
    m.innerHTML = `<form class="ir" id="fn" novalidate>
      ${sec(1, "user", "المتعلم", "ابحث باسم المتعلم أو رقمه واختره من القائمة.", `<div id="pkn"></div>`)}
      ${sec(2, "clock", "التوقيت والمكان", "متى وأين حدثت الواقعة.", `<div class="ir-g3">
        <div><label for="dt">تاريخ الواقعة</label><input id="dt" type="date" max="${todayISO()}" value="${todayISO()}" required></div>
        <div><label for="tm">الوقت <small>(اختياري)</small></label><input id="tm" type="time"></div>
        <div><label for="lc">موقع الحدوث <small>(اختياري)</small></label><input id="lc" maxlength="120" placeholder="مثال: الفصل، الساحة، الممر"></div></div>`)}
      ${sec(3, "list", "تفاصيل الواقعة", "صِف ما حدث وصفاً موضوعياً دون أحكام.", `
        <div class="ir-g2"><div><label for="cn">تصنيف السلوك</label><select id="cn">${opt(Ng)}</select></div>
        <div><label for="pr">الأطراف ذات العلاقة <small>(عند الضرورة)</small></label><input id="pr" maxlength="300"></div></div>
        <div><label for="dn">وصف موضوعي للواقعة</label><textarea id="dn" maxlength="1500" rows="6" required placeholder="ماذا حدث؟ ومن شاهده؟ وما الذي سبقه؟"></textarea><small class="ir-c" id="dnc">0 / 1500</small></div>
        <div><label for="nt">ملاحظات المعلم <small>(اختياري)</small></label><textarea id="nt" maxlength="800" rows="3"></textarea></div>`)}
      ${sec(4, "image", "المرفقات", "حتى 3 ملفات: صور أو PDF (اختياري).", `<input id="fn2" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf">`)}
      <div class="ir-f"><p class="sub">تُسجَّل الواقعة بحالة «مرصودة» وتصل إلى صندوق وكيل شؤون الطلاب. وليست مخالفة معتمدة ولا يُخصم بها شيء.</p>
        <p class="err" id="en" role="alert"></p><button class="btn" id="gn">${ico("up")}رفع الواقعة إلى وكيل شؤون الطلاب</button></div></form>`;
    $("#dn").oninput = (e) => ($("#dnc").textContent = e.target.value.length + " / 1500");
    pickerField($("#pkn"), sn, "s");
    $("#fn").onsubmit = async (ev) => { ev.preventDefault(); const er = $("#en"); er.textContent = ""; if (!sn.s) { er.textContent = "اختر المتعلم أولاً."; return; }
      if (!$("#dn").value.trim()) { er.textContent = "اكتب وصف الواقعة."; $("#dn").focus(); return; }
      const files = [...$("#fn2").files]; if (files.length > 3) { er.textContent = "الحد الأقصى 3 مرفقات."; return; } $("#gn").disabled = true;
      try { const paths = []; for (const f of files) paths.push(await uploadFile(f, c.uid));
        const r = await rpc("qm_report_incident", { p_student: sn.s.id, p_category: $("#cn").value, p_description: $("#dn").value, p_date: $("#dt").value || null, p_time: $("#tm").value || null, p_location: $("#lc").value, p_notes: $("#nt").value, p_parties: $("#pr").value, p_attachments: paths });
        toast(`رُفعت الواقعة برقم ${r.no} وحالتها: مرصودة`); location.href = "negative.html?tab=incidents";
      } catch (e) { er.textContent = mapErr(e); $("#gn").disabled = false; } };
  }),

  incidents: () => boot("negative.html", async (m) => {
    let f = "all"; const root = document.createElement("div");
    const draw = async () => { const rows = await rpc("qm_incidents_list", { p_scope: "mine" });
      const sel = rows.filter((i) => f === "all" || (f === "act" && i.needs_my_action) || (f === "open" && !i.is_closed) || (f === "closed" && i.is_closed));
      root.innerHTML = `<div class="tabs">${[["all", "الكل"], ["act", "مطلوب مني"], ["open", "قيد المعالجة"], ["closed", "المغلقة"]].map(([k, l]) => `<button data-f="${k}" class="${f === k ? "on" : ""}">${l}${k === "act" ? ` (${rows.filter((i) => i.needs_my_action).length})` : ""}</button>`).join("")}</div>
      <div id="li">${sel.length ? sel.map(incidentCard).join("") : empty("inbox", "لا وقائع", "ستظهر هنا الوقائع التي ترفعها وحالة كل منها.")}</div>`;
      $$("[data-f]", root).forEach((b) => (b.onclick = () => { f = b.dataset.f; draw(); }));
    };
    m.appendChild(root); bindIncidents(root, draw); await draw();
  }),

  // سجل التعزيز صار داخل «منح النقاط والأوسمة»
  reinforcements: () => location.replace(location.pathname.split("/").pop() + "?tab=reinforce"),

  balances: () => boot("positive.html", async (m) => {
    const ex = await rpc("qm_excellence", { p_limit: 10 });
    m.innerHTML = `<div class="grid"><div class="card"><h4 style="margin-top:0">لوحة التميز</h4>${ex.length ? ex.map((r, i) => `<div class="rank"><span class="n ${i === 0 ? "g" : ""}">${i + 1}</span><b><a href="#" data-c="${r.id}">${esc(r.name)}</a></b><span class="v">${r.balance}</span><span class="track"><i style="width:${Math.round((r.balance / ex[0].balance) * 100)}%"></i></span></div>`).join("") : '<p class="sub">لا أرصدة بعد.</p>'}<p class="sub">للتكريم والتحفيز، وليست ترتيباً رسمياً.</p></div>
    <div class="card" style="grid-column:span 2"><h4 style="margin-top:0">أرصدة المتعلمين</h4><input id="q" type="search" placeholder="ابحث باسم المتعلم أو رقمه" aria-label="بحث"><div id="li" style="margin-top:10px"></div></div></div>`;
    $$("[data-c]", m).forEach((a) => (a.onclick = (e) => { e.preventDefault(); location.href = "learner.html?id=" + a.dataset.c; }));
    let t = 0; const draw = async () => { const r = await rpc("qm_balances", { p_q: $("#q").value, p_limit: 60 });
      $("#li").innerHTML = r.length ? `<table class="tbl"><thead><tr><th>المتعلم</th><th>الصف</th><th>التعزيزات</th><th>الرصيد</th></tr></thead><tbody>${r.map((x) => `<tr data-c="${x.id}" style="cursor:pointer"><td>${esc(x.name)}</td><td>${esc(x.grade || "")}${x.section ? " · " + esc(x.section) : ""}</td><td>${x.awards}</td><td>${pts(x.balance)}</td></tr>`).join("")}</tbody></table>` : '<p class="sub">لا نتائج.</p>';
      $$("tr[data-c]", $("#li")).forEach((tr) => (tr.onclick = () => (location.href = "learner.html?id=" + tr.dataset.c))); };
    $("#q").oninput = () => { clearTimeout(t); t = setTimeout(draw, 250); }; await draw();
  }),

  // دليل المتعلمين: كل المتعلمين معروضين، والفرز بالمرحلة ثم الصف ثم الفصل، والعرض بطاقات أو قائمة، والاختيار يفتح ملف المتعلم مباشرة
  students: () => boot("students.html", async (m) => {
    const qs = new URLSearchParams(location.search), VK = "qm-dir-view";
    let view = qs.get("v") || (() => { try { return localStorage.getItem(VK); } catch { return null; } })() || "cards";
    const st = { stage: qs.get("st") || "", grade: qs.get("g") || "", section: qs.get("s") || "", q: qs.get("q") || "" };
    m.innerHTML = '<p class="sub">جارٍ تحميل المتعلمين…</p>';
    const all = await rpc("qm_students_all");
    // المرحلة من رمز الصف (m: متوسط، p: ابتدائي، s/h: ثانوي)
    const STG = { p: "المرحلة الابتدائية", m: "المرحلة المتوسطة", s: "المرحلة الثانوية", h: "المرحلة الثانوية", k: "رياض الأطفال" };
    const stageOf = (x) => { const c = String(x.grade_code || "").charAt(0).toLowerCase(); return STG[c] ? c === "h" ? "s" : c : "o"; };
    const stName = (k) => STG[k] || "مرحلة أخرى";
    all.forEach((x) => (x.stage = stageOf(x)));
    const uniq = (arr, key) => { const seen = new Map(); arr.forEach((x) => { const k = key(x); if (k[0] && !seen.has(k[0])) seen.set(k[0], k); }); return [...seen.values()]; };
    const stages = uniq(all, (x) => [x.stage, stName(x.stage)]);
    if (stages.length === 1) st.stage = stages[0][0];
    const chips = (id, list, cur, attr) => `<div class="gr-chips" id="${id}"><button type="button" data-${attr}="" aria-pressed="${!cur}">الكل<small>${list.total}</small></button>${list.map(([k, n, c]) => `<button type="button" data-${attr}="${esc(k)}" aria-pressed="${k === cur}">${esc(n)}<small>${c}</small></button>`).join("")}</div>`;
    m.innerHTML = `<div class="card dir-f"><div class="gr-steps">
        <div class="gr-step" id="wSt"><span>المرحلة</span><div id="fSt"></div></div>
        <div class="gr-step"><span>الصف</span><div id="fG"></div></div>
        <div class="gr-step" id="wS"><span>الفصل</span><div id="fS"></div></div></div>
        <div class="dir-bar"><input id="dq" type="search" placeholder="تصفية بالاسم أو الرقم داخل الفرز الحالي" aria-label="تصفية بالاسم أو الرقم" value="${esc(st.q)}">
        <span class="dir-n" id="dn" aria-live="polite"></span>
        <div class="dir-v" role="group" aria-label="طريقة العرض"><button type="button" data-v="cards" title="بطاقات">${ico("grid")}<span>بطاقات</span></button><button type="button" data-v="list" title="قائمة">${ico("list")}<span>قائمة</span></button></div></div></div>
      <div id="dl" class="mt"></div>`;
    const sync = () => { const u = new URLSearchParams(); if (st.stage && stages.length > 1) u.set("st", st.stage); if (st.grade) u.set("g", st.grade); if (st.section) u.set("s", st.section); if (st.q) u.set("q", st.q); u.set("v", view);
      history.replaceState(null, "", location.pathname + "?" + u.toString()); };
    const draw = () => {
      const inSt = all.filter((x) => !st.stage || x.stage === st.stage);
      const gl = uniq(inSt, (x) => [x.grade_code, x.grade || x.grade_code, x.grade_sort]).sort((a, b) => a[2] - b[2]).map(([k, n]) => [k, n, inSt.filter((x) => x.grade_code === k).length]); gl.total = inSt.length;
      if (st.grade && !gl.some((g) => g[0] === st.grade)) st.grade = "";
      const inG = inSt.filter((x) => !st.grade || x.grade_code === st.grade);
      const sl = uniq(inG, (x) => [x.section_id, (st.grade ? "" : (x.grade || "") + " · ") + (x.section || "بلا فصل")]).map(([k, n]) => [k, n, inG.filter((x) => x.section_id === k).length]); sl.total = inG.length;
      if (st.section && !sl.some((x) => x[0] === st.section)) st.section = "";
      const sl2 = stages.map(([k, n]) => [k, n, all.filter((x) => x.stage === k).length]); sl2.total = all.length;
      $("#fSt").innerHTML = stages.length > 1 ? chips("cSt", sl2, st.stage, "st") : `<div class="gr-chips"><button type="button" aria-pressed="true" disabled>${esc(stages[0]?.[1] || "—")}<small>${all.length}</small></button></div>`;
      $("#fG").innerHTML = chips("cG", gl, st.grade, "g");
      $("#wS").hidden = !st.grade; $("#fS").innerHTML = st.grade ? chips("cS", sl, st.section, "s") : "";
      const q = st.q.trim(), rows = inG.filter((x) => (!st.section || x.section_id === st.section) && (!q || x.name.includes(q) || String(x.no || "").startsWith(q)));
      $("#dn").textContent = rows.length + " متعلماً";
      $$(".dir-v button", m).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === view));
      const href = (x) => "learner.html?id=" + x.id;
      const where = (x) => esc(x.grade || "") + (x.section ? " · " + esc(x.section) : "");
      $("#dl").innerHTML = !rows.length ? empty("users", "لا متعلمين بهذا الفرز", q ? "جرّب اسماً آخر أو امسح التصفية." : "اختر صفاً أو فصلاً آخر.")
        : view === "list"
        ? `<div class="card dir-list"><div style="overflow:auto"><table class="tbl"><thead><tr><th>#</th><th>المتعلم</th><th>الصف</th><th>الفصل</th><th>الرصيد</th><th>الأوسمة</th></tr></thead><tbody>${rows.map((x, i) => `<tr><td>${i + 1}</td><td><a href="${href(x)}"><b>${esc(x.name)}</b></a>${x.no ? `<br><small>${esc(x.no)}</small>` : ""}</td><td>${esc(x.grade || "")}</td><td>${esc(x.section || "—")}</td><td>${x.balance}</td><td>${x.badges}</td></tr>`).join("")}</tbody></table></div></div>`
        : `<div class="dir-cards">${rows.map((x) => `<a class="dir-c" href="${href(x)}"><span class="av">${esc(initials(x.name))}</span><span class="dir-t"><b>${esc(x.name)}</b><small>${where(x)}</small></span><span class="dir-p"><b>${x.balance}</b><small>نقطة</small>${x.badges ? `<em>${ico("medal")}${x.badges}</em>` : ""}</span></a>`).join("")}</div>`;
      $$("[data-st]", m).forEach((b) => (b.onclick = () => { st.stage = b.dataset.st; st.grade = ""; st.section = ""; sync(); draw(); }));
      $$("[data-g]", m).forEach((b) => (b.onclick = () => { st.grade = b.dataset.g; st.section = ""; sync(); draw(); }));
      $$("[data-s]", m).forEach((b) => (b.onclick = () => { st.section = b.dataset.s; sync(); draw(); }));
    };
    $$(".dir-v button", m).forEach((b) => (b.onclick = () => { view = b.dataset.v; try { localStorage.setItem(VK, view); } catch {} sync(); draw(); }));
    let t = 0; $("#dq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; sync(); draw(); }, 150); };
    draw();
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

// سجل التعزيز: «ما سجّلتُه» و«كل التعزيزات» مع التصفية والحذف؛ يعيد دالة لإعادة التحميل
async function reinfLog(root, c, mineFirst, after) {
  let mine = !!mineFirst, q = "";
  root.innerHTML = `<div class="tabs"><button data-m="1" class="${mine ? "on" : ""}">ما سجّلتُه أنا</button><button data-m="0" class="${mine ? "" : "on"}">كل التعزيزات</button></div><div class="form" style="max-width:420px;margin-bottom:12px"><input type="search" data-q placeholder="تصفية بالاسم أو الصف" aria-label="تصفية"></div><div data-li></div>`;
  const li = $("[data-li]", root);
  const draw = async () => { let r = await rpc("qm_reinforcements_list", { p_mine: mine, p_limit: 300 }); const k = q.trim(); if (k) r = r.filter((x) => (x.student + x.grade + x.type).includes(k));
    li.innerHTML = r.length ? r.map(reinfItem).join("") : empty("list", mine ? "لم تمنح نقاطاً بعد" : "لا تعزيزات مطابقة"); bindVoid(li, async () => { await draw(); after && after(); }, c); };
  $$(".tabs button", root).forEach((b) => (b.onclick = () => { mine = b.dataset.m === "1"; $$(".tabs button", root).forEach((x) => x.classList.toggle("on", x === b)); draw(); }));
  $("[data-q]", root).oninput = (e) => { q = e.target.value; draw(); };
  await draw(); return draw;
}
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
    window.__bcats = rows.map((r) => r.category).filter(Boolean);
    root.innerHTML = `<div class="row2"><p class="sub" style="margin:0">لكل وسام سبب استحقاق ونقاط تُضاف إلى رصيد المتعلم عند منحه، ونوع يحدد تصنيفه في ملف المتعلم.</p><button class="btn" id="nb" type="button">${ico("plus")}إضافة وسام</button></div>
      ${rows.length ? `<div class="bd-g">${rows.map((b) => `<div class="bd-c${b.is_active ? "" : " off"}"><div class="hd">${medal({ ...b, image: b.image_path })}<div><b>${esc(b.name_ar)}</b><span class="badge ${b.kind === "educational" ? "info" : ""}">وسام ${KIND[b.kind]}</span>${b.category ? ` <span class="badge">${esc(b.category)}</span>` : ""} <span class="pts">${b.points ? "<bdi>+" + b.points + "</bdi> نقطة" : "بلا نقاط"}</span></div></div>
        <p><small>سبب الاستحقاق:</small> ${esc(b.criteria || "لم يُكتب بعد")}</p>${b.is_active ? "" : '<span class="badge">موقوف</span>'}<div class="acts"><button class="btn sm sec" data-e="${b.id}" type="button">تعديل</button></div></div>`).join("")}</div>` : empty("trophy", "لا أوسمة بعد", "أضف أول وسام ليتمكن المعلمون من منحه.")}`;
    $("#nb", root).onclick = () => form(null, rows.length);
    $$("[data-e]", root).forEach((x) => (x.onclick = () => form(rows.find((r) => r.id === x.dataset.e))));
  };
  const form = (b, n) => {
    const v = b || { name_ar: "", criteria: "", points: 0, kind: "general", is_active: true, image_path: null, icon: "trophy" };
    const md = modal(`<h3>${b ? "تعديل الوسام" : "إضافة وسام"}</h3><form id="bf">
      <label for="b_n">اسم الوسام</label><input id="b_n" required maxlength="80" value="${esc(v.name_ar)}">
      <div class="two"><div><label for="b_k">نوع الوسام</label><select id="b_k"><option value="educational">تعليمي</option><option value="administrative">إداري</option><option value="general">عام</option></select></div><div><label for="b_p">نقاط الوسام</label><input id="b_p" type="number" min="0" max="1000" value="${v.points}"></div></div>
      <label for="b_g">التصنيف (المادة للأوسمة التعليمية، أو مجال الوسام العام)</label><input id="b_g" list="b_gl" maxlength="60" placeholder="مثال: الرياضيات، لغتي الخالدة، الانضباط، القيادة" value="${esc(v.category || "")}"><datalist id="b_gl">${[...new Set([...Object.values(SUBJECTS), ...BADGE_AREAS.flatMap((a) => a[2]), ...(window.__bcats || [])])].map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
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
        const o = { name_ar: $("#b_n", md.el).value.trim(), kind: $("#b_k", md.el).value, category: $("#b_g", md.el).value.trim() || null, points: Math.max(0, +$("#b_p", md.el).value || 0), criteria: $("#b_c", md.el).value.trim() || null, image_path: path };
        if (b) o.is_active = $("#b_a", md.el).checked; else o.sort_order = (n || 0) + 1;
        const q = b ? await sb.from("qm_badges").update(o).eq("id", b.id) : await sb.from("qm_badges").insert(o);
        if (q.error) throw new Error(mapErr(q.error));
        if (path !== v.image_path && v.image_path) sb.storage.from("qm-badges").remove([v.image_path]).catch(() => {});
        md.close(); toast("حُفظ الوسام"); draw();
      } catch (e) { er.textContent = mapErr(e); btn.disabled = false; } };
  };
  await draw();
}
// مستويات الطلاب: الاسم وحد النقاط لكل مستوى، يضيفها مدير النواة ويعدلها ويحذفها
async function levelsAdmin(root) {
  const draw = async () => {
    const { data: rows, error } = await sb.from("qm_levels").select("*").order("min_points");
    if (error) { root.innerHTML = `<p class="err">${esc(mapErr(error))}</p>`; return; }
    root.innerHTML = `<p class="sub">يُحسب مستوى الطالب من رصيده التراكمي: يدخل المستوى عند بلوغ حد النقاط. يظهر المستوى في ملف الطالب وقائمة الطلاب وصفحة النقاط والأوسمة.</p>
      <div style="overflow:auto"><table class="tbl"><thead><tr><th>اسم المستوى</th><th>يبدأ من (نقطة)</th><th>فعّال</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr data-id="${r.id}"><td><input data-k="name_ar" maxlength="40" value="${esc(r.name_ar)}"></td><td><input data-k="min_points" type="number" min="0" max="100000" value="${r.min_points}"></td><td><label class="tgl"><input type="checkbox" data-k="is_active" ${r.is_active ? "checked" : ""} aria-label="فعّال"><span></span></label></td><td><button class="btn sm sec" data-d="${r.id}" type="button">حذف</button></td></tr>`).join("")}</tbody></table></div>
      <form class="card form mt" id="lf"><h4 style="margin:0">إضافة مستوى</h4><div class="two"><div><label for="l_n">اسم المستوى</label><input id="l_n" required maxlength="40"></div><div><label for="l_p">يبدأ من (نقطة)</label><input id="l_p" type="number" min="0" max="100000" required></div></div><p class="err" id="l_e" role="alert"></p><div class="acts"><button class="btn">إضافة</button></div></form>`;
    $$("tr[data-id] [data-k]", root).forEach((el) => (el.onchange = async () => { const k = el.dataset.k, v = el.type === "checkbox" ? el.checked : el.type === "number" ? +el.value : el.value.trim();
      if (k === "name_ar" && !v) { toast("اسم المستوى مطلوب", true); draw(); return; }
      const { error } = await sb.from("qm_levels").update({ [k]: v }).eq("id", el.closest("tr").dataset.id); if (error) { toast(error.code === "23505" ? "يوجد مستوى آخر بالحد نفسه" : mapErr(error), true); draw(); } else { toast("تم الحفظ"); if (k === "min_points") draw(); } }));
    $$("[data-d]", root).forEach((b) => (b.onclick = async () => { if (!confirm("حذف هذا المستوى؟ يُعاد احتساب مستوى الطلاب تلقائياً.")) return; const { error } = await sb.from("qm_levels").delete().eq("id", b.dataset.d); toast(error ? mapErr(error) : "تم الحذف", !!error); draw(); }));
    $("#lf", root).onsubmit = async (e) => { e.preventDefault(); const { error } = await sb.from("qm_levels").insert({ name_ar: $("#l_n", root).value.trim(), min_points: +$("#l_p", root).value }); if (error) { $("#l_e", root).textContent = error.code === "23505" ? "يوجد مستوى بالحد نفسه من النقاط." : mapErr(error); return; } toast("تمت الإضافة"); draw(); };
  };
  await draw();
}
// الصلاحيات: كل منسوبي المدرسة الفعّالين، ولكل قدرة في البوابة صلاحية تُمنح بعلامة صح
const PERM_COLS = [
  ["reinforce", "التعزيز", "منح النقاط والأوسمة وتوثيق المواقف الإيجابية", 1],
  ["behavior", "السلوك السلبي", "تسجيل الوقائع ورفعها إلى الوكيل", 1],
  ["reports", "التقارير", "التقارير المجمّعة للفترة", 1],
  ["agent", "وكيل شؤون الطلاب", "يستقبل الوقائع ويعالجها"],
  ["counselor", "الموجه الطلابي", "الحالات الإجرائية والدعم"],
  ["all_sections", "كل الفصول", "يمنح النقاط والأوسمة لكل المتعلمين دون إسناد تدريس"],
  ["portal_admin", "مدير البوابة", "الصلاحيات وإدارة البوابة (يمنحها مدير النواة)"],
];
PAGES.perms = () => boot("perms.html", async (m, c) => {
  m.innerHTML = `<div id="bd"><p class="sub">جارٍ التحميل…</p></div>`;
  const body = $("#bd"); let S = [], q = "";
  const has = (s, r) => s.roles.includes(r);
  const load = async () => { S = await rpc("qm_staff_list"); S.forEach((s) => (s.roles = s.roles || [])); };
  const draw = () => {
    const rows = S.filter((s) => !q || s.name.includes(q) || String(s.job || "").includes(q));
    const cnt = (r) => S.filter((s) => has(s, r)).length;
    body.innerHTML = `<div class="card pm-h"><p class="sub" style="margin:0">قائمة منسوبي المدرسة الفعّالين في النواة الرقمية (${S.length}). ضع علامة صح لمنح الصلاحية أو أزلها لسحبها، ويُحفظ التغيير فوراً ويُسجَّل في سجل العمليات. مدير النواة الرقمية يملك كل الصلاحيات تلقائياً.</p>
      <div class="pm-legend">${PERM_COLS.map(([k, n, d]) => `<span><b>${n}</b> ${esc(d)}</span>`).join("")}</div>
      <div class="pm-bar"><input type="search" id="pq" placeholder="بحث بالاسم أو الوظيفة" aria-label="بحث بالاسم أو الوظيفة" value="${esc(q)}"><span class="sub" style="margin:0">${rows.length} منسوباً</span></div></div>
      <div class="card mt pm-t"><div style="overflow:auto"><table class="tbl"><thead><tr><th>المنسوب</th>${PERM_COLS.map(([k, n, d, all]) => `<th title="${esc(d)}">${n}<small>${cnt(k)} من ${S.length}</small>${all ? `<span class="pm-all"><button type="button" data-all="${k}" data-on="1">الكل</button><button type="button" data-all="${k}" data-on="0">لا أحد</button></span>` : ""}</th>`).join("")}</tr></thead><tbody>
      ${rows.map((s) => `<tr><td><b>${esc(s.name)}</b><small>${esc(s.job || "")}${s.has_account ? "" : " · بلا حساب دخول"}</small></td>${PERM_COLS.map(([k, n]) => { const lock = k === "portal_admin" && !c.isCoreAdmin;
        return `<td><label class="tgl"><input type="checkbox" data-s="${s.id}" data-r="${k}" ${has(s, k) ? "checked" : ""} ${lock ? "disabled" : ""} aria-label="${n} – ${esc(s.name)}"><span></span></label></td>`; }).join("")}</tr>`).join("") || `<tr><td colspan="${PERM_COLS.length + 1}"><p class="sub">لا نتائج.</p></td></tr>`}</tbody></table></div></div>`;
    let t = 0; $("#pq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); draw(); const x = $("#pq"); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 200); };
    $$("[data-s]", body).forEach((el) => (el.onchange = async () => {
      const s = S.find((x) => x.id === el.dataset.s), r = el.dataset.r;
      try { await rpc("qm_set_role", { p_staff: s.id, p_role: r, p_on: el.checked });
        s.roles = el.checked ? [...new Set([...s.roles, r])] : s.roles.filter((x) => x !== r);
        toast((el.checked ? "مُنحت" : "سُحبت") + " صلاحية «" + PERM_COLS.find((x) => x[0] === r)[1] + "»"); draw();
      } catch (e) { toast(mapErr(e), true); el.checked = !el.checked; } }));
    $$("[data-all]", body).forEach((b) => (b.onclick = async () => {
      const r = b.dataset.all, on = b.dataset.on === "1", n = PERM_COLS.find((x) => x[0] === r)[1];
      if (!confirm(on ? `منح صلاحية «${n}» لكل المنسوبين؟` : `سحب صلاحية «${n}» من كل المنسوبين؟`)) return;
      try { await rpc("qm_set_role_all", { p_role: r, p_on: on }); await load(); draw(); toast(on ? "مُنحت للجميع" : "سُحبت من الجميع"); } catch (e) { toast(mapErr(e), true); } }));
  };
  try { await load(); draw(); } catch (e) { body.innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; }
}, { role: "admin" });
PAGES.admin = () => openHub("admin.html");
PAGES.adminTab = () => boot("admin.html", async (m, c) => {
  let cur = window.__hub.tab;
  m.innerHTML = `<div id="bd"></div>`;
  let body = $("#bd"); const kinds = [["positive", "إيجابي"], ["negative", "سلبي"]];
  const draw = async () => {
    // «التصنيفات والحالات»: تصنيفات السلوك ثم حالات الواقعة في صفحة واحدة
    if (cur === "cats" && !draw.both) { const host = $("#bd"); host.innerHTML = '<div id="bdc"></div><h3 class="sec" style="margin-top:26px">حالات الواقعة</h3><div id="bds"></div>';
      draw.both = 1; try { body = $("#bdc"); await draw(); cur = "stat"; body = $("#bds"); await draw(); } finally { cur = "cats"; body = host; draw.both = 0; } return; }
    if (cur === "ann") { body.innerHTML = '<p class="sub">أضف الإعلانات وعدّلها وأوقفها من الأقسام أدناه، وتظهر للمستخدمين في أعلى صفحات النظام.</p>'; return; }
    body.innerHTML = '<p class="sub">جارٍ التحميل…</p>';
    try {
      if (cur === "types") await crud(body, "qm_reinforcement_types", [{ k: "name_ar", l: "الاسم" }, { k: "domain", l: "المجال", t: "select", o: [["academic", "أكاديمي"], ["behavior", "سلوكي"], ["participation", "مشاركة"], ["leadership", "قيادي"], ["general", "عام"]] }, { k: "default_points", l: "النقاط المقترحة", t: "number" }, { k: "criteria", l: "طريقة الاستحقاق (تظهر للطلاب)" }, { k: "is_active", l: "فعّال", t: "bool" }], [{ k: "name_ar", l: "الاسم", req: 1 }, { k: "domain", l: "المجال", t: "select", o: [["general", "عام"], ["academic", "أكاديمي"], ["behavior", "سلوكي"], ["participation", "مشاركة"], ["leadership", "قيادي"]] }, { k: "default_points", l: "النقاط المقترحة", t: "number" }, { k: "criteria", l: "طريقة الاستحقاق (تظهر للطلاب)" }]);
      else if (cur === "badges") await badgeAdmin(body);
      else if (cur === "levels") await levelsAdmin(body);
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
  achievements: () => boot("positive.html", async (m, ctx) => {
    // التسجيل أولاً، ثم المعرض بالفرز («إنجازاتي» صارت فرزاً داخل المعرض: «ما سجّلتُه أنا»)
    const tabs = [["add", "تسجيل إنجاز", "trophy"], ["talents", "تسجيل موهبة", "gem"], ["gallery", "معرض الإنجازات", "grid"]];
    if (ctx.isAdmin) tabs.push(["review", "بانتظار التحقق", "hourglass"]);
    let cur = new URLSearchParams(location.search).get("t"); if (cur === "mine") cur = "gallery"; if (!tabs.some((t) => t[0] === cur)) cur = "add";
    const gf = { scope: new URLSearchParams(location.search).get("t") === "mine" ? "mine" : "gallery", q: "", cat: "", lv: "", gr: "" };
    const paint = async () => {
      m.innerHTML = `<div class="tabs">${tabs.map(([k, n, i]) => `<button type="button" class="${k === cur ? "on" : ""}" data-t="${k}">${ico(i)}${n}</button>`).join("")}</div><div id="tb"></div>`;
      $$("[data-t]", m).forEach((b) => (b.onclick = () => { cur = b.dataset.t; paint(); }));
      const tb = $("#tb", m);
      if (cur === "review") {
        const L = await rpc("qm_achievements_list", { p_scope: cur });
        tb.innerHTML = L.length ? L.map(achItem).join("") : empty("trophy", "لا إنجازات بانتظار التحقق");
        tb.onclick = (e) => { const el = e.target.closest("[data-ach]"); if (el) openAchievement(el.dataset.ach, paint); };
      } else if (cur === "gallery") {
        const L = await rpc("qm_achievements_list", { p_scope: gf.scope });
        const uniq = (f) => [...new Set(L.map(f).filter(Boolean))].sort();
        const cats = uniq((a) => a.category), grades = [...new Set(L.flatMap((a) => (a.students || []).map((x) => x.grade)).filter(Boolean))].sort();
        const sel = (id, lab, list, v, names) => `<label class="ag-f"><span>${lab}</span><select id="${id}"><option value="">الكل</option>${list.map((x) => `<option value="${esc(x)}" ${x === v ? "selected" : ""}>${esc(names ? names[x] || x : x)}</option>`).join("")}</select></label>`;
        tb.innerHTML = `<div class="card ag-bar"><div class="tabs" style="margin:0"><button type="button" data-sc="gallery" class="${gf.scope === "gallery" ? "on" : ""}">الموثقة</button><button type="button" data-sc="mine" class="${gf.scope === "mine" ? "on" : ""}">ما سجّلتُه أنا</button></div>
            <div class="ag-fs"><label class="ag-f ag-q"><span>بحث</span><input id="gq" type="search" placeholder="عنوان الإنجاز أو اسم المتعلم" value="${esc(gf.q)}"></label>${sel("gc", "التصنيف", cats, gf.cat)}${sel("gl", "المستوى", Object.keys(LV).filter((k) => L.some((a) => a.level === k)), gf.lv, LV)}${sel("gg", "الصف", grades, gf.gr)}</div></div>
          <p class="sub" id="gn"></p><div id="gli"></div>`;
        const draw = () => { const q = gf.q.trim();
          const R = L.filter((a) => (!gf.cat || a.category === gf.cat) && (!gf.lv || a.level === gf.lv) && (!gf.gr || (a.students || []).some((x) => x.grade === gf.gr))
            && (!q || a.title.includes(q) || (a.students || []).some((x) => (x.name || "").includes(q))));
          $("#gn", tb).textContent = R.length + " إنجازاً" + (gf.scope === "mine" ? " (ومنها ما ينتظر التحقق)" : "");
          $("#gli", tb).innerHTML = R.length ? R.map(achItem).join("") : empty("trophy", "لا إنجازات مطابقة", gf.scope === "gallery" ? "يعرض المعرض الإنجازات الموثقة فقط. جرّب تصفية أخرى." : "جرّب تصفية أخرى."); };
        $$("[data-sc]", tb).forEach((b) => (b.onclick = () => { gf.scope = b.dataset.sc; gf.cat = gf.lv = gf.gr = ""; paint(); }));
        $("#gq", tb).oninput = (e) => { gf.q = e.target.value; draw(); };
        [["gc", "cat"], ["gl", "lv"], ["gg", "gr"]].forEach(([id, k]) => ($("#" + id, tb).onchange = (e) => { gf[k] = e.target.value; draw(); }));
        $("#gli", tb).onclick = (e) => { const el = e.target.closest("[data-ach]"); if (el) openAchievement(el.dataset.ach, paint); };
        draw();
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
          toast("أُرسل للتحقق"); cur = "gallery"; gf.scope = "mine"; paint(); } catch (e) { $("#ae").textContent = mapErr(e); b.disabled = false; } };
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
    const iso = (dt) => dt.toLocaleDateString("en-CA", { timeZone: TZ }), back = (n) => iso(new Date(Date.now() - n * 864e5)), t0 = todayISO();
    const RNG = { w: ["آخر 7 أيام", back(6)], m: ["هذا الشهر", t0.slice(0, 8) + "01"], d30: ["آخر 30 يوماً", back(29)], d90: ["آخر 90 يوماً", back(89)] };
    m.innerHTML = `<div class="card form"><div class="tabs" id="rq">${Object.entries(RNG).map(([k, v]) => `<button type="button" data-q="${k}" class="${k === "d30" ? "on" : ""}">${v[0]}</button>`).join("")}</div><div class="grid2"><div><label for="rf">من تاريخ</label><input id="rf" type="date" max="${t0}" value="${RNG.d30[1]}"></div><div><label for="rt">إلى تاريخ</label><input id="rt" type="date" max="${t0}" value="${t0}"></div></div><p class="sub">تقرير مجمّع بالأعداد فقط، ولا يتضمن أسماء متعلمين.</p><div class="acts"><button class="btn" id="go">عرض التقرير</button><button class="btn sec" id="csv" disabled>تصدير CSV</button><button class="btn sec" id="pr" disabled>طباعة</button></div><p class="err" id="er" role="alert"></p></div><div id="rep"></div>`;
    let R = null;
    const blk = (t, rows) => `<div class="card"><h4 style="margin-top:0">${esc(t)}</h4>${rows.length ? rankRows(rows, "name", "n") : '<p class="sub">لا بيانات في الفترة.</p>'}</div>`;
    const run = async () => { const er = $("#er"), f = $("#rf").value, t = $("#rt").value, go = $("#go"); er.textContent = "";
      if (!f || !t) { er.textContent = "حدّد تاريخ البداية وتاريخ النهاية."; return; }
      if (f > t) { er.textContent = "تاريخ البداية بعد تاريخ النهاية."; return; }
      go.disabled = true; try {
      R = await rpc("qm_report", { p_from: f, p_to: t });
      const lv = (rows) => rows.map((r) => ({ ...r, name: LV[r.name] || r.name }));
      const none = !(R.reinforcements.total || R.incidents.total || R.achievements.total || R.support.opened || R.support.closed);
      $("#rep").innerHTML = `<h3 class="sec">تقرير قيمي: ${esc(fmtDay(R.from))} إلى ${esc(fmtDay(R.to))}</h3>${none ? '<p class="sub">لا سجلات في هذه الفترة. جرّب فترة أوسع.</p>' : ""}<div class="grid">${kpi("check", R.reinforcements.total, "تعزيزاً", 1)}${kpi("star", R.reinforcements.points, "نقطة ممنوحة", 3)}${kpi("inbox", R.incidents.total, "واقعة مرصودة", 2)}${kpi("trophy", R.achievements.total, "إنجازاً موثقاً", 4)}${kpi("help", R.support.opened, "حالة دعم مفتوحة", 0)}${kpi("check", R.support.closed, "حالة دعم مغلقة", 1)}</div>
      ${R.support.avg_improvement != null ? `<p class="sub">متوسط التحسن النهائي للحالات المغلقة: ${R.support.avg_improvement} من 5</p>` : ""}
      <div class="grid mt">${blk("التعزيز حسب النوع", R.reinforcements.by_type)}${blk("التعزيز حسب الصف", R.reinforcements.by_grade)}${blk("الوقائع حسب التصنيف", R.incidents.by_category)}${blk("الوقائع حسب الحالة", R.incidents.by_status)}${blk("الإنجازات حسب التصنيف", R.achievements.by_category)}${blk("الإنجازات حسب المستوى", lv(R.achievements.by_level))}${blk("حالات الدعم حسب النوع", R.support.by_type)}</div>`;
      $("#csv").disabled = $("#pr").disabled = false;
    } catch (e) { R = null; $("#rep").innerHTML = ""; $("#csv").disabled = $("#pr").disabled = true; er.textContent = mapErr(e); } go.disabled = false; };
    $("#go").onclick = run;
    const mark = (k) => $$("#rq button").forEach((b) => b.classList.toggle("on", b.dataset.q === k));
    $$("#rq button").forEach((b) => (b.onclick = () => { $("#rf").value = RNG[b.dataset.q][1]; $("#rt").value = t0; mark(b.dataset.q); run(); }));
    $("#rf").onchange = $("#rt").onchange = () => mark("");
    $("#pr").onclick = () => window.print();
    $("#csv").onclick = () => {
      const rows = [["القسم", "البند", "العدد"]];
      const add = (s, a) => a.forEach((r) => rows.push([s, r.name, r.n]));
      rows.push(["الفترة", "من", R.from], ["الفترة", "إلى", R.to]);
      rows.push(["ملخص", "تعزيزات", R.reinforcements.total], ["ملخص", "نقاط", R.reinforcements.points], ["ملخص", "وقائع", R.incidents.total], ["ملخص", "إنجازات موثقة", R.achievements.total], ["ملخص", "حالات دعم مفتوحة", R.support.opened], ["ملخص", "حالات دعم مغلقة", R.support.closed]);
      add("تعزيز حسب النوع", R.reinforcements.by_type); add("تعزيز حسب الصف", R.reinforcements.by_grade); add("وقائع حسب التصنيف", R.incidents.by_category); add("وقائع حسب الحالة", R.incidents.by_status);
      add("إنجازات حسب التصنيف", R.achievements.by_category); add("إنجازات حسب المستوى", R.achievements.by_level.map((r) => ({ ...r, name: LV[r.name] || r.name }))); add("دعم حسب النوع", R.support.by_type);
      const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `qiyami-report-${R.from}-${R.to}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    await run();
  }, { role: "report" }),
});

// ملف المتعلم في لوحة التحكم (learner.html): كل ما يخص المتعلم في مكان واحد، والإدارة منه مباشرة
// المنسق: تعديل النقاط وحذفها، والتصحيح، وتعديل الأوسمة وسحبها ومنحها، وحذف المواقف. غيره: يحذف ما سجّله هو فقط.
// الصفحة العامة للمتعلم في الموقع (student.html) تبقى للعرض العام فقط.
Object.assign(PAGES, {
  learner: () => boot("learner.html", async (m, ctx) => {
    const qs = new URLSearchParams(location.search), id = qs.get("id");
    if (!id) {
      m.innerHTML = `<div class="card form"><label>ابحث عن المتعلم بالاسم أو الرقم</label><div id="pk"></div><p class="sub mt">أو تصفّح <a href="students.html">دليل المتعلمين</a> بالمرحلة والصف والفصل.</p></div>`;
      studentPicker($("#pk"), (x) => (location.href = "learner.html?id=" + x.id));
      return;
    }
    let tab = qs.get("t") || "sum";
    const load = async () => {
      const s = await rpc("qm_student_file", { p_student: id });
      const adm = !!(ctx.isAdmin && s.is_admin), sens = ctx.isAdmin || ctx.isAgent || ctx.isCounselor;
      document.title = s.name + " – ملف المتعلم – قيمي";
      const R = s.reinf || [], B = s.badge_rows || [], P = s.positive_rows || [], A = s.achievements || [], I = s.incidents || [];
      const TABS = [["sum", "الملخص", "chart", ""], ["pts", "النقاط", "star", R.length], ["bdg", "الأوسمة", "medal", B.length], ["ach", "المواهب والإنجازات", "trophy", (s.talents || []).length + A.length + P.length], ["inc", "الوقائع", "flag", I.length], ["led", "حركة الرصيد", "list", ""]];
      if (!TABS.some((t) => t[0] === tab)) tab = "sum";
      m.innerHTML = `<section class="lf-hero"><div class="lf-av" aria-hidden="true">${esc(initials(s.name))}</div>
          <div class="lf-id"><h2>${esc(s.name)}</h2><p>${esc(s.grade || "—")}${s.section ? " · " + esc(s.section) : ""}${s.no ? " · رقم " + esc(s.no) : ""}</p>
            <div class="acts">${adm ? `<button class="btn sm" id="xAdd">${ico("plus")}إضافة نقاط</button><button class="btn sm sec" id="xAdj">خصم / تصحيح الرصيد</button><button class="btn sm sec" id="xBdg">${ico("medal")}منح وسام</button>` : ""}${sens ? `<button class="btn sm sec" id="xCard">${ico("user")}البطاقة الكاملة</button>` : ""}<a class="btn sm sec" href="students.html">${ico("users")}دليل المتعلمين</a><a class="lf-pub" href="student.html?id=${id}" target="_blank" rel="noopener">الصفحة العامة ↗</a></div></div>
          <div class="lf-st"><div><b>${s.balance}</b><small>الرصيد</small></div><div><b>${s.balance > 0 ? s.rank : "—"}</b><small>الترتيب في المدرسة</small></div><div><b>${s.balance > 0 ? s.rank_section : "—"}</b><small>في الفصل</small></div></div></section>
        <div class="tabs lf-tabs mt" role="tablist">${TABS.map(([k, n, i, c]) => `<button type="button" role="tab" data-lt="${k}" class="${k === tab ? "on" : ""}">${ico(i)}${n}${c !== "" ? ` <small>${c}</small>` : ""}</button>`).join("")}</div>
        <div id="lb" class="mt"></div>`;
      const body = $("#lb");
      const act = (r, kind) => {
        const b = [];
        if (kind === "r") { if (adm) b.push(`<button class="btn sm sec" data-re="${r.id}" data-p="${r.points}">تعديل</button>`); if (adm || r.mine) b.push(`<button class="btn sm sec dng" data-rd="${r.id}">حذف</button>`); }
        if (kind === "b" && adm) b.push(`<button class="btn sm sec" data-be="${r.id}">تعديل</button>`, `<button class="btn sm sec dng" data-bd="${r.id}">سحب</button>`);
        if (kind === "p" && (adm || r.mine)) b.push(`<button class="btn sm sec dng" data-pd="${r.id}">حذف</button>`);
        return b.join(" ");
      };
      const draw = async () => {
        $$("[data-lt]", m).forEach((x) => x.classList.toggle("on", x.dataset.lt === tab));
        const u = new URLSearchParams(location.search); u.set("t", tab); history.replaceState(null, "", "learner.html?" + u);
        if (tab === "pts") body.innerHTML = `<div class="card"><div class="row2"><h4 style="margin:0">التعزيزات المسجّلة</h4><span>المجموع: ${pts(R.reduce((a, r) => a + (r.points || 0), 0))}</span></div>
          ${R.length ? `<div style="overflow:auto"><table class="tbl mt"><thead><tr><th>النوع</th><th>النقاط</th><th>منحها</th><th>التاريخ</th><th></th></tr></thead><tbody>${R.map((r) => `<tr><td><b>${esc(r.type)}</b>${r.description ? `<br><small>${esc(r.description)}</small>` : ""}</td><td>${pts(r.points)}</td><td>${esc(r.by)}</td><td>${esc(fmtShort(r.created_at))}</td><td class="lf-a">${act(r, "r")}</td></tr>`).join("")}</tbody></table></div>` : empty("star", "لا تعزيزات بعد")}
          ${adm ? `<p class="sub">التعديل والحذف يُسجَّلان بحركة تصحيح في دفتر النقاط مع السبب، ويُعكس أثرهما على الرصيد.</p>` : R.some((r) => r.mine) ? `<p class="sub">يمكنك حذف ما منحتَه أنت فقط.</p>` : ""}</div>`;
        if (tab === "bdg") body.innerHTML = `<div class="card"><h4 style="margin-top:0">الأوسمة الممنوحة</h4>${B.length ? `<div style="overflow:auto"><table class="tbl"><thead><tr><th>الوسام</th><th>نقاطه</th><th>سبب المنح</th><th>منحه</th><th>التاريخ</th><th></th></tr></thead><tbody>${B.map((b) => `<tr><td><b>${ico(b.icon in ICONS ? b.icon : "medal")} ${esc(b.name)}</b></td><td>${b.points ? pts(b.points) : "—"}</td><td>${esc(b.note || "—")}</td><td>${esc(b.by)}</td><td>${esc(fmtShort(b.at))}</td><td class="lf-a">${act(b, "b")}</td></tr>`).join("")}</tbody></table></div>` : empty("medal", "لا أوسمة بعد")}</div>`;
        if (tab === "ach") body.innerHTML = `${(s.talents || []).length ? `<div class="card"><h4 style="margin-top:0">المواهب والقدرات</h4>${s.talents.map((t) => `<div class="item"><b>${esc(t.name)}</b> <small>${esc(t.field)}</small>${t.description ? `<p class="sub">${esc(t.description)}</p>` : '<div class="card"><h4 style="margin-top:0">المواهب والقدرات</h4><p class="sub">لا مواهب مرصودة.</p></div>'}</div>`).join("")}</div>` : '<div class="card"><h4 style="margin-top:0">المواهب والقدرات</h4><p class="sub">لا مواهب مرصودة.</p></div>'}
          <div class="card mt"><h4 style="margin-top:0">الإنجازات الموثقة</h4>${A.length ? A.map((a) => `<div class="item"><div class="row2"><b>${esc(a.title)}</b><small>${esc(fmtDay(a.achieved_on))}</small></div><small>${esc(a.category)} · ${esc(LV[a.level] || a.level)}</small></div>`).join("") : '<p class="sub">لا إنجازات موثقة.</p>'}<p class="sub">تُدار الإنجازات وتوثيقها من <a href="positive.html?tab=achievements">الإنجاز والمواهب</a>.</p></div>
          <div class="card mt"><h4 style="margin-top:0">المواقف الإيجابية</h4>${P.length ? P.map((p) => `<div class="item"><div class="row2"><b>${esc(p.category)}</b><span><small>${esc(fmtShort(p.created_at))}</small> ${act(p, "p")}</span></div><p class="sub">${esc(p.description || "")}</p><small>سجّلها: ${esc(p.by)}</small></div>`).join("") : '<p class="sub">لا مواقف مسجّلة.</p>'}</div>`;
        if (tab === "inc") { const open = I.filter((i) => !i.is_closed).length;
          const kv = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "";
          body.innerHTML = `<div class="card"><div class="row2"><h4 style="margin:0">الوقائع السلوكية</h4><span>${I.length} واقعة${open ? ` · <b>${open} قيد المتابعة</b>` : ""}</span></div>
            <p class="sub">${s.incidents_all ? "الوقائع المرصودة على المتعلم بحسب صلاحيتك" : "الوقائع التي رصدتَها أنت لهذا المتعلم"}. الوقائع مرصودة وليست مخالفات معتمدة، ولا تُخصم بها نقاط. اضغط «التفاصيل والإجراءات» لعرض السجل الزمني والمرفقات واتخاذ الإجراء.</p></div>
            ${I.length ? I.map((i) => `<div class="card mt lf-inc t-${i.tone}"><div class="row2"><div><b>واقعة رقم ${i.no}</b> ${tbadge(i.status_name, i.tone)}<br><small>رُصدت ${esc(fmtT(i.created_at))} · آخر تحديث ${esc(ago(i.updated_at))}</small></div><button class="btn sm" data-inc="${i.id}">${ico("list")}التفاصيل والإجراءات</button></div>
              <dl class="ir-kv mt">${kv("تصنيف السلوك", esc(i.category))}${kv("التاريخ", esc(fmtDay(i.occurred_on)))}${kv("الوقت", i.occurred_time ? esc(String(i.occurred_time).slice(0, 5)) : "")}${kv("موقع الحدوث", esc(i.location || ""))}${kv("الأطراف ذات العلاقة", esc(i.parties || ""))}${kv("سجّلها", esc(i.reporter))}${kv("المرفقات", i.attachments ? i.attachments + " مرفق" : "")}${kv("أُغلقت", i.closed_at ? esc(fmtShort(i.closed_at)) : "")}</dl>
              <div class="ir-t"><small>الوصف</small><p>${esc(i.description || "")}</p></div>${i.teacher_notes ? `<div class="ir-t"><small>ملاحظات المعلم</small><p>${esc(i.teacher_notes)}</p></div>` : ""}</div>`).join("") : `<div class="mt">${empty("check", "لا وقائع مسجّلة", s.incidents_all ? "لا وقائع ضمن صلاحيتك على هذا المتعلم." : "لم ترصد أنت أي واقعة لهذا المتعلم.")}</div>`}`;
          $$("[data-inc]", body).forEach((b) => (b.onclick = () => openIncident(b.dataset.inc, (ch) => ch && load()))); }
        if (tab === "sum") body.innerHTML = `<div class="grid">${kpi("check", s.reinforcements, "تعزيزاً", 1)}${kpi("medal", B.length, "وساماً", 3)}${kpi("trophy", A.length, "إنجازاً موثقاً", 4)}${kpi("star", (s.talents || []).length, "موهبة", 0)}</div>
          <div class="grid mt"><div class="card" style="grid-column:span 2"><h4 style="margin-top:0">من أين حصل على نقاطه؟</h4>${(s.by_type || []).length ? `<table class="tbl"><thead><tr><th>جانب التعزيز</th><th>المرات</th><th>النقاط</th></tr></thead><tbody>${s.by_type.map((t) => `<tr><td><b>${esc(t.type)}</b></td><td>${t.n}</td><td>${pts(t.points)}</td></tr>`).join("")}</tbody></table>` : '<p class="sub">لا تعزيزات بعد.</p>'}</div>
          <div class="card"><h4 style="margin-top:0">من منح النقاط</h4>${(s.givers || []).length ? rankRows(s.givers.map((g) => ({ name: g.name + " (" + g.n + ")", points: g.points })), "name", "points") : '<p class="sub">لا نقاط بعد.</p>'}</div></div>`;
        if (tab === "led") { body.innerHTML = '<p class="sub">جارٍ التحميل…</p>'; const L = await rpc("qm_ledger_list", { p_student: id, p_limit: 300 });
          const KD = { reinforcement: "تعزيز", badge: "وسام", correction: "تصحيح", reversal: "إلغاء" };
          body.innerHTML = `<div class="card"><div class="row2"><h4 style="margin:0">دفتر النقاط</h4><span>الرصيد: ${pts(L.balance)}</span></div>${L.rows.length ? `<div style="overflow:auto"><table class="tbl mt"><thead><tr><th>النقاط</th><th>الحركة</th><th>السبب</th><th>بواسطة</th><th>التاريخ</th></tr></thead><tbody>${L.rows.map((r) => `<tr><td><b class="${r.points < 0 ? "neg" : ""}">${r.points > 0 ? "+" : ""}${r.points}</b></td><td>${KD[r.kind] || r.kind}</td><td>${esc(r.reason || "")}</td><td>${esc(r.by)}</td><td>${esc(fmtShort(r.created_at))}</td></tr>`).join("")}</tbody></table></div>` : '<p class="sub">لا حركات.</p>'}<p class="sub">سجل ثابت لكل حركة على الرصيد؛ لا يُحذف منه شيء، وكل تعديل يظهر حركةً مستقلة.</p></div>`; }
        bind();
      };
      const bind = () => {
        $$("[data-re]", body).forEach((b) => (b.onclick = () => {
          const md = modal(`<h3>تعديل نقاط التعزيز</h3><label>النقاط الجديدة</label><input id="np" type="number" min="0" max="1000" value="${b.dataset.p}"><label>سبب التعديل (مطلوب)</label><textarea id="nr"></textarea><p class="err" id="ne"></p><div class="acts mt"><button class="btn" id="ok">حفظ</button><button class="btn sec" id="no">رجوع</button></div>`);
          $("#no", md.el).onclick = md.close;
          $("#ok", md.el).onclick = async () => { try { await rpc("qm_edit_reinforcement_points", { p_id: b.dataset.re, p_points: +$("#np", md.el).value, p_reason: $("#nr", md.el).value }); md.close(); toast("عُدّلت النقاط"); load(); } catch (e) { $("#ne", md.el).textContent = mapErr(e); } };
        }));
        $$("[data-rd]", body).forEach((b) => (b.onclick = async () => { const n = await askNote("حذف التعزيز", "سبب الحذف (مطلوب). تُعكس نقاطه ويبقى أثره في دفتر النقاط.", true); if (!n) return; try { await rpc("qm_void_reinforcement", { p_id: b.dataset.rd, p_reason: n }); toast("حُذف التعزيز وعُكست نقاطه"); load(); } catch (e) { toast(mapErr(e), true); } }));
        $$("[data-bd]", body).forEach((b) => (b.onclick = async () => { const n = await askNote("سحب الوسام", "سبب السحب (مطلوب). تُعكس نقاط الوسام من الرصيد.", true); if (!n) return; try { await rpc("qm_revoke_badge", { p_id: b.dataset.bd, p_reason: n }); toast("سُحب الوسام"); load(); } catch (e) { toast(mapErr(e), true); } }));
        $$("[data-pd]", body).forEach((b) => (b.onclick = async () => { const n = await askNote("حذف الموقف الإيجابي", "سبب الحذف (مطلوب).", true); if (!n) return; try { await rpc("qm_delete_positive", { p_id: b.dataset.pd, p_reason: n }); toast("حُذف الموقف"); load(); } catch (e) { toast(mapErr(e), true); } }));
        $$("[data-be]", body).forEach((b) => (b.onclick = async () => {
          const x = B.find((y) => y.id === b.dataset.be); const { data: BL } = await sb.from("qm_badges").select("id,name_ar,points,is_active").order("sort_order");
          const list = (BL || []).filter((y) => y.is_active || y.id === x.badge_id);
          const md = modal(`<h3>تعديل الوسام</h3><label>الوسام</label><select id="eb">${list.map((y) => `<option value="${y.id}" data-p="${y.points || 0}" ${y.id === x.badge_id ? "selected" : ""}>${esc(y.name_ar)}${y.points ? " (+" + y.points + ")" : ""}</option>`).join("")}</select>
            <label>نقاط الوسام لهذا المتعلم</label><input id="ep" type="number" min="0" max="1000" value="${x.points || 0}"><label>سبب المنح</label><textarea id="en" maxlength="300">${esc(x.note || "")}</textarea><label>سبب التعديل (مطلوب)</label><input id="er" maxlength="300"><p class="err" id="ee"></p><div class="acts mt"><button class="btn" id="ok">حفظ</button><button class="btn sec" id="no">رجوع</button></div>`);
          $("#eb", md.el).onchange = (e) => ($("#ep", md.el).value = e.target.selectedOptions[0].dataset.p);
          $("#no", md.el).onclick = md.close;
          $("#ok", md.el).onclick = async () => { try { await rpc("qm_edit_student_badge", { p_id: x.id, p_badge: $("#eb", md.el).value, p_note: $("#en", md.el).value, p_points: +$("#ep", md.el).value, p_reason: $("#er", md.el).value }); md.close(); toast("عُدّل الوسام"); load(); } catch (e) { $("#ee", md.el).textContent = mapErr(e); } };
        }));
      };
      $$("[data-lt]", m).forEach((x) => (x.onclick = () => { tab = x.dataset.lt; draw(); }));
      const on = (k, f) => { const e = $(k); if (e) e.onclick = f; };
      on("#xCard", () => openStudentCard(id));
      on("#xAdj", () => adjustPoints(id, load));
      on("#xBdg", () => awardBadge(id, load));
      on("#xAdd", async () => {
        const T = await types("qm_reinforcement_types");
        const md = modal(`<h3>إضافة نقاط</h3><label>نوع التعزيز</label><select id="ty">${T.map((t) => `<option value="${t.id}" data-p="${t.default_points}">${esc(t.name_ar)}</option>`).join("")}</select><label>عدد النقاط</label><input id="pt" type="number" min="1" max="1000" value="${T[0]?.default_points || 1}"><label>ملاحظة (اختياري)</label><input id="ds" maxlength="300"><p class="err" id="pe"></p><div class="acts mt"><button class="btn" id="ok">إضافة</button><button class="btn sec" id="no">رجوع</button></div>`);
        $("#ty", md.el).onchange = (e) => ($("#pt", md.el).value = e.target.selectedOptions[0].dataset.p || 1);
        $("#no", md.el).onclick = md.close;
        $("#ok", md.el).onclick = async () => { try { await rpc("qm_admin_add_points", { p_student: id, p_type: $("#ty", md.el).value, p_points: +$("#pt", md.el).value, p_description: $("#ds", md.el).value }); md.close(); toast("أُضيفت النقاط"); load(); } catch (e) { $("#pe", md.el).textContent = mapErr(e); } };
      });
      await draw();
    };
    try { await load(); } catch (e) { m.innerHTML = empty("users", "تعذر فتح ملف المتعلم", mapErr(e)); }
  }, { nav: "students.html", title: "ملف المتعلم", icon: "user", desc: "كل نقاط المتعلم وأوسمته وإنجازاته ومواقفه وحركة رصيده، وإدارتها من مكان واحد" }),
});
// «تصحيح النقاط» صار داخل ملف المتعلم: الرابط القديم يفتح البحث عن المتعلم
PAGES.points = () => location.replace("learner.html");
PAGES.teach = () => openHub("teach.html");
// منح الأوسمة لوكيل شؤون الطلاب: صفحة مستقلة بخطوات واضحة (الوسام ← المتعلمون ← السبب)، والأوسمة العامة فقط
// «منح الأوسمة» للوكيل حُذفت: المنح من «مهامي معلّماً ← منح النقاط والأوسمة» (الأوسمة كلها، فردياً أو للفصل)
PAGES.award = () => location.replace("teach.html?tab=reinforce");
PAGES.awardOld = () => boot("award.html", async (m, c) => {
  if (!c.canReinforce) { m.innerHTML = empty("crown", "لا تملك صلاحية التعزيز", "تُمنح من صفحة «الصلاحيات» في قيمي."); return; }
  const [BQ, F, H] = await Promise.all([sb.from("qm_badges").select("id,name_ar,criteria,points,kind,category,icon,image_path,sort_order").eq("is_active", true).neq("kind", "educational").order("sort_order"),
    rpc("qm_pub_filters"), rpc("qm_pub_home").catch(() => ({}))]);
  const B = (BQ.data || []).map((b) => ({ ...b, image: b.image_path }));
  F.sections = F.sections.filter((x) => canSection(x.id)); F.grades = F.grades.filter((g) => F.sections.some((x) => x.grade === g.code));
  if (!F.sections.length) { m.innerHTML = noSectionsMsg(); return; }
  const st = { badge: null, grade: "", section: "", rows: [], sel: new Map() };
  const mine = ((H && H.last_badges) || []).filter((x) => x.by === c.who.name).slice(0, 8);
  m.innerHTML = `<section class="aw-hero"><span class="aw-ic">${ico("crown")}</span><div><h2>منح الأوسمة</h2><p>كرّم المتميزين سلوكاً وانضباطاً ومبادرة بأوسمة المدرسة العامة. اختر الوسام، ثم المتعلمين، ثم اكتب سبب المنح.</p></div></section>
    <section class="aw-step"><h3><i>1</i>اختر الوسام</h3><div class="aw-b" id="awB">${B.length ? B.map((b) => `<button type="button" class="aw-card" data-b="${b.id}" aria-pressed="false">${medal(b, "lg")}<b>${esc(b.name_ar)}</b><small>${esc(b.criteria || b.category || "")}</small>${b.points ? `<em><bdi>+${b.points}</bdi> نقطة</em>` : ""}</button>`).join("") : '<p class="sub">لا أوسمة عامة فعّالة. تُضاف من «إدارة البوابة» ← الأوسمة.</p>'}</div></section>
    <section class="aw-step"><h3><i>2</i>اختر المتعلمين</h3>
      <div class="gr-steps"><div class="gr-step"><span>الصف</span><div class="gr-chips" id="gG">${F.grades.map((g) => `<button type="button" data-g="${esc(g.code)}" aria-pressed="false">${esc(g.name)}</button>`).join("")}</div></div>
        <div class="gr-step" id="gSw" hidden><span>الفصل</span><div class="gr-chips" id="gS"></div></div>
        <div class="gr-step"><span>أو ابحث عن متعلم من أي فصل</span><div id="pk"></div></div></div>
      <div id="ro" class="mt"></div></section>
    <section class="aw-step"><h3><i>3</i>سبب المنح</h3><input id="why" maxlength="300" placeholder="مثال: التزامه بالانضباط طوال الشهر، مبادرته في خدمة زملائه"></section>
    <div class="aw-bar" id="bar"></div>
    ${mine.length ? `<h3 class="sec">آخر ما منحتُه من أوسمة</h3><div class="card">${mine.map((x) => `<div class="fd"><span class="fd-ic b">${ico("medal")}</span><div><b><a href="learner.html?id=${x.id}">${esc(shortName(x.name))}</a></b> نال «${esc(x.badge)}»<small>${klass(x)} · ${esc(ago(x.at))}</small></div></div>`).join("")}</div>` : ""}`;
  const bar = () => { const b = B.find((x) => x.id === st.badge), n = st.sel.size;
    $("#bar").innerHTML = `<div class="aw-sum">${b ? medal(b, "sm") : `<span class="aw-q">${ico("crown")}</span>`}<div><b>${b ? "وسام «" + esc(b.name_ar) + "»" : "لم تختر الوسام بعد"}</b><small>${n ? n + (n > 10 ? " متعلماً" : n > 2 ? " متعلمين" : n === 2 ? " متعلمان" : " متعلم") : "لم تختر متعلمين بعد"}</small></div></div>
      ${n ? `<div class="aw-who">${[...st.sel.values()].map((s) => `<span>${esc(shortName(s.name))}<button type="button" data-rm="${s.id}" aria-label="إزالة ${esc(s.name)}">×</button></span>`).join("")}</div>` : ""}
      <button class="btn aw-go" id="go" type="button" ${b && n ? "" : "disabled"}>${ico("crown")}منح الوسام</button>`;
    $$("[data-rm]", $("#bar")).forEach((x) => (x.onclick = () => { st.sel.delete(x.dataset.rm); drawRoster(); bar(); }));
    $("#go").onclick = give; };
  const drawRoster = () => { const ro = $("#ro");
    if (!st.section) { ro.innerHTML = ""; return; }
    if (!st.rows.length) { ro.innerHTML = empty("users", "لا متعلمين في هذا الفصل"); return; }
    const all = st.rows.every((s) => st.sel.has(s.id));
    ro.innerHTML = `<div class="aw-ro"><label class="aw-all"><input type="checkbox" id="all" ${all ? "checked" : ""}>تحديد كل الفصل (${st.rows.length})</label>${st.rows.map((s) => { const has = st.badge && (s.badges || []).includes(st.badge);
      return `<label class="aw-s${st.sel.has(s.id) ? " on" : ""}"><input type="checkbox" data-s="${s.id}" ${st.sel.has(s.id) ? "checked" : ""}><span>${esc(s.name)}${has ? `<small>لديه هذا الوسام</small>` : ""}</span></label>`; }).join("")}</div>`;
    $("#all").onchange = (e) => { st.rows.forEach((s) => (e.target.checked ? st.sel.set(s.id, s) : st.sel.delete(s.id))); drawRoster(); bar(); };
    $$("[data-s]", ro).forEach((x) => (x.onchange = () => { const s = st.rows.find((r) => r.id === x.dataset.s); x.checked ? st.sel.set(s.id, s) : st.sel.delete(s.id); drawRoster(); bar(); })); };
  const loadRoster = async () => { if (!st.section) return drawRoster(); $("#ro").innerHTML = '<p class="sub">جارٍ التحميل…</p>'; try { st.rows = await rpc("qm_section_roster", { p_section: st.section }); drawRoster(); } catch (e) { $("#ro").innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; } };
  $$("#awB [data-b]").forEach((x) => (x.onclick = () => { st.badge = x.dataset.b; $$("#awB [data-b]").forEach((y) => y.setAttribute("aria-pressed", y === x)); drawRoster(); bar(); }));
  $$("#gG button").forEach((x) => (x.onclick = () => { st.grade = x.dataset.g; st.section = ""; st.rows = []; $$("#gG button").forEach((y) => y.setAttribute("aria-pressed", y === x));
    const S = F.sections.filter((z) => z.grade === st.grade); $("#gSw").hidden = false;
    $("#gS").innerHTML = S.length ? S.map((z) => `<button type="button" data-s="${z.id}" aria-pressed="false">${esc(z.name)}</button>`).join("") : '<span class="sub">لا فصول لهذا الصف.</span>';
    $$("#gS button").forEach((y) => (y.onclick = () => { st.section = y.dataset.s; $$("#gS button").forEach((w) => w.setAttribute("aria-pressed", w === y)); loadRoster(); })); drawRoster(); }));
  studentPicker($("#pk"), (s) => { st.sel.set(s.id, s); bar(); drawRoster(); }, { placeholder: "اكتب حرفين على الأقل من الاسم أو الرقم", filter: (s) => canSection(s.section_id) });
  async function give() {
    const b = B.find((x) => x.id === st.badge), studs = [...st.sel.values()], go = $("#go"); if (!b || !studs.length) return;
    go.disabled = true;
    try { const R = await rpc("qm_grant_bulk", { p_students: studs.map((s) => s.id), p_kind: "badge", p_ref: b.id, p_points: 0, p_note: $("#why").value.trim() || null });
      const sk = R.skipped || [], skId = new Set(sk.map((x) => x.id));
      if (R.ok) notice(`تم منح وسام «${b.name_ar}» بنجاح`, studs.filter((s) => !skId.has(s.id)).map((s) => [s.name, `نال وسام «${b.name_ar}»`]), "ok");
      if (sk.length) notice(`لم يُمنح الوسام لـ ${sk.length === 1 ? "متعلم واحد" : sk.length + " متعلمين"}`, sk.map((x) => [x.name, skipWhy(x.why, "badge")]));
      st.sel.clear(); $("#why").value = ""; await loadRoster(); bar();
    } catch (e) { notice("لم يُمنح الوسام", [[null, mapErr(e)]]); go.disabled = false; }
  }
  bar();
}, { role: "agent" });
// الرئيسية وقسما الوكيل والموجه صارت صفحات مجمّعة: التبويب الأول هو الصفحة الأصلية
PAGES.overview = PAGES.dashboard; PAGES.dashboard = () => openHub("dashboard.html");
PAGES.box = PAGES.agent; PAGES.agent = () => openHub("agent.html");
PAGES.cases = PAGES.counselor; PAGES.counselor = () => openHub("counselor.html");
PAGES.positive = () => openHub("positive.html");
PAGES.negative = () => openHub("negative.html");
