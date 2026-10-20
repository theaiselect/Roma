"""e2e de las pantallas mejoradas: reservas (resumen, orden, nota, visor de entradas), plan (casilla «hecho», entrada),
diario (no pierde lo escrito al cambiar de día), cartas (editar), votos (día futuro), canciones de los dos,
postal (vista previa automática), libro (archivo) y ajustes (probar conexión). Servidor e2e en :5199 RECIÉN ARRANCADO."""
import re, sys, struct, zlib, tempfile, os
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:5199'; NOW='2026-10-31T13:00'; ok=True
def check(n,c):
    global ok; ok&=bool(c); print(('OK   ' if c else 'FALLA'),n)
def png(path,w=64,h=48,rgb=(192,88,58)):
    raw=b''.join(b'\x00'+bytes(rgb)*w for _ in range(h))
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))
def pdf(path):
    open(path,'wb').write(b'%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
tmp=tempfile.mkdtemp(); PNG=os.path.join(tmp,'entrada.png'); PDF=os.path.join(tmp,'entrada.pdf'); png(PNG); pdf(PDF)

def phone(b,who,now=NOW):
    ctx=b.new_context(viewport={'width':400,'height':860},is_mobile=True,has_touch=True,locale='es-ES',timezone_id='Europe/Madrid',accept_downloads=True)
    pg=ctx.new_page(); pg.on('dialog',lambda d:d.accept())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'{BASE}/?now={now}')
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.get_by_role('button',name='Continuar').click()
    pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name=who).click(); pg.get_by_role('button',name='Entrar igualmente').click()
    pg.wait_for_timeout(300)
    return ctx,pg,errs
