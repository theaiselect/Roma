# Descarga sin conexión con el paquete ya preparado (public/offline/roma.json) y Overpass caído:
# calles, sitios, puntos y metro tienen que quedar guardados sin preguntar a Overpass ni una vez.
import os, re, sys
from playwright.sync_api import sync_playwright
BASE=os.environ.get('BASE','http://127.0.0.1:5199'); NOW='2026-10-31T13:00'; ok=True
def check(n,c):
    global ok; ok=ok and bool(c); print(('OK   ' if c else 'FAIL ')+' '+n)
if not os.path.exists('public/offline/roma.json'): print('Sin public/offline/roma.json: se genera con el workflow «Datos sin conexión»'); sys.exit(1)
hits={'overpass':0,'pack':0}
def overpass(route):
    hits['overpass']+=1; route.fulfill(status=503,body='caído')
def count_pack(route):
    hits['pack']+=1; route.continue_()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':412,'height':900},is_mobile=True,locale='es-ES',timezone_id='Europe/Madrid',service_workers='block')
    for host in ['overpass-api.de','overpass.openstreetmap.fr','overpass.private.coffee','overpass.kumi.systems']: ctx.route(f'**://{host}/**',overpass)
    for host in ['tiles.openfreemap.org','photon.komoot.io','routing.openstreetmap.de','api.open-meteo.com','es.wikipedia.org','upload.wikimedia.org']: ctx.route(f'**://{host}/**',lambda r: r.abort())
    ctx.route('**/offline/roma.json',count_pack)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'{BASE}/?now={NOW}')
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.get_by_role('button',name='Continuar').click()
    pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name='Jesús').click(); pg.get_by_role('button',name='Entrar igualmente').click()
    pg.goto(f'{BASE}/mas/ajustes?now={NOW}&autooffline=1')
    card=pg.get_by_label('Preparar para ir sin conexión')
    seen_pct=False
    for _ in range(120):
        t=card.inner_text()
        if re.search(r'Descargando: \d+ %', t) and 'lleva' in t: seen_pct=True
        if 'cruces ·' in t and 'estaciones ·' in t and 'sitios ·' in t and 'puntos ·' in t and 'Descargando:' not in t: break
        pg.wait_for_timeout(500)
    t=card.inner_text()
    check('progreso: se ve el % total y cuánto lleva', seen_pct)
    check('calles guardadas desde el paquete', re.search(r'[\d.]{4,} cruces', t) is not None)
    check('sitios guardados desde el paquete', re.search(r'[\d.]{3,} sitios ·', t) is not None)
    check('puntos guardados desde el paquete', re.search(r'[\d.]{3,} puntos', t) is not None)
    check('metro guardado desde el paquete', re.search(r'\d{2,} estaciones', t) is not None)
    check(f'el paquete se pidió ({hits["pack"]})', hits['pack']>=1)
    check(f'no se preguntó a Overpass ({hits["overpass"]})', hits['overpass']==0)
    check('sin errores de página', not errs)
    print(t)
    b.close()
sys.exit(0 if ok else 1)
