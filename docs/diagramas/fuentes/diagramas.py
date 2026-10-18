"""Genera los diagramas estructurales de Plumb como SVG con posiciones fijas.

Uso: python diagramas.py <carpeta_salida>
Los diagramas de secuencia se generan aparte con PlantUML (archivos .puml).
"""
import math
import os
import sys
from xml.sax.saxutils import escape

TINTA = '#1C2470'
TINTA_SUAVE = '#4A5394'
CANARIO = '#FFE14D'
CANARIO_CLARO = '#FFF4B8'
ROSA_CLARO = '#FDE8EC'
FOLIO = '#D0202E'
PAUTA = '#CDD5EE'
MESA = '#EEF1F8'
VERDE = '#13795B'
VERDE_CLARO = '#DCF2E9'
AZUL_CLARO = '#DFE5FB'
FUENTE = "Archivo, 'Archivo Variable', sans-serif"
MONO = "'IBM Plex Mono', monospace"

# Medición de texto con las métricas reales de Archivo (si está instalada).
_metricas = {}


def _cargar(peso):
    if peso in _metricas:
        return _metricas[peso]
    nombre = {400: 'Archivo-Regular.ttf', 500: 'Archivo-Medium.ttf', 600: 'Archivo-SemiBold.ttf', 700: 'Archivo-Bold.ttf', 800: 'Archivo-ExtraBold.ttf'}[peso]
    ruta = os.path.expanduser(f'~/.local/share/fonts/plumb/{nombre}')
    try:
        from fontTools.ttLib import TTFont
        f = TTFont(ruta)
        _metricas[peso] = (f.getBestCmap(), f['hmtx'].metrics, f['head'].unitsPerEm)
    except Exception:
        _metricas[peso] = None
    return _metricas[peso]


def ancho(texto, tam, peso=400):
    m = _cargar(peso)
    if not m:
        return len(texto) * tam * 0.56
    cmap, hmtx, upm = m
    total = sum(hmtx.get(cmap.get(ord(c), '.notdef'), (upm * 0.5, 0))[0] for c in texto)
    return total * tam / upm


class Lienzo:
    def __init__(self, ancho_px, alto_px, titulo):
        self.w, self.h, self.titulo = ancho_px, alto_px, titulo
        self.capas = {'fondo': [], 'lineas': [], 'formas': [], 'textos': []}

    def add(self, capa, svg):
        self.capas[capa].append(svg)

    def texto(self, x, y, contenido, tam=16, peso=400, color=TINTA, anclaje='middle', familia=FUENTE,
              subrayado=False, cursiva=False, capa='textos'):
        deco = ' text-decoration="underline"' if subrayado else ''
        estilo = ' font-style="italic"' if cursiva else ''
        self.add(capa, f'<text x="{x:.1f}" y="{y:.1f}" font-family="{familia}" font-size="{tam}" font-weight="{peso}" '
                 f'fill="{color}" text-anchor="{anclaje}" dominant-baseline="middle"{deco}{estilo}>{escape(contenido)}</text>')

    def svg(self):
        defs = f'''<defs>
  <marker id="flecha" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
    <path d="M1 1 L11 6 L1 11" fill="none" stroke="{TINTA}" stroke-width="1.6"/>
  </marker>
  <marker id="flecha-llena" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse">
    <path d="M0 0 L12 6 L0 12 z" fill="{TINTA}"/>
  </marker>
  <marker id="generalizacion" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="20" markerHeight="20" orient="auto-start-reverse">
    <path d="M1 1 L19 10 L1 19 z" fill="#FFFFFF" stroke="{TINTA}" stroke-width="1.6"/>
  </marker>
</defs>'''
        cuerpo = '\n'.join(self.capas['fondo'] + self.capas['lineas'] + self.capas['formas'] + self.capas['textos'])
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">\n'
                f'<title>{escape(self.titulo)}</title>\n{defs}\n<rect width="100%" height="100%" fill="#FFFFFF"/>\n{cuerpo}\n</svg>\n')


def borde_elipse(cx, cy, rx, ry, hacia_x, hacia_y):
    dx, dy = hacia_x - cx, hacia_y - cy
    if dx == 0 and dy == 0:
        return cx, cy
    t = 1 / math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
    return cx + dx * t, cy + dy * t


def borde_rect(cx, cy, w, h, hacia_x, hacia_y):
    dx, dy = hacia_x - cx, hacia_y - cy
    if dx == 0 and dy == 0:
        return cx, cy
    sx = (w / 2) / abs(dx) if dx else math.inf
    sy = (h / 2) / abs(dy) if dy else math.inf
    s = min(sx, sy)
    return cx + dx * s, cy + dy * s


def borde_rombo(cx, cy, w, h, hacia_x, hacia_y):
    dx, dy = hacia_x - cx, hacia_y - cy
    if dx == 0 and dy == 0:
        return cx, cy
    s = 1 / (abs(dx) / (w / 2) + abs(dy) / (h / 2))
    return cx + dx * s, cy + dy * s


def linea(l, x1, y1, x2, y2, color=TINTA, grosor=1.6, punteada=False, marcador=None, inicio=None):
    dash = ' stroke-dasharray="7 6"' if punteada else ''
    fin = f' marker-end="url(#{marcador})"' if marcador else ''
    ini = f' marker-start="url(#{inicio})"' if inicio else ''
    l.add('lineas', f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" '
                    f'stroke-width="{grosor}"{dash}{fin}{ini}/>')


def etiqueta_sobre_linea(l, x, y, texto, tam=14, color=TINTA_SUAVE, peso=600):
    w = ancho(texto, tam, 600) + 12
    l.add('formas', f'<rect x="{x - w / 2:.1f}" y="{y - tam * 0.75:.1f}" width="{w:.1f}" height="{tam * 1.5:.1f}" fill="#FFFFFF"/>')
    l.texto(x, y, texto, tam, peso, color)


# ---------------------------------------------------------------- Casos de uso

