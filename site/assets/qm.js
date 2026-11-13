/* المنطق المشترك لنظام «قيمي» (رعاية المتعلمين). الهوية من core.css وchrome.js (هوية النواة الرقمية).
   كل عملية كتابة تتم عبر دوال qm_* في قاعدة النواة وتتحقق من الدور على الخادم؛ الواجهة هنا للعرض فقط. */
const sb = supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);
async function doLogout(to) {
  try { await Promise.race([sb.auth.signOut({ scope: "local" }), new Promise((r) => setTimeout(r, 2500))]); } catch (_) {}
  try { Object.keys(localStorage).filter((k) => /^sb-.*-auth-token/.test(k)).forEach((k) => localStorage.removeItem(k)); sessionStorage.clear(); } catch (_) {}
  location.replace(to || "index.html");
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const TZ = "Asia/Riyadh";
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const fmtDay = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T12:00:00Z").toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—");
const fmtHijri = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T12:00:00Z").toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
const fmtT = (d) => (d ? new Date(d).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }) : "—");
const fmtShort = (d) => (d ? new Date(d).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", timeZone: TZ }) : "");
const ago = (d) => { const m = Math.max(0, Math.round((Date.now() - new Date(d)) / 60000)); return m < 1 ? "الآن" : m < 60 ? `قبل ${m} دقيقة` : m < 1440 ? `قبل ${Math.round(m / 60)} ساعة` : `قبل ${Math.round(m / 1440)} يوماً`; };

const ERR = {
  not_staff: "حسابك غير مرتبط بسجل منسوب فعّال في النواة الرقمية.",
  forbidden: "لا تملك صلاحية تنفيذ هذه العملية.",
  not_found: "السجل غير موجود.",
  not_allowed: "هذا الإجراء غير متاح في الحالة الحالية للواقعة.",
  note_required: "هذا الحقل مطلوب.",
  type_invalid: "الاختيار غير متاح. حدّث الصفحة وأعد المحاولة.",
  points_invalid: "عدد النقاط غير صحيح أو يتجاوز الحد الأقصى المسموح.",
  student_not_enrolled: "هذا المتعلم غير مقيّد في العام الدراسي الحالي.",
  duplicate: "سُجّلت عملية مطابقة قبل قليل. إن كانت مقصودة فانتظر قليلاً.",
  student_required: "أضف متعلماً واحداً على الأقل.",
  date_future: "لا يمكن تسجيل واقعة بتاريخ مستقبلي.",
  already_void: "سبق إلغاء هذا التعزيز.",
  too_many: "العدد كبير. امنح 60 متعلماً كحد أقصى في المرة الواحدة.",
};
const mapErr = (e) => { const m = e?.message || String(e); return ERR[m] || (/permission denied|row-level security/i.test(m) ? ERR.forbidden : m); };
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args || {});
  if (error) throw new Error(mapErr(error));
  return data;
}

