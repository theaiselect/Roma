"""e2e de dos móviles: diario, gastos, pregunta del día (revelado) y trabajo sin conexión.
Requiere el servidor e2e en :5199."""
import re, sys
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5199'
NOW = '2026-10-31T13:00'
ok = True
def check(name, cond):
    global ok
    ok &= bool(cond)
    print(('OK   ' if cond else 'FALLA'), name)

def phone(b, who):
    ctx = b.new_context(viewport={'width': 400, 'height': 860}, is_mobile=True, has_touch=True, locale='es-ES', timezone_id='Europe/Madrid')
    pg = ctx.new_page()
    pg.goto(f'{BASE}/?now={NOW}')
    pg.get_by_role('button', name=who).click()
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest')
    pg.get_by_role('button', name='Continuar').click()
    pg.get_by_role('button', name='Ya está, seguir').click()
    pg.get_by_role('button', name='Entrar igualmente').click()
    return ctx, pg

def sync_now(pg):
    pg.evaluate("window.dispatchEvent(new Event('online'))")
    pg.wait_for_timeout(2500)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    cj, j = phone(b, 'Jesús')
    cl, l = phone(b, 'Lucía')

    # 1) Diario: cada uno escribe su versión y se ve en el otro móvil
    j.goto(f'{BASE}/nosotros/diario?now={NOW}'); l.goto(f'{BASE}/nosotros/diario?now={NOW}')
    j.get_by_label('Tu diario de hoy').fill('Comimos carbonara en Da Enzo'); j.get_by_label('Tu diario de hoy').blur()
    j.wait_for_timeout(500); sync_now(j); sync_now(l)
    l.goto(f'{BASE}/nosotros/diario?now={NOW}'); l.wait_for_timeout(2500)
    check('diario: Lucía ve lo que escribió Jesús', l.get_by_text('Comimos carbonara en Da Enzo').count() > 0)

    # 2) Pregunta del día: oculta hasta que responden los dos
    j.goto(f'{BASE}/nosotros/votos?now={NOW}'); l.goto(f'{BASE}/nosotros/votos?now={NOW}')
    j.get_by_placeholder('Tu respuesta…').fill('Los cacio e pepe'); j.get_by_role('button', name='Responder').click()
    j.wait_for_timeout(500); sync_now(j); sync_now(l)
    l.goto(f'{BASE}/nosotros/votos?now={NOW}'); l.wait_for_timeout(2500)
    check('pregunta: Lucía NO ve la respuesta antes de responder', l.get_by_text('Los cacio e pepe').count() == 0)
    check('pregunta: Lucía sabe que Jesús ya respondió', l.get_by_text(re.compile('ya ha respondido')).count() > 0)
    l.get_by_placeholder('Tu respuesta…').fill('El Coliseo'); l.get_by_role('button', name='Responder').click()
    l.wait_for_timeout(500); sync_now(l); sync_now(j)
    j.goto(f'{BASE}/nosotros/votos?now={NOW}'); j.wait_for_timeout(2500)
    check('pregunta: ahora Jesús ve la de Lucía', j.get_by_text('El Coliseo').count() > 0)
    check('pregunta: y Lucía ve la de Jesús', l.get_by_text('Los cacio e pepe').count() > 0)

    # 3) Gasto creado sin conexión en un móvil y sincronizado al volver
    j.goto(f'{BASE}/mas/gastos?now={NOW}'); j.wait_for_timeout(800)
    cj.set_offline(True)
    j.get_by_role('button', name=re.compile('Añadir gasto')).click()
    j.get_by_placeholder('0,00').fill('24,50'); j.get_by_placeholder(re.compile('Da Enzo')).fill('Gelato offline')
    j.get_by_role('button', name='Guardar').click(); j.wait_for_timeout(600)
    check('gasto offline: aparece en el móvil de Jesús', j.get_by_text('Gelato offline').count() > 0)
    cj.set_offline(False); sync_now(j); sync_now(l)
    l.goto(f'{BASE}/mas/gastos?now={NOW}'); l.wait_for_timeout(2500)
    check('gasto offline: llega al móvil de Lucía al recuperar red', l.get_by_text('Gelato offline').count() > 0)

    # 4) Sitio guardado con ⭐: Jesús lo guarda y Lucía lo ve en «Guardados» (aquí el mapa cae al esquema: no hay internet)
    j.goto(f'{BASE}/mapa?now={NOW}'); l.goto(f'{BASE}/mapa?now={NOW}')
    j.wait_for_selector('.schematic', timeout=40000)
    j.locator('.schematic g[role=button]').first.click(); j.wait_for_timeout(500)
    j.get_by_role('button', name=re.compile('Guardar')).first.click(); j.wait_for_timeout(500)
    check('guardados: Jesús ve «★ Guardado» y el sitio en su lista', j.get_by_role('button', name=re.compile('Guardado')).count() > 0 and j.locator('#saved-title ~ article').count() == 1)
    sync_now(j); sync_now(l)
    l.goto(f'{BASE}/mapa?now={NOW}'); l.wait_for_timeout(3000)
    check('guardados: Lucía lo ve en su lista, guardado por Jesús', l.locator('#saved-title ~ article').count() == 1 and 'Lo guardó Jesús' in l.locator('#saved-title ~ article').inner_text())
    l.get_by_role('button', name='Quitar', exact=True).click(); l.wait_for_timeout(500); sync_now(l); sync_now(j)
    j.goto(f'{BASE}/mapa?now={NOW}'); j.wait_for_timeout(3000)
    check('guardados: si Lucía lo quita, desaparece también en el de Jesús', j.locator('#saved-title ~ article').count() == 0)

    b.close()
sys.exit(0 if ok else 1)
