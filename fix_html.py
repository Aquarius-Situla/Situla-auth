import re
import os

base_dir = r"F:\antigravity_data\situla-auth\public"

def fix_html(filename, js_name):
    filepath = os.path.join(base_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Remove all <script>...</script> blocks
    html = re.sub(r'<script\b[^>]*>([\s\S]*?)<\/script>', '', html)

    # Remove the simplewebauthn cdn script if present (it was replaced by local, but the regex above removes it anyway)
    # Re-insert the simplewebauthn and i18n scripts into the head
    if filename == "admin.html" or filename == "index.html" or filename == "totp.html":
        # The head usually ends with </head>
        head_scripts = '\n    <script src="/js/simplewebauthn.js"></script>\n    <script src="i18n.js"></script>\n</head>'
        if '<script src="/js/simplewebauthn.js">' not in html:
            html = html.replace('</head>', head_scripts)
            
    # Add the main js script right before </body>
    script_tag = f'\n    <script src="/js/{js_name}"></script>\n</body>'
    if f'<script src="/js/{js_name}">' not in html:
        html = html.replace('</body>', script_tag)

    # Remove inline handlers
    html = re.sub(r'\s*onclick="[^"]+"', '', html)
    html = re.sub(r'\s*oninput="[^"]+"', '', html)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Fixed {filename}")

fix_html('index.html', 'login.js')
fix_html('totp.html', 'totp.js')
fix_html('admin.html', 'admin.js')
