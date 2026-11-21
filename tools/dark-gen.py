#!/usr/bin/env python3
"""مولّد طبقة النمط الداكن من الألوان الثابتة في ملف CSS.

الاستخدام:
  python3 tools/dark-gen.py site/assets/lbeed.css            # يحدّث الكتلة المولّدة في آخر الملف
  python3 tools/dark-gen.py site/assets/core.css --kit site/assets/unified-kit.js

الفكرة: الصفحات كُتبت بألوان فاتحة ثابتة (#fff وتدرجات فاتحة ونصوص داكنة)، فلا تتأثر برموز
النمط الداكن في core.css. يقرأ المولّد كل قاعدة ويحوّل ألوانها:
  - الخلفية البيضاء ← var(--surface)، والرمادية الفاتحة ← var(--soft) أو var(--line)
  - الخلفية الفاتحة الملوّنة ← الصبغة نفسها بدرجة داكنة
  - النص الداكن ← var(--ink) أو var(--muted)، والنص الملوّن الداكن ← الصبغة نفسها بدرجة فاتحة
  - الحدود الفاتحة ← var(--line)، وحلقات الظل البيضاء ← var(--surface)
ويتجاوز السياقات الداكنة أصلاً (الغلاف، البطاقات الداكنة dkc...) والنص فوق خلفية ملوّنة لم تتحول.
الكتلة الناتجة داخل @media (prefers-color-scheme:dark) وبمحدِّد :where() بلا وزن، فتبقى أولوية
القواعد كما هي في الأصل؛ ولهذا تُعاد كتابة إعلانات الألوان التي لم تتغير متى نافست قاعدة متحوّلة
بالوزن نفسه. أعد تشغيل المولّد بعد أي تعديل على الألوان في الملف.
"""
import colorsys, re, sys

BEGIN = "/* ===== النمط الداكن (مولَّد بـ tools/dark-gen.py — لا تعدّل يدوياً، أعد التوليد) ===== */"
END = "/* ===== نهاية النمط الداكن المولَّد ===== */"
SKIP_SEL = re.compile(r"\.dkc|\.lb-hero|\.lb-stars|\.st5|\.dov|\.lb-face|\.lb-cm\b|\.lb-dis\b|\.sel\b|\.pk-wc|\.pk-mb|::backdrop|\.hero\b|\.ab-hero|\.dnav|\.dash \.dnav|footer|\.ftr|\.ub-|#ub|\.sg-|canvas|\.rk-|\.paper")
COLOR_PROPS = ("background", "background-color", "background-image", "color", "border", "border-top", "border-bottom",
               "border-left", "border-right", "border-color", "border-block", "border-inline", "border-block-start",
               "border-block-end", "border-inline-start", "border-inline-end", "border-top-color", "border-bottom-color",
               "outline", "outline-color", "box-shadow", "fill", "stroke", "caret-color", "text-decoration-color")
TOK = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|var\(--(?:navy[23]?|moenavy|deep)(?:,[^()]*)?\)")
TEXT_VARS = ("--ink", "--ink2", "--muted", "--navy-ink")
BG_VARS = ("--mist", "--surface", "--soft", "--bg", "--line", "--card", "--paper")


def strip_comments(s):
    return re.sub(r"/\*.*?\*/", "", s, flags=re.S)


def parse(css):
    """يعيد قائمة (media, selector, body) بترتيب الملف، ويتجاوز keyframes وfont-face والطباعة والداكن."""
    css = strip_comments(css)
    out, i, n = [], 0, len(css)

    def block(start):
        d, j = 0, start
        while j < n:
            if css[j] == "{": d += 1
            elif css[j] == "}":
                d -= 1
                if d == 0: return j
            elif css[j] in "\"'":
                q = css[j]; j += 1
                while j < n and css[j] != q: j += 1
            j += 1
        return n

    def walk(a, b, media):
        nonlocal out
        j = a
        while j < b:
            k = css.find("{", j)
            if k < 0 or k >= b: break
            head = css[j:k].strip()
            e = block(k)
            if head.startswith("@"):
                low = head.lower()
                if low.startswith("@media") and "prefers-color-scheme" not in low and "print" not in low:
                    walk(k + 1, e, (media + " and " if media else "") + head[6:].strip())
                elif low.startswith("@supports"):
                    walk(k + 1, e, media)
            elif head:
                out.append((media, head, css[k + 1:e]))
            j = e + 1
    walk(0, n, "")
    return out


