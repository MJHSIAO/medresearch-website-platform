"""Session-protected, escaped HTML; no tokens or complete claim dumps."""
from html import escape


def portal_html(record, role, settings, admin=False, denied=False):
    def e(value):
        return escape(str(value), quote=True)

    base = e(settings.app_base_url)
    claims = record['claims']
    title = '無管理權限' if denied else '系統管理' if admin else '院內專區'
    label = '系統管理員' if role == 'system_admin' else '一般院內人員'
    # Candidates are diagnostic only. They never determine which claim is trusted.
    candidates = ('sub', 'employee_id', 'employeeid', 'employee_no', 'staff_id', 'preferred_username')
    rows = ''.join(f'<tr><th scope="row">{e(key)}</th><td>{e(claims[key])}</td></tr>'
                   for key in candidates if isinstance(claims.get(key), str))
    configured = settings.admin_identity_claim
    identity = claims.get(configured) if configured else None
    match_status = '尚未設定識別欄位' if not configured else '已取得識別值' if isinstance(identity, str) and identity else '回傳資料未含有效識別值'
    link = f'<a class="button" href="{base}/admin">進入系統管理</a>' if role == 'system_admin' and not admin else ''
    message = ('您的登入已完成，但尚未取得管理授權。請先確認下方身分，再由伺服器管理者設定授權。'
               if denied else '已透過院方登入驗證。以下僅顯示您自己的身分確認資訊。')
    management = '''<section class="card"><h2>系統管理員的管理範圍</h2><p>您具備全平台管理角色，不需要兼任醫研部總管理員。</p>
    <ul><li>全部單位內容、消息發布與醫研部首頁</li><li>人員角色及單位授權</li><li>共用版型與系統設定</li></ul>
    <p>本版已啟用登入與管理頁存取控制。內容寫入、人員授權表單、檔案上傳及系統設定操作尚未開放；現階段授權由伺服器環境設定維護。</p></section>''' if admin and not denied else ''
    return f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{title}｜醫學研究部</title><link rel="stylesheet" href="{base}/assets/css/base.css"><link rel="stylesheet" href="{base}/assets/css/components.css">
    <style>body{{margin:0;background:#f1f5f2;color:#203f34;font-family:system-ui,sans-serif;line-height:1.7}}main{{max-width:900px;margin:auto;padding:24px 16px}}header{{background:#174d3e;color:white;padding:20px}}nav{{display:flex;flex-wrap:wrap;gap:18px}}nav a{{color:inherit}}.card{{padding:22px;background:white;border:1px solid #d8e3dc;border-radius:12px;margin:18px 0}}table{{width:100%;border-collapse:collapse;table-layout:fixed}}th,td{{text-align:left;padding:10px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}}th{{width:42%}}p,dd{{overflow-wrap:anywhere}}a:focus-visible{{outline:3px solid #b87520;outline-offset:4px}}code{{overflow-wrap:anywhere}}h1{{font-size:28px}}</style></head><body>
    <header><nav aria-label="網站導覽"><a href="{base}/">醫學研究部首頁</a><a href="{base}/internal">院內專區</a><a href="{base}/auth/logout">登出</a></nav></header>
    <main><h1>{title}</h1><section class="card"><h2>{e(record['user'].get('name') or '院內人員')}</h2><p>目前角色：<strong>{label}</strong></p><p>{message}</p>{link}</section>{management}
    <section class="card"><h2>登入身分確認</h2><p>請核對哪個欄位與您的員編相同。候選欄位不代表已確認的員編規格，姓名不作為授權依據。</p>
    <table><caption>本次經院方驗證的身分欄位</caption><tbody>{rows or '<tr><td>沒有可顯示的候選欄位</td></tr>'}</tbody></table>
    <p>本次回傳欄位名稱：{e(', '.join(sorted(claims)))}</p>
    <p>授權識別欄位：<code>{e(configured or '未設定')}</code>；{match_status}。</p>
    <p>若候選欄位未包含員編，請讓維運人員依院方規格確認；不要貼出完整 Token、Cookie 或所有登入資料。</p></section></main></body></html>'''