function toast(msg, bad) { const d = document.createElement("div"); d.className = "toast" + (bad ? " bad" : ""); d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 3800); }
function modal(html, wide) {
  const ov = document.createElement("div"); ov.className = "ov"; ov.innerHTML = `<div class="md" role="dialog" aria-modal="true" ${wide ? 'style="max-width:860px"' : ""}>${html}</div>`;
  const close = () => ov.remove(); ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
  document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
  document.body.appendChild(ov); return { el: ov.firstChild, close };
}
const empty = (icon, t, s) => `<div class="card empty"><div class="big">${ico(icon)}</div><b>${esc(t)}</b>${s ? `<p class="sub">${esc(s)}</p>` : ""}</div>`;
const tbadge = (name, tone) => `<span class="badge ${tone === "mute" ? "" : tone || ""}">${esc(name)}</span>`;
Object.assign(ICONS, {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z"/><path d="M5 21h14"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.5L5 3h5l2 4 2-4h5l-3.500 7.500"/><path d="M12 13l.9 1.800 2 .3-1.450 1.400.35 2L12 17.550l-1.800.950.35-2L9.100 15.100l2-.3z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.500"/><circle cx="9" cy="10" r="1.800"/><path d="M4 18l5.500-5 4 3.500 2.500-2 4 3.500"/>',
});
// ===== عناصر مشتركة للوحة الشرف: الأسماء والأوسمة =====
const initials = (n) => (n || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(" ");
const shortName = (n) => { const p = (n || "").trim().split(/\s+/).filter((w) => w !== "بن"); return p.length > 2 ? p[0] + " " + p[p.length - 1] : p.join(" "); };
const klass = (x) => esc(x.grade || "") + (x.section ? "، " + esc(x.section) : "");
const badgeUrl = (path) => (path ? APP_CONFIG.supabaseUrl + "/storage/v1/object/public/qm-badges/" + path.split("/").map(encodeURIComponent).join("/") : "");
const KIND = { educational: "تعليمي", general: "عام" };
const medal = (b, cls) => `<span class="mdl ${cls || ""}" data-k="${esc(b.kind || "general")}">${b.image ? `<img src="${esc(badgeUrl(b.image))}" alt="" loading="lazy">` : ico(b.icon in ICONS ? b.icon : "trophy")}</span>`;
const pts = (n) => `<span class="pts ${n < 0 ? "neg" : ""}"><bdi>${n > 0 ? "+" : ""}${n}</bdi></span>`;

// ===== اختيار المتعلم: بحث سريع في طلاب النواة (لا نسخ لبياناتهم) =====
function studentPicker(root, onPick, opts = {}) {
  root.classList.add("pick");
  root.innerHTML = `<input type="search" placeholder="${esc(opts.placeholder || "ابحث باسم المتعلم أو رقمه")}" autocomplete="off" aria-label="بحث عن متعلم"><div class="res" hidden></div>`;
  const inp = $("input", root), res = $(".res", root); let t = 0, seq = 0;
  const run = async () => {
    const q = inp.value.trim(), my = ++seq;
    if (q.length < 2) { res.hidden = true; return; }
    try {
      const rows = await rpc("qm_students_search", { p_q: q, p_limit: 12 });
      if (my !== seq) return;
      res.innerHTML = rows.length ? rows.map((s, i) => `<button type="button" data-i="${i}"><span>${esc(s.name)}</span><small>${esc(s.grade || "")} ${s.section ? "· " + esc(s.section) : ""}</small></button>`).join("") : '<p class="sub" style="margin:12px">لا نتائج.</p>';
      res.hidden = false;
      $$("button", res).forEach((b) => (b.onclick = () => { res.hidden = true; inp.value = ""; onPick(rows[+b.dataset.i]); }));
    } catch (e) { res.innerHTML = `<p class="err" style="margin:12px">${esc(mapErr(e))}</p>`; res.hidden = false; }
  };
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 250); });
  document.addEventListener("click", (e) => { if (!root.contains(e.target)) res.hidden = true; });
}
const chosenHTML = (s) => `<div class="chosen"><div><b>${esc(s.name)}</b><small>${esc(s.grade || "")}${s.section ? " · " + esc(s.section) : ""}${s.no ? " · " + esc(s.no) : ""}</small></div><button type="button" class="btn sm sec" data-clear>تغيير</button></div>`;

