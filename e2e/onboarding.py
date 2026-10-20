"""e2e del primer arranque: contraseña → instalar → quién eres → descarga. Servidor e2e en :5199."""
import re, sys
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:5199'; fails=[]
def check(n,ok):
    print(('OK   ' if ok else 'FALLA ')+n)
    if not ok: fails.append(n)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':400,'height':860},is_mobile=True,has_touch=True,locale='es-ES',timezone_id='Europe/Madrid')
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'{BASE}/')
    check('primero la contraseña, sin «¿Quién eres?»', pg.get_by_placeholder(re.compile('aaaa')).count()==1 and pg.get_by_text('¿Quién eres?').count()==0)
    check('sin «Lo pondré luego en Ajustes»', pg.get_by_text(re.compile('Lo pondré luego')).count()==0)
    check('«Continuar» desactivado sin contraseña', pg.get_by_role('button',name='Continuar').is_disabled())
    pg.get_by_placeholder(re.compile('aaaa')).fill('equivocada1'); pg.get_by_role('button',name='Continuar').click(); pg.wait_for_timeout(800)
    check('contraseña equivocada: avisa y no avanza', pg.get_by_role('alert').count()==1 and pg.get_by_placeholder(re.compile('aaaa')).count()==1)
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
    check('contraseña buena (con Enter): sale instalar', pg.get_by_role('heading',name='Ponla en la pantalla de inicio').count()==1)
    pg.reload(); pg.wait_for_timeout(600)
    check('si se recarga, vuelve a salir instalar', pg.get_by_role('heading',name='Ponla en la pantalla de inicio').count()==1)
    pg.get_by_role('button',name='Ya está, seguir').click()
    check('después de instalar: «¿Quién eres?»', pg.get_by_role('heading',name='¿Quién eres?').count()==1)
    pg.get_by_role('button',name='Lucía').click(); pg.wait_for_timeout(400)
    check('luego la descarga y entrar', pg.get_by_role('button',name=re.compile('Entrar')).count()>=1)
    pg.get_by_role('button',name='Entrar igualmente').click(); pg.wait_for_timeout(600)
    check('dentro de la app como Lucía', pg.locator('.tabbar').count()==1)
    check('sin errores de página', not errs)
    b.close()
sys.exit(1 if fails else 0)