def decls(body):
    res, cur, d = [], "", 0
    for ch in body:
        if ch == "(": d += 1
        if ch == ")": d -= 1
        if ch == ";" and d == 0:
            res.append(cur); cur = ""
        else: cur += ch
    res.append(cur)
    out = []
    for x in res:
        if ":" not in x: continue
        p, v = x.split(":", 1)
        out.append((p.strip().lower(), v.strip()))
    return out


def split_sel(s):
    out, cur, d = [], "", 0
    for ch in s:
        if ch in "([": d += 1
        if ch in ")]": d -= 1
        if ch == "," and d == 0: out.append(cur.strip()); cur = ""
        else: cur += ch
    if cur.strip(): out.append(cur.strip())
    return out


def spec(sel):
    s = re.sub(r":(where)\((?:[^()]|\([^()]*\))*\)", "", sel)
    s = re.sub(r":(not|is|has)\(((?:[^()]|\([^()]*\))*)\)", r" \2", s)
    a = len(re.findall(r"#[\w-]+", s))
    b = len(re.findall(r"\.[\w-]+|\[[^\]]*\]|(?<!:):(?!:)[\w-]+", s))
    c = len(re.findall(r"(?:^|[\s>+~(])([a-zA-Z][\w-]*)", s)) + len(re.findall(r"::[\w-]+", s))
    return (a, b, c)


def rgb_of(t):
    t = t.lower()
    if t == "white": return (255, 255, 255, 1.0)
    if t.startswith("#"):
        h = t[1:]
        if len(h) in (3, 4): h = "".join(c * 2 for c in h)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
    if t.startswith("rgb"):
        p = [x for x in re.split(r"[\s,/()]+", t[t.index("(") + 1:]) if x]
        try:
            r, g, b = (float(p[0]), float(p[1]), float(p[2]))
            a = float(p[3].rstrip("%")) / (100 if p[3].endswith("%") else 1) if len(p) > 3 else 1.0
            return (r, g, b, a)
        except (ValueError, IndexError):
            return None
    return None


def hls(c):
    return colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)


def hexof(h, l, s):
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def with_alpha(v, a):
    return v if a >= 0.85 else f"color-mix(in srgb,{v} {round(a * 100)}%,transparent)"


def tx_bg(t):
    if t.startswith("var("): return None
    c = rgb_of(t)
    if not c or c[3] < 0.35: return None
    h, l, s = hls(c)
    if l < 0.86: return None
    if s < 0.3 or l > 0.985:
        v = "var(--surface)" if l > 0.985 else "var(--soft)" if l >= 0.95 else "var(--line)"
    else:
        v = hexof(h, 0.19, min(s, 0.45))
    return with_alpha(v, c[3])


def tx_text(t):
    if t.startswith("var("): return "var(--ink)"
    c = rgb_of(t)
    if not c or c[3] < 0.5: return None
    h, l, s = hls(c)
    if s < 0.3 and l < 0.62: return "var(--ink)" if l < 0.25 else "var(--muted)"
    if l >= 0.5: return None
    if l < 0.2: return "var(--ink)"
    return hexof(h, 0.72, min(s, 0.7))


def tx_border(t):
    if t.startswith("var("): return None
    c = rgb_of(t)
    if not c or c[3] < 0.35: return None
    h, l, s = hls(c)
    if l < 0.75: return None
    if s < 0.3 or l > 0.985: return "var(--line)"
    return hexof(h, 0.3, min(s, 0.4))


def tx_shadow(t):
    if t.startswith("var("): return None
    c = rgb_of(t)
    if not c: return None
    h, l, s = hls(c)
    return "var(--surface)" if l > 0.95 and c[3] > 0.85 else None


def kind(p):
    if p in TEXT_VARS: return "text"
    if p in BG_VARS: return "bg"
    if p.startswith("background"): return "bg"
    if p in ("color", "caret-color", "text-decoration-color"): return "text"
    if p.startswith("border") or p.startswith("outline"): return "border"
    if p == "box-shadow": return "shadow"
    if p in ("fill", "stroke"): return "svg"
    return None


def transform(p, v, text_ok):
    k = kind(p)
    if not k: return v
    imp = ""
    if v.endswith("!important"): v, imp = v[:-10].strip(), "!important"
    if k == "text" and not text_ok and not p.startswith("--"): return v + imp
    if k == "bg" and "url(" in v: return v + imp
    f = {"bg": tx_bg, "text": tx_text, "border": tx_border, "shadow": tx_shadow,
         "svg": lambda t: tx_bg(t) if (rgb_of(t) and hls(rgb_of(t))[1] >= 0.86) else None}[k]

    def rep(m):
        t = m.group(0)
        if t.startswith("var(") and k != "text": return t
        r = f(t)
        return r if r else t
    out = TOK.sub(rep, v) + imp
    if p.startswith("--"):  # متغيّر محلي يعيد تعريف رمز عام: قيمة صريحة لتجنب الإحالة الدائرية
        out = out.replace("var(--ink)", "#e3f0f5").replace("var(--muted)", "#8aa1b0").replace("var(--surface)", "#11242f").replace("var(--soft)", "#0f2230").replace("var(--line)", "#1f3a48")
    return out