// ===== المرفقات: تخزين خاص، المسار يبدأ بمعرّف المستخدم =====
async function uploadFile(file, uid) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("حجم الملف يتجاوز 5 ميجابايت.");
  if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(file.type)) throw new Error("الأنواع المسموحة: صورة أو PDF.");
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${(file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const { error } = await sb.storage.from("qm-attachments").upload(path, file, { contentType: file.type });
  if (error) throw new Error("تعذر رفع المرفق.");
  return path;
}
async function openAttachment(path) {
  const { data, error } = await sb.storage.from("qm-attachments").createSignedUrl(path, 120);
  if (error || !data) { toast("لا تملك صلاحية فتح المرفق.", true); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

// ===== بطاقة المتعلم =====
async function openStudentCard(id) {
  const md = modal('<p class="sub">جارٍ التحميل…</p>', true);
  try {
    const c = await rpc("qm_student_card", { p_student: id }), L = await rpc("qm_ledger_list", { p_student: id, p_limit: 30 });
    md.el.innerHTML = `<div class="row2"><div><h3 style="margin:0">${esc(c.name)}</h3><p class="sub">${esc(c.grade || "")}${c.section ? " · " + esc(c.section) : ""}${c.no ? " · رقم " + esc(c.no) : ""}</p></div><button class="btn sm sec" data-x>إغلاق</button></div>
    <div class="grid"><div class="kpi k0"><div class="ic">${ico("star")}</div><div><b>${c.balance}</b><span>رصيد النقاط</span></div></div>
      <div class="kpi k1"><div class="ic">${ico("check")}</div><div><b>${c.reinforcements}</b><span>تعزيزاً</span></div></div>
      <div class="kpi k3"><div class="ic">${ico("trophy")}</div><div><b>${c.badges.length}</b><span>وساماً</span></div></div></div>
    <h4 class="sec">الأوسمة</h4><div>${c.badges.length ? c.badges.map((b) => `<span class="bdg-i">${ico(b.icon in ICONS ? b.icon : "trophy")}${esc(b.name)}</span>`).join("") : '<p class="sub">لا أوسمة بعد.</p>'}</div>
    <h4 class="sec">آخر التعزيزات</h4>${c.recent_reinforcements.length ? c.recent_reinforcements.map((r) => `<div class="item"><div class="row2"><b>${esc(r.type)}</b><span>${r.points ? pts(r.points) : ""} <small>${esc(fmtShort(r.created_at))}</small></span></div>${r.description ? `<p class="sub">${esc(r.description)}</p>` : ""}</div>`).join("") : '<p class="sub">لا تعزيزات.</p>'}
    ${c.positive.length ? `<h4 class="sec">مواقف إيجابية</h4>${c.positive.map((p) => `<div class="item"><b>${esc(p.category)}</b> <small>${esc(fmtShort(p.created_at))}</small><p class="sub">${esc(p.description)}</p></div>`).join("")}` : ""}
    <h4 class="sec">حركة النقاط</h4>${L.rows.length ? `<table class="tbl"><tbody>${L.rows.map((r) => `<tr><td>${pts(r.points)}</td><td>${esc(r.reason || "")}${r.kind === "reversal" ? " (إلغاء)" : r.kind === "correction" ? " (تصحيح)" : ""}</td><td><small>${esc(r.by)} · ${esc(fmtShort(r.created_at))}</small></td></tr>`).join("")}</tbody></table>` : '<p class="sub">لا حركات.</p>'}
    ${c.sensitive ? `<h4 class="sec">الوقائع السلوكية</h4>${c.incidents.length ? c.incidents.map((i) => `<div class="item"><b>واقعة ${i.no}</b> · ${esc(i.category)} ${tbadge(i.status_name, i.tone)} <small>${esc(fmtDay(i.occurred_on))}</small></div>`).join("") : '<p class="sub">لا وقائع.</p>'}` : ""}
    ${(window.__qm?.isAdmin || window.__qm?.isAgent || window.__qm?.isCounselor) ? `<div class="acts mt"><a class="btn sm sec" href="student.html?id=${id}">${ico("user")}الملف الشخصي</a><button class="btn sm" data-badge>${ico("trophy")}منح وسام</button>${window.__qm.isAdmin ? `<button class="btn sm sec" data-adj>تصحيح الرصيد</button>` : ""}</div>` : ""}
    <p class="sub">بطاقة داخلية لمنسوبي المدرسة المخولين، وليست ملفاً إدارياً شاملاً.</p>`;
    $("[data-x]", md.el).onclick = md.close;
    const bb = $("[data-badge]", md.el); if (bb) bb.onclick = () => awardBadge(id, () => { md.close(); openStudentCard(id); });
    const ab = $("[data-adj]", md.el); if (ab) ab.onclick = () => adjustPoints(id, () => { md.close(); openStudentCard(id); });
  } catch (e) { md.el.innerHTML = `<p class="err">${esc(mapErr(e))}</p><button class="btn sec" data-x>إغلاق</button>`; $("[data-x]", md.el).onclick = md.close; }
}

// ===== تفاصيل واقعة وإجراءاتها (مشتركة بين المعلم والوكيل والموجه) =====
const EV = { reported: "رصد الواقعة", status_change: "تحديث الحالة", review_note: "ملاحظة مراجعة", info_requested: "طلب استكمال", info_provided: "استكمال المعلومات", action: "إجراء موثق", referred: "إحالة للموجه الطلابي", counselor_note: "ملاحظة إرشادية (سرية)", closed: "إغلاق", dismissed: "حفظ دون إجراء" };
function incidentActions(d) {
  const a = [], st = d.status;
  if (d.can.agent) {
    if (st === "observed") a.push(["start_review", "بدء المراجعة", false, "check"]);
    if (["observed", "with_agent", "agent_processing"].includes(st)) a.push(["request_info", "طلب استكمال من المعلم", true, "help"]);
    if (["with_agent", "agent_processing", "needs_info"].includes(st)) a.push(["review_note", "ملاحظة مراجعة", true, "list"]);
    if (["with_agent", "agent_processing"].includes(st)) { a.push(["document_action", "توثيق إجراء", true, "check"], ["refer_counselor", "إحالة للموجه الطلابي", true, "users"], ["close", "إغلاق الواقعة", true, "check"]); }
    if (["observed", "with_agent", "agent_processing"].includes(st)) a.push(["dismiss", "حفظ دون إجراء", true, "x"]);
  }
  if (d.can.counselor) {
    if (st === "referred_counselor") a.push(["start_counseling", "بدء المتابعة الإرشادية", false, "check"]);
    if (["referred_counselor", "counseling_follow"].includes(st)) { a.push(["counselor_note", "ملاحظة إرشادية سرية", true, "list"], ["close", "إغلاق بعد المتابعة", true, "check"]); }
  }
  if (d.mine && st === "needs_info") a.push(["provide_info", "استكمال المعلومات المطلوبة", true, "check"]);
  const seen = new Set(); return a.filter((x) => (seen.has(x[0] + x[1]) ? false : seen.add(x[0] + x[1])));
}
async function openIncident(id, onDone) {
  const md = modal('<p class="sub">جارٍ التحميل…</p>', true);
  const paint = async () => {
    try {
      const d = await rpc("qm_incident_get", { p_id: id }), acts = incidentActions(d);
      md.el.innerHTML = `<div class="row2"><div><h3 style="margin:0">واقعة رقم ${d.no} ${tbadge(d.status_name, d.tone)}</h3><p class="sub">رُصدت ${esc(fmtT(d.created_at))} · آخر تحديث ${esc(ago(d.updated_at))}</p></div><button class="btn sm sec" data-x>إغلاق</button></div>
      <div class="item"><div class="row2"><div><b>${esc(d.student)}</b><br><small>${esc(d.grade || "")}${d.section ? " · " + esc(d.section) : ""}</small></div><button class="btn sm sec" data-card="${d.student_id}">بطاقة المتعلم</button></div>
        <p class="sub" style="margin:10px 0 2px">${esc(d.category)} · ${esc(fmtDay(d.occurred_on))}${d.occurred_time ? " · " + esc(String(d.occurred_time).slice(0, 5)) : ""}${d.location ? " · " + esc(d.location) : ""}</p>
        <p style="white-space:pre-wrap">${esc(d.description)}</p>
        ${d.teacher_notes ? `<p class="bk-n"><small>ملاحظات المعلم:</small> ${esc(d.teacher_notes)}</p>` : ""}${d.parties ? `<p class="bk-n"><small>الأطراف ذات العلاقة:</small> ${esc(d.parties)}</p>` : ""}
        <p class="sub">سجّلها: ${esc(d.reporter)}</p>
        ${d.attachments.length ? `<div class="acts">${d.attachments.map((p, i) => `<button class="btn sm sec" data-att="${esc(p)}">مرفق ${i + 1}</button>`).join("")}</div>` : ""}
        <p class="sub" style="margin-top:8px">هذه الواقعة مرصودة وليست مخالفة معتمدة، ولا تُخصم بها نقاط.</p></div>
      <h4 class="sec">السجل الزمني</h4><ul class="tl">${d.events.map((e) => `<li class="${e.visibility === "counselor" ? "priv" : ""}"><div class="w"><b>${esc(EV[e.kind] || e.kind)}${e.visibility === "counselor" ? " (سري)" : e.visibility === "internal" ? " (داخلي)" : ""}</b><span>${esc(e.by)} · ${esc(fmtT(e.created_at))}</span></div>${e.note ? `<p>${esc(e.note)}</p>` : ""}</li>`).join("")}</ul>
      ${acts.length ? `<h4 class="sec">الإجراءات المتاحة</h4><div class="acts">${acts.map(([k, l, , ic]) => `<button class="btn sm ${k === "dismiss" ? "sec" : ""}" data-act="${k}">${ico(ic)}${esc(l)}</button>`).join("")}</div>` : ""}`;
      $("[data-x]", md.el).onclick = () => { md.close(); onDone && onDone(); };
      $("[data-card]", md.el).onclick = (e) => openStudentCard(e.currentTarget.dataset.card);
      $$("[data-att]", md.el).forEach((b) => (b.onclick = () => openAttachment(b.dataset.att)));
      $$("[data-act]", md.el).forEach((b) => (b.onclick = async () => {
        const [k, l, needNote] = acts.find((x) => x[0] === b.dataset.act); let note = "";
        if (needNote) { note = await askNote(l, "الملاحظة أو السبب", true); if (note === null) return; }
        b.disabled = true;
        try { await rpc("qm_incident_act", { p_id: id, p_action: k, p_note: note || null }); toast("تم تنفيذ الإجراء"); await paint(); onDone && onDone(true); }
        catch (e) { toast(mapErr(e), true); b.disabled = false; }
      }));
    } catch (e) { md.el.innerHTML = `<p class="err">${esc(mapErr(e))}</p><button class="btn sec" data-x>إغلاق</button>`; $("[data-x]", md.el).onclick = md.close; }
  };
  await paint();
}
function askNote(title, label, required) {
  return new Promise((res) => {
    const md = modal(`<h3>${esc(title)}</h3><label>${esc(label)}</label><textarea id="nt" maxlength="1000"></textarea><p class="err" id="ne"></p><div class="acts mt"><button class="btn" id="ok">تأكيد</button><button class="btn sec" id="no">رجوع</button></div>`);
    $("#no", md.el).onclick = () => { md.close(); res(null); };
    $("#ok", md.el).onclick = () => { const v = $("#nt", md.el).value.trim(); if (required && !v) { $("#ne", md.el).textContent = "هذا الحقل مطلوب."; return; } md.close(); res(v); };
    $("#nt", md.el).focus();
  });
}
function incidentCard(i) {
  return `<div class="item inc t-${i.tone}" data-inc="${i.id}" tabindex="0" role="button"><div class="row2"><div><b>واقعة ${i.no} · ${esc(i.student)}</b> ${tbadge(i.status_name, i.tone)}${i.needs_my_action ? ' <span class="badge warn">مطلوب منك إجراء</span>' : ""}<br><small>${esc(i.grade || "")}${i.section ? " · " + esc(i.section) : ""} · ${esc(i.category)} · ${esc(fmtDay(i.occurred_on))}</small></div><small>${esc(ago(i.updated_at))}</small></div>${i.mine ? "" : `<small>سجّلها: ${esc(i.reporter)}</small>`}</div>`;
}
function bindIncidents(root, reload) {
  const go = (el) => openIncident(el.dataset.inc, (changed) => changed !== false && reload && reload());
  root.addEventListener("click", (e) => { const el = e.target.closest("[data-inc]"); if (el) go(el); });
  root.addEventListener("keydown", (e) => { if (e.key === "Enter") { const el = e.target.closest("[data-inc]"); if (el) go(el); } });
}

// ===== الهيكل: ترويسة لوحة التحكم بنمط أنظمة النواة، والقائمة بحسب الدور =====
// r: all | agent | counselor | admin
const NAV = [
  ["dashboard.html", "الرئيسية", "home", "ما يخصك الآن ومؤشرات الرعاية", "all"],
  ["reinforce.html", "منح النقاط والأوسمة", "plus", "اختر الصف والفصل ثم امنح فردياً أو جماعياً", "all"],
  ["behavior.html", "تسجيل سلوك", "list", "موقف إيجابي أو واقعة تُحال إلى وكيل شؤون الطلاب", "all"],
  ["incidents.html", "وقائعي", "inbox", "الوقائع التي رفعتَها وحالتها", "all"],
  ["reinforcements.html", "سجل التعزيز", "calendar", "سجل التعزيزات ودفتر النقاط", "all"],
  ["balances.html", "الأرصدة والتميز", "trophy", "أرصدة المتعلمين ولوحة التميز", "all"],
  ["students.html", "دليل المتعلمين", "users", "بحث سريع وبطاقة المتعلم", "all"],
  ["achievements.html", "الإنجاز والمواهب", "trophy", "إنجازات المتعلمين ومواهبهم ومعرض التميز", "all"],
  ["support.html", "المتابعة والدعم", "help", "حالات الدعم التربوي وخطط المتابعة", "support"],
  ["agent.html", "صندوق الوكيل", "inbox", "الوقائع المحالة من المعلمين", "agent"],
  ["counselor.html", "الحالات الإجرائية", "help", "الحالات المحالة إلى الموجه الطلابي", "counselor"],
  ["reports.html", "التقارير", "list", "تقارير مجمّعة للفترة بلا أسماء، مع تصدير", "report"],
  ["points.html", "إدارة النقاط", "star", "إضافة النقاط وتعديلها وحذفها", "admin"],
  ["admin.html", "الإدارة", "gear", "الأدوار والإعدادات وسجل العمليات", "admin"],
];
async function boot(page, render, o = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search)); return; }
  const shell = document.getElementById("shell");
  const fail = (msg) => {
    shell.innerHTML = `<main class="wrap"><div class="card" style="max-width:520px;margin:48px auto"><h3 style="margin-top:0">تعذر فتح لوحة التحكم</h3><p class="err">${esc(msg)}</p><div class="acts mt"><button class="btn" id="rt">إعادة المحاولة</button><button class="btn sec" id="lo">تسجيل الخروج</button></div></div></main>`;
    $("#rt").onclick = () => location.reload(); $("#lo").onclick = () => doLogout();
  };
  let who;
  try { who = await rpc("qm_whoami"); } catch (e) { console.error(e); fail(/does not exist|schema cache|Could not find/i.test(String(e.message)) ? "لم يُنفَّذ سكربت قاعدة بيانات قيمي بعد (supabase/migrations/0201)." : "تعذر الاتصال بالخادم أو التحقق من حسابك."); return; }
  if (!who) { await doLogout("login.html?e=nostaff"); return; }
  const ctx = { who, uid: session.user.id, isAdmin: who.is_admin, isAgent: who.is_agent, isCounselor: who.is_counselor,
    role: who.is_agent ? "وكيل شؤون الطلاب" : who.is_counselor ? "الموجه الطلابي" : who.is_admin ? "مدير النواة الرقمية" : "المعلم" };
  window.__qm = ctx;
  const ok = (r) => r === "all" || (r === "support" && (ctx.isAgent || ctx.isCounselor)) || (r === "report" && (ctx.isAdmin || ctx.isAgent || ctx.isCounselor)) || (r === "agent" && ctx.isAgent) || (r === "counselor" && ctx.isCounselor) || (r === "admin" && ctx.isAdmin);
  if (o.role && !ok(o.role)) { location.replace("dashboard.html"); return; }
  const items = NAV.filter((n) => ok(n[4]));
  const cur = NAV.find((n) => n[0] === page) || [page, o.title || "لوحة التحكم", "grid", o.desc || ""];
  shell.innerHTML =
    `<header class="dash"><div class="wrap top">${brandHTML("dashboard.html")}<div class="idl"><a class="sitelink" href="index.html">الموقع الإلكتروني</a><span class="vdiv"></span>${coreBlock()}${headMoe}</div></div>
     <div class="strip" aria-hidden="true"></div>
     <div class="dnav"><div class="wrap dn"><div class="dnav-in">${items.map(([h, n, e, t]) => `<a href="${h}" title="${esc(t)}" class="${h === page ? "on" : ""}" ${h === page ? 'aria-current="page"' : ""}>${ico(e)}${n}</a>`).join("")}</div>
     <div class="dwho"><div class="ntf"><button type="button" class="ntf-b" id="ntfB" aria-label="الإشعارات" aria-expanded="false" aria-haspopup="true">${ico("bell")}<span class="ntf-n" id="ntfN" hidden></span></button><div class="ntf-p" id="ntfP" hidden><div class="ntf-h"><b>الإشعارات</b><button type="button" id="ntfR">تحديد الكل كمقروء</button></div><div id="ntfL"><p class="sub" style="margin:14px">جارٍ التحميل…</p></div></div></div><span class="dname">${esc(who.name)}</span><a class="loginbtn" href="#" id="out">خروج</a></div></div></div></header>
     <div class="pagebar"><div class="wrap pb"><div class="pb-t"><small>${esc(ctx.role)}</small><h1>${esc(cur[1])}</h1></div><p class="pb-d">${esc(cur[3])}</p>
     <div class="pb-u"><span id="pbTime"></span><button class="btn sec sm" id="pbRefresh" type="button">${ico("refresh")}تحديث</button></div></div></div>
     <main class="wrap" id="main"></main>${footerHTML}`;
  bindNav();
  $("#pbTime").textContent = "حُدِّثت " + new Date().toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  $("#pbRefresh").onclick = () => location.reload();
  $("#out").onclick = (e) => { e.preventDefault(); doLogout(); };
  // الإشعارات من جدول qm_notifications (توجَّه للمعنيين فقط)، والمقروء يُحفظ في القاعدة
  (async () => {
    let N = []; try { N = await rpc("qm_notifications_list", { p_limit: 20 }); } catch (e) {}
    const paint = () => { const n = N.filter((x) => !x.is_read).length, e = $("#ntfN"); e.hidden = !n; e.textContent = n > 9 ? "9+" : n;
      $("#ntfL").innerHTML = N.length ? N.map((x) => `<a class="ntf-i${x.is_read ? "" : " new"}" href="${esc(x.link || "#")}"><span class="ntf-ic">${ico("bell")}</span><span><b>${esc(x.title)}</b>${x.body ? `<small>${esc(x.body)}</small>` : ""}<time>${esc(fmtT(x.created_at))}</time></span></a>`).join("") : '<p class="sub" style="margin:16px;text-align:center">لا إشعارات حالياً.</p>'; };
    const P = $("#ntfP"), B = $("#ntfB"), close = () => { P.hidden = true; B.setAttribute("aria-expanded", "false"); };
    B.onclick = (e) => { e.stopPropagation(); P.hidden = !P.hidden; B.setAttribute("aria-expanded", String(!P.hidden)); };
    $("#ntfR").onclick = async () => { try { await rpc("qm_notifications_read"); N = N.map((x) => ({ ...x, is_read: true })); paint(); } catch (e) {} };
    P.onclick = (e) => e.stopPropagation(); document.addEventListener("click", close); document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    paint();
  })();
  const main = $("#main");
  try { await render(main, ctx); } catch (e) { console.error(e); main.innerHTML = `<p class="err">تعذر تحميل الصفحة: ${esc(mapErr(e))}</p>`; }
  // فتح واقعة مباشرة من رابط إشعار (?i=)
  const q = new URLSearchParams(location.search).get("i"); if (q && !/^(achievements|support)\.html$/.test(page)) openIncident(q);
}