def casos_de_uso():
    l = Lienzo(1460, 980, 'Diagrama de casos de uso de Plumb')
    # Límite del sistema
    l.add('fondo', f'<rect x="255" y="30" width="985" height="915" rx="12" fill="#FFFFFF" stroke="{TINTA}" stroke-width="2"/>')
    l.texto(280, 62, 'Plumb, marketplace de oficios', 21, 800, TINTA, 'start')

    def actor(x, y, nombre):
        l.add('formas', f'<circle cx="{x}" cy="{y - 42}" r="15" fill="{CANARIO}" stroke="{TINTA}" stroke-width="2"/>')
        l.add('formas', f'<path d="M{x} {y - 27} V{y + 10} M{x - 26} {y - 12} H{x + 26} M{x} {y + 10} L{x - 20} {y + 42} '
                        f'M{x} {y + 10} L{x + 20} {y + 42}" fill="none" stroke="{TINTA}" stroke-width="2.2" stroke-linecap="round"/>')
        l.texto(x, y + 64, nombre, 18, 800)

    casos = {}

    def caso(clave, x, y, codigo, lineas, futuro=False, rx=122, ry=48):
        casos[clave] = (x, y, rx, ry)
        relleno = '#FFFFFF' if futuro else CANARIO_CLARO
        dash = ' stroke-dasharray="7 5"' if futuro else ''
        l.add('formas', f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{relleno}" stroke="{TINTA}" stroke-width="1.8"{dash}/>')
        filas = ([codigo] if codigo else []) + lineas
        y0 = y - (len(filas) - 1) * 10
        for i, t in enumerate(filas):
            es_codigo = codigo and i == 0
            l.texto(x, y0 + i * 20, t, 14 if es_codigo else 16, 800 if es_codigo else 500, FOLIO if es_codigo else TINTA)

    def asociar(px, py, clave):
        cx, cy, rx, ry = casos[clave]
        bx, by = borde_elipse(cx, cy, rx, ry, px, py)
        linea(l, px, py, bx, by, grosor=1.8)

    def dependencia(origen, destino, texto, dx=0, dy=0):
        ox, oy, orx, ory = casos[origen]
        tx, ty, trx, try_ = casos[destino]
        x1, y1 = borde_elipse(ox, oy, orx, ory, tx, ty)
        x2, y2 = borde_elipse(tx, ty, trx, try_, ox, oy)
        linea(l, x1, y1, x2, y2, punteada=True, marcador='flecha')
        for i, t in enumerate(texto.split('\n')):
            etiqueta_sobre_linea(l, (x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy + i * 18, t, 13)

    caso('CU01', 485, 145, 'CU-01', ['Consultar catálogo', 'con filtros'])
    caso('CU07', 485, 265, 'CU-07', ['Ver maestros', 'destacados'])
    caso('CU05', 485, 385, 'CU-05', ['Registrar cuenta', 'de cliente'])
    caso('VAL', 815, 385, None, ['Validar mayoría', 'de edad'], rx=110, ry=40)
    caso('CU02', 815, 575, 'CU-02', ['Gestionar solicitud', 'de servicio'])
    caso('CU06', 485, 735, 'CU-06', ['Calificar servicio'])
    caso('CHAT', 815, 815, None, ['Coordinar por chat'], futuro=True, rx=112, ry=38)
    caso('CU09', 1095, 405, 'CU-09', ['Iniciar sesión'], futuro=True, rx=112, ry=44)
    caso('CU08', 1095, 640, 'CU-08', ['Moderar solicitudes', 'y reseñas'])
    caso('CU03', 1095, 755, 'CU-03', ['Gestionar maestros', '(mantenedor 1)'])
    caso('CU04', 1095, 870, 'CU-04', ['Gestionar oficios', '(mantenedor 2)'])

    actor(115, 260, 'Visitante')
    actor(115, 610, 'Cliente')
    actor(1355, 545, 'Maestro')
    actor(1355, 755, 'Administrador')

    # Generalización: un Cliente es un Visitante registrado
    linea(l, 115, 558, 115, 345, grosor=1.8, marcador='generalizacion')

    for c in ('CU01', 'CU07', 'CU05'):
        asociar(148, 245, c)
    asociar(148, 600, 'CU02')
    asociar(148, 612, 'CU06')
    asociar(1322, 540, 'CU02')
    for c in ('CU08', 'CU03', 'CU04'):
        asociar(1322, 752, c)

    dependencia('CU05', 'VAL', '«include»', dy=-14)
    dependencia('CU02', 'CU09', '«include»', dx=8, dy=-14)
    dependencia('CU06', 'CU02', '«extend»\n(solicitud finalizada)', dx=-40, dy=-6)
    dependencia('CHAT', 'CU02', '«extend»', dx=40)

    l.add('formas', f'<ellipse cx="300" cy="912" rx="22" ry="11" fill="#FFFFFF" stroke="{TINTA}" stroke-width="1.6" stroke-dasharray="6 4"/>')
    l.texto(332, 912, 'Borde punteado: caso de uso de la solución general que se implementa en la Etapa II.', 14, 500, TINTA_SUAVE, 'start')
    return l


# ---------------------------------------------------------------- Modelo ER (Chen)

def modelo_er():
    l = Lienzo(2000, 1080, 'Modelo entidad-relación de Plumb (notación de Chen)')
    ent = {}
    rel = {}
    EW, EH = 230, 64
    RW, RH = 190, 92

    def entidad(clave, x, y, nombre):
        ent[clave] = (x, y)
        l.add('formas', f'<rect x="{x - EW / 2}" y="{y - EH / 2}" width="{EW}" height="{EH}" fill="{TINTA}" stroke="{TINTA}" stroke-width="2"/>')
        l.texto(x, y + 1, nombre, 21, 800, '#FFFFFF')

    def relacion(clave, x, y, nombre):
        rel[clave] = (x, y)
        pts = f'{x},{y - RH / 2} {x + RW / 2},{y} {x},{y + RH / 2} {x - RW / 2},{y}'
        l.add('formas', f'<polygon points="{pts}" fill="{CANARIO}" stroke="{TINTA}" stroke-width="2"/>')
        l.texto(x, y + 1, nombre, 17, 700)

    def unir(e, r, card_e, card_r=None, total=False):
        ex, ey = ent[e]
        rx_, ry_ = rel[r]
        x1, y1 = borde_rect(ex, ey, EW, EH, rx_, ry_)
        x2, y2 = borde_rombo(rx_, ry_, RW, RH, ex, ey)
        if total:
            # Participación total: doble línea paralela
            dx, dy = x2 - x1, y2 - y1
            n = math.hypot(dx, dy)
            ox, oy = -dy / n * 3.2, dx / n * 3.2
            linea(l, x1 + ox, y1 + oy, x2 + ox, y2 + oy, grosor=1.6)
            linea(l, x1 - ox, y1 - oy, x2 - ox, y2 - oy, grosor=1.6)
        else:
            linea(l, x1, y1, x2, y2, grosor=1.8)
        # Cardinalidad junto a la entidad
        t = 0.28
        mx, my = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
        horizontal = abs(x2 - x1) > abs(y2 - y1)
        lx, ly = (mx, my - 18) if horizontal else (mx + 20, my)
        l.texto(lx, ly, card_e, 20, 800, FOLIO)

    atributos = []

    def atributo(e, x, y, nombre, pk=False, derivado=False, anclaje=None):
        tam = 14
        w = ancho(nombre, tam, 700 if pk else 500) + 34
        h = 40
        atributos.append((x, y, w, h))
        ex, ey = ent[e]
        ax, ay = anclaje if anclaje else (ex, ey)
        x1, y1 = borde_elipse(x, y, w / 2, h / 2, ax, ay)
        x2, y2 = borde_rect(ex, ey, EW, EH, x, y) if not anclaje else (ax, ay)
        linea(l, x1, y1, x2, y2, color=TINTA_SUAVE, grosor=1.2)
        dash = ' stroke-dasharray="6 4"' if derivado else ''
        relleno = CANARIO_CLARO if pk else '#FFFFFF'
        l.add('formas', f'<ellipse cx="{x}" cy="{y}" rx="{w / 2:.1f}" ry="{h / 2}" fill="{relleno}" stroke="{TINTA}" stroke-width="1.5"{dash}/>')
        l.texto(x, y + 1, nombre, tam, 700 if pk else 500, TINTA, subrayado=pk)

    entidad('MAESTRO', 1000, 470, 'MAESTRO')
    entidad('OFICIO', 330, 470, 'OFICIO')
    entidad('REGION', 1670, 470, 'REGION')
    entidad('SOLICITUD', 1000, 800, 'SOLICITUD')
    entidad('CLIENTE', 330, 800, 'CLIENTE')
    entidad('CALIFICACION', 1670, 800, 'CALIFICACION')

    relacion('CLASIFICA', 665, 470, 'Clasifica')
    relacion('OPERA', 1335, 470, 'Opera en')
    relacion('RECIBE', 1000, 635, 'Recibe')
    relacion('EMITE', 665, 800, 'Emite')
    relacion('EVALUA', 1335, 800, 'Evalúa')

    unir('OFICIO', 'CLASIFICA', '1')
    unir('MAESTRO', 'CLASIFICA', 'N', total=True)
    unir('REGION', 'OPERA', '1')
    unir('MAESTRO', 'OPERA', 'N', total=True)
    unir('MAESTRO', 'RECIBE', '1')
    unir('SOLICITUD', 'RECIBE', 'N', total=True)
    unir('CLIENTE', 'EMITE', '1')
    unir('SOLICITUD', 'EMITE', 'N', total=True)
    unir('SOLICITUD', 'EVALUA', '1')
    unir('CALIFICACION', 'EVALUA', '1', total=True)

    # MAESTRO: dos filas escalonadas; cada línea llega a su propio punto del borde
    # superior, así las líneas de la fila de arriba pasan entre los óvalos de abajo.
    fila1 = [('rut_maestro', True, False), ('email', False, False), ('fecha_nacimiento', False, False),
             ('tarifa_hora', False, False), ('disponible', False, False), ('fecha_registro', False, False)]
    fila2 = [('nombre', False, False), ('telefono', False, False), ('experiencia_anios', False, False),
             ('descripcion', False, False), ('promedio', False, True)]
    y1, y2, borde = 95, 255, 470 - EH / 2
    xs1 = [1000 + (i - 2.5) * 235 for i in range(6)]
    ancla = lambda x: (1000 + (x - 1000) * 0.17, borde)
    cruces = []
    for x in xs1:
        axx, ayy = ancla(x)
        cruces.append(x + (axx - x) * (y2 - y1) / (ayy - y1))
    xs2 = [(cruces[i] + cruces[i + 1]) / 2 for i in range(5)]
    for (nombre, pk, der), x in zip(fila1, xs1):
        atributo('MAESTRO', x, y1, nombre, pk=pk, anclaje=ancla(x))
    for (nombre, pk, der), x in zip(fila2, xs2):
        atributo('MAESTRO', x, y2, nombre, pk=pk, derivado=der, anclaje=ancla(x))

    # OFICIO y REGION: atributos hacia afuera
    atributo('OFICIO', 140, 360, 'id_oficio', pk=True)
    atributo('OFICIO', 115, 470, 'nombre')
    atributo('OFICIO', 155, 580, 'descripcion')
    atributo('REGION', 1860, 360, 'id_region', pk=True)
    atributo('REGION', 1890, 470, 'codigo')
    atributo('REGION', 1860, 580, 'nombre')

    # CLIENTE: abanico a la izquierda y abajo
    atributo('CLIENTE', 130, 690, 'rut_cliente', pk=True)
    atributo('CLIENTE', 100, 790, 'nombre')
    atributo('CLIENTE', 110, 890, 'email')
    atributo('CLIENTE', 245, 960, 'telefono')
    atributo('CLIENTE', 405, 965, 'fecha_nacimiento')
    atributo('CLIENTE', 345, 690, 'fecha_registro')

    # SOLICITUD: fila inferior
    sol = [('id_solicitud', True), ('descripcion', False), ('direccion', False), ('fecha_servicio', False),
           ('estado', False), ('fecha_solicitud', False)]
    for i, (nombre, pk) in enumerate(sol):
        x = 1000 + (i - 2.5) * 176
        atributo('SOLICITUD', x, 935, nombre, pk=pk,
                 anclaje=(1000 + (x - 1000) * 0.22, 800 + EH / 2))

    # CALIFICACION: abanico a la derecha
    atributo('CALIFICACION', 1870, 690, 'id_calificacion', pk=True)
    atributo('CALIFICACION', 1900, 800, 'puntuacion')
    atributo('CALIFICACION', 1870, 905, 'comentario')
    atributo('CALIFICACION', 1680, 950, 'fecha')

    # Leyenda (franja inferior)
    ly = 1045
    l.add('formas', f'<rect x="30" y="{ly - 13}" width="44" height="26" fill="{TINTA}"/>')
    l.texto(84, ly, 'Entidad', 14, 600, TINTA, 'start')
    l.add('formas', f'<polygon points="190,{ly - 15} 214,{ly} 190,{ly + 15} 166,{ly}" fill="{CANARIO}" stroke="{TINTA}" stroke-width="1.5"/>')
    l.texto(224, ly, 'Relación', 14, 600, TINTA, 'start')
    l.add('formas', f'<ellipse cx="345" cy="{ly}" rx="26" ry="13" fill="{CANARIO_CLARO}" stroke="{TINTA}" stroke-width="1.4"/>')
    l.texto(380, ly, 'Clave primaria (subrayada)', 14, 600, TINTA, 'start')
    l.add('formas', f'<ellipse cx="610" cy="{ly}" rx="26" ry="13" fill="#FFFFFF" stroke="{TINTA}" stroke-width="1.4" stroke-dasharray="6 4"/>')
    l.texto(645, ly, 'Atributo derivado (se calcula con la vista, no se guarda)', 14, 600, TINTA, 'start')
    linea(l, 1050, ly - 3, 1100, ly - 3, grosor=1.5)
    linea(l, 1050, ly + 3, 1100, ly + 3, grosor=1.5)
    l.texto(1110, ly, 'Participación total (la FK es NOT NULL)', 14, 600, TINTA, 'start')
    l.texto(1430, ly, '1, N: cardinalidad', 14, 800, FOLIO, 'start')
    return l


# ---------------------------------------------------------------- Modelo relacional

TABLAS = {
    'REGION': [('PK', 'id_region', 'SMALLINT', True), ('UQ', 'codigo', 'VARCHAR(4)', True), ('UQ', 'nombre', 'VARCHAR(60)', True)],
    'OFICIO': [('PK', 'id_oficio', 'INTEGER IDENTITY', True), ('UQ', 'nombre', 'VARCHAR(60)', True), ('', 'descripcion', 'VARCHAR(255)', False)],
    'MAESTRO': [('PK', 'rut_maestro', 'VARCHAR(10)', True), ('', 'nombre', 'VARCHAR(120)', True), ('UQ', 'email', 'VARCHAR(120)', True),
                ('', 'telefono', 'VARCHAR(15)', True), ('', 'fecha_nacimiento', 'DATE', True), ('FK', 'id_oficio', 'INTEGER', True),
                ('FK', 'id_region', 'SMALLINT', True), ('', 'tarifa_hora', 'INTEGER', True), ('', 'experiencia_anios', 'SMALLINT', True),
                ('', 'disponible', 'BOOLEAN', True), ('', 'descripcion', 'VARCHAR(500)', False), ('', 'fecha_registro', 'TIMESTAMPTZ', True)],
    'CLIENTE': [('PK', 'rut_cliente', 'VARCHAR(10)', True), ('', 'nombre', 'VARCHAR(120)', True), ('UQ', 'email', 'VARCHAR(120)', True),
                ('', 'telefono', 'VARCHAR(15)', False), ('', 'fecha_nacimiento', 'DATE', True), ('', 'fecha_registro', 'TIMESTAMPTZ', True)],
    'SOLICITUD': [('PK', 'id_solicitud', 'INTEGER IDENTITY', True), ('FK', 'rut_cliente', 'VARCHAR(10)', True), ('FK', 'rut_maestro', 'VARCHAR(10)', True),
                  ('', 'descripcion', 'VARCHAR(1000)', True), ('', 'direccion', 'VARCHAR(200)', True), ('', 'fecha_servicio', 'DATE', True),
                  ('', 'estado', 'VARCHAR(12)', True), ('', 'fecha_solicitud', 'TIMESTAMPTZ', True)],
    'CALIFICACION': [('PK', 'id_calificacion', 'INTEGER IDENTITY', True), ('FK, UQ', 'id_solicitud', 'INTEGER', True),
                     ('', 'puntuacion', 'SMALLINT', True), ('', 'comentario', 'VARCHAR(500)', False), ('', 'fecha', 'TIMESTAMPTZ', True)],
}


def modelo_relacional():
    l = Lienzo(1640, 960, 'Modelo relacional de Plumb')
    TW, HH, RH = 452, 46, 32
    pos = {'REGION': (40, 150), 'MAESTRO': (594, 40), 'OFICIO': (1148, 150),
           'CLIENTE': (40, 560), 'SOLICITUD': (594, 560), 'CALIFICACION': (1148, 560)}
    filas = {}

    for nombre, cols in TABLAS.items():
        x, y = pos[nombre]
        h = HH + RH * len(cols)
        l.add('formas', f'<rect x="{x}" y="{y}" width="{TW}" height="{h}" fill="#FFFFFF" stroke="{TINTA}" stroke-width="2"/>')
        l.add('formas', f'<rect x="{x}" y="{y}" width="{TW}" height="{HH}" fill="{TINTA}"/>')
        l.texto(x + 16, y + HH / 2 + 1, nombre.lower(), 20, 800, '#FFFFFF', 'start')
        for i, (marca, col, tipo, nn) in enumerate(cols):
            fy = y + HH + RH * i
            filas[(nombre, col)] = (x, fy + RH / 2)
            if i % 2 == 1:
                l.add('formas', f'<rect x="{x + 2}" y="{fy}" width="{TW - 4}" height="{RH}" fill="{MESA}"/>')
            if 'PK' in marca:
                l.add('formas', f'<rect x="{x + 2}" y="{fy}" width="{TW - 4}" height="{RH}" fill="{CANARIO_CLARO}"/>')
            color_marca = FOLIO if 'FK' in marca else TINTA
            l.texto(x + 14, fy + RH / 2 + 1, marca, 12, 800, color_marca, 'start')
            l.texto(x + 78, fy + RH / 2 + 1, col, 16, 700 if 'PK' in marca else 500, TINTA, 'start', subrayado='PK' in marca)
            l.texto(x + 262, fy + RH / 2 + 1, tipo, 13, 400, TINTA_SUAVE, 'start', familia=MONO)
            l.texto(x + TW - 14, fy + RH / 2 + 1, 'NN' if nn else 'NULL', 12, 700, TINTA if nn else TINTA_SUAVE, 'end')

    def pie_de_gallo(x, y, hacia, opcional=True):
        # Extremo "muchos": tres trazos que abren hacia la tabla
        s = 1 if hacia == 'derecha' else -1
        l.add('lineas', f'<path d="M{x} {y} L{x - s * 18} {y - 11} M{x} {y} L{x - s * 18} {y + 11} M{x} {y} L{x - s * 18} {y}" '
                        f'stroke="{TINTA}" stroke-width="1.8" fill="none"/>')
        if opcional:
            cx = x - s * 28
            l.add('formas', f'<circle cx="{cx}" cy="{y}" r="6" fill="#FFFFFF" stroke="{TINTA}" stroke-width="1.8"/>')

    def uno(x, y, hacia, opcional=False):
        s = 1 if hacia == 'derecha' else -1
        l.add('lineas', f'<path d="M{x - s * 10} {y - 11} V{y + 11}" stroke="{TINTA}" stroke-width="1.8"/>')
        if opcional:
            l.add('formas', f'<circle cx="{x - s * 22}" cy="{y}" r="6" fill="#FFFFFF" stroke="{TINTA}" stroke-width="1.8"/>')
        else:
            l.add('lineas', f'<path d="M{x - s * 18} {y - 11} V{y + 11}" stroke="{TINTA}" stroke-width="1.8"/>')

    def uno_vertical(x, y, hacia):
        s = 1 if hacia == 'abajo' else -1
        l.add('lineas', f'<path d="M{x - 11} {y - s * 10} H{x + 11} M{x - 11} {y - s * 18} H{x + 11}" stroke="{TINTA}" stroke-width="1.8"/>')

    # MAESTRO.id_region → REGION.id_region (izquierda)
    mx, my = filas[('MAESTRO', 'id_region')]
    rx_, ry_ = filas[('REGION', 'id_region')]
    xa, xb = rx_ + TW, mx
    xm = (xa + xb) / 2
    l.add('lineas', f'<path d="M{xa} {ry_} H{xm} V{my} H{xb}" fill="none" stroke="{TINTA}" stroke-width="1.8"/>')
    uno(xa, ry_, 'izquierda')
    pie_de_gallo(xb, my, 'derecha')

    # MAESTRO.id_oficio → OFICIO.id_oficio (derecha)
    mx, my = filas[('MAESTRO', 'id_oficio')]
    ox, oy = filas[('OFICIO', 'id_oficio')]
    xa, xb = mx + TW, ox
    xm = (xa + xb) / 2
    l.add('lineas', f'<path d="M{xa} {my} H{xm} V{oy} H{xb}" fill="none" stroke="{TINTA}" stroke-width="1.8"/>')
    pie_de_gallo(xa, my, 'izquierda')
    uno(xb, oy, 'derecha')

    # SOLICITUD.rut_cliente → CLIENTE.rut_cliente (izquierda)
    sx, sy = filas[('SOLICITUD', 'rut_cliente')]
    cx_, cy_ = filas[('CLIENTE', 'rut_cliente')]
    xa, xb = cx_ + TW, sx
    xm = (xa + xb) / 2
    l.add('lineas', f'<path d="M{xa} {cy_} H{xm} V{sy} H{xb}" fill="none" stroke="{TINTA}" stroke-width="1.8"/>')
    uno(xa, cy_, 'izquierda')
    pie_de_gallo(xb, sy, 'derecha')

    # SOLICITUD.rut_maestro → MAESTRO.rut_maestro: línea vertical entre las dos tablas
    mx0, my0 = pos['MAESTRO']
    sx0, sy0 = pos['SOLICITUD']
    xv = mx0 + TW / 2
    yb = my0 + HH + RH * len(TABLAS['MAESTRO'])
    l.add('lineas', f'<path d="M{xv} {yb} V{sy0}" fill="none" stroke="{TINTA}" stroke-width="1.8"/>')
    l.add('lineas', f'<path d="M{xv - 11} {yb + 10} H{xv + 11} M{xv - 11} {yb + 18} H{xv + 11}" stroke="{TINTA}" stroke-width="1.8"/>')
    l.add('lineas', f'<path d="M{xv} {sy0} L{xv - 11} {sy0 - 18} M{xv} {sy0} L{xv + 11} {sy0 - 18} M{xv} {sy0} V{sy0 - 18}" stroke="{TINTA}" stroke-width="1.8" fill="none"/>')
    l.add('formas', f'<circle cx="{xv}" cy="{sy0 - 28}" r="6" fill="#FFFFFF" stroke="{TINTA}" stroke-width="1.8"/>')
    etiqueta_sobre_linea(l, xv + 70, (yb + sy0) / 2, 'rut_maestro', 14, FOLIO, 700)

    # CALIFICACION.id_solicitud → SOLICITUD.id_solicitud (1 a 0..1)
    kx, ky = filas[('CALIFICACION', 'id_solicitud')]
    sx, sy = filas[('SOLICITUD', 'id_solicitud')]
    xa = sx + TW
    xm = xa + 70
    l.add('lineas', f'<path d="M{xa} {sy} H{xm} V{ky} H{kx}" fill="none" stroke="{TINTA}" stroke-width="1.8"/>')
    uno(xa, sy, 'izquierda')
    uno(kx, ky, 'derecha', opcional=True)

    # Leyenda
    ly = 915
    l.texto(40, ly, 'PK clave primaria   FK clave foránea   UQ valor único   NN NOT NULL', 15, 600, TINTA, 'start')
    lx = 800
    l.add('lineas', f'<path d="M{lx} {ly} H{lx + 60}" stroke="{TINTA}" stroke-width="1.8"/>')
    uno(lx, ly, 'izquierda')
    l.texto(lx + 72, ly, 'uno y solo uno', 15, 500, TINTA, 'start')
    lx2 = 1010
    l.add('lineas', f'<path d="M{lx2} {ly} H{lx2 + 60}" stroke="{TINTA}" stroke-width="1.8"/>')
    pie_de_gallo(lx2 + 60, ly, 'derecha')
    l.texto(lx2 + 72, ly, 'cero o muchos', 15, 500, TINTA, 'start')
    lx3 = 1220
    l.add('lineas', f'<path d="M{lx3} {ly} H{lx3 + 60}" stroke="{TINTA}" stroke-width="1.8"/>')
    uno(lx3 + 60, ly, 'derecha', opcional=True)
    l.texto(lx3 + 72, ly, 'cero o uno', 15, 500, TINTA, 'start')
    return l


# ---------------------------------------------------------------- Arquitectura

def arquitectura():
    l = Lienzo(1640, 910, 'Arquitectura y despliegue de Plumb')

    def caja(x, y, w, h, titulo, subtitulo, relleno='#FFFFFF', borde=TINTA, color_titulo=TINTA):
        l.add('formas', f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{relleno}" stroke="{borde}" stroke-width="2"/>')
        l.texto(x + 20, y + 30, titulo, 20, 800, color_titulo, 'start')
        if subtitulo:
            l.texto(x + 20, y + 56, subtitulo, 14, 500, TINTA_SUAVE if color_titulo == TINTA else '#E8EBFF', 'start')

    def nube(x, y, w, h, texto):
        l.add('fondo', f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{MESA}" stroke="{PAUTA}" stroke-width="2" stroke-dasharray="8 6"/>')
        l.texto(x + 18, y + 26, texto, 15, 700, TINTA_SUAVE, 'start')

    # Zonas
    nube(330, 40, 860, 640, 'Vercel: un proyecto, misma dirección (HTTPS automático)')
    nube(1230, 40, 380, 300, 'Neon (PostgreSQL gestionado)')
    nube(1230, 380, 380, 300, 'MongoDB Atlas (Etapa II)')

    # Navegador
    caja(30, 250, 260, 180, 'Navegador', 'Cliente, maestro o administrador', CANARIO_CLARO)
    l.texto(50, 330, 'React 19 corriendo en', 15, 500, TINTA, 'start')
    l.texto(50, 354, 'el equipo del usuario.', 15, 500, TINTA, 'start')
    l.texto(50, 390, 'Nunca habla con la BD.', 15, 700, FOLIO, 'start')

    # Frontend
    caja(370, 90, 380, 190, 'Frontend', 'frontend/ (React 19 + Vite)')
    for i, t in enumerate(['Archivos estáticos (dist/) en la CDN', 'Rutas: /, /catalogo, /maestros/:rut, /solicitudes,', '/admin, /consultas, /nosql',
                           'Llama a /api/v1 en la misma dirección']):
        l.texto(390, 178 + i * 24, t, 15, 500 if i < 3 else 700, TINTA, 'start', familia=FUENTE)

    # API
    caja(370, 320, 780, 330, 'API REST', 'backend/ (Node 22 + Express 5), función serverless en Washington (iad1)', TINTA, TINTA, '#FFFFFF')
    capas = [('routes/', 'mapa de la API /api/v1'), ('controllers/', 'leen la petición y eligen la respuesta'),
             ('validators/', 'forma de los datos → 400'), ('models/', 'SQL parametrizado, MQL y reglas → 422'),
             ('middlewares/', 'errores de la BD → 409 / 422')]
    for i, (c, d) in enumerate(capas):
        yy = 410 + i * 46
        l.add('formas', f'<rect x="395" y="{yy - 18}" width="730" height="38" rx="4" fill="#2A3383"/>')
        l.texto(412, yy + 1, c, 15, 700, CANARIO, 'start', familia=MONO)
        l.texto(580, yy + 1, d, 15, 500, '#FFFFFF', 'start')
    l.texto(395, 640, 'Variables: DATABASE_URL, MONGODB_URI, CORS_ORIGINS', 14, 700, CANARIO, 'start')

    # BD
    caja(1260, 80, 320, 236, 'PostgreSQL 17', 'AWS us-east-2 (Ohio), TLS', AZUL_CLARO)
    for i, t in enumerate(['6 tablas + 1 vista', 'region, oficio, cliente, maestro,', 'solicitud, calificacion',
                           'CHECK, UNIQUE, FK RESTRICT', 'y CASCADE']):
        l.texto(1280, 160 + i * 26, t, 15, 700 if i in (0, 3) else 500, TINTA, 'start')

    caja(1260, 420, 320, 236, 'MongoDB 8.0', 'AWS us-east-1 (Virginia), clúster M0, TLS', VERDE_CLARO)
    for i, t in enumerate(['6 colecciones', 'maestros, solicitudes, clientes,', 'oficios, regiones, contadores',
                           '$jsonSchema, 10 índices y', 'transacciones multi-documento']):
        l.texto(1280, 500 + i * 26, t, 15, 700 if i in (0, 3) else 500, TINTA, 'start')

    # Flujos
    def flecha(x1, y1, x2, y2, num, texto, dx=0, dy=-16, doble=False):
        linea(l, x1, y1, x2, y2, grosor=2.4, marcador='flecha-llena', inicio='flecha-llena' if doble else None)
        mx, my = (x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy
        l.add('formas', f'<circle cx="{mx - ancho(texto, 14, 600) / 2 - 20}" cy="{my}" r="13" fill="{FOLIO}"/>')
        l.texto(mx - ancho(texto, 14, 600) / 2 - 20, my + 1, str(num), 14, 800, '#FFFFFF')
        etiqueta_sobre_linea(l, mx, my, texto, 14, TINTA, 600)

    flecha(290, 300, 370, 185, 1, 'Descarga la app', dx=-20, dy=-30)
    flecha(290, 380, 370, 450, 2, 'JSON por HTTPS', dx=-10, dy=-30, doble=True)
    flecha(1150, 400, 1260, 230, 3, 'SQL por TLS', dx=10, dy=-10, doble=True)
    flecha(1150, 560, 1260, 560, 4, 'MQL por TLS', dx=0, dy=-24, doble=True)

    # Desarrollo local
    l.add('fondo', f'<rect x="30" y="720" width="1580" height="160" rx="10" fill="#FFFFFF" stroke="{PAUTA}" stroke-width="2"/>')
    l.texto(54, 752, 'En desarrollo (equipo de cada integrante)', 17, 800, TINTA, 'start')
    pasos = ['docker compose up -d  (PostgreSQL 17 local)', 'npm run db:init  (esquema + datos)',
             'docker run mongo:8 --replSet rs0  (MongoDB local)', 'npm run mongo:migrar  (PostgreSQL → MongoDB)',
             'npm run dev  (API en :3000)', 'npm run dev  (web en :5173, /api → :3000)']
    for i, t in enumerate(pasos):
        l.texto(54 + (i % 2) * 780, 790 + (i // 2) * 32, t, 15, 500, TINTA, 'start', familia=MONO)
    return l


def main():
    salida = sys.argv[1] if len(sys.argv) > 1 else '..'
    for nombre, fn in [('casos_de_uso', casos_de_uso), ('modelo_er', modelo_er),
                       ('modelo_relacional', modelo_relacional), ('arquitectura', arquitectura)]:
        ruta = os.path.join(salida, f'{nombre}.svg')
        with open(ruta, 'w', encoding='utf8') as f:
            f.write(fn().svg())
        print('svg', ruta)


if __name__ == '__main__' and not (len(sys.argv) > 2 and sys.argv[2] == 'diapositivas'):
    main()


# ================================================================ Versiones para diapositivas
# Menos detalle y letra más grande: tienen que leerse en un proyector desde el fondo de la sala.

def casos_de_uso_diapositiva():
    l = Lienzo(1600, 940, 'Casos de uso (versión para proyectar)')
    l.add('fondo', f'<rect x="230" y="14" width="1140" height="912" rx="14" fill="#FFFFFF" stroke="{TINTA}" stroke-width="3"/>')

    def actor(x, y, nombre):
        l.add('formas', f'<circle cx="{x}" cy="{y - 50}" r="19" fill="{CANARIO}" stroke="{TINTA}" stroke-width="3"/>')
        l.add('formas', f'<path d="M{x} {y - 31} V{y + 14} M{x - 32} {y - 14} H{x + 32} M{x} {y + 14} L{x - 25} {y + 52} '
                        f'M{x} {y + 14} L{x + 25} {y + 52}" fill="none" stroke="{TINTA}" stroke-width="3" stroke-linecap="round"/>')
        l.texto(x, y + 80, nombre, 25, 800)

    casos = {}

    def caso(clave, x, y, codigo, lineas, futuro=False, rx=158, ry=54):
        casos[clave] = (x, y, rx, ry)
        relleno = '#FFFFFF' if futuro else CANARIO_CLARO
        dash = ' stroke-dasharray="10 7"' if futuro else ''
        l.add('formas', f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{relleno}" stroke="{TINTA}" stroke-width="2.6"{dash}/>')
        filas = ([codigo] if codigo else []) + lineas
        y0 = y - (len(filas) - 1) * 13
        for i, t in enumerate(filas):
            es_codigo = codigo and i == 0
            l.texto(x, y0 + i * 26, t, 18 if es_codigo else 22, 800 if es_codigo else 600, FOLIO if es_codigo else TINTA)

    def asociar(px, py, clave):
        cx, cy, rx, ry = casos[clave]
        bx, by = borde_elipse(cx, cy, rx, ry, px, py)
        linea(l, px, py, bx, by, grosor=2.6)

    def dependencia(origen, destino, texto, dx=0, dy=0):
        ox, oy, orx, ory = casos[origen]
        tx, ty, trx, try_ = casos[destino]
        x1, y1 = borde_elipse(ox, oy, orx, ory, tx, ty)
        x2, y2 = borde_elipse(tx, ty, trx, try_, ox, oy)
        linea(l, x1, y1, x2, y2, punteada=True, marcador='flecha', grosor=2.4)
        etiqueta_sobre_linea(l, (x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, texto, 19, TINTA, 700)

    caso('CU01', 420, 100, 'CU-01', ['Consultar catálogo'])
    caso('CU07', 420, 225, 'CU-07', ['Ver destacados'])
    caso('CU05', 420, 350, 'CU-05', ['Registrar cuenta'])
    caso('VAL', 790, 350, None, ['Validar mayoría', 'de edad'], rx=150, ry=50)
    caso('CU02', 790, 555, 'CU-02', ['Gestionar solicitud'])
    caso('CU06', 420, 720, 'CU-06', ['Calificar servicio'])
    caso('CHAT', 790, 790, None, ['Coordinar por chat'], futuro=True, rx=150, ry=46)
    caso('CU09', 1150, 300, 'CU-09', ['Iniciar sesión'], futuro=True)
    caso('CU08', 1150, 600, 'CU-08', ['Moderar'])
    caso('CU03', 1150, 720, 'CU-03', ['Gestionar maestros'])
    caso('CU04', 1150, 840, 'CU-04', ['Gestionar oficios'])

    actor(105, 215, 'Visitante')
    actor(105, 600, 'Cliente')
    actor(1490, 400, 'Maestro')
    actor(1490, 720, 'Admin.')
    linea(l, 105, 535, 105, 325, grosor=2.6, marcador='generalizacion')
    for c in ('CU01', 'CU07', 'CU05'):
        asociar(148, 200, c)
    asociar(148, 595, 'CU02')
    asociar(148, 612, 'CU06')
    asociar(1448, 398, 'CU02')
    for c in ('CU08', 'CU03', 'CU04'):
        asociar(1448, 716, c)
    dependencia('CU05', 'VAL', '«include»', dy=-20)
    dependencia('CU02', 'CU09', '«include»', dx=-20, dy=-14)
    dependencia('CU06', 'CU02', '«extend»', dx=-36, dy=-8)
    dependencia('CHAT', 'CU02', '«extend»', dx=58)
    l.texto(255, 905, 'Punteado: Etapa II', 18, 700, TINTA_SUAVE, 'start')
    return l


def er_diapositiva():
    l = Lienzo(1600, 760, 'Modelo entidad-relación (versión para proyectar)')
    EW, EH, RW, RH = 250, 104, 210, 116
    ent, rel = {}, {}

    def entidad(clave, x, y, nombre, clavep):
        ent[clave] = (x, y)
        l.add('formas', f'<rect x="{x - EW / 2}" y="{y - EH / 2}" width="{EW}" height="{EH}" fill="{TINTA}"/>')
        l.texto(x, y - 14, nombre, 29, 800, '#FFFFFF')
        l.texto(x, y + 24, clavep, 18, 600, CANARIO, subrayado=True)

    def relacion(clave, x, y, nombre):
        rel[clave] = (x, y)
        pts = f'{x},{y - RH / 2} {x + RW / 2},{y} {x},{y + RH / 2} {x - RW / 2},{y}'
        l.add('formas', f'<polygon points="{pts}" fill="{CANARIO}" stroke="{TINTA}" stroke-width="3"/>')
        l.texto(x, y + 1, nombre, 24, 800)

    def unir(e, r, card, total=False, lado='arriba'):
        ex, ey = ent[e]
        rx_, ry_ = rel[r]
        x1, y1 = borde_rect(ex, ey, EW, EH, rx_, ry_)
        x2, y2 = borde_rombo(rx_, ry_, RW, RH, ex, ey)
        if total:
            dx, dy = x2 - x1, y2 - y1
            n = math.hypot(dx, dy)
            ox, oy = -dy / n * 5, dx / n * 5
            linea(l, x1 + ox, y1 + oy, x2 + ox, y2 + oy, grosor=2.6)
            linea(l, x1 - ox, y1 - oy, x2 - ox, y2 - oy, grosor=2.6)
        else:
            linea(l, x1, y1, x2, y2, grosor=3)
        t = 0.5 if len(card) > 1 else 0.35
        mx, my = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
        if abs(x2 - x1) > abs(y2 - y1):
            l.texto(mx, my - 28, card, 34, 800, FOLIO)
        else:
            l.texto(mx + 30, my, card, 34, 800, FOLIO)

    entidad('OFICIO', 160, 110, 'OFICIO', 'id_oficio')
    entidad('MAESTRO', 800, 110, 'MAESTRO', 'rut_maestro')
    entidad('REGION', 1440, 110, 'REGION', 'id_region')
    entidad('CLIENTE', 160, 560, 'CLIENTE', 'rut_cliente')
    entidad('SOLICITUD', 800, 560, 'SOLICITUD', 'id_solicitud')
    entidad('CALIFICACION', 1440, 560, 'CALIFICACIÓN', 'id_calificacion')
    relacion('CLASIFICA', 480, 110, 'Clasifica')
    relacion('OPERA', 1120, 110, 'Opera en')
    relacion('RECIBE', 800, 335, 'Recibe')
    relacion('EMITE', 480, 560, 'Emite')
    relacion('EVALUA', 1120, 560, 'Evalúa')
    unir('OFICIO', 'CLASIFICA', '1')
    unir('MAESTRO', 'CLASIFICA', 'N', total=True)
    unir('REGION', 'OPERA', '1')
    unir('MAESTRO', 'OPERA', 'N', total=True)
    unir('MAESTRO', 'RECIBE', '1')
    unir('SOLICITUD', 'RECIBE', 'N', total=True)
    unir('CLIENTE', 'EMITE', '1')
    unir('SOLICITUD', 'EMITE', 'N', total=True)
    unir('SOLICITUD', 'EVALUA', '1')
    unir('CALIFICACION', 'EVALUA', '0..1', total=True)
    linea(l, 40, 726, 110, 726, grosor=2.6)
    linea(l, 40, 736, 110, 736, grosor=2.6)
    l.texto(126, 731, 'Doble línea: participación total (la FK es NOT NULL)', 21, 600, TINTA, 'start')
    return l


def relacional_diapositiva():
    TW, HH, RH = 430, 50, 33
    cols = {k: [(m, c) for (m, c, t, nn) in v] for k, v in TABLAS.items()}
    pos = {'REGION': (40, 150), 'MAESTRO': (585, 20), 'OFICIO': (1130, 150),
           'CLIENTE': (40, 520), 'SOLICITUD': (585, 520), 'CALIFICACION': (1130, 520)}
    alto = 520 + HH + RH * len(cols['SOLICITUD']) + 30
    l = Lienzo(1600, alto, 'Modelo relacional (versión para proyectar)')
    filas = {}
    for nombre, cs in cols.items():
        x, y = pos[nombre]
        h = HH + RH * len(cs)
        l.add('formas', f'<rect x="{x}" y="{y}" width="{TW}" height="{h}" fill="#FFFFFF" stroke="{TINTA}" stroke-width="3"/>')
        l.add('formas', f'<rect x="{x}" y="{y}" width="{TW}" height="{HH}" fill="{TINTA}"/>')
        l.texto(x + 18, y + HH / 2 + 1, nombre.lower(), 26, 800, '#FFFFFF', 'start')
        for i, (marca, col) in enumerate(cs):
            fy = y + HH + RH * i
            filas[(nombre, col)] = (x, fy + RH / 2)
            if 'PK' in marca:
                l.add('formas', f'<rect x="{x + 3}" y="{fy}" width="{TW - 6}" height="{RH}" fill="{CANARIO_CLARO}"/>')
            l.texto(x + 16, fy + RH / 2 + 1, marca.replace(', ', ' '), 16, 800, FOLIO if 'FK' in marca else TINTA, 'start')
            l.texto(x + 92, fy + RH / 2 + 1, col, 22, 700 if marca else 500, TINTA, 'start', subrayado='PK' in marca)

    def codo(xa, ya, xb, yb, xm):
        l.add('lineas', f'<path d="M{xa} {ya} H{xm} V{yb} H{xb}" fill="none" stroke="{TINTA}" stroke-width="3"/>')

    def uno(x, y, s):
        l.add('lineas', f'<path d="M{x - s * 12} {y - 14} V{y + 14} M{x - s * 22} {y - 14} V{y + 14}" stroke="{TINTA}" stroke-width="3"/>')

    def muchos(x, y, s):
        l.add('lineas', f'<path d="M{x} {y} L{x - s * 22} {y - 14} M{x} {y} L{x - s * 22} {y + 14}" stroke="{TINTA}" stroke-width="3" fill="none"/>')

    mx, my = filas[('MAESTRO', 'id_region')]
    rx_, ry_ = filas[('REGION', 'id_region')]
    codo(rx_ + TW, ry_, mx, my, (rx_ + TW + mx) / 2)
    uno(rx_ + TW, ry_, -1)
    muchos(mx, my, 1)
    mx, my = filas[('MAESTRO', 'id_oficio')]
    ox, oy = filas[('OFICIO', 'id_oficio')]
    codo(mx + TW, my, ox, oy, (mx + TW + ox) / 2)
    muchos(mx + TW, my, -1)
    uno(ox, oy, 1)
    sx, sy = filas[('SOLICITUD', 'rut_cliente')]
    cx_, cy_ = filas[('CLIENTE', 'rut_cliente')]
    codo(cx_ + TW, cy_, sx, sy, (cx_ + TW + sx) / 2)
    uno(cx_ + TW, cy_, -1)
    muchos(sx, sy, 1)
    xv = pos['MAESTRO'][0] + TW / 2
    yb = pos['MAESTRO'][1] + HH + RH * len(cols['MAESTRO'])
    ys = pos['SOLICITUD'][1]
    l.add('lineas', f'<path d="M{xv} {yb} V{ys}" stroke="{TINTA}" stroke-width="3"/>')
    l.add('lineas', f'<path d="M{xv - 14} {yb + 12} H{xv + 14} M{xv - 14} {yb + 22} H{xv + 14}" stroke="{TINTA}" stroke-width="3"/>')
    l.add('lineas', f'<path d="M{xv} {ys} L{xv - 14} {ys - 22} M{xv} {ys} L{xv + 14} {ys - 22}" stroke="{TINTA}" stroke-width="3" fill="none"/>')
    kx, ky = filas[('CALIFICACION', 'id_solicitud')]
    sx, sy = filas[('SOLICITUD', 'id_solicitud')]
    codo(sx + TW, sy, kx, ky, (sx + TW + kx) / 2)
    uno(sx + TW, sy, -1)
    l.add('lineas', f'<path d="M{kx - 12} {ky - 14} V{ky + 14}" stroke="{TINTA}" stroke-width="3"/>')
    l.add('formas', f'<circle cx="{kx - 24}" cy="{ky}" r="7" fill="#FFFFFF" stroke="{TINTA}" stroke-width="3"/>')
    return l


def main_diapositivas(salida):
    os.makedirs(salida, exist_ok=True)
    for nombre, fn in [('casos_de_uso', casos_de_uso_diapositiva), ('modelo_er', er_diapositiva),
                       ('modelo_relacional', relacional_diapositiva)]:
        ruta = os.path.join(salida, f'{nombre}.svg')
        with open(ruta, 'w', encoding='utf8') as f:
            f.write(fn().svg())
        print('svg', ruta)


if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[2] == 'diapositivas':
    main_diapositivas(sys.argv[1])