def generate(css, prefix=":where(:root:not([data-theme=light])) ", media_wrap=True):
    rules = parse(css)
    emitted = []  # (media, selector, [(p,v)], changed)
    hot = {}      # (media-agnostic) prop-kind -> set of specificities that were transformed
    for media, head, body in rules:
        ds = [(p, v) for p, v in decls(body) if p in COLOR_PROPS or p in TEXT_VARS or p in BG_VARS]
        if not ds: continue
        for sel in split_sel(head):
            skip = bool(SKIP_SEL.search(sel)) or "clip:text" in body.replace(" ", "")  # نص متدرّج يبقى كما صُمم
            bgs = [v for p, v in ds if kind(p) == "bg"]
            bg_changed = any(transform(p, v, True) != v for p, v in ds if kind(p) == "bg")
            # خلفية ملوّنة ثابتة (لا تتحول) تعني أن النص فوقها مصمم لها فلا يُمس؛ رموز السطح الداكنة لا تمنع
            has_color_bg = any(re.search(r"#|rgb|\bwhite\b|var\(--(gold|grad|hv|brand2?[,)]|c\df|ok|bad|warn|info|moe|acc2[,)]|navy)", v) for v in bgs)
            text_ok = (not has_color_bg) or bg_changed
            out, changed = [], False
            sp = spec(sel)
            for p, v in ds:
                nv = v if skip else transform(p, v, text_ok)
                if nv != v:
                    changed = True; out.append((p, nv)); hot.setdefault(kind(p), set()).add(sp)
                elif sp in hot.get(kind(p), ()):
                    out.append((p, v))
            # الخاصية المختصرة background تعيد ضبط clip/size/position، فتُعاد معها كما في القاعدة الأصلية
            if any(p == "background" for p, _ in out):
                names = [p for p, _ in out]
                longs = [(p, v) for p, v in decls(body) if p.startswith(("background-", "-webkit-background-")) and p not in names and p != "background-color" or p in ("-webkit-text-fill-color",)]
                out += longs
            if out:
                emitted.append((media, sel, out, changed))
    # أسقط القواعد التي لم يتغير فيها شيء ولا تنافس قاعدة متحوّلة
    lines, last_media = [], None
    for media, sel, out, changed in emitted:
        if not changed and not out: continue
        body = ";".join(f"{p}:{v}" for p, v in out)
        rule = f"{prefix}{sel}{{{body}}}"
        if media: rule = f"@media {media}{{{rule}}}"
        lines.append(rule)
    inner = "\n".join(lines)
    return f"@media (prefers-color-scheme:dark){{\n{inner}\n}}" if media_wrap else inner


def kit_css(js):
    """يستخرج نص CSS المضمّن في unified-kit.js (const CSS = `...`)."""
    m = re.search(r"const CSS\s*=\s*`(.*?)`", js, flags=re.S)
    return m.group(1) if m else ""


def main():
    path = sys.argv[1]
    src = open(path, encoding="utf-8").read()
    base = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END) + r"\n?", "", src, flags=re.S).rstrip() + "\n"
    gen = generate(base)
    extra = ""
    if "--kit" in sys.argv:
        kit = kit_css(open(sys.argv[sys.argv.index("--kit") + 1], encoding="utf-8").read())
        # أنماط الحزمة تُحقن بعد core.css، فيلزم وزن إضافي يتفوق عليها بالترتيب نفسه
        extra = "\n/* أنماط unified-kit.js (الإعلانات وإدارتها) */\n" + generate(kit, prefix=":root:not([data-theme=light]) ")
    hand = ""  # الإضافات اليدوية تُكتب في الملف نفسه داخل @media (prefers-color-scheme:dark) فيتجاوزها المولّد
    open(path, "w", encoding="utf-8").write(base + BEGIN + "\n" + gen + extra + hand + "\n" + END + "\n")
    print(path, "rules:", gen.count("{") - 1, "bytes:", len(gen) + len(extra) + len(hand))


if __name__ == "__main__":
    main()