async function awardBadge(studentId, done) {
  const { data: B } = await sb.from("qm_badges").select("id,name_ar,points").eq("is_active", true).order("sort_order");
  const md = modal(`<h3>منح وسام</h3><label>الوسام</label><select id="bd">${(B || []).map((b) => `<option value="${b.id}">${esc(b.name_ar)}${b.points ? " (+" + b.points + ")" : ""}</option>`).join("")}</select><label>سبب المنح (اختياري)</label><textarea id="bn" maxlength="300"></textarea><p class="err" id="be"></p><div class="acts mt"><button class="btn" id="ok">منح</button><button class="btn sec" id="no">رجوع</button></div>`);
  $("#no", md.el).onclick = md.close;
  $("#ok", md.el).onclick = async () => { try { await rpc("qm_award_badge", { p_student: studentId, p_badge: $("#bd", md.el).value, p_note: $("#bn", md.el).value }); md.close(); toast("تم منح الوسام"); done && done(); } catch (e) { $("#be", md.el).textContent = mapErr(e); } };
}
async function adjustPoints(studentId, done) {
  const md = modal(`<h3>تصحيح رصيد النقاط</h3><p class="sub">يُسجَّل كحركة تصحيح موثقة في الدفتر، ولا يُعدَّل أي سجل سابق. استخدم رقماً سالباً للخصم.</p><label>عدد النقاط (موجب أو سالب)</label><input id="pp" type="number" step="1"><label>سبب التصحيح (مطلوب)</label><textarea id="pr" maxlength="300"></textarea><p class="err" id="pe"></p><div class="acts mt"><button class="btn" id="ok">تسجيل التصحيح</button><button class="btn sec" id="no">رجوع</button></div>`);
  $("#no", md.el).onclick = md.close;
  $("#ok", md.el).onclick = async () => { try { await rpc("qm_adjust_points", { p_student: studentId, p_points: +$("#pp", md.el).value, p_reason: $("#pr", md.el).value }); md.close(); toast("سُجّل التصحيح"); done && done(); } catch (e) { $("#pe", md.el).textContent = mapErr(e); } };
}
