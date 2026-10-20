"""e2e: el móvil de Lucía es el regalo. Sin herramientas de organizador (Calendario, Maleta, Normas), sin avisos de
copia/reservas/«falta algo» en Hoy, sin Postal en Nosotros. El de Jesús sí lo tiene todo. Servidor e2e en :5199."""
import re, sys
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:5199'; NOW='2026-10-25T12:00'; fails=[]
def check(n,ok):
    print(('OK   ' if ok else 'FALLA ')+n)
    if not ok: fails.append(n)
def phone(b, who):
    ctx=b.new_context(viewport={'width':400,'height':860},is_mobile=True,has_touch=True,locale='es-ES',timezone_id='Europe/Madrid')
    pg=ctx.new_page(); pg.goto(f'{BASE}/?now={NOW}')
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.get_by_role('button',name='Continuar').click()
    pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name=who).click(); pg.get_by_role('button',name='Entrar igualmente').click()
    pg.wait_for_timeout(800); return ctx,pg
def go(pg,path): pg.goto(f'{BASE}{path}?now={NOW}'); pg.wait_for_timeout(1200)
ORG=['Calendario (.ics)','Maleta y noche anterior','Normas y multas']
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    cl,l=phone(b,'Lucía'); errs=[]; l.on('pageerror',lambda e:errs.append(str(e)))
    go(l,'/mas'); menu=l.get_by_role('navigation',name='Herramientas')
    check('Lucía: el menú no tiene Calendario, Maleta ni Normas', all(menu.get_by_text(t,exact=True).count()==0 for t in ORG))
    check('Lucía: el menú sí tiene Gastos, Reservas y Emergencias', all(menu.get_by_text(t,exact=True).count()==1 for t in ['Gastos','Reservas y entradas','Emergencias y salud']))
    go(l,'/')
    main=l.inner_text('main')
    check('Lucía: Hoy sin aviso de copia de seguridad', not re.search(r'copia de seguridad', main, re.I))
    check('Lucía: Hoy sin reservas por hacer', not re.search(r'por reservar|reservas? (pendientes|por hacer)', main, re.I))
    check('Lucía: Hoy sin «¿Está todo listo?»', not re.search(r'todo listo|falta(n)? por preparar', main, re.I))
    go(l,'/nosotros'); nav=l.get_by_role('navigation',name='Secciones de Nosotros')
    check('Lucía: Nosotros sin Postal y con Cartas', nav.get_by_text('Postal').count()==0 and nav.get_by_text('Cartas').count()==1)
    check('sin errores de página', not errs)
    cj,j=phone(b,'Jesús')
    go(j,'/mas'); menu=j.get_by_role('navigation',name='Herramientas')
    check('Jesús: el menú sí tiene Calendario, Maleta y Normas', all(menu.get_by_text(t,exact=True).count()==1 for t in ORG))
    go(j,'/'); jm=j.inner_text('main')
    check('Jesús: Hoy sí tiene sus avisos de organizador (copia o reservas o listo)', bool(re.search(r'copia de seguridad|por reservar|reservas? (pendientes|por hacer)|todo listo|falta', jm, re.I)))
    print('--- avisos de Jesús:', [x for x in jm.split('\n') if re.search(r'copia|reserv|listo|falta', x, re.I)][:6])
    b.close()
sys.exit(1 if fails else 0)
