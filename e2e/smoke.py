"""Humo e2e: onboarding de los dos móviles, recorrido de todas las pantallas y errores de consola.
Uso: servidor e2e en :5199 (vite --config vite.e2e.config.ts) y python3 e2e/smoke.py <carpeta capturas>"""
import sys, re
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:5199'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
NOW = '2026-10-31T13:00'
ROUTES = ['/', '/plan/2', '/mapa', '/nosotros/diario', '/nosotros/fotos', '/nosotros/cartas', '/nosotros/capsula',
          '/nosotros/votos', '/nosotros/postal', '/nosotros/cancion', '/nosotros/libro', '/mas', '/mas/reservas', '/mas/gastos',
          '/mas/monumentos', '/mas/comidas', '/mas/carta', '/mas/transporte', '/mas/frases', '/mas/audioguia',
          '/mas/emergencias', '/mas/maleta', '/mas/normas', '/mas/regalos', '/mas/calendario', '/mas/ajustes']

def onboard(page, who):
    page.goto(f'{BASE}/?now={NOW}')
    page.get_by_role('button', name=who).click()
    page.get_by_placeholder(re.compile('palabras')).fill('testtest')
    page.get_by_role('button', name='Continuar').click()
    page.get_by_role('button', name='Ya está, seguir').click()
    page.get_by_role('button', name='Entrar igualmente').click()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 412, 'height': 900}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES', timezone_id='Europe/Madrid')
    page = ctx.new_page()
    errs = []
    page.on('console', lambda m: errs.append(f'{page.url} {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append(f'{page.url} PAGEERROR {e}'))
    onboard(page, 'Jesús')
    page.wait_for_timeout(800)
    for r in ROUTES:
        page.goto(f'{BASE}{r}?now={NOW}')
        page.wait_for_timeout(500)
        name = r.strip('/').replace('/', '_') or 'hoy'
        page.screenshot(path=f'{OUT}/{name}.png', full_page=False)
        h1 = page.locator('h1').first.inner_text() if page.locator('h1').count() else '(sin h1)'
        w = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        print(f'{r:24} h1={h1!r} overflowX={w}')
    print('ERRORES:', *errs, sep='\n  ') if errs else print('Sin errores de consola')
    b.close()
