#!/usr/bin/env python3
"""Build-time patch for the two physics comparison APKs.
Uses one canonical 3.12.1 game for both variants; all shared UI/rendering
changes are identical. Applied after checkout by GitHub Actions.
"""
from pathlib import Path
import sys

variant = sys.argv[1] if len(sys.argv) > 1 else 'classic'
assert variant in ('classic', 'arcade'), variant
root = Path(__file__).resolve().parents[1]
game = root/'web/game.js'
css = root/'web/styles.css'
index = root/'web/index.html'
s = game.read_text(encoding='utf-8')

def patch(old, new, expected=1):
    global s
    count=s.count(old)
    if count != expected:
        raise ValueError(f'Expected {expected} match(es), got {count}: {old[:110]!r}')
    s=s.replace(old,new)

patch('const W=420,H=760,LEFT=43,RIGHT=377,BY=285,R=16,DT=1/120;',
      f'const W=420,LEFT=43,RIGHT=377,BY=285,R=16,DT=1/120,ARCADE_PHYSICS={str(variant=="arcade").lower()};\nlet H=760;')

# Retina/high-DPI backing canvas. Uniform scaling makes the ball round even
# on very tall devices. The logical viewport height grows with screen ratio.
patch("const canvas=document.getElementById('game'),ctx=canvas.getContext('2d',{alpha:false});",
'''const canvas=document.getElementById('game'),ctx=canvas.getContext('2d',{alpha:false});
let canvasScale=1, renderAccumulator=0, lastDpr=0;
function fitCanvas(){
 const rect=canvas.getBoundingClientRect();
 const cssWidth=Math.max(1,rect.width), cssHeight=Math.max(1,rect.height);
 const dpr=Math.min(3.5,Math.max(1,window.devicePixelRatio||1));
 const targetW=Math.max(420,Math.round(cssWidth*dpr));
 const targetH=Math.max(760,Math.round(cssHeight*dpr));
 if(canvas.width!==targetW||canvas.height!==targetH||lastDpr!==dpr){
  canvas.width=targetW;canvas.height=targetH;lastDpr=dpr;
 }
 canvasScale=targetW/W;
 H=targetH/canvasScale;
 ctx.setTransform(canvasScale,0,0,canvasScale,0,0);
 ctx.imageSmoothingEnabled=true;
}
window.addEventListener('resize',fitCanvas);
if(window.visualViewport)window.visualViewport.addEventListener('resize',fitCanvas);
fitCanvas();''')

# Keep the middle of the start menu centred on tall phones without distorting it.
patch("const x=b.x+side*22*away,y=b.y-5*away;",
      "const x=b.x+side*22*away,y=b.y-5*away+(H-760)*.48;")
patch("label('TOUCH EMPTY SPACE TO PLAY',210,636+8*away,12,C.cyan,'800','center');",
      "label('TOUCH EMPTY SPACE TO PLAY',210,636+8*away+(H-760)*.48,12,C.cyan,'800','center');")
patch("if(Math.hypot(px-btn.x,py-btn.y)<43)","if(Math.hypot(px-btn.x,py-btn.y-(H-760)*.48)<43)")

# Modal panels (death, settings, pause, countdown) stay vertically centred.
# Input is translated back into legacy logical y-coordinates by inputPoint.
patch("function inputPoint(e){if(!e)return {x:210,y:385};const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*W/b.width,y:(e.clientY-b.top)*H/b.height}}",
'''function inputPoint(e){
 if(!e)return {x:210,y:385};
 const b=canvas.getBoundingClientRect(), x=(e.clientX-b.left)*W/b.width;
 let y=(e.clientY-b.top)*H/b.height;
 if(['skins','missions','settings','records','over','pause','ad','resume'].includes(state.mode)) y-=(H-760)*.5;
 return {x,y};
}''')
patch("function overlay(){\n if(state.mode==='ready'){homeScreen(1);return}",
'''function overlay(){
 if(state.mode==='ready'){homeScreen(1);return}''')
patch(" if(['skins','missions','settings','records'].includes(state.mode)){panelOverlay();return}\n ctx.fillStyle='rgba(3,7,19,.85)';ctx.fillRect(0,0,W,H);",
''' if(['skins','missions','settings','records'].includes(state.mode)){
  ctx.save();ctx.fillStyle='rgba(3,7,19,.88)';ctx.fillRect(0,0,W,H);
  ctx.translate(0,(H-760)*.5);panelOverlay();ctx.restore();return;
 }
 ctx.fillStyle='rgba(3,7,19,.85)';ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(0,(H-760)*.5);''')
# overlay() ends directly before render()
patch(" }\n}\nfunction render(){", " }\n ctx.restore();\n}\nfunction render(){")

# Flat buttons and slider knobs, leaving visual outlines and gradients elsewhere.
patch("function glossyButton(x,y,w,h,r,base,border,glow=0,glowColor=border){",
'''function flatButton(x,y,w,h,r,base,border){ctx.save();ctx.shadowBlur=0;rr(x,y,w,h,r,base,border,1.6);ctx.restore();}
function glossyButton(x,y,w,h,r,base,border,glow=0,glowColor=border){''')
# Death screen: remove sheen/darker stripe, not just the drop shadow.
patch("glossyButton(40,458,340,78,18,available?'#1B6D78':'#253044',available?C.green:'#556981',glow,available?'#8DFFBF':'#556981');",
      "flatButton(40,458,340,78,18,available?'#1B6D78':'#253044',available?C.green:'#556981');")
