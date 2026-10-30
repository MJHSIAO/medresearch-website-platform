"""Session-protected, escaped HTML; no tokens or complete claim dumps."""
from html import escape


def portal_html(record, role, settings, admin=False, denied=False):
    def e(value):
        return escape(str(value), quote=True)

    base = e(settings.app_base_url)
    title = '無管理權限' if denied else '系統管理' if admin else '院內專區'
    label = {'system_admin': '系統管理員', 'site_admin': '醫研部總管理員', 'unit_admin': '單位管理員'}.get(role, '一般院內人員')
    link = f'<a class="button" href="{base}/admin">進入管理中心</a>' if role in {'system_admin', 'site_admin', 'unit_admin'} and not admin else ''
    message = ('您的登入已完成，但沒有此管理功能的權限。如需使用，請聯絡管理員。'
               if denied else '您已完成院內登入，可在此查看院內消息與可用功能。')
    return f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{title}｜醫學研究部</title><link rel="stylesheet" href="{base}/assets/css/base.css"><link rel="stylesheet" href="{base}/assets/css/components.css">
    <style>body{{margin:0;background:#f1f5f2;color:#203f34;font-family:system-ui,sans-serif;line-height:1.7}}main{{max-width:900px;margin:auto;padding:24px 16px}}header{{background:#174d3e;color:white;padding:20px}}nav{{display:flex;flex-wrap:wrap;gap:18px}}nav a{{color:inherit}}.card{{padding:22px;background:white;border:1px solid #d8e3dc;border-radius:12px;margin:18px 0}}table{{width:100%;border-collapse:collapse;table-layout:fixed}}th,td{{text-align:left;padding:10px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}}th{{width:42%}}p,dd{{overflow-wrap:anywhere}}a:focus-visible{{outline:3px solid #b87520;outline-offset:4px}}code{{overflow-wrap:anywhere}}h1{{font-size:28px}}</style></head><body>
    <header><nav aria-label="網站導覽"><a href="{base}/">醫學研究部首頁</a><a href="{base}/internal">院內專區</a><a href="{base}/auth/logout">登出</a></nav></header>
    <main><h1>{title}</h1><section class="card"><h2>{e(record['user'].get('name') or '院內人員')}</h2><p>目前角色：<strong>{label}</strong></p><p>{message}</p>{link}</section>
    <section class="card"><h2>院內消息</h2><div id="internal-news"></div></section>
    <script src="{base}/assets/js/internal.js"></script></main></body></html>'''
