"""e2e del mapa con OpenFreeMap, Photon, OSRM y Overpass SIMULADOS (el entorno de pruebas no llega a internet).
Comprueba que el mapa se monta con WebGL, los pines por día, tocar un pin, el buscador, la ruta a pie,
los puntos de OpenStreetMap en «Cerca de mí» y la descarga sin conexión. Servidor e2e en :5199."""
import json, re, sys
from playwright.sync_api import sync_playwright
import os
BASE=os.environ.get('BASE','http://127.0.0.1:5199'); NOW='2026-10-31T13:00'; ok=True
def check(n,c):
    global ok; ok&=bool(c); print(('OK   ' if c else 'FALLA'),n)

STYLE={'version':8,'glyphs':'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
       'sources':{'ofm':{'type':'vector','url':'https://tiles.openfreemap.org/planet'}},
       'layers':[{'id':'bg','type':'background','paint':{'background-color':'#e8e2d6'}},
                 {'id':'roads','type':'line','source':'ofm','source-layer':'transportation','paint':{'line-color':'#fff'}}]}
TILEJSON={'tilejson':'3.0.0','tiles':['https://tiles.openfreemap.org/planet/v1/{z}/{x}/{y}.pbf'],'minzoom':0,'maxzoom':14}
PHOTON={'features':[{'geometry':{'coordinates':[12.4768,41.8986]},'properties':{'osm_id':1,'osm_type':'W','name':'Pantheon','street':'Piazza della Rotonda','city':'Roma','district':'Pigna'}}]}
def osrm(n_legs=1):
    steps=[{'distance':400,'name':'Via Test','maneuver':{'type':'depart','location':[12.4823,41.9060]}},
           {'distance':800,'name':'Via del Corso','maneuver':{'type':'turn','modifier':'left','location':[12.4800,41.9020]}},
           {'distance':0,'name':'','maneuver':{'type':'arrive','modifier':'right','location':[12.4768,41.8986]}}]
    return {'code':'Ok','routes':[{'distance':1234*n_legs,'duration':900*n_legs,'geometry':{'coordinates':[[12.4823,41.9060],[12.4800,41.9020],[12.4768,41.8986]]},
            'legs':[{'distance':1234,'duration':900,'steps':steps if n_legs==1 else steps[:1]} for _ in range(n_legs)]}]}
OVERPASS={'elements':[{'type':'node','id':11,'lat':41.9012,'lon':12.4831,'tags':{'amenity':'drinking_water'}},
                      {'type':'node','id':12,'lat':41.9040,'lon':12.4850,'tags':{'amenity':'toilets','fee':'no'}},
                      {'type':'node','id':13,'lat':41.9055,'lon':12.4860,'tags':{'amenity':'pharmacy','name':'Farmacia Test'}}]}
def _ways():
    out=[]
    for i in range(45):
        out.append({'type':'way','tags':{'highway':'residential','name':f'Via Est {i}'},'geometry':[{'lat':41.900+i*0.0004,'lon':12.480+j*0.0004} for j in range(45)]})
        out.append({'type':'way','tags':{'highway':'footway','name':f'Via Norte {i}'},'geometry':[{'lat':41.900+j*0.0004,'lon':12.480+i*0.0004} for j in range(45)]})
    return {'elements':out}
