import json
rows=[l.split('|') for l in open('tools/pegs_src.txt').read().splitlines() if l.strip() and not l.startswith('#')]
pegs=[dict(id=r[0],label=r[1],kind=r[2],keys=[k for k in r[3].split(',') if k],imgs=r[4].split(';')) for r in rows]
open('pegs.js','w').write("// Built-in name pegs: fixed images for common first names and name sounds.\nwindow.NMG_PEGS = "+json.dumps(pegs,ensure_ascii=False,indent=0).replace('\n','')+";\n")
print(len(pegs))
