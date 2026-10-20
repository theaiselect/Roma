"""e2e de las mejoras de la fase 5: aviso de reservas, previsión del viaje, plan de lluvia sugerido,
recordatorio de copia, emergencias (hotel y ficha) y frases favoritas. Servidor e2e en :5199 recién arrancado."""
import re, sys, json
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:5199'; ok=True
def check(n,c):
    global ok; ok&=bool(c); print(('OK   ' if c else 'FALLA'),n)

DATES=['2026-10-%02d'%d for d in range(20,32)]+['2026-11-%02d'%d for d in range(1,5)]
def forecast():
    n=len(DATES)
    code=[63 if d=='2026-10-31' else 1 for d in DATES]
    prob=[80 if d=='2026-10-31' else 10 for d in DATES]
    return json.dumps({'daily':{'time':DATES,'weather_code':code,'temperature_2m_max':[19]*n,'temperature_2m_min':[10]*n,'precipitation_probability_max':prob}})

def phone(b,who,now):
    ctx=b.new_context(viewport={'width':400,'height':860},is_mobile=True,has_touch=True,locale='es-ES',timezone_id='Europe/Madrid',accept_downloads=True)
    ctx.route(re.compile(r'api\.open-meteo\.com'),lambda r:r.fulfill(status=200,content_type='application/json',body=forecast()))
    pg=ctx.new_page(); pg.on('dialog',lambda d:d.accept())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'{BASE}/?now={now}')
    pg.get_by_role('button',name=who).click(); pg.get_by_placeholder(re.compile('aaaa')).fill('testtest')
    pg.get_by_role('button',name='Continuar').click(); pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name='Entrar igualmente').click()
    pg.wait_for_timeout(400)
    return ctx,pg,errs

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    # ── Antes del viaje: reservas pendientes y previsión ──
    _,j,errs=phone(b,'Jesús','2026-10-29T12:00')
    j.goto(f'{BASE}/?now=2026-10-29T12:00'); j.wait_for_timeout(1200)
    check('hoy: avisa de las reservas por hacer', j.get_by_text(re.compile(r'Quedan \d+ reservas por hacer')).count()==1)
    check('hoy: lo más urgente (Coliseo, sábado) sale en la lista con «en 2 días»', j.get_by_label('Reservas por hacer').get_by_text('en 2 días').count()>=1)
    check('hoy: previsión de los cinco días del viaje', j.get_by_label('Previsión del viaje').locator('a').count()==5)
    check('hoy: el sábado se marca con lluvia 80 %', j.get_by_label('Previsión del viaje').get_by_text('lluvia 80 %').count()==1)
    # marcar como hechas todas: el aviso desaparece
    j.goto(f'{BASE}/mas/reservas?now=2026-10-29T12:00'); j.wait_for_timeout(600)
    while j.get_by_role('button',name='Ya está hecho').count(): j.get_by_role('button',name='Ya está hecho').first.click(); j.wait_for_timeout(250)
    j.goto(f'{BASE}/?now=2026-10-29T12:00'); j.wait_for_timeout(800)
    check('hoy: sin reservas pendientes desaparece el aviso', j.get_by_label('Reservas por hacer').count()==0)

    # ── Plan de lluvia sugerido (sábado 31) ──
    j.goto(f'{BASE}/plan/2?now=2026-10-31T09:00'); j.wait_for_timeout(1200)
    check('plan: la previsión de lluvia propone el plan', j.get_by_role('button',name='Activar plan de lluvia').count()>=1)
    j.get_by_role('button',name='Activar plan de lluvia').first.click(); j.wait_for_timeout(600)
    check('plan: al activarlo desaparece la sugerencia y queda activo', j.get_by_role('button',name='Activar plan de lluvia').count()==0 and j.get_by_text('Plan de lluvia activado').count()>=1)
    j.goto(f'{BASE}/plan/1?now=2026-10-30T09:00'); j.wait_for_timeout(900)
    check('plan: un día sin lluvia no sugiere nada', j.get_by_role('button',name='Activar plan de lluvia').count()==0)

    # ── Recordatorio de copia ──
    j.goto(f'{BASE}/nosotros/diario?now=2026-11-03T09:00'); j.wait_for_timeout(700)
    j.get_by_label('Tu diario de hoy').fill('Última mañana en Roma'); j.get_by_label('Tu diario de hoy').blur(); j.wait_for_timeout(600)
    j.goto(f'{BASE}/?now=2026-11-03T10:00'); j.wait_for_timeout(900)
    check('copia: el día de la vuelta avisa de guardar una copia', j.get_by_text(re.compile('Antes de volver, guarda una copia')).count()==1)
    j.get_by_role('link',name='Guardar copia').click(); j.wait_for_timeout(700)
    check('copia: el aviso lleva a Ajustes y dice que no hay copia', j.get_by_text('Todavía no has guardado ninguna copia en este móvil.').count()==1)
    with j.expect_download(timeout=20000) as dl:
        j.get_by_role('button',name='Exportar copia').click()
    check('copia: se descarga el archivo', dl.value.suggested_filename.startswith('roma-copia-'))
    j.wait_for_timeout(500)
    check('copia: Ajustes enseña la fecha de la última copia', j.get_by_text(re.compile('Última copia guardada')).count()==1)
    j.goto(f'{BASE}/?now=2026-11-03T10:00'); j.wait_for_timeout(900)
    check('copia: con copia reciente el aviso desaparece', j.get_by_text(re.compile('guarda una copia')).count()==0)

    # ── Emergencias ──
    j.goto(f'{BASE}/mas/emergencias'); j.wait_for_timeout(600)
    j.get_by_role('button',name='Enseñar al taxista').click(); j.wait_for_timeout(300)
    check('emergencias: la dirección del hotel sale en grande', j.get_by_role('dialog').get_by_text('Via Zucchelli 32, Roma',exact=True).count()==1)
    j.get_by_role('dialog').get_by_role('button',name='Cerrar').click(); j.wait_for_timeout(200)
    j.get_by_role('button',name='Rellenar').click()
    j.get_by_label('Grupo sanguíneo').fill('A+'); j.get_by_label('Contacto de emergencia').fill('Madre 600000000')
    j.get_by_role('button',name='Guardar en este móvil').click(); j.wait_for_timeout(300)
    check('emergencias: la ficha se guarda', j.get_by_text('A+').count()==1 and j.get_by_text('Madre 600000000').count()==1)
    j.reload(); j.wait_for_timeout(900)
    check('emergencias: la ficha sigue tras recargar', j.get_by_text('Madre 600000000').count()==1)
    # Lucía no ve la ficha de Jesús (solo local)
    _,l,_=phone(b,'Lucía','2026-10-30T12:00')
    l.goto(f'{BASE}/mas/emergencias'); l.wait_for_timeout(700)
    check('emergencias: la ficha no se comparte con el otro móvil', l.get_by_text('Madre 600000000').count()==0 and l.get_by_role('button',name='Rellenar').count()==1)

    # ── Frases favoritas ──
    j.goto(f'{BASE}/mas/frases'); j.wait_for_timeout(600)
    check('frases: existe el grupo Hotel y taxi', j.get_by_role('heading',name='Hotel y taxi').count()==1)
    j.get_by_role('button',name=re.compile('Guardar como favorita: ¿Puede llamarnos un taxi')).click(); j.wait_for_timeout(300)
    check('frases: aparece la sección Favoritas', j.get_by_role('heading',name='Favoritas').count()==1)
    j.reload(); j.wait_for_timeout(800)
    check('frases: la favorita sigue tras recargar', j.get_by_label('Favoritas').get_by_text('Può chiamarci un taxi, per favore?').count()==1)
    j.get_by_label('Favoritas').get_by_role('button',name='Enseñar').click(); j.wait_for_timeout(300)
    check('frases: «Enseñar» abre la pantalla grande', j.get_by_role('dialog').get_by_text('Può chiamarci un taxi, per favore?').count()==1)

    check('sin errores de JavaScript', not errs)
    if errs: print(errs)
    b.close()
sys.exit(0 if ok else 1)
