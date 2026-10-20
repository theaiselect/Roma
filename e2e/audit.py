"""Auditoría de criterios de aceptación visibles (documento de implementación). Servidor e2e en :5199."""
import re, sys
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:5199'
CASES=[
 ('F01 Hoy sábado 13:00 → Da Enzo al 29','2026-10-31T13:00','/',[r'Da Enzo al 29',r'(?i)15 min']),
 ('F01 antes del viaje → Faltan X días','2026-10-25T10:00','/',[r'Faltan \d+ días']),
 ('F04 domingo → Da Enzo cerrado (aviso «Hoy cierran»)','2026-11-01T11:00','/',[r'Hoy cierran',r'Da Enzo']),
 ('F04 sábado → Boccione (Shabbat)','2026-10-31T11:00','/',[r'Boccione.*Shabbat|Shabbat']),
 ('F08 aviso de atardecer 45 min antes (1 nov)','2026-11-01T16:30','/',[r'atardecer|Atardecer|sol se pone']),
 ('F12 QR 30 min antes (Vaticanos, 2 nov 07:35)','2026-11-02T07:35','/',[r'Vatican|QR|entrada']),
 ('F16 último metro domingo 23:00','2026-11-01T23:00','/',[r'metro cierra a las 23:30']),
 ('F35 noche anterior desde las 21:00','2026-10-31T21:30','/',[r'noche anterior|Esta noche|Antes de dormir|alarma']),
 ('F10 cuenta atrás Jesús (30 oct)','2026-10-30T08:00','/',[r'Lucía']),
 ('F21 Estoy perdido: dirección hotel','2026-10-31T13:00','/mas/emergencias',[r'Via Zucchelli 32',r'Barberini']),
 ('F32 Emergencias: 112 / consulado / TSE / DNI','2026-10-31T13:00','/mas/emergencias',[r'112',r'onsulado',r'Tarjeta Sanitaria',r'DNI']),
 ('F49 resumen final desde 3 nov','2026-11-03T10:00','/nosotros/libro',[r'km|Km',r'gelat|Gelat',r'onumentos']),
 ('F29 leyendas (audioguía y leyendas)','2026-10-31T13:00','/mas/audioguia',[r'Trevi',r'Boca de la Verdad']),
 ('F31 normas (escalinata, fuentes, centuriones)','2026-10-31T13:00','/mas/normas',[r'scalinata|España',r'uentes',r'enturion']),
 ('F25 presupuesto semáforo','2026-10-31T13:00','/mas/gastos',[r'200']),
 ('F36 copia de seguridad en Ajustes','2026-10-31T13:00','/mas/ajustes',[r'Exportar',r'Restaurar|Importar']),
 ('F50 Ajustes: oscuro, letra grande, sincronizar, borrar','2026-10-31T13:00','/mas/ajustes',[r'Noche|scuro',r'grande',r'incroniz',r'orrar']),
 ('F27 monumentos contador X de Y','2026-10-31T13:00','/mas/monumentos',[r'\d+ de \d+']),
 ('F40 retos de fotos','2026-10-31T13:00','/nosotros/fotos',[r'Gianicolo',r'cuchar']),
 ('F33 salud: hospital y farmacia','2026-10-31T13:00','/mas/emergencias',[r'Ospedale|ospital',r'armacia']),
 ('F22 punto de encuentro del día','2026-10-31T13:00','/plan/2',[r'encuentro']),
 ('F06 botón Llueve','2026-10-31T13:00','/plan/2',[r'Llueve|lluvia']),
 ('F07 tiempo (sin red: última previsión)','2026-10-31T13:00','/',[r'actualizado|tiempo|Tiempo|sin datos|Sin datos|Sin previsi|Previsi']),
 ('F09 calendario .ics','2026-10-31T13:00','/mas/calendario',[r'\.ics|Descargar|calendario']),
 ('F20 cerca de mí (filtros)','2026-10-31T13:00','/mapa',[r'armacia',r'asoni|uentes']),
 ('F18 mapa con calles (MapLibre/PMTiles)','2026-10-31T13:00','/mapa',[r'Buscar un sitio|Cerca de mí|Sin conexión']),
]
def onboard(pg,now):
    pg.goto(f'{BASE}/?now={now}')
    pg.get_by_placeholder(re.compile('aaaa')).fill('testtest'); pg.get_by_role('button',name='Continuar').click()
    pg.get_by_role('button',name='Ya está, seguir').click(); pg.get_by_role('button',name='Jesús').click(); pg.get_by_role('button',name='Entrar igualmente').click()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':412,'height':900},is_mobile=True,locale='es-ES',timezone_id='Europe/Madrid'); pg=ctx.new_page()
    onboard(pg,'2026-10-31T13:00')
    for name,now,route,pats in CASES:
        pg.goto(f'{BASE}{route}?now={now}'); pg.wait_for_timeout(900)
        t=pg.inner_text('body')
        miss=[x for x in pats if not re.search(x,t,re.S)]
        print(('OK    ' if not miss else 'FALTA ')+name+('' if not miss else '  ← '+', '.join(miss)))
    b.close()
