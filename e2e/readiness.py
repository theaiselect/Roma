"""e2e de «¿Está todo listo?»: dos móviles, presencia entre ellos y avisos. Servidor e2e recién arrancado en :5199."""
import re, sys
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:5199'; NOW='2026-10-28T12:00'; fails=[]
def check(n,ok):
    print(('OK   ' if ok else 'FALLA ')+n)
    if not ok: fails.append(n)
def phone(b,who):
    ctx=b.new_context(viewport={'width':400,'height':860},is_mobile=True,has_touch=True,locale='es-ES',timezone_id='Europe/Madrid')
    pg=ctx.new_page(); pg.goto(f'{BASE}/?now={NOW}')
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.get_by_role('button',name='Continuar').click()
    pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name=who).click(); pg.get_by_role('button',name='Entrar igualmente').click()
    pg.wait_for_timeout(1200); return ctx,pg
def ready(pg): pg.locator('#listo li').first.wait_for(timeout=9000); pg.wait_for_timeout(300)
def sync(pg): pg.evaluate("window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(1800)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    cj,j=phone(b,'Jesús'); errs=[]; j.on('pageerror',lambda e:errs.append(str(e)))
    j.goto(f'{BASE}/mas/ajustes?now={NOW}'); ready(j)
    card=j.get_by_label('¿Está todo listo?')
    check('ajustes: aparece la tarjeta «¿Está todo listo?»', card.count()==1)
    txt=card.inner_text()
    check('Lucía todavía no ha entrado', 'Lucía todavía no ha abierto' in txt)
    check('avisa de que no está instalada (navegador)', 'Instalada en la pantalla de inicio' in txt and card.get_by_role('button',name='Cómo instalarla').count()==1)
    check('hay botón «Comprobar ahora con el servidor»', card.get_by_role('button',name=re.compile('Comprobar ahora')).count()==1)
    j.goto(f'{BASE}/?now={NOW}'); j.wait_for_timeout(8000)
    check('Hoy avisa de lo que falta', j.get_by_text(re.compile('Falta(n)? \\d* ?(1 )?cosas? por dejar')).count()>=1 or j.get_by_text(re.compile('por dejar list')).count()>=1)
    cl,l=phone(b,'Lucía'); sync(l); sync(j)
    j.goto(f'{BASE}/mas/ajustes?now={NOW}'); ready(j)
    sync(j); j.wait_for_timeout(800)
    txt=j.get_by_label('¿Está todo listo?').inner_text()
    check('Jesús ve que Lucía se conectó', 'Lucía se conectó' in txt)
    j.get_by_label('¿Está todo listo?').get_by_role('button',name=re.compile('Comprobar ahora')).click(); j.wait_for_timeout(3500)
    txt=j.get_by_label('¿Está todo listo?').inner_text()
    check('prueba con el servidor: contraseña correcta', 'contraseña es correcta' in txt)
    check('ya está sincronizada', 'Al día' in txt)
    l.goto(f'{BASE}/mas/ajustes?now={NOW}'); ready(l); sync(l)
    check('Lucía ve que Jesús se conectó', 'Jesús se conectó' in l.get_by_label('¿Está todo listo?').inner_text())
    check('sin errores de página', not errs)
    b.close()
sys.exit(1 if fails else 0)