WAYS=_ways()
PLACES={'elements':[{'type':'node','lat':41.9+k*0.0003,'lon':12.49,'tags':{'name':f'Trattoria {k}','amenity':'restaurant'}} for k in range(60)]+[{'type':'node','lat':41.9060,'lon':12.4880,'tags':{'name':'Caffè Prova','amenity':'cafe'}},{'type':'node','lat':41.9010,'lon':12.4850,'tags':{'name':'Pantheon','historic':'monument'}}]}
counts={'tiles':0}
def mock(route):
    u=route.request.url
    j=lambda o:route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(o))
    if u.endswith('/styles/liberty'): return j(STYLE)
    if u.endswith('/planet'): return j(TILEJSON)
    if '/fonts/' in u or u.endswith('.pbf'):
        counts['tiles']+=1
        return route.fulfill(status=200,headers={'access-control-allow-origin':'*'},content_type='application/x-protobuf',body=b'')
    if 'photon.komoot.io' in u: return j(PHOTON)
    if 'routing.openstreetmap.de' in u: return j(osrm(u.split('/foot/')[1].split('?')[0].count(';')))
    if 'open-meteo.com' in u: return j({'daily':{'time':['2026-10-31'],'weather_code':[1],'temperature_2m_max':[20],'temperature_2m_min':[11],'precipitation_probability_max':[10]}})
    if 'overpass-api.de' in u:
        from urllib.parse import unquote_plus; q=unquote_plus(route.request.post_data or '')
        if 'out tags geom' in q: return j(WAYS)
        if 'nwr["name"]' in q: return j(PLACES)
        return j(OVERPASS)
    return route.continue_()

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':412,'height':900},is_mobile=True,has_touch=True,locale='es-ES',timezone_id='Europe/Madrid',service_workers='block',
                      permissions=['geolocation'],geolocation={'latitude':41.9060,'longitude':12.4823})
    for host in ['tiles.openfreemap.org','photon.komoot.io','routing.openstreetmap.de','overpass-api.de','api.open-meteo.com']:
        ctx.route(f'**://{host}/**',mock)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:print('CONSOLE',m.text[:300]) if 'offline' in m.text else None)
    pg.goto(f'{BASE}/?now={NOW}')
    pg.get_by_role('button',name='Jesús').click(); pg.get_by_placeholder(re.compile('aaaa')).fill('testtest')
    pg.get_by_role('button',name='Continuar').click(); pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name='Entrar igualmente').click()
    pg.goto(f'{BASE}/mapa?now={NOW}&e2e=1')
    pg.wait_for_selector('.romamap canvas',timeout=20000); pg.wait_for_function("window.__romaMap && window.__romaMap.getSource('pins')",timeout=20000)
    pg.wait_for_timeout(1500)
    check('mapa: se monta con WebGL y carga el estilo', True)
    check('mapa: sin aviso de fallback', pg.get_by_text('No se ha podido cargar el mapa').count()==0)
    n=pg.evaluate("window.__romaMap.querySourceFeatures('pins').length")
    check(f'mapa: pines del día II en el mapa ({n})', n>=5)
    pg.screenshot(path='/tmp/map1.png')
    # tocar un pin (el primero del día)
    xy=pg.evaluate("(()=>{const m=window.__romaMap;const f=m.querySourceFeatures('pins').find(f=>f.properties.kind==='stop');const p=m.project(f.geometry.coordinates);const r=m.getCanvas().getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y,id:f.properties.id}})()")
    pg.mouse.click(xy['x'],xy['y']); pg.wait_for_timeout(500)
    check('pin: al tocarlo sale la tarjeta con acciones', pg.get_by_role('button',name='Ruta a pie',exact=True).count()>0)
    # buscador
    pg.get_by_label('Buscar un sitio').fill('Pantheon'); pg.wait_for_timeout(800)
    check('buscador: sale el resultado', pg.get_by_role('option',name=re.compile('Pantheon')).count()>0)
    pg.get_by_role('option',name=re.compile('^Pantheon')).click(); pg.wait_for_timeout(600)
    # ruta a pie desde la ubicación
    pg.get_by_role('button',name='Dónde estoy').first.click(); pg.wait_for_timeout(800)
    pg.get_by_role('button',name='Ruta a pie',exact=True).click(); pg.wait_for_timeout(1200)
    check('ruta: muestra minutos y distancia a pie', pg.get_by_text('15 min').count()>0 and pg.get_by_text(re.compile('1[,.]2 km')).count()>0)
    check('ruta: se dibuja en el mapa', pg.evaluate("window.__romaMap.querySourceFeatures('route').length")>0)
    pg.screenshot(path='/tmp/map2.png')
    check('ruta: indicaciones en español', pg.get_by_text(re.compile('Ver las 3 indicaciones')).count()>0)
    pg.get_by_text(re.compile('Ver las 3 indicaciones')).click()
    check('ruta: «Gira a la izquierda por Via del Corso»', pg.get_by_text('Gira a la izquierda por Via del Corso').count()>0)
    # navegación con GPS simulado
    pg.get_by_role('button',name='Empezar a caminar').click(); pg.wait_for_timeout(1000)
    ban=pg.locator('.navbanner')
    check('navegación: banner con la primera maniobra', ban.count()==1 and 'Gira a la izquierda' in ban.inner_text())
    pg.screenshot(path='/tmp/map3.png')
    ctx.set_geolocation({'latitude':41.9020,'longitude':12.4800}); pg.wait_for_timeout(1500)
    check('navegación: al pasar la maniobra avanza a «Has llegado»', 'Has llegado' in ban.inner_text())
    ctx.set_geolocation({'latitude':41.8986,'longitude':12.4768}); pg.wait_for_timeout(1500)
    check('navegación: al llegar sale el aviso y se cierra el banner', pg.locator('.navbanner').count()==0 and pg.get_by_text(re.compile('Has llegado a')).count()>0)
    pg.get_by_role('button',name='Cerrar').first.click(); pg.wait_for_timeout(300)
    # ruta del día
    pg.get_by_role('button',name='Ruta a pie del día').click(); pg.wait_for_timeout(1200)
    check('ruta del día: lista de tramos con tiempos', pg.locator('.legs li').count()>=3 and pg.get_by_text(re.compile('paradas')).count()>0)
    # pulsación larga (botón derecho en el mapa) = punto marcado
    box=pg.locator('.romamap').bounding_box()
    pg.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2,button='right'); pg.wait_for_timeout(900)
    check('pulsación larga: punto marcado con ruta', pg.get_by_role('button',name='Ruta a pie',exact=True).count()>0)
    # Cerca de mí con datos de OSM
    pg.get_by_role('button',name='Fuente').click(); pg.wait_for_timeout(600)
    check('cerca de mí: fuente de OpenStreetMap en la lista', pg.get_by_text('Fuente de agua potable (nasone)').count()>0)
    pg.get_by_role('button',name='Baño').click(); pg.wait_for_timeout(400)
    check('cerca de mí: baño gratis', pg.get_by_text('Gratis').count()>0)
    pg.get_by_role('button',name='Farmacia').click(); pg.wait_for_timeout(400)
    check('cerca de mí: farmacia de OSM', pg.get_by_text('Farmacia Test').count()>0)
    # descarga sin conexión
    pg.get_by_role('button',name='Preparar para ir sin conexión').click()
    try: pg.wait_for_selector('text=Todo listo',timeout=120000)
    except Exception:
        print(pg.locator('section[aria-label="Preparar para ir sin conexión"]').inner_text()); print(errs[:3]); raise
    cnt=pg.evaluate("caches.open('mapa').then(c=>c.keys()).then(k=>k.length)")
    check(f'descarga: teselas y estilo en la caché «mapa» ({cnt})', cnt>=150)
    # SIN CONEXIÓN: se corta la red y todo sigue funcionando con lo descargado
    ctx.set_offline(True); pg.evaluate("window.dispatchEvent(new Event('offline'))"); pg.wait_for_timeout(300)
    pg.get_by_role('button',name='Quitar ruta').first.click() if pg.get_by_role('button',name='Quitar ruta').count() else None
    pg.get_by_label('Buscar un sitio').fill('Caffe Prova'); pg.wait_for_timeout(900)
    check('sin conexión: el buscador encuentra un sitio fuera del plan', pg.get_by_role('option',name=re.compile('Caffè Prova')).count()>0)
    pg.get_by_label('Buscar un sitio').fill('Via Norte 7'); pg.wait_for_timeout(900)
    check('sin conexión: el buscador encuentra una calle', pg.get_by_role('option',name=re.compile('Via Norte 7')).count()>0)
    pg.get_by_role('option',name=re.compile('Via Norte 7')).first.click(); pg.wait_for_timeout(500)
    pg.get_by_role('button',name='Dónde estoy').first.click(); pg.wait_for_timeout(800)
    pg.get_by_role('button',name='Ruta a pie',exact=True).click(); pg.wait_for_timeout(1500)
    check('sin conexión: calcula la ruta a pie con las calles guardadas', pg.get_by_text('sin conexión').count()>0 and pg.evaluate("window.__romaMap.querySourceFeatures('route').length")>0)
    pg.screenshot(path='/tmp/map-offline.png')
    pg.get_by_role('button',name='Quitar ruta').first.click(); pg.wait_for_timeout(300)
    ctx.set_geolocation({'latitude':41.9120,'longitude':12.4900})
    pg.evaluate("(()=>{const m=window.__romaMap;m.jumpTo({center:[12.4906,41.9064],zoom:17})})()"); pg.wait_for_timeout(800)
    box=pg.locator('.romamap').bounding_box()
    pg.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2,button='right'); pg.wait_for_timeout(1200)
    check('sin conexión: pulsación larga dice qué calle es', pg.get_by_text(re.compile('Via (Est|Norte) \\d+')).count()>0)
    check('descarga: sin errores de página', not errs)
    if errs: print(errs[:3])
    b.close()
sys.exit(0 if ok else 1)
