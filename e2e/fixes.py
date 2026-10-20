"""e2e de los arreglos de la revisión: reserva privada, archivos que no bloquean, PDF como imagen, regalos privados,
punto de encuentro por día, modo día de viaje, «Estoy perdido». Servidor e2e recién arrancado en :5199."""
import re, sys, json
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:5199'; NOW='2026-10-31T13:00'; fails=[]
def check(n,ok):
    print(('OK   ' if ok else 'FALLA ')+n)
    if not ok: fails.append(n)

def pdf_bytes():
    # PDF mínimo de una página con un texto (sin dependencias)
    stream=b"BT /F1 48 Tf 72 700 Td (ENTRADA QR 1234) Tj ET"
    objs=[b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
          b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
          b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out=b"%PDF-1.4\n"; offs=[]
    for i,o in enumerate(objs):
        offs.append(len(out)); out+=b"%d 0 obj\n" % (i+1) + o + b"\nendobj\n"
    x=len(out)
    out+=b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs)+1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    out+=b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs)+1, x)
    return out

def phone(b, who):
    ctx=b.new_context(viewport={'width':400,'height':860},is_mobile=True,has_touch=True,locale='es-ES',timezone_id='Europe/Madrid')
    pg=ctx.new_page(); pg.goto(f'{BASE}/?now={NOW}')
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.get_by_role('button',name='Continuar').click()
    pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name=who).click(); pg.get_by_role('button',name='Entrar igualmente').click()
    pg.wait_for_timeout(800); return ctx,pg
