"""Create the source-grounded DYNORA handbook. Requires reportlab and Pillow.
The PDF is a documentation artifact; it is not required to run the simulator.
"""
from pathlib import Path
import hashlib, html, json, re, textwrap
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
    Spacer, PageBreak, Table, TableStyle, Image, Preformatted, KeepTogether)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.graphics.shapes import Drawing, Rect, Line, String, Circle, PolyLine

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'docs/DYNORA_Complete_Handbook_V7.pdf'
FONT=Path('/usr/share/fonts/truetype/dejavu')
for name,file in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf'),('Mono','DejaVuSansMono.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONT/file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
INK=colors.HexColor('#162e40');TEAL=colors.HexColor('#127563');MUTED=colors.HexColor('#5a6e7a');LINE=colors.HexColor('#d9e2e2');CREAM=colors.HexColor('#f5f6f2')
WIDTH,HEIGHT=595.276,841.89
ST={
 'body':ParagraphStyle('body',fontName='Body',fontSize=9.35,leading=14.3,textColor=INK,spaceAfter=8,splitLongWords=True),
 'small':ParagraphStyle('small',fontName='Body',fontSize=7.6,leading=11,textColor=MUTED,spaceAfter=7,splitLongWords=True),
 'h1':ParagraphStyle('h1',fontName='Bold',fontSize=22,leading=28,textColor=INK,spaceAfter=17,keepWithNext=True),
 'h2':ParagraphStyle('h2',fontName='Bold',fontSize=12.1,leading=17,textColor=TEAL,spaceBefore=15,spaceAfter=7,keepWithNext=True),
 'h3':ParagraphStyle('h3',fontName='Bold',fontSize=10.2,leading=14,textColor=INK,spaceBefore=10,spaceAfter=5,keepWithNext=True),
 'table':ParagraphStyle('table',fontName='Body',fontSize=7.7,leading=11,textColor=INK,splitLongWords=True),
 'th':ParagraphStyle('th',fontName='Bold',fontSize=7.7,leading=11,textColor=colors.white,splitLongWords=True),
 'code':ParagraphStyle('code',fontName='Mono',fontSize=7.1,leading=10,textColor=INK,spaceAfter=0),
 'caption':ParagraphStyle('caption',fontName='Body',fontSize=8.1,leading=11.5,textColor=MUTED,spaceAfter=13),
 'title':ParagraphStyle('title',fontName='Bold',fontSize=42,leading=47,textColor=INK,spaceAfter=16),
 'subtitle':ParagraphStyle('subtitle',fontName='Body',fontSize=17,leading=24,textColor=TEAL,spaceAfter=12),
}

def clean(s):
    for a in ['\u2011','\u2010','\u2012','\u2013','\u2014','\u2212']:s=s.replace(a,'-')
    return s
def inline(s):
    s=html.escape(clean(s)).replace('&lt;br/&gt;','<br/>')
    s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',lambda m: (f'<link href="{m[2]}" color="#127563">{m[1]}</link>' if m[2].startswith('http') else m[1]+' ('+m[2]+')'),s)
    s=re.sub(r'`([^`]+)`',r'<font name="Mono" size="8.3">\1</font>',s)
    s=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',s)
    return s
def P(s,style='body'):return Paragraph(inline(s),ST[style])
def table(rows):
    n=max(len(row) for row in rows)
    widths=([115,380] if n==2 else [110,130,255] if n==3 else [495/n]*n)
    cells=[[Paragraph(inline(c),ST['th' if r==0 else 'table']) for c in row]+['']*(n-len(row)) for r,row in enumerate(rows)]
    t=Table(cells,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),TEAL),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,CREAM]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),.6,TEAL),('LINEBELOW',(0,1),(-1,-1),.25,LINE)]))
    return [t,Spacer(1,10)]

class Book(BaseDocTemplate):
    def afterFlowable(self,f):
        if isinstance(f,Paragraph) and f.style.name in ['h1','h2']:
            level=0 if f.style.name=='h1' else 1
            text=f.getPlainText();
            if text=='Contents':return
            key='bookmark_'+str(self.seq.nextf('bookmark'))
            self.canv.bookmarkPage(key);self.canv.addOutlineEntry(text,key,level,False)
            self.notify('TOCEntry',(level,text,self.page,key))
    def beforeDocument(self):self.seq.reset('bookmark')

