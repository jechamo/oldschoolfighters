"""Normalize supplied generated sprite sheets into transparent runtime atlases.
Usage: python3 tools/import_movement.py /path/to/movement-sources.json
Requires Pillow, numpy and scipy. No optical flow or runtime limb deformation.
"""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist/assets'
sources=json.loads(Path(sys.argv[1]).read_text())
old=json.loads((OUT/'fighters.json').read_text())
db={'size':512,'ground':448,'height':302,'characters':[],'frames':{},'art':'Generated from user character references; complete-frame animation'}

def extract(im,index):
 w,h=im.size;col=index%4;row=index//4
 box=(round(col*w/4),round(row*h/4),round((col+1)*w/4),round((row+1)*h/4))
 a=np.array(im.crop(box).convert('RGBA'))
 rgb=a[:,:,:3].astype(float)
 if a[:,:,3].min()==255:
  # These inputs contain a rendered checkerboard. Neutral pixels belong to the
  # backdrop; the painted outlines and tinted fabric form the character mask.
  core=(np.ptp(rgb,axis=2)>13)|(rgb.min(axis=2)<112)
  core=ndi.binary_closing(core,iterations=1)
  labels,n=ndi.label(core);sizes=np.bincount(labels.ravel());sizes[0]=0
  mask=labels==sizes.argmax()
  holes=ndi.binary_fill_holes(mask)&~mask
  hl,hn=ndi.label(holes);hs=np.bincount(hl.ravel());small=hs<110;small[0]=False
  mask|=small[hl]
  a[:,:,3]=mask.astype('uint8')*255
 else: mask=a[:,:,3]>100
 yy,xx=np.where(mask)
 if len(xx)<800:raise ValueError('Missing body in cell '+str(index))
 x0,x1=int(xx.min()),int(xx.max()+1);y0,y1=int(yy.min()),int(yy.max()+1)
 # Estimate pelvis from a narrow band of torso, excluding extended fists.
 band=mask[round(y0+(y1-y0)*.49):round(y0+(y1-y0)*.58)]
 bx=np.where(band)[1];pivot=float(np.median(bx)) if len(bx) else (x0+x1)/2
 return Image.fromarray(a),[x0,y0,x1,y1],pivot

for character in old['characters']:
 name=character['id'];images={kind:Image.open(sources[name+'-'+kind]) for kind in ['locomotion','combat']}
 atlas=Image.new('RGBA',(4096,2048));frames={}
 for kind,im in images.items():
  cells=[extract(im,i) for i in range(16)]
  # Each sheet uses a single scale based on its standing guard. Crouchers stay small.
  reference=8 if kind=='locomotion' else 0
  guardbox=cells[reference][1];factor=302/(guardbox[3]-guardbox[1])
  for i,(cell,bounds,pivot) in enumerate(cells):
   x0,y0,x1,y1=bounds;piece=cell.crop(bounds)
   size=(round(piece.width*factor),round(piece.height*factor))
   piece=piece.resize(size,Image.Resampling.LANCZOS)
   # Feet fixed to baseline. Airborne body keeps its natural reduced silhouette.
   px=round(256-(pivot-x0)*factor);py=448-size[1]
   tile=Image.new('RGBA',(512,512));tile.alpha_composite(piece,(px,py))
   alpha=np.array(tile)[:,:,3];alpha[alpha<12]=0;tile.putalpha(Image.fromarray(alpha))
   bbox=tile.getbbox()
   if not bbox or min(bbox[:2])<5 or max(bbox[2:])>507:raise ValueError('Frame crop '+name+' '+kind+' '+str(i)+' '+str(bbox))
   k=name+'-'+kind+'-'+str(i);slot=i+(16 if kind=='combat' else 0)
   tx=(slot%8)*512;ty=(slot//8)*512;atlas.alpha_composite(tile,(tx,ty));frames[k]=tile
   db['frames'][k]={'src':name+'-atlas.webp','box':[tx,ty,512,512],'bounds':[bbox[0],bbox[1],bbox[2]-bbox[0],bbox[3]-bbox[1]]}
  print(name,kind,'scale',round(factor,3))
 L=lambda i:name+'-locomotion-'+str(i)
 C=lambda i:name+'-combat-'+str(i)
 character={k:v for k,v in character.items() if k not in ['anims','crouchHeight']}
 character['crouchHeight']=db['frames'][L(10)]['bounds'][3]
 character['anims']={'idle':[L(8)],'walk':[L(i) for i in range(8)],'crouch':[L(8),L(9),L(10)],'jump':[L(13),L(15),L(14),L(15)],'punch':[C(i) for i in range(4)],'cross':[C(i) for i in range(4,8)],'hook':[C(i) for i in range(8,12)],'kick':[C(i) for i in range(12,16)]}
 db['characters'].append(character)
 atlas.save(OUT/(name+'-atlas.webp'),quality=93,method=6)
 # Inspection contact sheet on a dark background makes backdrop contamination visible.
 contact=Image.new('RGB',(1024,1024),(28,38,47))
 for i,tile in enumerate(frames.values()):
  tile=tile.resize((256,256),Image.Resampling.LANCZOS)
  contact.paste(tile,((i%4)*256,(i//4%4)*256),tile) if i<16 else None
 contact.save(Path(sys.argv[1]).parent/(name+'-clean.jpg'),quality=94)
(OUT/'fighters.json').write_text(json.dumps(db,separators=(',',':')))
print('Imported',len(db['frames']),'frames')
