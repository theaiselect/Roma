"""e2e de las herramientas de «Más» y «Nosotros»: buscador de Más, Enseñar frase, progreso de maleta y monumentos,
gastos con saldado, comidas por día, retos sorpresa y compartir ubicación. Servidor e2e en :5199, recién arrancado: guarda estado entre ejecuciones."""
import re, sys
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:5199'; NOW='2026-10-31T13:00'; ok=True
def check(n,c):
    global ok; ok&=bool(c); print(('OK   ' if c else 'FALLA'),n)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':412,'height':900},is_mobile=True,has_touch=True,locale='es-ES',timezone_id='Europe/Madrid',permissions=['geolocation'],geolocation={'latitude':41.9,'longitude':12.48})
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog',lambda d:d.accept())
    pg.goto(f'{BASE}/?now={NOW}')
    pg.get_by_role('button',name='Jesús').click(); pg.get_by_placeholder(re.compile('aaaa')).fill('testtest')
    pg.get_by_role('button',name='Continuar').click(); pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name='Entrar igualmente').click()
    go=lambda r:(pg.goto(f'{BASE}{r}?now={NOW}'),pg.wait_for_timeout(500))
    # Más: buscador
    go('/mas'); pg.get_by_label('Buscar una herramienta').fill('gast'); pg.wait_for_timeout(200)
    check('Más: el buscador filtra', pg.locator('nav.menu a').count()==1 and pg.get_by_text('Gastos').count()>0)
    pg.get_by_label('Buscar una herramienta').fill('zzz'); pg.wait_for_timeout(200)
    check('Más: sin resultados lo dice', pg.get_by_text(re.compile('Nada con')).count()>0)
    # Frases: Enseñar
    go('/mas/frases'); pg.get_by_role('button',name='Enseñar').first.click(); pg.wait_for_timeout(200)
    check('Frases: «Enseñar» abre la frase en grande', pg.locator('.showcard p[lang=it]').count()==1)
    pg.locator('.showcard').click(); pg.wait_for_timeout(200)
    check('Frases: se cierra al tocar', pg.locator('.showcard').count()==0)
    pg.get_by_label('Buscar frase').fill('gracias'); pg.wait_for_timeout(200)
    check('Frases: la búsqueda filtra', pg.locator('.phrase').count()>=1 and pg.locator('.phrase').count()<5)
    # Carta: búsqueda
    go('/mas/carta'); pg.get_by_label('Buscar un plato').fill('carbonara'); pg.wait_for_timeout(200)
    check('Carta: busca un plato', pg.locator('.dish').count()>=1 and pg.get_by_text('Cacio e pepe').count()==0)
    # Maleta: progreso
    go('/mas/maleta'); pg.locator('table.checklist input[type=checkbox]').first.click(); pg.wait_for_timeout(900)
    check('Maleta: sube el contador de Jesús', '1/14' in pg.locator('.grid2').first.inner_text())
    # Monumentos
    go('/mas/monumentos'); pg.locator('input[type=checkbox]').nth(1).click(); pg.wait_for_timeout(400)
    check('Monumentos: cuenta 1 visto y barra', pg.get_by_text(re.compile('^1 de ')).count()>0 and pg.locator('.progress').count()>=1)
    pg.get_by_label('Solo los que faltan').check(); pg.wait_for_timeout(300)
    check('Monumentos: «solo los que faltan» oculta el marcado', pg.locator('li.leg input:checked').count()==0)
    # Gastos: saldar
    go('/mas/gastos'); pg.get_by_role('button',name=re.compile('Añadir gasto')).click()
    pg.get_by_label(re.compile('Importe')).fill('50'); pg.get_by_role('button',name='Guardar').click(); pg.wait_for_timeout(600)
    check('Gastos: deuda tras pagar yo 50 a medias', pg.get_by_text(re.compile('Lucía debe 25')).count()>0)
    check('Gastos: aparece «En qué os lo gastáis»', pg.get_by_text('En qué os lo gastáis').count()>0)
    pg.get_by_role('button',name='Marcar como saldado').click(); pg.wait_for_timeout(600)
    check('Gastos: saldado → «Estáis en paz» y el total sigue en 50 €', pg.get_by_text('Estáis en paz').count()>0 and pg.get_by_text(re.compile('Total gastado: 50')).count()>0)
    # Comidas por día
    go('/mas/comidas')
    check('Comidas: por defecto solo el día de hoy', pg.locator('h2', has_text=re.compile('^II ·')).count()==1 and pg.locator('h2', has_text=re.compile('^I ·')).count()==0)
    pg.get_by_role('button',name='Todos').click(); pg.wait_for_timeout(200)
    check('Comidas: «Todos» muestra los cinco días', pg.locator('section > h2').count()>=4)
    # Retos sorpresa
    go('/nosotros/fotos'); pg.get_by_role('button',name='Reto sorpresa').click(); pg.wait_for_timeout(500)
    check('Retos: el sorprendente se resalta', pg.locator('.reto.surprise').count()==1)
    # Emergencias / Transporte
    go('/mas/emergencias')
    check('Emergencias: botón de enviar ubicación y farmacias', pg.get_by_role('button',name='Enviar mi ubicación').count()==1 and pg.get_by_role('link',name=re.compile('Farmacias cerca')).count()==1)
    go('/mas/transporte')
    check('Transporte: «Volver al hotel» con metro y a pie', pg.get_by_role('link',name=re.compile('En metro o bus')).count()==1)
    check('sin errores de página', not errs)
    if errs: print(errs[:3])
    b.close()
sys.exit(0 if ok else 1)
