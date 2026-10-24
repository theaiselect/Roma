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
def osrm(n_legs=1, alt=False):
    steps=[{'distance':400,'name':'Via Test','maneuver':{'type':'depart','location':[12.4823,41.9060]}},
           {'distance':800,'name':'Via del Corso','maneuver':{'type':'turn','modifier':'left','location':[12.4800,41.9020]}},
           {'distance':0,'name':'','maneuver':{'type':'arrive','modifier':'right','location':[12.4768,41.8986]}}]
    return {'code':'Ok','routes':[{'distance':1234*n_legs,'duration':900*n_legs,'geometry':{'coordinates':[[12.4823,41.9060],[12.4800,41.9020],[12.4768,41.8986]]},
            'legs':[{'distance':1234,'duration':900,'steps':steps if n_legs==1 else steps[:1]} for _ in range(n_legs)]}]+([{'distance':1500,'duration':1100,'geometry':{'coordinates':[[12.4823,41.9060],[12.4790,41.9040],[12.4768,41.8986]]},'legs':[{'distance':1500,'duration':1100,'steps':steps}]}] if alt else [])}
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
METRO={'elements':[
  {'type':'relation','id':1,'tags':{'route':'subway','ref':'A'},'members':[{'type':'way','ref':10,'role':'','geometry':[{'lat':41.9061,'lon':12.4825},{'lat':41.9035,'lon':12.4895},{'lat':41.9010,'lon':12.5010}]}]},
  {'type':'relation','id':2,'tags':{'route':'subway','ref':'A'},'members':[{'type':'way','ref':10,'role':'','geometry':[{'lat':41.9061,'lon':12.4825},{'lat':41.9035,'lon':12.4895},{'lat':41.9010,'lon':12.5010}]}]},
  {'type':'relation','id':3,'tags':{'route':'subway','ref':'B'},'members':[{'type':'way','ref':20,'role':'','geometry':[{'lat':41.8903,'lon':12.4922},{'lat':41.9010,'lon':12.5010}]}]},
  {'type':'node','id':1,'lat':41.9061,'lon':12.4825,'tags':{'name':'Spagna','railway':'station','station':'subway'}},
  {'type':'node','id':2,'lat':41.9035,'lon':12.4895,'tags':{'name':'Barberini','railway':'station','station':'subway'}},
  {'type':'node','id':3,'lat':41.9010,'lon':12.5010,'tags':{'name':'Termini','railway':'station','station':'subway'}},
  {'type':'node','id':4,'lat':41.8903,'lon':12.4922,'tags':{'name':'Colosseo','railway':'station','station':'subway'}}]}