patch("glossyButton(retry.x,retry.y,retry.w,retry.h,17,C.cyan,'#C9F8FF',.08+.08*uiPulse2,'#6DE9FF');",
      "flatButton(retry.x,retry.y,retry.w,retry.h,17,C.cyan,'#C9F8FF');")
patch("glossyButton(91,668,238,55,18,'#37C9EB','#9DF3FF',.18*bp,'#66E7FF');",
      "flatButton(91,668,238,55,18,'#37C9EB','#9DF3FF');")
patch(" ctx.save();ctx.shadowBlur=14;ctx.shadowColor=accent;\n circle(x+w*value,ty,12,'#F1F8FF',accent,3);ctx.restore();",
      " circle(x+w*value,ty,12,'#F1F8FF',accent,3);")

# True 120 fps MAX: requestAnimationFrame may arrive at 144/165 Hz on phones.
# Keep fixed-step simulation at 120 Hz and throttle visible presentation.
patch('let seed=92371,fxSeed=8536421,globalTime=0,rafLast=0,accum=0,audio=null,manualFrames=false;',
      'let seed=92371,fxSeed=8536421,globalTime=0,rafLast=0,accum=0,audio=null,manualFrames=false;')
patch("function frame(t){if(manualFrames){rafLast=t;requestAnimationFrame(frame);return}if(!rafLast)rafLast=t;let elapsed=Math.min(.06,(t-rafLast)/1000);rafLast=t;accum+=elapsed;let n=0;\n while(accum>=DT&&n++<8){update(DT);accum-=DT}render();requestAnimationFrame(frame)}",
'''function frame(t){
 if(manualFrames){rafLast=t;requestAnimationFrame(frame);return}
 if(!rafLast)rafLast=t;
 const elapsed=Math.min(.06,(t-rafLast)/1000);rafLast=t;accum+=elapsed;
 let n=0;while(accum>=DT&&n++<8){update(DT);accum-=DT}
 renderAccumulator+=elapsed;
 if(renderAccumulator>=DT-.00012){
  render();renderAccumulator=Math.max(0,renderAccumulator-DT);
  if(renderAccumulator>DT)renderAccumulator%=DT;
 }
 requestAnimationFrame(frame);
}''')

# Arcade handling only. Classic retains source physics exactly.
if variant=='arcade':
    patch('return (m.pole===pole?-1:1)*1650*magnetGain(m,t)*falloff*dx/d;',
          'return (m.pole===pole?-1:1)*1120*magnetGain(m,t)*falloff*dx/d;')
    patch('function baseFall(distance){return Math.min(233,152+distance*.0035)}',
          'function baseFall(distance){return Math.min(202,138+distance*.0024)}')
    patch('s.vx=(s.vx+Math.max(-2000,Math.min(2000,ax))*dt)*Math.exp(-.99*dt);',
          's.vx=(s.vx+Math.max(-1150,Math.min(1150,ax))*dt)*Math.exp(-2.75*dt);')
    patch('s.vx=Math.max(-266,Math.min(266,s.vx));',
          's.vx=Math.max(-205,Math.min(205,s.vx));')
    patch('const gap=Math.hypot(m.x-s.x,dyy)-(34+R-3);',
          'const gap=Math.hypot(m.x-s.x,dyy)-(34+R-9);')
    patch('const gap=Math.hypot(obstacleX(h,s.simT)-s.x,dyy)-(h.r+R+3);',
          'const gap=Math.hypot(obstacleX(h,s.simT)-s.x,dyy)-(h.r+R-3);')
    patch('const p=Math.pow(Math.max(0,1-d/174),1.15)*184*magnetGain(m,s.simT||0)*Math.sign(dx||1);',
          'const p=Math.pow(Math.max(0,1-d/174),1.15)*138*magnetGain(m,s.simT||0)*Math.sign(dx||1);')
    patch(" s.vx=Math.max(-266,Math.min(266,s.vx+impulse));", " s.vx=Math.max(-205,Math.min(205,s.vx+impulse));")

# Snapshot/debug metadata, useful for automated side-by-side tests.
patch("window.__magnetDebug={",f"window.__magnetDebug={{physicsVariant:'{variant}',maxFps:120,")

s=s.replace('MAGNET MADNESS v3.10',f'MAGNET MADNESS v3.13 {variant.upper()}')
game.write_text(s,encoding='utf-8')
css.write_text('''
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body {margin:0; width:100%; height:100%; overflow:hidden; background:#050817;
 font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;}
body {margin:0; overflow:hidden; touch-action:none;}
.game-shell {position:fixed; inset:0; width:100vw; height:100dvh; min-height:100vh; overflow:hidden;}
canvas {display:block;width:100%;height:100%;touch-action:none;user-select:none;
 -webkit-user-select:none;outline:none;}
.assistive {position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
''',encoding='utf-8')
index.write_text(index.read_text(encoding='utf-8').replace('v3.10','v3.13')
 .replace('Magnet Madness game',f'Magnet Madness {variant} game'),encoding='utf-8')
print(f'{variant}: patched {len(s)} characters; UI DPI, adaptive viewport, 120-fps ceiling, flat modal buttons')