def sync(pg): pg.evaluate("window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(2000)
def go(pg,path): pg.goto(f'{BASE}{path}?now={NOW}'); pg.wait_for_timeout(900)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    cj,j=phone(b,'Jesús'); errs=[]; j.on('pageerror',lambda e:errs.append(str(e)))
    sync(j)
    # 3 · reserva y PIN llegan con la contraseña (no están en la app)
    go(j,'/mas/emergencias'); j.wait_for_timeout(600)
    check('reserva: Emergencias enseña la reserva y el PIN tras sincronizar', bool(re.search(r'5044007987', j.inner_text('main'))) and 'PIN' in j.inner_text('main'))
    js=j.evaluate("(async()=>{const r=await fetch('/src/data/emergency.ts');return await r.text()})()")
    check('reserva: el código de la app ya no lleva la reserva', '5044007987' not in js and '5702' not in js)
    # 9/19 · nombre del otro y compartir en dos toques
    j.context.grant_permissions(['geolocation']); j.context.set_geolocation({'latitude':41.9,'longitude':12.49})
    go(j,'/')
    btn=j.get_by_role('button',name=re.compile('Estoy perdido'))
    box=btn.bounding_box(); j.mouse.move(box['x']+10,box['y']+10); j.mouse.down(); j.wait_for_timeout(1300); j.mouse.up(); j.wait_for_timeout(1500)
    sheet=j.get_by_role('dialog',name='Estoy perdido')
    check('perdido: busca la ubicación sola y deja listo «Enviar ahora a Lucía»', sheet.get_by_role('button',name=re.compile('Enviar ahora a Lucía')).count()+sheet.get_by_role('link',name=re.compile('Enviar ahora a Lucía')).count()==1)
    check('perdido: ya no pone «a Lucía» fijo en el botón de buscar', sheet.get_by_text('Enviar mi ubicación a Lucía').count()<=1)
    sheet.get_by_role('button',name='Cerrar').click()
    # 2 · un archivo que el servidor no acepta no bloquea nada
    r=j.evaluate("""(async()=>{
      const db=await import('/src/lib/db.ts'); const sync=await import('/src/lib/sync.ts');
      const id=await db.putBlob(new Blob(['<p>raro</p>'],{type:'text/html'}));
      await db.save({kind:'ticket',reservationId:'colosseo',blobId:id,mime:'text/html',name:'raro.html'});
      await db.save({kind:'expense',amountCents:1234,paidBy:'jesus',split:{jesus:617,lucia:617},category:'otros',day:2,note:'Prueba bloqueo'});
      await sync.requestSync(true);
      const d=await db.db(); const row=await d.get('blobs',id);
      return {outbox: await db.outboxSize(), err: row && row.uploadError};
    })()""")
    check('archivo raro: se marca como no compartido y la cola de cambios se vacía', r['outbox']==0 and r['err']=='bad_type')
    go(j,'/mas/reservas')
    check('archivo raro: la entrada avisa de que no se ha podido compartir', j.get_by_text(re.compile('No se ha podido compartir con el otro móvil')).count()>=1)
    # 7 · PDF → páginas como imagen
    open('/tmp/entrada-test.pdf','wb').write(pdf_bytes())
    card=j.locator('article',has=j.get_by_role('heading',name=re.compile('Coliseo')))
    card.locator('input[type=file]').first.set_input_files('/tmp/entrada-test.pdf'); j.wait_for_timeout(4000)
    t=j.evaluate("(async()=>{const db=await import('/src/lib/db.ts');const l=await db.listKind('ticket');const x=l.find(t=>t.name==='entrada-test.pdf');return x?{pages:(x.pageBlobIds||[]).length}:null})()")
    check('PDF: al añadirlo se guardan sus páginas como imagen', bool(t) and t['pages']==1)
    card.get_by_role('button',name='entrada-test.pdf',exact=True).click(); j.wait_for_timeout(1500)
    check('PDF: el visor lo enseña como imagen (no depende del visor del móvil)', j.locator('.ticketview img.ticketview-img').count()==1)
    j.get_by_role('button',name='Cerrar').first.click()
    # 12 · regalos privados
    go(j,'/mas/regalos')
    j.get_by_label('Para quién').fill('Lucía'); j.get_by_label('Qué').fill('Pendientes sorpresa'); j.get_by_role('button',name=re.compile('Añadir')).click(); j.wait_for_timeout(300)
    j.get_by_label('Para quién').fill('Mamá'); j.get_by_label('Qué').fill('Imán compartido'); j.get_by_text(re.compile('Que lo vea también Lucía')).click(); j.get_by_role('button',name=re.compile('Añadir')).click(); j.wait_for_timeout(300)
    sync(j)
    # 30 · punto de encuentro por día
    go(j,'/plan/2'); j.get_by_role('button',name='Cambiar').first.click(); j.get_by_label('Nuevo punto de encuentro').fill('La fuente de prueba'); j.get_by_role('button',name='Fijar').click(); j.wait_for_timeout(400)
    go(j,'/plan/3')
    check('encuentro: cambiar el del sábado no cambia el del domingo', j.get_by_text('La fuente de prueba').count()==0 and j.get_by_text(re.compile("Castel Sant'Angelo")).count()>=1)
    go(j,'/plan/2')
    check('encuentro: el sábado sí tiene el nuevo', j.get_by_text('La fuente de prueba').count()>=1)
    # 17 · modo día de viaje: el martes no cuenta las casillas del viernes
    go(j,'/plan/1')
    tm=j.get_by_role('region',name='Modo día de viaje') if j.get_by_role('region',name='Modo día de viaje').count() else j.locator('section',has=j.get_by_role('heading',name='Modo día de viaje'))
    for cb in tm.locator('input[type=checkbox]').all(): cb.check(); j.wait_for_timeout(120)
    go(j,'/plan/5')
    tm5=j.locator('section',has=j.get_by_role('heading',name='Modo día de viaje'))
    check('modo viaje: el día 5 empieza en 0 aunque el día 1 esté todo hecho', bool(re.search(r'\b0/\d+', tm5.inner_text())))
    sync(j)
    # Lucía
    cl,l=phone(b,'Lucía'); sync(l)
    go(l,'/mas/regalos')
    check('regalos: Lucía no ve el regalo sorpresa de Jesús', l.get_by_text('Pendientes sorpresa').count()==0)
    check('regalos: Lucía sí ve el compartido', l.get_by_text('Imán compartido').count()==1)
    go(l,'/mas/reservas'); l.wait_for_timeout(800)
    lc=l.locator('article',has=l.get_by_role('heading',name=re.compile('Coliseo')))
    lc.get_by_role('button',name='entrada-test.pdf',exact=True).click(); l.wait_for_timeout(2500)
    check('PDF: a Lucía le llegan las páginas y se ven como imagen', l.locator('.ticketview img.ticketview-img').count()==1)
    l.get_by_role('button',name='Cerrar').first.click()
    go(l,'/mas/gastos')
    check('archivo raro: el gasto de Jesús sí llegó a Lucía', l.get_by_text(re.compile('Prueba bloqueo')).count()==1)
    # 23 · borrar la foto de una entrada borra su archivo en los dos móviles
    go(j,'/mas/reservas'); j.on('dialog',lambda d:d.accept())
    jc=j.locator('article',has=j.get_by_role('heading',name=re.compile('Coliseo')))
    jc.get_by_role('button',name='Quitar entrada-test.pdf').click(); j.wait_for_timeout(500); sync(j); sync(j)
    gone=j.evaluate("(async()=>{const db=await import('/src/lib/db.ts');const l=await db.listKind('ticket',true);const x=l.find(t=>t.name==='entrada-test.pdf');const d=await db.db();return x?!(await d.get('blobs',x.blobId)):false})()")
    check('borrado: el PDF quitado ya no ocupa sitio en el móvil', gone)
    check('sin errores de página', not errs)
    b.close()
sys.exit(1 if fails else 0)