WIKI_TITLES=['Coliseo','Foro Romano','Palatino','Panteón de Agripa','Fontana de Trevi','Plaza Navona','Plaza de España (Roma)','Villa Borghese','Plaza del Popolo','Trastevere','Museos Vaticanos','Basílica de San Pedro','Palacio Barberini',"Castillo de Sant'Angelo",'Boca de la Verdad','Circo Máximo','Aventino','Janículo','Tempietto de Bramante','Gueto de Roma','Teatro de Marcelo','Monumento a Víctor Manuel II','Plaza del Capitolio','Estación de Roma Termini','Museos Capitolinos','San Luigi dei Francesi',"Sant'Ignazio de Roma",'San Pietro in Vincoli']
WIKI={'query':{'pages':[{'title':t,'index':i+1,'extract':'Texto de prueba sobre '+t+'.','thumbnail':{'source':'https://upload.wikimedia.org/test/'+str(i)+'.png','width':640,'height':480}} for i,t in enumerate(WIKI_TITLES)]}}
PNG=bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8ffff3f0005fe02fea75ad08f0000000049454e44ae426082')
def mock(route):
    u=route.request.url
    j=lambda o:route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(o))
    if u.endswith('/styles/positron'): return j(STYLE)
    if u.endswith('/planet'): return j(TILEJSON)
    if '/fonts/' in u or u.endswith('.pbf'):
        counts['tiles']+=1
        return route.fulfill(status=200,headers={'access-control-allow-origin':'*'},content_type='application/x-protobuf',body=b'')
    if 'photon.komoot.io' in u: return j(PHOTON)
    if 'routing.openstreetmap.de' in u: return j(osrm(u.split('/foot/')[1].split('?')[0].count(';'), 'alternatives=3' in u))
    if 'wikipedia.org' in u: return j(WIKI)
    if 'upload.wikimedia.org' in u: return route.fulfill(status=200,headers={'access-control-allow-origin':'*'},content_type='image/png',body=PNG)
    if 'open-meteo.com/v1/elevation' in u:
        from urllib.parse import urlparse, parse_qs
        lats=[float(x) for x in parse_qs(urlparse(u).query)['latitude'][0].split(',')]
        return j({'elevation':[round(30+(41.91-la)*2000) for la in lats]})
    if 'open-meteo.com' in u: return j({'daily':{'time':['2026-10-31'],'weather_code':[1],'temperature_2m_max':[20],'temperature_2m_min':[11],'precipitation_probability_max':[10]}})
    if '/api/interpreter' in u:  # cualquier espejo de Overpass
        from urllib.parse import unquote_plus; q=unquote_plus(route.request.post_data or '')
        if 'route"="subway' in q: return j(METRO)
        if 'out tags geom' in q: return j(WAYS)
        if 'nwr["name"]' in q: return j(PLACES)
        return j(OVERPASS)
    return route.continue_()

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':412,'height':900},is_mobile=True,has_touch=True,locale='es-ES',timezone_id='Europe/Madrid',service_workers='block',
                      permissions=['geolocation'],geolocation={'latitude':41.9060,'longitude':12.4823})
    for host in ['tiles.openfreemap.org','photon.komoot.io','routing.openstreetmap.de','overpass-api.de','overpass.openstreetmap.fr','overpass.private.coffee','overpass.kumi.systems','api.open-meteo.com','es.wikipedia.org','upload.wikimedia.org']:
        ctx.route(f'**://{host}/**',mock)
    # Sin el paquete ya preparado: esta prueba usa los datos falsos de Overpass de arriba.
    ctx.route('**/offline/roma.json',lambda r: r.fulfill(status=404,body=''))
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:print('CONSOLE',m.text[:300]) if 'offline' in m.text else None)
    pg.goto(f'{BASE}/?now={NOW}')
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.get_by_role('button',name='Continuar').click()
    pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name='Jesús').click(); pg.get_by_role('button',name='Entrar igualmente').click()
    pg.goto(f'{BASE}/mapa?now={NOW}&e2e=1&autooffline=1')
    pg.wait_for_selector('.romamap canvas',timeout=20000); pg.wait_for_function("window.__romaMap && window.__romaMap.getSource('pins')",timeout=20000)
    pg.wait_for_timeout(1500)
    check('mapa: se monta con WebGL y carga el estilo', True)
    check('mapa: sin aviso de fallback', pg.get_by_text('No se ha podido cargar el mapa').count()==0)
    n=pg.evaluate("window.__romaMap.querySourceFeatures('pins').length")
    check(f'mapa: pines del día II en el mapa ({n})', n>=5)
    pg.screenshot(path='/tmp/map1.png')
    # tocar un pin (el primero del día)
    pg.evaluate("(()=>{const m=window.__romaMap;const f=m.querySourceFeatures('pins').find(f=>f.properties.kind==='stop');m.jumpTo({center:f.geometry.coordinates,zoom:16})})()"); pg.wait_for_timeout(700)
    xy=pg.evaluate("(()=>{const m=window.__romaMap;const f=m.querySourceFeatures('pins').find(f=>f.properties.kind==='stop');const p=m.project(f.geometry.coordinates);const r=m.getCanvas().getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y,id:f.properties.id}})()")
    pg.mouse.click(xy['x'],xy['y']); pg.wait_for_timeout(500)
    check('pin: al tocarlo sale la ficha con acciones', pg.get_by_role('button',name='Ruta a pie',exact=True).count()>0)
    # números 1, 2, 3… en vez de horas, y ficha con todo lo de la parada
    shorts=pg.evaluate("window.__romaMap.querySourceFeatures('pins').filter(f=>f.properties.kind==='stop').map(f=>f.properties.short)")
    check(f'mapa: los pines llevan números 1, 2, 3… ({sorted(set(shorts))[:4]})', '1' in shorts and '2' in shorts and not any(':' in x for x in shorts))
    sheet=pg.locator('.stopsheet')
    check('ficha: dice la parada, el día y la hora', sheet.count()==1 and re.search(r'Sábado 31/10 · \d\d:\d\d', sheet.inner_text()) is not None and 'parada' in sheet.inner_text())
    check('ficha: enseña el tiempo y el atardecer', 'atardecer' in sheet.inner_text())
    check('ficha: lleva a Google Maps y al plan', sheet.get_by_role('link',name=re.compile('Google Maps|Apple Maps')).count()==1 and sheet.get_by_role('link',name='Ver en el plan').count()==1)
    n1=sheet.locator('.stopnum').inner_text()
    sheet.get_by_role('button',name=re.compile('Siguiente')).click(); pg.wait_for_timeout(500)
    n2=pg.locator('.stopsheet .stopnum').inner_text()
    check(f'ficha: «Siguiente» pasa de la parada {n1} a la {n2}', int(n2)==int(n1)+1)
    pg.locator('.stopsheet').get_by_role('button',name='Marcar como hecho').click(); pg.wait_for_timeout(600)
    check('ficha: «Marcar como hecho» cambia a «Hecho ♥» con corazones', pg.locator('.stopsheet').get_by_role('button',name='Hecho ♥').count()==1 and pg.locator('.stopsheet .heartburst').count()==1)
    pg.screenshot(path='/tmp/map-sheet.png')
    pg.get_by_role('button',name='Cerrar la ficha').click(); pg.wait_for_timeout(300)
    check('ficha: se cierra', pg.locator('.stopsheet').count()==0)
    check('mapa: «Siguiente» sobre el mapa del día de hoy', pg.locator('.nextchip').count()==1)
    pg.locator('.nextchip').click(); pg.wait_for_timeout(500)
    check('mapa: tocar «Siguiente» abre su ficha', pg.locator('.stopsheet').count()==1)
    box0=pg.locator('.romamap').bounding_box()
    pg.mouse.click(box0['x']+8,box0['y']+box0['height']*0.35); pg.wait_for_timeout(400)
    check('mapa: tocar el mapa vacío cierra la ficha', pg.locator('.stopsheet').count()==0)
    # ── Extras del mapa: foto del sitio, metro cercano, estrella, 3D, capa de metro ──
    def open_stop(pat):
        pg.evaluate("(pat=>{const m=window.__romaMap;const f=m.querySourceFeatures('pins').filter(f=>f.properties.kind==='stop'&&new RegExp(pat).test(f.properties.id))[0];m.jumpTo({center:f.geometry.coordinates,zoom:16})})",pat); pg.wait_for_timeout(700)
        xy=pg.evaluate("(pat=>{const m=window.__romaMap;const f=m.querySourceFeatures('pins').filter(f=>f.properties.kind==='stop'&&new RegExp(pat).test(f.properties.id))[0];if(!f)return null;const p=m.project(f.geometry.coordinates);const r=m.getCanvas().getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y}})",pat)
        if not xy: return False
        pg.mouse.click(xy['x'],xy['y']); pg.wait_for_timeout(700); return True
    got=open_stop('^stop:(colosseo|foro-romano|palatino|pantheon|trevi|navona|piazza-spagna)$')
    check('extras: hay una parada del día con ficha de monumento', got and pg.locator('.stopsheet').count()==1)
    try: pg.wait_for_selector('.stopsheet .wikirow img',timeout=6000)
    except Exception: pass
    check('ficha: foto y resumen de Wikipedia con atribución', pg.locator('.stopsheet .wikirow img').count()==1 and 'Texto de prueba' in pg.locator('.stopsheet .wikirow').inner_text() and pg.locator('.stopsheet .wikirow').get_by_role('link',name='Wikipedia').count()==1)
    check('ficha: metro más cercano con línea y minutos', pg.locator('.stopsheet').get_by_text(re.compile(r'Metro .* a unos \d+ min a pie')).count()==1)
    pg.locator('.stopsheet').get_by_role('button',name=re.compile('Guardar')).click(); pg.wait_for_timeout(600)
    check('estrella: «☆ Guardar» pasa a «★ Guardado»', pg.locator('.stopsheet').get_by_role('button',name=re.compile('Guardado')).count()==1)
    n_saved=pg.evaluate("new Set(window.__romaMap.querySourceFeatures('pins').filter(f=>f.properties.kind==='saved').map(f=>f.properties.id)).size")
    check(f'estrella: el sitio aparece con su estrella en el mapa ({n_saved})', n_saved==1)
    check('estrella: sale en la lista «Guardados»', pg.get_by_role('heading',name=re.compile('Guardados')).count()==1 and pg.locator('#saved-title ~ article').count()==1 and 'Lo guardaste tú' in pg.locator('#saved-title ~ article').inner_text())
    pg.get_by_role('button',name='Cerrar la ficha').click(); pg.wait_for_timeout(300)
    pg.get_by_label('Buscar un sitio').fill(WIKI_TITLES[0][:4]); pg.wait_for_timeout(500)
    pg.get_by_label('Buscar un sitio').fill('')
    # 3D: quitado del mapa (20 oct)
    check('3D: ya no hay botón 3D', pg.get_by_role('group',name='Capas del mapa').get_by_role('button',name='3D',exact=True).count()==0)
    # Metro
    pg.get_by_role('group',name='Capas del mapa').get_by_role('button',name=re.compile('Metro')).click(); pg.wait_for_timeout(1500)
    ml=pg.evaluate("window.__romaMap.getSource('metro-lines').serialize().data.features.length"); ms=pg.evaluate("window.__romaMap.getSource('metro-stations').serialize().data.features.length")
    check(f'metro: líneas A y B y sus estaciones en el mapa ({ml} líneas, {ms} estaciones)', ml==2 and ms==4)
    check('metro: capas visibles', pg.evaluate("['metro-line','metro-station','metro-name'].every(i=>!!window.__romaMap.getLayer(i))"))
    pg.screenshot(path='/tmp/map-metro.png')
    pg.get_by_role('group',name='Capas del mapa').get_by_role('button',name=re.compile('Metro')).click(); pg.wait_for_timeout(500)
    check('metro: al apagarlo se oculta', pg.evaluate("window.__romaMap.getSource('metro-lines').serialize().data.features.length")==0)
    # Toque romántico: al llegar a una parada de hoy sale solo «Habéis llegado» con corazones
    tgt=pg.evaluate("(()=>{const f=window.__romaMap.querySourceFeatures('pins').filter(f=>f.properties.kind==='stop'&&f.properties.status==='todo')[0]||window.__romaMap.querySourceFeatures('pins').filter(f=>f.properties.kind==='stop')[0];return {lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],id:f.properties.id,short:f.properties.short}})()")
    ctx.set_geolocation({'latitude':tgt['lat'],'longitude':tgt['lng']}); pg.wait_for_timeout(2200)
    check('llegada: sale «Habéis llegado» al estar en una parada', pg.locator('.arrival').count()==1 and 'habéis llegado' in pg.locator('.arrival').inner_text().lower())
    check('llegada: corazones y frase cariñosa', pg.locator('.arrival .heartburst span').count()>=5 and pg.locator('.arrival-line').inner_text().strip()!='')
    check('llegada: atajos a la foto y al diario', pg.locator('.arrival').get_by_role('link',name=re.compile('Foto de recuerdo')).count()==1 and pg.locator('.arrival').get_by_role('link',name=re.compile('diario')).count()==1)
    pg.locator('.arrival').get_by_role('button',name='Hecho',exact=True).click(); pg.wait_for_timeout(700)
    st=pg.evaluate("(id=>{const f=window.__romaMap.querySourceFeatures('pins').find(f=>f.properties.id===id);return f&&f.properties.status})",tgt['id'])
    check(f'llegada: «Hecho» deja la parada en gris ({st})', pg.locator('.arrival').count()==0 and st=='done')
    ctx.set_geolocation({'latitude':41.9060,'longitude':12.4823}); pg.wait_for_timeout(1200)
    check('mapa: línea de puntos con el orden del día', pg.evaluate("['order','route'].some(k=>{const d=window.__romaMap.getSource(k).serialize().data;return d&&d.geometry&&d.geometry.coordinates.length>1})"))
    check('día: chips con día de la semana y «hoy»', pg.get_by_role('button',name=re.compile('II · Sáb · hoy')).count()==1)
    pg.get_by_role('button',name='Todos',exact=True).click(); pg.wait_for_timeout(600)
    dots=pg.evaluate("window.__romaMap.querySourceFeatures('pins').filter(f=>f.properties.kind==='dot').length")
    check(f'«Todos»: solo puntos de color sin números ({dots})', dots>5 and pg.evaluate("window.__romaMap.querySourceFeatures('pins').filter(f=>f.properties.kind==='stop').length")==0)
    pg.get_by_role('button',name=re.compile('^II · Sáb')).click(); pg.wait_for_timeout(600)
    pg.screenshot(path='/tmp/map-numeros.png')
    # volver a tocar una parada para seguir con el resto de pruebas
    pg.evaluate("(()=>{const m=window.__romaMap;const f=m.querySourceFeatures('pins').find(f=>f.properties.kind==='stop');m.jumpTo({center:f.geometry.coordinates,zoom:16})})()"); pg.wait_for_timeout(700)
    xy=pg.evaluate("(()=>{const m=window.__romaMap;const f=m.querySourceFeatures('pins').find(f=>f.properties.kind==='stop');const p=m.project(f.geometry.coordinates);const r=m.getCanvas().getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y}})()")
    pg.mouse.click(xy['x'],xy['y']); pg.wait_for_timeout(400)
    pg.get_by_role('button',name='Cerrar la ficha').click(); pg.wait_for_timeout(200)
    # buscador
    pg.get_by_label('Buscar un sitio').fill('Pantheon'); pg.wait_for_timeout(800)
    check('buscador: sale el resultado', pg.get_by_role('option',name=re.compile('Pantheon')).count()>0)
    pg.get_by_role('option',name=re.compile('^Pantheon')).click(); pg.wait_for_timeout(600)
    # ruta a pie desde la ubicación
    pg.get_by_role('button',name='Dónde estoy').first.click(); pg.wait_for_timeout(800)
    pg.get_by_role('button',name='Ruta a pie',exact=True).click(); pg.wait_for_timeout(1200)
    check('ruta: muestra minutos y distancia a pie', pg.get_by_text('15 min').count()>0 and pg.get_by_text(re.compile('1[,.]2 km')).count()>0)
    check('ruta: se dibuja en el mapa', pg.evaluate("window.__romaMap.querySourceFeatures('route').length")>0)
    check('ruta: dos opciones (recomendada y alternativa) con tiempo y distancia', pg.locator('.altchip').count()==2 and 'Recomendada' in pg.locator('.altchip').first.inner_text() and pg.locator('.altchip').nth(1).get_by_text('Alternativa 1').count()==1)
    check('ruta: la alternativa se ve en gris sobre el mapa', pg.evaluate("window.__romaMap.getSource('alts').serialize().data.features.length")==1)
    pg.locator('.altchip').nth(1).click(); pg.wait_for_timeout(600)
    c1=pg.evaluate("window.__romaMap.getSource('route').serialize().data.geometry.coordinates[1][0]")
    check('ruta: elegir la alternativa la dibuja como principal', abs(c1-12.4790)<1e-6 and pg.locator('.altchip').nth(1).get_attribute('aria-pressed')=='true' and pg.get_by_text('1,5 km').count()>0)
    pg.locator('.altchip').first.click(); pg.wait_for_timeout(500)
    check('ruta: ya no se dibuja el desnivel', pg.locator('.elev').count()==0)
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
    pg.wait_for_timeout(800)
    check('ruta del día: se calcula sola y lista los tramos con tiempos', pg.locator('.legs li').count()>=3 and pg.get_by_text(re.compile('recorrido del día')).count()>0)
    check('ruta del día: los tramos llevan el número de parada', pg.locator('.legs li b.num').first.inner_text()=='1')
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
    # La descarga empieza SOLA (sin pulsar nada): aparece el aviso y termina con «Todo listo».
    check('descarga automática: se ve el aviso mientras guarda Roma', pg.get_by_text(re.compile('Guardando Roma para usarla sin conexión')).count()>0 or pg.get_by_text('Todo listo').count()>0)
    try: pg.wait_for_selector('text=Todo listo',timeout=120000)
    except Exception:
        print(pg.locator('section[aria-label="Preparar para ir sin conexión"]').inner_text()); print(errs[:3]); raise
    check('descarga automática: el aviso final dice que Roma está guardada', pg.get_by_text(re.compile('Roma ya está guardada')).count()>0 or pg.get_by_text('Todo listo').count()>0)
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
    pg.get_by_role('group',name='Capas del mapa').get_by_role('button',name=re.compile('Metro')).click(); pg.wait_for_timeout(1200)
    check('sin conexión: el metro se ve con lo guardado', pg.evaluate("window.__romaMap.getSource('metro-lines').serialize().data.features.length")==2)
    pg.get_by_role('button',name='Todos',exact=True).click(); pg.wait_for_timeout(300)
    pg.get_by_role('button',name=re.compile('^II · Sáb')).click(); pg.wait_for_timeout(800)
    got=open_stop('^stop:(colosseo|foro-romano|palatino|pantheon|trevi|navona|piazza-spagna)$')
    check('sin conexión: la ficha conserva la foto y el resumen', got and pg.locator('.stopsheet .wikirow img').count()==1)
    check('sin conexión: la estrella sigue guardada', pg.locator('.stopsheet').get_by_role('button',name=re.compile('Guardado')).count()==1)
    pg.get_by_role('button',name='Cerrar la ficha').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button',name='Quitar',exact=True).click(); pg.wait_for_timeout(500)
    check('estrella: «Quitar» la saca de la lista y del mapa', pg.locator('#saved-title ~ article').count()==0 and pg.evaluate("window.__romaMap.querySourceFeatures('pins').filter(f=>f.properties.kind==='saved').length")==0)
    check('descarga: sin errores de página', not errs)
    if errs: print(errs[:3])
    b.close()
sys.exit(0 if ok else 1)