def page(c,doc):
    c.setFillColor(colors.white);c.rect(0,0,WIDTH,HEIGHT,fill=1,stroke=0)
    if doc.page==1:return
    c.setStrokeColor(LINE);c.setLineWidth(.5);c.line(50,HEIGHT-42,WIDTH-50,HEIGHT-42);c.line(50,42,WIDTH-50,42)
    c.setFont('Bold',7.5);c.setFillColor(TEAL);c.drawString(50,HEIGHT-32,'DYNORA  /  TECHNICAL & USER HANDBOOK')
    c.setFont('Body',7.5);c.setFillColor(MUTED);c.drawString(50,28,'V7.0.0  •  26 October 2026  •  Local laptop edition');c.drawRightString(WIDTH-50,28,str(doc.page))

story=[]
def h1(s):
    while story and isinstance(story[-1],Spacer):story.pop()
    story.extend([PageBreak(),P(s,'h1')])
def md(text,skip_title=True):
    lines=text.splitlines();i=0;paragraph=[]
    def flush():
        if paragraph:story.append(P(' '.join(paragraph)));paragraph.clear()
    while i<len(lines):
        line=lines[i].strip()
        if line.startswith('```'):
            flush();code=[];i+=1
            while i<len(lines) and not lines[i].strip().startswith('```'):code.append(lines[i]);i+=1
            for item in code:
                for wrapped in textwrap.wrap(clean(item),width=102,replace_whitespace=False,drop_whitespace=False) or [' ']:story.append(Preformatted(wrapped,ST['code']))
            story.append(Spacer(1,10))
        elif line=='!SLIPPLOT':
            flush();story.append(slipplot());story.append(P('Figure 2. Recomputed from the shipped drive model for four seconds at equal full duties: mu=0.75 versus mu=0.08, all other defaults unchanged. Simulated illustration, not hardware data.','caption'))
        elif line.startswith('|'):
            flush();rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                row=[c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',c or ' ') for c in row):rows.append(row)
                i+=1
            story.extend(table(rows));continue
        elif line.startswith('# '):
            flush()
            if not skip_title:story.append(P(line[2:],'h2'))
        elif line.startswith('## '):flush();story.append(P(line[3:],'h2'))
        elif line.startswith('### '):flush();story.append(P(line[4:],'h3'))
        elif line.startswith('> '):flush();story.append(P(line[2:],'small'))
        elif re.match(r'^(- |\d+\. )',line):
            flush();story.append(P(line))
        elif not line:flush()
        else:paragraph.append(line)
        i+=1
    flush()

def architecture():
    d=Drawing(495,224)
    labels=[(0,147,'LAPTOP SERVER','Python -> local built files'),(260,147,'BROWSER','Room state + interface'),(0,53,'SIMULATION','Drive + sensors + props'),(260,53,'DATASET','Images + CSV + evidence')]
    for x,y,title,body in labels:
        d.add(Rect(x,y,235,63,rx=8,fillColor=CREAM,strokeColor=LINE));d.add(String(x+13,y+39,title,fontName='Bold',fontSize=9,fillColor=TEAL));d.add(String(x+13,y+20,body,fontName='Body',fontSize=8.8,fillColor=INK))
    for a,b in [((235,178),(260,178)),((377,147),(117,116)),((117,116),(117,116)),((235,84),(260,84))]:d.add(Line(*a,*b,strokeColor=TEAL,strokeWidth=1.3))
    d.add(String(0,18,'The server sends files; simulation and capture run in the browser.',fontName='Body',fontSize=8.5,fillColor=MUTED))
    return d

def slipplot():
    data=json.loads((ROOT/'docs/handbook-dynamics-data.json').read_text())['series']
    d=Drawing(495,255);x0,y0,w,h=42,40,425,175
    ymax=max(row[2] for rows in data.values() for row in rows)*1.1
    for n in range(5):
        y=y0+h*n/4;d.add(Line(x0,y,x0+w,y,strokeColor=LINE,strokeWidth=.5));d.add(String(9,y-3,f'{ymax*n/4:.1f}',fontName='Body',fontSize=7.5,fillColor=MUTED))
    for n in range(5):
        x=x0+w*n/4;d.add(String(x-2,y0-15,str(n),fontName='Body',fontSize=7.5,fillColor=MUTED))
    for name,color in [('dry',TEAL),('low_grip',colors.HexColor('#a5662e'))]:
        for col,dash in [(1,None),(2,[4,3])]:
            points=[]
            for row in data[name]:points.extend([x0+w*row[0]/4,y0+h*row[col]/ymax])
            line=PolyLine(points,strokeColor=color,strokeWidth=1.6,fillColor=None)
            if dash:line.strokeDashArray=dash
            d.add(line)
    d.add(String(42,237,'MODEL EXAMPLE: WHEEL ODOMETRY CAN EXCEED GROUND TRAVEL',fontName='Bold',fontSize=8.5,fillColor=INK))
    d.add(String(42,221,'Dry grip: teal. Low grip: brown. Solid: ground. Dashed: wheel odometry.',fontName='Body',fontSize=7.5,fillColor=MUTED))
    d.add(String(207,8,'Simulation time (s)',fontName='Body',fontSize=8,fillColor=MUTED));d.add(String(1,221,'m',fontName='Body',fontSize=8,fillColor=MUTED))
    return d

# Cover.
story.extend([Spacer(1,32),P('DYNORA / LOCAL RESEARCH STUDIO','small'),Spacer(1,12),P('From code<br/>to experiments','title'),P('A complete guide to the robot lab,<br/>detailed people and editable scenes','subtitle'),P('Easy explanations • worked calculations • source walkthroughs • operating procedures','small'),Spacer(1,15)])
imgs=[Image(str(ROOT/'public/visual/previews/human-sam.png'),width=245,height=196),Image(str(ROOT/'public/visual/previews/human-maya.png'),width=245,height=196)]
story.append(Table([imgs],colWidths=[247.5,247.5]));story.append(P('Actual bundled character geometry and textures, rendered on CPU. These are static previews, not a browser performance benchmark.','caption'))
story.extend(table([['Document control','Value'],['Software','DYNORA 7.0.0'],['Prepared','26 October 2026'],['Audience','Owner, student, developer and dataset researcher'],['Scope','Local app, rover, sensing, datasets, terrain, assets and scene editing']]))
story.append(P('This handbook explains what the shipped code does and why. It separates software verification, model assumptions and hardware validation.','body'))

h1('Contents')
toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc0',fontName='Bold',fontSize=10,leading=15,spaceBefore=9,textColor=INK),ParagraphStyle('toc1',fontName='Body',fontSize=8,leading=11,leftIndent=14,textColor=MUTED)]
story.append(toc)

h1('1. Start here: the whole system')
md('''This handbook documents the uploaded DYNORA V6 project and the V7 people/scene update made from it. It concerns the robot simulator. The separate SAM boundary/Fourier tool and interactive study-book application are outside this codebase.

The project runs on your laptop. The local server provides built files; the browser draws the scene, updates the robot and collects recordings. V7 keeps the established dark studio while replacing primitive people with detailed rigs and adding direct scene arrangement.

Read Chapter 2 to run the app. Chapter 3 explains the code step by step. Chapters 4-8 give the physics, research, visual, terrain and asset details. Chapter 9 explains new people and layout controls. The appendices contain actual source excerpts, a file atlas, verification limits and references.

Source facts come from the attached project and the updated implementation. Worked calculations illustrate those equations. Automated tests check mathematical/software properties. Hardware validation would require actual measurements and recordings, which were not supplied for this update. A realistic-looking mesh or a passing unit test does not substitute for those measurements.

The earlier V2-V6 notes preserve the history of changes. Where a later feature supersedes an earlier limitation, the handbook states the current behaviour. In particular, current sensing includes the V3 timing/error pipeline, current furniture includes all 28 V6 models, and current people use the V7 detailed character system.''')
story.append(architecture())
story.append(P('Figure 1. The file server, browser simulation and exported evidence have separate jobs. No remote AI service is required for this robot simulator.','caption'))

h1('2. Installation and daily workflow')
readme=(ROOT/'README.md').read_text();md(readme[readme.index('## Run on Windows'):readme.index('## Visual Studio V4')]);md('## Your first recording\nChoose a room, inspect the robot and confirm that camera and ToF measurements change as expected. Start with a short 640x480 JPG recording. Choose telemetry rate and image interval explicitly, stop, export and inspect the ZIP before collecting a large run. Chapters 3 and 5 explain the files and timing.\n\n## Source editing versus running\nUse npm ci and npm run dev for source development. Use npm run build before distributing or using the Python launcher after an edit. The complete source and ready-to-run dist are both in the updated ZIP.\n\n## If an old version remains visible\nStop the old terminal, extract to a fresh folder, run the launcher from that folder and check the V7 header. Hard-refresh the browser. If a port is busy, run .\\start-windows.bat 8775. The printed local URL is the one served by that terminal.')
h1('3. Code walkthrough: state to dataset')
md((ROOT/'docs/CODE_WALKTHROUGH_V7.md').read_text().replace('## 8. The route','!SLIPPLOT\n\n## 8. The route'))

h1('4. Robot geometry and physics foundations')
t=(ROOT/'docs/PHYSICS_V2.md').read_text()
t=t.replace('ToF still uses nine rays over a 25° horizontal field and nearest-hit logic with synthetic noise. It does not simulate reflectance, exposure-dependent ranging or real sensor failure modes.','The geometric ToF query uses nine rays over a 25° horizontal field. The current V3 pipeline additionally models timing, bias, scale, noise, dropout and approximate material-related loss. It remains an approximate sensor model; Chapter 5 describes its current meaning.')
t=t.replace('Longitudinal tyre contact force is proportional to peripheral-wheel / ground-speed mismatch and is limited to ±μN/2 per side.','Longitudinal tyre contact force is proportional to peripheral-wheel / ground-speed mismatch. The current model distributes it across four contact patches and applies a combined longitudinal/lateral friction limit at each patch; Chapter 5 gives the extension.')
md(t)
h1('5. Research tools, sensing and data quality')
md((ROOT/'docs/RESEARCH_V3.md').read_text())
h1('6. Detailed geometry, materials and prop physics')
t=(ROOT/'docs/VISUAL_V4.md').read_text().replace('The header says **Visual Studio V4**.','The current header says **People & Scene Studio V7**.').replace('Eight original models are included:','The V4 foundation introduced eight original models:').replace('- People retain the articulated, stylized V3 geometry, with small clothing details. This is not a photoreal human upgrade.','- V7 now replaces the earlier primitive people with textured anatomical rigs. See Chapter 9 for the implementation and its limits.')
md(t)
h1('7. Terrain, potholes and speed trials')
md((ROOT/'docs/TERRAIN_V5.md').read_text())
h1('8. The furniture and asset library')
md((ROOT/'docs/ASSETS_V6.md').read_text())
h1('9. Detailed people and scene arrangement')
md((ROOT/'docs/PEOPLE_SCENE_V7.md').read_text().split('## If you still see old people')[0])

h1('10. Worked learning exercises')
md('''## Exercise A: calculate expected wheel speed
At radius 0.0675 m and 60 RPM, calculate peripheral no-load speed. Multiply circumference 2*pi*r by one revolution per second. Answer: approximately 0.4241 m/s. Now double the robot mass while retaining its motors: no-load wheel speed is unchanged, but acceleration and load behaviour can change. This separates kinematics from dynamics.

## Exercise B: find a synchronization error
A ToF observation is acquired at 2.000 s and delivered at 2.035 s. A camera frame is captured at 2.020 s. Its latest delivered ToF packet cannot be this future-delivered observation. Align by what was available at capture, preserve acquisition/delivery stamps and keep sensor age. Never simply choose the closest timestamp without deciding whether future information is allowed.

## Exercise C: identify leakage
Your target is forward velocity, but the input includes the simulator's exact velocity or a caption saying the robot's speed. The test score can look excellent without solving perception. Choose observations appropriate to the task, keep truth/teacher labels separate, and split at an independent environment/run level.

## Exercise D: move a model properly
Move a chair visually and leave its physics collider at the old location. What happens? The robot can hit empty space or pass through the visible chair. The V7 commit path rebuilds added-object contact state and refreshes original-world proxies. Changing only mesh.position is not a complete editor integration.

## Exercise E: repeat a pothole experiment
Use the same route, robot calibration, initial state and nominal speed. Record three baseline trials. Increase only pothole depth. Compare duration, pitch, roll, slip and stall detection. Report the configured shape, support approximation and sample timing. Do not infer real hardware safety from the result.

## Exercise F: explain a human animation limitation
A rigged character looks natural while walking but still slides sideways when dragged or intersects a chair. The animation controls appearance; the scene transform and approximate colliders control placement/contact. The project does not solve human balance or continuous cloth collision. Better appearance does not establish human biomechanics.

## A practical study schedule
Session 1: run the app and locate every panel. Session 2: follow boot and room initialization. Session 3: reproduce speed/radius calculations and inspect dynamics. Session 4: collect a short dataset and explain every file. Session 5: calibrate from a controlled measurement. Session 6: rearrange a room and repeat a held-out experiment. Keep a notebook of parameters, assumptions and observed failures.''')

h1('Appendix A. Actual source excerpts')
story.append(P('These excerpts come from the updated source. Original line numbers appear at the left. Long lines wrap for print; copy executable code from the ZIP rather than from a wrapped PDF listing.','body'))
for title,path,start,end,explanation in [
 ('A1. Pose and impulse helpers','src/dynamics.js',25,34,'integratePose applies a constant-twist arc update. impact1D validates masses/restitution and applies equal/opposite impulse. The distance and angle arguments already include the time integration; they are not speeds.'),
 ('A2. Fixed-step advance','src/dynamics.js',48,59,'Allowed elapsed time enters an accumulator. Each loop spends one STEP, updates physics and calls the supplied hook. The clock increments after that hook, which is why recording integration must handle callback timing carefully.'),
 ('A3. Validated transforms','src/scene-transform.js',1,11,'Transforms preserve orientation as a quaternion, not only yaw. This shared contract rejects non-finite values, invalid rotation and non-positive scale before applying state. The history class later in the same source uses these snapshots for Undo and Redo.'),
 ('A4. Independent human instances','src/realistic-human.js',26,45,'A shared template is cloned with SkeletonUtils so bones belong to the new character. Each instance gets independent material objects; immutable geometry and texture data can remain shared.'),
 ('A5. Camera projection contract','src/camera-model.js',3,3,'The intrinsics calculation converts FOV to pixel focal length. D and K are exported with explicit optical axes and mount coordinates. The distortion helper works on normalized image coordinates.'),
 ('A6. CSV escaping','src/dataset-export.js',1,3,'The encoder preserves an empty value for null/undefined, quotes fields containing commas/quotes/newlines and doubles embedded quotation marks. This prevents captions from breaking the CSV column structure.')]:
    story.append(P(title,'h2'));story.append(P(explanation))
    lines=(ROOT/path).read_text().splitlines();story.append(P(path+' (original lines '+str(start)+'-'+str(min(end,len(lines)))+')','small'))
    for i,line in enumerate(lines[start-1:end],start):
        chunks=textwrap.wrap(clean(line),width=105,replace_whitespace=False,drop_whitespace=False) or [' ']
        for j,chunk in enumerate(chunks):story.append(Preformatted((f'{i:>3}  ' if not j else '     ')+chunk,ST['code']))
    story.append(Spacer(1,13))

h1('Appendix B. File and concept atlas')
purpose={
'boot':'Login, environment selection and human preload','main':'Apartment scene and recording loop','canteen':'Canteen scene and recording loop','track':'Obstacle-track scene and recording loop',
'dynamics':'Fixed-step motor, tyre, body and battery state','research':'Rover integration, calibration and route teacher','lab-core':'Sensors, parsing, calibration, comparison, quality, splits and replay','lab':'Research UI and recording integration','dataset-export':'CSV partitions, ZIP files, quality and hashes','camera-model':'Camera calibration and image effects','robot-model':'Rover geometry, mounts and camera','cad-assets':'Original STL/URDF inspection and replacements','visual-studio':'PBR materials, catalogue, scene imports and prop records','visual-core':'Geometry normalization and GLB validation','visual-models':'Original detailed furniture and rover meshes','room-models':'Twenty additional original furniture models','human':'Human factory API and fallback geometry','realistic-human':'Detailed rigs, animation sampling and People catalogue','people':'Walking routes, positions, modes and pedestrian controls','scene-editor':'Selection and interactive transform handles','scene-transform':'Transform validation and history','prop-physics':'Rapier world, colliders and robot coupling','collider-parts':'Bounded connected-island convex contact shapes','mirror-view':'One optional live planar mirror and resource cleanup','asset-core':'Catalogue filtering and safe placement helpers','track-geometry':'Analytic hole/bump surface and wheel support','track-surface':'Track surface integration','track-tests':'Terrain trial capture and metrics','speed-control':'Target speed, strategy and rate limits','showroom':'Model/material preview and download','studio-layout':'Fixed camera/navigation and scrolling panels','app-random':'Named seeded random streams','task':'Tasks and route planning','move3d':'Legacy object movement and falling','rotate':'Legacy rotation controls','roll':'Legacy rolling-object dynamics','physics':'Shared gravity and prop estimates','collide':'Legacy rover/object momentum response','lighting':'Room lighting controls','paint':'Material colour controls','weights':'Original mass controls','wheelerr':'Motor mismatch controls','narrate':'Local explanatory narration','curtains':'Window curtain interaction','directions':'Navigation helpers','verification':'Numerical verification page','research-tools':'Standalone research tools','human-gltf-tools':'Node GLB rig inspection'}
rows=[['Source module','Purpose']]
for path in sorted((ROOT/'src').glob('*.js')):rows.append([str(path.relative_to(ROOT)),purpose.get(path.stem,'Scene or interaction helper; inspect its exported entry points in source')])
story.extend(table(rows))
story.append(P('Glossary','h2'))
story.extend(table([['Term','Easy meaning'],['State','The current numbers describing a simulated thing'],['Mesh','Vertices and triangles describing a visible surface'],['Material / PBR','Surface appearance parameters used by lighting'],['Rig / skin weights','Bones and per-vertex influences that deform a character'],['Collider','Simplified shape used for contact calculations'],['Pose / transform','Position, orientation and scale of an object'],['Odometry','Estimated motion integrated from wheel observations'],['Ground truth','Internal simulated state used for diagnosis or labels'],['Latency / jitter','Delivery delay / variation in that delay'],['Bias / noise','Systematic offset / changing error'],['Quaternion','Four-number representation of 3D rotation'],['Fixed timestep','Equal duration used for each dynamics update'],['Seed','Initial value for a reproducible random sequence'],['Manifest','File list with sizes and content hashes'],['Leakage','Information in training inputs/test construction that unfairly reveals the answer'],['Calibration','Parameter estimation from measured evidence'],['Validation','Checking whether behaviour matches the intended real task']]))

h1('Appendix C. Verification and provenance')
md((ROOT/'docs/VALIDATION_V7.md').read_text())
story.append(P('Attachment provenance','h2'))
story.append(P('Input: dynora-sim(1).zip. SHA-256: e278065d012bd3b32bdf22cf5b9beb62ba3ba66686eeb9e8fe169178afa0189d. The V7 deliverable is a separate updated archive; this manual does not alter the uploaded original.','small'))
story.append(P('Human asset provenance','h2'))
for item in json.loads((ROOT/'public/visual/humans/sources.json').read_text()):
    story.append(P(item['id']+' - '+item['source_url'],'small'));story.append(P('Bundled SHA-256: '+item['sha256']+'. CC0-1.0; authored anatomical character, not a real-person scan.','small'))
story.append(P('Source references','h2'))
md('''The primary implementation references are the files in the source atlas, the original URDF/STL assets and the versioned project guides reproduced and explained here. The following official references are additional learning material; APIs can differ from the older bundled Three r128 version.

- Three.js materials: https://threejs.org/docs/pages/MeshStandardMaterial.html
- Three.js glTF loading: https://threejs.org/docs/pages/GLTFLoader
- Rapier rigid bodies: https://www.rapier.rs/docs/user_guides/javascript/rigid_bodies/
- Rapier colliders: https://www.rapier.rs/docs/user_guides/javascript/colliders/
- ROS URDF physical properties: https://docs.ros.org/en/rolling/Tutorials/Intermediate/URDF/Adding-Physical-and-Collision-Properties-to-a-URDF-Model.html
- CC0 human asset dedication: https://creativecommons.org/publicdomain/zero/1.0/

Retain the complete source ZIP, package-lock.json, measured calibration, scene ZIP and raw recordings together. A document explains the implementation; the executable source and recorded evidence remain the reference for reproducing an experiment.''')

doc=Book(str(DEST),pagesize=(WIDTH,HEIGHT),leftMargin=50,rightMargin=50,topMargin=60,bottomMargin=56,title='DYNORA Complete Technical and User Handbook V7',author='DYNORA project documentation',pageCompression=1)
frame=Frame(50,56,495,HEIGHT-116,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
doc.addPageTemplates(PageTemplate(id='Book',frames=frame,onPage=page))
doc.multiBuild(story)
print(str(DEST))
