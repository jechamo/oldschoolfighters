"""Use supplied walking drawings for Chamo and Nacho without flow interpolation."""
from pathlib import Path
import json,sys
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
root=Path(__file__).resolve().parents[1];out=root/'dist/assets';base=Path(sys.argv[1]);sources=json.loads((base/'source-map.json').read_text());db=json.loads((out/'fighters.json').read_text())
for name,group,index,order in [('chamo','chamofinal',2,[0,1,2,3]),('nacho','nacho',5,[0,1,2,3,4,5])]:
 source=next(s for s in sources if s['character']==group and s['index']==index)
 rgb=np.array(Image.open(base/'drive-assets'/group/source['file']).convert('RGB'))
 labels,n=ndi.label(rgb.min(2)<190);objects=ndi.find_objects(labels);parts=[]
 for j,box in enumerate(objects):
  if box is None:continue
  sy,sx=box;size=(labels[box]==j+1).sum()
  if size>1500 and sy.stop-sy.start>90:parts.append((sx.start,sy,sx,j+1))
 parts.sort();assert len(parts)==len(order),(name,len(parts))
 atlas=Image.new('RGBA',(512*len(parts),512));keys=[]
 for i,idx in enumerate(order):
  _,sy,sx,label=parts[idx];a=rgb[sy,sx];mask=labels[sy,sx]==label;mask=ndi.binary_fill_holes(mask)
  mask=ndi.binary_dilation(mask,iterations=1);alpha=np.uint8(mask)*255
  edge=mask&~ndi.binary_erosion(mask,iterations=1);alpha[edge]=np.uint8(np.clip((250-a.min(2)[edge].astype(float))/35,0,1)*255)
  im=Image.fromarray(a).convert('RGBA');im.putalpha(Image.fromarray(alpha))
  scale=302/im.height;band=mask[int(im.height*.48):int(im.height*.58)];pivot=np.median(np.where(band)[1]);piece=im.resize((round(im.width*scale),302),Image.Resampling.LANCZOS)
  tile=Image.new('RGBA',(512,512));tile.alpha_composite(piece,(round(256-pivot*scale),146));bb=tile.getbbox();key=name+'-walk-original-'+str(i);keys.append(key)
  atlas.alpha_composite(tile,(i*512,0));db['frames'][key]={'src':name+'-walk.webp','sourceDriveId':source['id'],'box':[i*512,0,512,512],'bounds':[bb[0],bb[1],bb[2]-bb[0],bb[3]-bb[1]]}
 next(c for c in db['characters'] if c['id']==name)['anims']['walk']=keys
 atlas.save(out/(name+'-walk.webp'),quality=94,method=6)
for c in db['characters']:
 if c['id'] not in ['chamo','nacho']:c['anims']['walk']=[c['anims']['walk'][i] for i in [0,1,2,4,5,6]]
(out/'fighters.json').write_text(json.dumps(db,separators=(',',':')))
print('Restored supplied walking drawings with clean silhouettes and corrected order')