def sync(pg):
    pg.evaluate("window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(2500)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    _,j,errs=phone(b,'Jesús'); _,l,_=phone(b,'Lucía')
    go=lambda pg,r:(pg.goto(f'{BASE}{r}?now={NOW}'),pg.wait_for_timeout(700))

    # ── Reservas ──
    go(j,'/mas/reservas')
    check('reservas: resumen arriba', j.get_by_text(re.compile(r'Quedan \d+ cosas por hacer')).count()==1)
    check('reservas: grupos Por hacer y Hechas', j.get_by_role('heading',name=re.compile('^Por hacer')).count()==1 and j.get_by_role('heading',name=re.compile('^Hechas')).count()==1)
    check('reservas: el hotel figura como comprado', j.get_by_role('heading',name='Hotel Soha Piazza di Spagna').count()==1)
    n0=j.get_by_role('button',name='Ya está hecho').count()
    j.get_by_role('button',name='Ya está hecho').first.click(); j.wait_for_timeout(500)
    check('reservas: «Ya está hecho» la pasa a Hechas', j.get_by_role('button',name='Ya está hecho').count()==n0-1)
    j.get_by_label(re.compile('nota de la reserva vaticani')).fill('LOC123'); j.get_by_label(re.compile('nota de la reserva vaticani')).blur(); j.wait_for_timeout(500)
    go(j,'/mas/reservas')
    check('reservas: la nota se guarda', j.get_by_label(re.compile('nota de la reserva vaticani')).input_value()=='LOC123')
    pan=j.locator('article',has=j.get_by_role('heading',name='Panteón'))
    pan.locator('input[type=file]').set_input_files([PNG,PDF]); pan.get_by_role('button',name='entrada.pdf',exact=True).wait_for(timeout=10000); pan.get_by_role('button',name='entrada.png',exact=True).wait_for(timeout=10000); j.wait_for_timeout(300)
    pan.get_by_role('button',name='entrada.png',exact=True).click(); j.wait_for_timeout(600)
    check('visor: se abre la entrada a pantalla completa', j.get_by_role('dialog').count()==1 and j.locator('.ticketview-img').count()==1)
    check('visor: indica la posición «de 2»', j.get_by_text(re.compile('[12] de 2')).count()>=1)
    if 'entrada.pdf' not in j.locator('.ticketview-bar').first.inner_text():
        nav=j.get_by_role('button',name=re.compile('Siguiente'))
        (nav if nav.is_enabled() else j.get_by_role('button',name=re.compile('Anterior'))).click(); j.wait_for_timeout(2500)
    # El PDF se enseña como imagen de sus páginas (pdf.js); si no se pudiera, con el visor del navegador.
    check('visor: pasar a la otra entrada enseña el PDF', 'entrada.pdf' in j.locator('.ticketview-bar').first.inner_text() and (j.locator('.ticketview-img').count()>=1 or j.locator('.ticketview-pdf').count()==1))
    j.get_by_role('button',name=re.compile('Cerrar')).click(); j.wait_for_timeout(200)
    check('visor: se cierra', j.get_by_role('dialog').count()==0)
    sync(j); go(l,'/mas/reservas'); sync(l); l.wait_for_timeout(800)
    check('reservas: Lucía ve la entrada y el estado', l.locator('article',has=l.get_by_role('heading',name='Panteón')).get_by_role('button',name='entrada.png',exact=True).count()==1 and l.get_by_label(re.compile('nota de la reserva vaticani')).input_value()=='LOC123')

    # ── Plan ──
    go(j,'/plan/2')
    check('plan: resumen del día con barra', j.get_by_role('progressbar',name='Paradas hechas').count()==1)
    check('plan: tiempo del día', j.get_by_label('Tiempo y atardecer').count()==1)
    check('plan: la parada del Coliseo enseña el estado de su entrada', j.locator('a.chip[href="/mas/reservas"]').count()>=1)
    before=j.locator('.daytabs').count()
    boxes=j.locator('input.stopcheck'); boxes.first.check(); j.wait_for_timeout(500)
    check('plan: la casilla «hecho» queda marcada y sube el contador', boxes.first.is_checked() and j.get_by_text(re.compile(r'^1/\d+$')).count()==1)
    go(j,'/plan/2'); check('plan: lo hecho se conserva al recargar', j.locator('input.stopcheck').first.is_checked())
    check('plan: botones de día anterior y siguiente', j.get_by_role('link',name=re.compile(r'^\s*I\s*$')).count()>=1 or j.locator('a[href="/plan/1"]').count()>=2)

    # ── Diario: no se pierde lo escrito al cambiar de día enseguida ──
    go(j,'/nosotros/diario')
    j.get_by_label('Tu diario de hoy').fill('Hoy vimos el Coliseo')
    j.get_by_role('button',name=re.compile('Viernes 30')).click(); j.wait_for_timeout(300)
    j.get_by_role('button',name=re.compile('Sábado 31')).click(); j.wait_for_timeout(500)
    check('diario: el texto sigue ahí tras cambiar de día al instante', j.get_by_label('Tu diario de hoy').input_value()=='Hoy vimos el Coliseo')
    check('diario: el día marca que uno ha escrito', j.get_by_role('button',name=re.compile('Sábado 31.*escrito por uno')).count()==1)
    sync(j); go(l,'/nosotros/diario'); sync(l); l.wait_for_timeout(600)
    check('diario: Lucía lo lee en su móvil', l.get_by_text('Hoy vimos el Coliseo').count()>=1)

    # ── Cartas: editar antes de que se abra ──
    go(j,'/nosotros/cartas'); j.get_by_role('button',name='Escribir una carta').click()
    j.get_by_label('Carta',exact=True).fill('Primera versión'); j.get_by_role('button',name='A una hora').click()
    j.locator('input[type=datetime-local]').fill('2026-12-24T10:00'); j.get_by_role('button',name='Guardar carta').click(); j.wait_for_timeout(500)
    check('cartas: aparece como cerrada con «Editar»', j.get_by_role('button',name='Editar').count()==1 and j.get_by_text('Cerrada').count()>=1)
    j.get_by_role('button',name='Editar').click(); j.wait_for_timeout(300)
    check('cartas: al editar se ve el texto', j.get_by_label('Carta',exact=True).input_value()=='Primera versión')
    j.get_by_label('Carta',exact=True).fill('Segunda versión'); j.get_by_role('button',name='Guardar cambios').click(); j.wait_for_timeout(500)
    j.get_by_role('button',name='Editar').click(); j.wait_for_timeout(300)
    check('cartas: el cambio queda guardado y no se duplica', j.get_by_label('Carta',exact=True).input_value()=='Segunda versión')
    j.get_by_role('button',name='Cancelar').click(); j.wait_for_timeout(200)
    check('cartas: sigue habiendo una sola carta mía', j.get_by_role('button',name='Editar').count()==1)

    # ── Votos: el mejor momento de un día futuro no se puede votar ──
    go(j,'/nosotros/votos'); j.get_by_role('button',name='V',exact=True).click(); j.wait_for_timeout(300)
    check('votos: día futuro avisa y bloquea', j.get_by_text('Se vota cuando empiece este día.').count()==1)
    j.get_by_role('button',name='II',exact=True).click(); j.wait_for_timeout(300)
    check('votos: el día de hoy se puede votar', j.get_by_text('Se vota cuando empiece este día.').count()==0)

    # ── Canciones: cada uno la suya ──
    go(l,'/nosotros/cancion'); l.get_by_role('button',name='Elegir').nth(1).click()
    l.get_by_label('Título').fill('Cancion de Lucia'); l.get_by_label('Artista').fill('Ella'); l.get_by_label('Enlace').fill('no vale'); 
    check('canción: avisa de un enlace que no vale', l.get_by_text(re.compile('no vale: tiene que empezar')).count()==1)
    l.get_by_role('button',name='Guardar').click(); l.wait_for_timeout(500); sync(l)
    go(j,'/nosotros/cancion'); j.get_by_role('button',name='Elegir').nth(1).click()
    j.get_by_label('Título').fill('Cancion de Jesus'); j.get_by_label('Artista').fill('El'); j.get_by_label('Enlace').fill('https://open.spotify.com/track/abc')
    j.get_by_role('button',name='Guardar').click(); j.wait_for_timeout(500); sync(j); j.wait_for_timeout(500)
    check('canción: Jesús ve la suya y la de Lucía a la vez', j.get_by_text('Cancion de Jesus').count()==1 and j.get_by_text('Cancion de Lucia').count()==1 and j.get_by_text('(la tuya)').count()>=1 and j.get_by_text('(la de Lucía)').count()==1)
    check('canción: el enlace de Spotify tiene botón y la otra se busca', j.get_by_role('link',name='Abrir en Spotify').count()==1 and j.get_by_role('link',name='Buscar en Spotify').count()>=1)

    # ── Postal: la vista previa sale sola ──
    go(j,'/nosotros/postal')
    j.locator('label:has-text("Usar una foto del móvil") input[type=file]').set_input_files(PNG); j.wait_for_timeout(1500)
    check('postal: vista previa automática al elegir foto', j.get_by_alt_text('Vista previa de la postal').count()==1)
    src1=j.get_by_alt_text('Vista previa de la postal').get_attribute('src')
    j.get_by_label('Texto de la postal').fill('Desde Roma con amor'); j.wait_for_timeout(1200)
    j.get_by_role('button',name='Noche').click(); j.wait_for_timeout(1200)
    src2=j.get_by_alt_text('Vista previa de la postal').get_attribute('src')
    check('postal: cambia al escribir y al cambiar de estilo', src1!=src2 and j.get_by_text('19 / 180').count()==1)

    # ── Libro: archivo ──
    go(j,'/nosotros/libro')
    check('libro: el resumen se enseña aunque el viaje no haya acabado', j.get_by_text('Resumen hasta ahora').count()==1)
    with j.expect_download(timeout=20000) as dl:
        j.get_by_role('button',name=re.compile('Guardar el libro')).click()
    path=dl.value.path(); html=open(path,encoding='utf-8').read()
    check('libro: se descarga un archivo con el diario y la canción', 'Hoy vimos el Coliseo' in html and 'Cancion de Jesus' in html and html.startswith('<!doctype html>'))

    # ── Ajustes ──
    go(j,'/mas/ajustes'); j.get_by_role('button',name='Probar conexión y código').click(); j.wait_for_timeout(1500)
    check('ajustes: prueba de conexión correcta', j.get_by_text(re.compile('código es correcto')).count()==1)
    j.get_by_label('Mostrar el código').check(); j.wait_for_timeout(200)
    check('ajustes: «Mostrar el código» lo enseña', j.get_by_label('Código del viaje').get_attribute('type')=='text')
    j.get_by_role('button',name='Buscar versión nueva').click(); j.wait_for_timeout(1500)
    check('ajustes: «Buscar versión nueva» contesta', j.get_by_text(re.compile('última versión|no permite|No se ha podido|versión nueva: pulsa')).count()>=1)
    check('ajustes: está la descarga sin conexión', j.get_by_role('heading',name='Sin conexión').count()==1)

    check('sin errores de JavaScript', not errs)
    if errs: print(errs)
    b.close()
sys.exit(0 if ok else 1)
