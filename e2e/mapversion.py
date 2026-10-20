"""e2e del fallo 1 (versión de teselas fijada) CON service worker: contra la preview de producción
(BASE=http://127.0.0.1:5188, `npx vite build && npx vite preview --port 5188`)."""
import re, sys, json, os
from playwright.sync_api import sync_playwright
BASE=os.environ.get('BASE','http://127.0.0.1:5188'); NOW='2026-10-28T12:00'; fails=[]
def check(n,ok):
    print(('OK   ' if ok else 'FALLA ')+n)
    if not ok: fails.append(n)
state={'v':'v1','seen':set()}
STYLE={'version':8,'glyphs':'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
       'sources':{'ofm':{'type':'vector','url':'https://tiles.openfreemap.org/planet'}},
       'layers':[{'id':'background','type':'background','paint':{'background-color':'#eeeeee'}},
                 {'id':'label','type':'symbol','source':'ofm','source-layer':'place','layout':{'text-field':['get','name_en'],'text-font':['Noto Sans Regular']}}]}
def mock(route):
    u=route.request.url
    j=lambda o:route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(o))
    if '/styles/' in u: return j(STYLE)
    if re.search(r'/planet/?$',u): return j({'tilejson':'3.0.0','tiles':[f"https://tiles.openfreemap.org/planet/{state['v']}/{{z}}/{{x}}/{{y}}.pbf"],'minzoom':0,'maxzoom':14})
    m=re.search(r'/planet/(v\d)/',u)
    if m: state['seen'].add(m.group(1))
    if '/fonts/' in u or u.endswith('.pbf') or '/sprites/' in u:
        return route.fulfill(status=200,headers={'access-control-allow-origin':'*'},content_type='application/x-protobuf',body=b'')
    return route.fulfill(status=503,body='')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':412,'height':900},is_mobile=True,locale='es-ES',timezone_id='Europe/Madrid')
    for host in ['tiles.openfreemap.org','photon.komoot.io','routing.openstreetmap.de','overpass-api.de','api.open-meteo.com','es.wikipedia.org','upload.wikimedia.org','overpass.private.coffee','overpass.kumi.systems']:
        ctx.route(f'**://{host}/**',mock)
    pg=ctx.new_page()
    pg.goto(f'{BASE}/?now={NOW}')
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.get_by_role('button',name='Continuar').click()
    pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name='Jesús').click()
    pg.get_by_role('button',name=re.compile('^Entrar')).first.click(); pg.wait_for_timeout(1500)
    pg.evaluate("navigator.serviceWorker.ready"); pg.reload(); pg.wait_for_timeout(1500)
    check('el service worker controla la página', pg.evaluate("!!navigator.serviceWorker.controller"))
    # Descarga de Roma (como la automática), con la versión v1 publicada.
    pg.goto(f'{BASE}/mas/ajustes?now={NOW}'); pg.wait_for_timeout(800)
    pg.get_by_role('button',name=re.compile('Descargar ahora|Actualizar todo')).click()
    TJ="(async()=>{const c=await caches.open('mapa');const r=(await c.keys()).find(r=>/\\/planet\\/?$/.test(r.url));if(!r)return '';const m=await c.match(r.url,{ignoreVary:true});return m?(await m.json()).tiles[0]:''})()"
    import time
    t0=time.time(); tj=''
    while time.time()-t0<90 and '/planet/v1/' not in tj:
        pg.wait_for_timeout(1000); tj=pg.evaluate(TJ)
    pg.wait_for_timeout(2000)
    check('descarga: el TileJSON guardado apunta a la versión descargada (v1)', '/planet/v1/' in tj)
    # OpenFreeMap publica v2. Se abre el mapa CON conexión: antes se cambiaba solo a v2 y se perdía lo descargado.
    state['v']='v2'; state['seen'].clear()
    pg.goto(f'{BASE}/mapa?now={NOW}&e2e=1'); pg.wait_for_timeout(6000)
    tj2=pg.evaluate(TJ)
    check('con conexión: el TileJSON sigue fijado en v1 (no se cambia solo)', '/planet/v1/' in tj2)
    # No se comprueba aquí que el mapa no pida teselas v2: con `route` Playwright desactiva la caché HTTP y Chrome
    # marca TODAS las peticiones con `cache: 'reload'`, que el service worker deja pasar (es la señal de la descarga).
    # En un móvil las peticiones del mapa van con `cache: 'default'` y se sirve el TileJSON fijado (lo de arriba).
    # Sin conexión: el mapa se pinta con lo descargado (no cae al esquema).
    ctx.set_offline(True); pg.reload(); pg.wait_for_timeout(6000)
    check('sin conexión: hay mapa (no el esquema de puntos)', pg.locator('.romamap').count()==1 and pg.get_by_text(re.compile('No se ha podido cargar el mapa')).count()==0)
    b.close()
sys.exit(1 if fails else 0)
