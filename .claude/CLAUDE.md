# 차곡차곡 (car.importants-studio.com)

Korean blog on car ownership costs and driving guides. Hugo + PaperMod, deployed via GitHub Pages (merge to `main` = publish). Sister site of 혜택줍줍 (blog.importants-studio.com).

## Invariant rules (apply to every session in this repo)

- **NEVER push directly to `main`.** Always branch + PR. Merging is a human decision.
- **NEVER leave Claude traces in commits** — no Co-Authored-By, no AI mentions.
- Posts live in `content/posts/YYYY-MM-DD-{english-slug}.md`. Required frontmatter: title, date (today at T09:00:00+09:00 — future time gets excluded from the build), draft: false, slug, description, tags, categories (검사·세금/절약/가이드/운전/차상식), sourceUrl.
- Writing style rules: `docs/writing-guide.md` — read before writing or editing any post.
- Fact policy: deadlines, amounts, and procedures need 2+ sources; official first (국토교통부, 한국교통안전공단, 경찰청 교통민원24, 위택스, 보험개발원). Unverified numbers must not appear — link to the official notice instead.
- Images: fetched from Pexels via `~/blog-automation/scripts/fetch_image.py` into `static/images/`. Missing image must never block publishing.
- Never modify `themes/PaperMod` (submodule).
- Verify `hugo --gc --minify` passes before committing content changes.
