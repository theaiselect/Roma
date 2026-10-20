"""e2e: carta bloqueada por hora (el servidor no entrega el texto antes) y canción del día. Servidor e2e en :5199."""
import re, sys
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:5199'; ok=True
def check(n,c):
    global ok; ok&=bool(c); print(('OK   ' if c else 'FALLA'),n)
def phone(b,who,now):
    ctx=b.new_context(viewport={'width':400,'height':860},is_mobile=True,locale='es-ES',timezone_id='Europe/Madrid'); pg=ctx.new_page()
    pg.goto(f'{BASE}/?now={now}')
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.get_by_role('button',name='Continuar').click()
    pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name=who).click(); pg.get_by_role('button',name='Entrar igualmente').click()
    return ctx,pg
def sync(pg):
    pg.evaluate("window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(2500)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    _,j=phone(b,'Jesús','2026-10-31T13:00'); _,l=phone(b,'Lucía','2026-10-31T13:00')
    j.goto(f'{BASE}/nosotros/cartas?now=2026-10-31T13:00'); j.wait_for_timeout(600)
    j.get_by_role('button',name='Escribir una carta').click()
    j.get_by_label('Carta', exact=True).fill('Te quiero más que a la carbonara')
    j.get_by_role('button',name='A una hora').click()
    j.locator('input[type=datetime-local]').fill('2026-10-31T21:00')
    j.get_by_role('button',name='Guardar carta').click(); j.wait_for_timeout(500); sync(j)
    check('carta: aparece en "Las tuyas" de Jesús', j.get_by_text(re.compile('Para Lucía')).count()>0)
    l.goto(f'{BASE}/nosotros/cartas?now=2026-10-31T13:00'); l.wait_for_timeout(2500)
    check('carta: Lucía la ve cerrada a las 13:00', l.get_by_text('Cerrada').count()>0)
    check('carta: el texto NO llega antes de la hora', l.get_by_text('carbonara').count()==0)
    html=l.content(); check('carta: ni está en el DOM', 'carbonara' not in html)
    l.goto(f'{BASE}/nosotros/cartas?now=2026-10-31T21:30'); l.wait_for_timeout(2500)
    check('carta: a las 21:30 simuladas sigue sin texto (el servidor usa la hora real)', l.get_by_text('Ya es la hora').count()>0 and l.get_by_text('carbonara').count()==0)
    # carta con hora ya pasada de verdad: se entrega y se abre
    j.get_by_role('button',name='Escribir una carta').click()
    j.get_by_label('Carta', exact=True).fill('Feliz llegada, amor')
    j.get_by_role('button',name='A una hora').click()
    j.locator('input[type=datetime-local]').fill('2026-10-19T00:30')
    j.get_by_role('button',name='Guardar carta').click(); j.wait_for_timeout(500); sync(j)
    l.goto(f'{BASE}/nosotros/cartas?now=2026-10-31T21:30'); l.wait_for_timeout(2500)
    check('carta pasada: está lista', l.get_by_text('Lista').count()>0)
    l.get_by_role('button',name='Abrir').first.click(); l.wait_for_timeout(500)
    check('carta pasada: al abrirla se lee', l.get_by_text('Feliz llegada, amor').count()>0)
    # canción del día
    j.goto(f'{BASE}/nosotros/cancion?now=2026-10-31T13:00'); j.wait_for_timeout(600)
    j.get_by_role('button',name=re.compile('Poner|Elegir|canción|Añadir',re.I)).first.click()
    j.get_by_label('Título').fill('Roma'); j.get_by_label('Artista').fill('Test')
    j.get_by_role('button',name='Guardar').click(); j.wait_for_timeout(500)
    check('canción: se guarda y se muestra', j.get_by_text('Roma').count()>0)
    b.close()
sys.exit(0 if ok else 1)
