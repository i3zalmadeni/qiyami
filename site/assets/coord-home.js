// الرئيسية للمنسق (قيمي): نظرة شاملة تفاعلية لكل ما يدور في المنصة خلال فترة يختارها، مع المقارنة بالفترة السابقة
(function () {
  const PK = "qm-coord-days";
  const nf = (v) => Number(v || 0).toLocaleString("en-US");
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const dayLbl = (d, o) => new Date(d + "T12:00:00Z").toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: o || "short", timeZone: "UTC" });
  const delta = ([cur, prev]) => {
    if (!prev && !cur) return '<small class="co-d">بلا تغيير</small>';
    if (!prev) return '<small class="co-d up">جديد في الفترة</small>';
    const d = Math.round(((cur - prev) / prev) * 100);
    return `<small class="co-d ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "▲" : d < 0 ? "▼" : "●"} ${Math.abs(d)}% عن الفترة السابقة</small>`;
  };
  const METRICS = { reinf: ["التعزيزات", "check"], points: ["النقاط الممنوحة", "star"], badges: ["الأوسمة", "medal"], incidents: ["الوقائع المرصودة", "flag"] };
  const bars = (rows, key, lab, href) => { const mx = Math.max(1, ...rows.map((r) => r[key] || 0));
    return rows.length ? `<div class="co-bars">${rows.map((r) => `<div class="co-bar" title="${esc(r.name)}: ${nf(r[key])} ${lab}"><span class="co-bl">${esc(r.name)}</span><span class="co-bt"><i style="width:${Math.max(2, (r[key] / mx) * 100)}%"></i></span><b>${nf(r[key])}</b></div>`).join("")}</div>` : '<p class="sub">لا بيانات في هذه الفترة.</p>'; };

  window.coordHome = async function (m, c) {
    let days = +(() => { try { return localStorage.getItem(PK); } catch { return null; } })() || 30, metric = "reinf", secSort = "grade", secGrade = "", ulGrade = "", feedK = "all", typeKey = "n";
    let D;
    const load = async () => { m.innerHTML = '<p class="sub">جارٍ تحميل النظرة الشاملة…</p>'; D = await rpc("qm_coord_overview", { p_days: days }); draw(); };

    const draw = () => {
      const K = D.kpi, A = D.achievements, S = D.support;
      const grades = [...new Set(D.sections.map((s) => s.grade))];
      // بانتظار إجرائك: ما يحتاج قراراً من المنسق أو متابعة منه
      const alerts = [];
      if (A.pending) alerts.push(["hourglass", A.pending + " إنجاز بانتظار التحقق", "positive.html?tab=achievements&t=review", "warn"]);
      if (A.needs_info) alerts.push(["help", A.needs_info + " إنجاز أُعيد للاستكمال", "positive.html?tab=achievements&t=review", ""]);
      if (D.inc_overdue) alerts.push(["clock", D.inc_overdue + " واقعة تأخرت لدى الوكيل أكثر من 3 أيام", "#co-inc", "warn"]);
      if (S.due) alerts.push(["calendar", S.due + " متابعة دعم تجاوزت موعدها", "#co-inc", "warn"]);
      if (D.unreached) alerts.push(["users", D.unreached + " متعلماً لم يصلهم تعزيز في الفترة", "#co-ul", ""]);
      if (D.idle.length) alerts.push(["user", D.idle.length + " من المخوّلين بالتعزيز لم يمنحوا في الفترة", "#co-st", ""]);

      const tile = (k, ic, lab, v, sub, extra) => `<button type="button" class="co-k ${METRICS[k] ? "pick" : ""} ${metric === k ? "on" : ""}" ${METRICS[k] ? `data-mt="${k}" aria-pressed="${metric === k}"` : "disabled"}>
          <span class="co-ki">${ico(ic)}</span><span class="co-kl">${lab}</span><b>${v}</b>${sub || ""}${extra || ""}</button>`;
      const ring = (a, b) => `<span class="co-ring" style="--p:${pct(a, b)}"><em>${pct(a, b)}%</em></span>`;

      m.innerHTML = `
      <div class="co-top card"><div><b>الفترة</b><div class="tabs co-per" role="group" aria-label="الفترة">${[[7, "7 أيام"], [30, "30 يوماً"], [90, "90 يوماً"], [365, "سنة"]].map(([v, l]) => `<button type="button" data-days="${v}" class="${v === days ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <p class="sub">من ${esc(dayLbl(D.from, "long"))} إلى ${esc(dayLbl(D.to, "long"))}، والمقارنة بالمدة نفسها قبلها.</p></div>

      ${alerts.length ? `<div class="co-al">${alerts.map(([i, t, h, tone]) => `<a class="co-a ${tone}" href="${h}">${ico(i)}<span>${esc(t)}</span></a>`).join("")}</div>` : ""}

      <div class="co-ks">
        ${tile("reinf", "check", "التعزيزات", nf(K.reinf[0]), delta(K.reinf))}
        ${tile("points", "star", "النقاط الممنوحة", nf(K.points[0]), delta(K.points))}
        ${tile("badges", "medal", "الأوسمة", nf(K.badges[0]), delta(K.badges))}
        ${tile("incidents", "flag", "الوقائع المرصودة", nf(K.incidents[0]), delta(K.incidents))}
        ${tile("reached", "users", "متعلمون نالوا تعزيزاً", nf(K.reached[0]), `<small class="co-d">من ${nf(D.enrolled)} متعلماً</small>`, ring(K.reached[0], D.enrolled))}
        ${tile("givers", "user", "منسوبون منحوا", nf(K.givers[0]), `<small class="co-d">من ${nf(D.givers_possible)} مخوّلاً</small>`, ring(K.givers[0], D.givers_possible))}
        ${tile("ach", "trophy", "إنجازات موثقة", nf(K.achievements[0]), delta(K.achievements))}
      </div>

      <div class="card co-ch"><div class="row2"><h4 style="margin:0" id="co-ct"></h4><div class="tabs co-mt" role="group" aria-label="المؤشر">${Object.entries(METRICS).map(([k, [l]]) => `<button type="button" data-mt="${k}" class="${k === metric ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <div class="co-cw" id="co-cw"></div><div class="co-cs" id="co-cs"></div></div>

      <div class="co-g2">
        <div class="card"><div class="row2"><h4 style="margin:0">التغطية حسب الفصل</h4>
            <select id="co-ss" aria-label="ترتيب الفصول"><option value="grade">ترتيب الصفوف</option><option value="low">الأقل تغطية أولاً</option><option value="pts">الأعلى نقاطاً</option><option value="inc">الأكثر وقائع</option></select></div>
          <div class="tabs co-gf">${["", ...grades].map((g) => `<button type="button" data-sg="${esc(g)}" class="${g === secGrade ? "on" : ""}">${g ? esc(g) : "كل الصفوف"}</button>`).join("")}</div>
          <div id="co-sec"></div><p class="sub">التغطية: نسبة متعلمي الفصل الذين نالوا تعزيزاً أو وساماً في الفترة. اضغط الفصل لفتحه في دليل المتعلمين.</p></div>
        <div class="card" id="co-ul"><div class="row2"><h4 style="margin:0">لم يصلهم تعزيز في الفترة</h4><span class="co-big">${nf(D.unreached)}</span></div>
          <select id="co-ug" aria-label="الصف"><option value="">كل الصفوف</option>${grades.map((g) => `<option ${g === ulGrade ? "selected" : ""}>${esc(g)}</option>`).join("")}</select>
          <div id="co-ull" class="co-chips"></div>${D.unreached > D.unreached_list.length ? `<p class="sub">يُعرض أول ${D.unreached_list.length}. البقية في <a href="students.html">دليل المتعلمين</a>.</p>` : ""}</div>
      </div>

      <div class="co-g2">
        <div class="card"><div class="row2"><h4 style="margin:0">جوانب التعزيز</h4><div class="tabs co-sm"><button type="button" data-tk="n" class="${typeKey === "n" ? "on" : ""}">بالعدد</button><button type="button" data-tk="points" class="${typeKey === "points" ? "on" : ""}">بالنقاط</button></div></div><div id="co-ty"></div></div>
        <div class="card"><h4 style="margin-top:0">الأوسمة الممنوحة</h4>${bars(D.badges, "n", "مرة")}</div>
      </div>

      <div class="co-g2" id="co-st">
        <div class="card"><h4 style="margin-top:0">الأكثر منحاً في الفترة</h4>${D.givers.length ? `<table class="tbl"><thead><tr><th>المنسوب</th><th>تعزيز</th><th>متعلم</th><th>نقاط</th></tr></thead><tbody>${D.givers.map((g, i) => `<tr><td><span class="co-rk">${i + 1}</span> ${esc(g.name)}</td><td>${nf(g.n)}</td><td>${nf(g.students)}</td><td>${nf(g.points)}</td></tr>`).join("")}</tbody></table>` : '<p class="sub">لم يُمنح شيء في هذه الفترة.</p>'}</div>
        <div class="card"><div class="row2"><h4 style="margin:0">مخوّلون لم يمنحوا في الفترة</h4><span class="co-big">${nf(D.idle.length)}</span></div>
          ${D.idle.length ? `<details class="co-det"><summary>عرض الأسماء</summary><div class="co-chips">${D.idle.map((s) => `<span class="co-chip">${esc(s.name)}</span>`).join("")}</div></details><p class="sub">يمكن تذكيرهم أو مراجعة صلاحياتهم من <a href="admin.html?tab=perms">إدارة البوابة ← الصلاحيات</a>.</p>` : '<p class="sub">كل المخوّلين منحوا في هذه الفترة.</p>'}</div>
      </div>

      <div class="co-g2" id="co-inc">
        <div class="card"><div class="row2"><h4 style="margin:0">مسار الوقائع السلوكية</h4>${D.inc_overdue ? `<span class="badge warn">${D.inc_overdue} متأخرة</span>` : ""}</div>
          <div class="co-pipe">${D.pipeline.map((p) => `<div class="co-ps t-${p.tone} ${p.n ? "" : "z"}"><b>${nf(p.n)}</b><span>${esc(p.name)}</span></div>`).join("")}</div>
          <p class="sub">المفتوحة كلها، والمغلقة خلال الفترة.</p><h4>التصنيفات في الفترة</h4>${bars(D.inc_categories, "n", "واقعة")}</div>
        <div class="card"><h4 style="margin-top:0">الإنجاز والمواهب والدعم</h4>
          <div class="co-mini">
            <a href="positive.html?tab=achievements&t=review"><b>${nf(A.pending + A.needs_info)}</b><span>إنجازات تنتظر التحقق</span></a>
            <a href="positive.html?tab=achievements&t=gallery"><b>${nf(A.verified)}</b><span>إنجازاً موثقاً</span></a>
            <a href="positive.html?tab=achievements&t=talents"><b>${nf(A.talents)}</b><span>موهبة مرصودة${A.talents_new ? ` (${A.talents_new} جديدة)` : ""}</span></a>
            <div><b>${nf(S.active)}</b><span>حالة دعم نشطة${S.new ? ` (${S.new} جديدة)` : ""}</span></div>
            <div><b>${nf(S.due)}</b><span>متابعة دعم متأخرة</span></div>
            <div><b>${nf(S.closed)}</b><span>حالة دعم أُغلقت في الفترة</span></div>
          </div>
          ${Object.keys(A.by_level || {}).length ? `<h4>الإنجازات الموثقة حسب المستوى</h4>${bars(Object.entries(A.by_level).map(([k, n]) => ({ name: LV[k] || k, n })), "n", "إنجاز")}` : ""}</div>
      </div>

      <div class="card"><div class="row2"><h4 style="margin:0">آخر ما جرى في المنصة</h4><div class="tabs co-sm">${[["all", "الكل"], ["points", "نقاط"], ["badge", "أوسمة"], ["incident", "وقائع"], ["achievement", "إنجازات"]].map(([k, l]) => `<button type="button" data-fk="${k}" class="${k === feedK ? "on" : ""}">${l}</button>`).join("")}</div></div><div id="co-fd"></div></div>`;

      drawChart(); drawSecs(); drawUl(); drawTypes(); drawFeed();
      $$("[data-days]", m).forEach((b) => (b.onclick = () => { days = +b.dataset.days; try { localStorage.setItem(PK, days); } catch {} load(); }));
      $$("[data-mt]", m).forEach((b) => (b.onclick = () => { metric = b.dataset.mt; $$("[data-mt]", m).forEach((x) => { x.classList.toggle("on", x.dataset.mt === metric); x.hasAttribute("aria-pressed") && x.setAttribute("aria-pressed", x.dataset.mt === metric); }); drawChart(); }));
      $("#co-ss").value = secSort; $("#co-ss").onchange = (e) => { secSort = e.target.value; drawSecs(); };
      $$("[data-sg]", m).forEach((b) => (b.onclick = () => { secGrade = b.dataset.sg; $$("[data-sg]", m).forEach((x) => x.classList.toggle("on", x === b)); drawSecs(); }));
      $("#co-ug").onchange = (e) => { ulGrade = e.target.value; drawUl(); };
      $$("[data-tk]", m).forEach((b) => (b.onclick = () => { typeKey = b.dataset.tk; $$("[data-tk]", m).forEach((x) => x.classList.toggle("on", x === b)); drawTypes(); }));
      $$("[data-fk]", m).forEach((b) => (b.onclick = () => { feedK = b.dataset.fk; $$("[data-fk]", m).forEach((x) => x.classList.toggle("on", x === b)); drawFeed(); }));
    };

    // المسار اليومي (أسبوعي إذا زادت الفترة على 45 يوماً) بأعمدة وتلميح عند المرور
    const drawChart = () => {
      let pts0 = D.series.map((s) => ({ d: s.d, v: s[metric] || 0, l: dayLbl(s.d) }));
      const weekly = pts0.length > 45;
      if (weekly) { const w = []; for (let i = 0; i < pts0.length; i += 7) { const g = pts0.slice(i, i + 7); w.push({ d: g[0].d, v: g.reduce((a, x) => a + x.v, 0), l: "أسبوع " + g[0].l + " – " + g[g.length - 1].l }); } pts0 = w; }
      const P = pts0, n = P.length, mx = Math.max(1, ...P.map((p) => p.v)), W = 1000, H = 220, pad = 26, AX = 40, bw = (W - AX - 4) / n, gap = Math.min(4, bw * 0.25);
      const tot = P.reduce((a, p) => a + p.v, 0), peak = P.reduce((a, p) => (p.v > a.v ? p : a), P[0] || { v: 0 });
      $("#co-ct").textContent = METRICS[metric][0] + (weekly ? " أسبوعياً" : " يومياً");
      const ticks = [0, Math.round(mx / 2), mx];
      $("#co-cw").innerHTML = `<svg viewBox="0 0 ${W} ${H + pad}" class="co-svg" role="img" aria-label="${METRICS[metric][0]}: المجموع ${tot}">
          ${ticks.map((t) => { const y = H - (t / mx) * (H - 10); return `<line x1="0" x2="${W - AX}" y1="${y}" y2="${y}" class="co-gl"/><text x="${W - 2}" y="${y + 4}" class="co-ax co-yt" text-anchor="end">${t}</text>`; }).join("")}
          ${P.map((p, i) => { const h = p.v ? Math.max(3, (p.v / mx) * (H - 10)) : 0, x = W - AX - (i + 1) * bw + gap / 2;
            return `<g data-i="${i}"><rect x="${x - gap / 2}" y="0" width="${bw}" height="${H}" class="co-hit"/>${h ? `<path class="co-b" d="M${x},${H} v${-(h - 3)} q0,-3 3,-3 h${bw - gap - 6} q3,0 3,3 v${h - 3} z"/>` : ""}</g>`; }).join("")}
          ${P.map((p, i) => (i % Math.ceil(n / 8) === 0 ? `<text x="${W - AX - (i + 0.5) * bw}" y="${H + 18}" class="co-ax" text-anchor="middle">${esc(weekly ? dayLbl(p.d) : p.l)}</text>` : "")).join("")}
        </svg><div class="co-tip" hidden></div>`;
      $("#co-cs").innerHTML = `<span>المجموع <b>${nf(tot)}</b></span><span>المتوسط ${weekly ? "الأسبوعي" : "اليومي"} <b>${(tot / Math.max(1, n)).toFixed(1)}</b></span>${peak && peak.v ? `<span>الذروة <b>${nf(peak.v)}</b> في ${esc(peak.l)}</span>` : ""}`;
      const cw = $("#co-cw"), tip = $(".co-tip", cw);
      cw.onmousemove = (e) => { const g = e.target.closest("[data-i]"); if (!g) { tip.hidden = true; return; } const p = P[+g.dataset.i];
        $$("[data-i]", cw).forEach((x) => x.classList.toggle("hov", x === g));
        tip.innerHTML = `<small>${esc(p.l)}</small><b>${nf(p.v)}</b> ${esc(METRICS[metric][0])}`; tip.hidden = false;
        const r = cw.getBoundingClientRect(); tip.style.left = Math.min(r.width - 150, Math.max(0, e.clientX - r.left - 70)) + "px"; tip.style.top = Math.max(0, e.clientY - r.top - 64) + "px"; };
      cw.onmouseleave = () => { tip.hidden = true; $$("[data-i]", cw).forEach((x) => x.classList.remove("hov")); };
    };
    const drawSecs = () => {
      let R = D.sections.filter((s) => !secGrade || s.grade === secGrade).map((s) => ({ ...s, cov: pct(s.reached, s.enrolled) }));
      if (secSort === "low") R.sort((a, b) => a.cov - b.cov); else if (secSort === "pts") R.sort((a, b) => b.points - a.points); else if (secSort === "inc") R.sort((a, b) => b.incidents - a.incidents);
      $("#co-sec").innerHTML = R.length ? `<div style="overflow:auto"><table class="tbl co-st"><thead><tr><th>الفصل</th><th>التغطية</th><th>تعزيز</th><th>نقاط</th><th>وقائع</th></tr></thead><tbody>${R.map((s) => `<tr data-go="students.html?g=${encodeURIComponent(s.grade_code)}&s=${s.id}" tabindex="0" title="فتح الفصل في دليل المتعلمين">
          <td><b>${esc(s.grade)}</b><br><small>${esc(s.section)}</small></td><td><div class="co-cov"><span class="co-bt"><i class="${s.cov < 30 ? "lo" : ""}" style="width:${s.cov ? Math.max(2, s.cov) : 0}%"></i></span><small>${s.cov}% · ${s.reached}/${s.enrolled}</small></div></td><td>${nf(s.reinf)}</td><td>${nf(s.points)}</td><td>${s.incidents ? `<span class="badge warn">${s.incidents}</span>` : "0"}</td></tr>`).join("")}</tbody></table></div>` : '<p class="sub">لا فصول.</p>';
      $$("[data-go]", $("#co-sec")).forEach((tr) => { tr.onclick = () => (location.href = tr.dataset.go); tr.onkeydown = (e) => e.key === "Enter" && (location.href = tr.dataset.go); });
    };
    const drawUl = () => { const L = D.unreached_list.filter((s) => !ulGrade || s.grade === ulGrade);
      $("#co-ull").innerHTML = L.length ? L.map((s) => `<a class="co-chip" href="learner.html?id=${s.id}" title="${esc(s.grade || "")} · ${esc(s.section || "")}">${esc(shortName(s.name))}<small>${esc(s.section || "")}</small></a>`).join("") : '<p class="sub">لا أحد — وصل التعزيز إلى الجميع.</p>'; };
    const drawTypes = () => ($("#co-ty").innerHTML = bars([...D.types].sort((a, b) => b[typeKey] - a[typeKey]), typeKey, typeKey === "n" ? "مرة" : "نقطة"));
    const drawFeed = () => {
      const ev = []; D.feed.filter((e) => feedK === "all" || e.k === feedK).forEach((e) => { const g = e.k === "points" && ev.find((x) => x.k === "points" && x.at === e.at && x.by === e.by && x.title === e.title && x.points === e.points); if (g) g.n++; else ev.push({ ...e, n: 1 }); });
      const IC = { points: ["star", "p"], badge: ["medal", "b"], incident: ["flag", "i"], achievement: ["trophy", "a"] };
      const who = (e) => (e.n > 1 ? `<b>${e.n} متعلماً</b>` : e.sid ? `<b><a href="learner.html?id=${e.sid}">${esc(shortName(e.student))}</a></b>` : "");
      const txt = (e) => e.k === "points" ? `${who(e)} ${e.n > 1 ? "نالوا" : "نال"} ${pts(e.points)}${e.n > 1 ? " لكلٍّ منهم" : ""} · ${esc(e.title)}` : e.k === "badge" ? `${who(e)} نال وسام «${esc(e.title)}»` : e.k === "incident" ? `رُصدت واقعة «${esc(e.title)}» على ${who(e)}` : `سُجّل إنجاز «${esc(e.title)}»`;
      $("#co-fd").innerHTML = ev.length ? ev.slice(0, 15).map((e) => `<div class="fd"><span class="fd-ic ${IC[e.k][1]}">${ico(IC[e.k][0])}</span><div>${txt(e)}<small>${esc(e.by)} · ${esc(ago(e.at))}</small></div></div>`).join("") : '<p class="sub">لا حركات.</p>';
    };
    try { await load(); } catch (e) { m.innerHTML = empty("chart", "تعذر تحميل النظرة الشاملة", mapErr(e)); }
  };
})();
