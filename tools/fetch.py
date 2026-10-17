import json, urllib.request, urllib.parse, time
d=json.load(open('tools/people_src.json'))
out=[];bad=[]
for name,title,cat,tip in d:
    url="https://en.wikipedia.org/api/rest_v1/page/summary/"+urllib.parse.quote(title,safe='')
    req=urllib.request.Request(url,headers={"User-Agent":"name-memory-game/1.0 (github.com/VMValentin)"})
    try:
        j=json.load(urllib.request.urlopen(req,timeout=20))
        img=(j.get("thumbnail") or {}).get("source")
        if not img: bad.append((name,"noimg"))
        out.append(dict(name=name,title=title,category=cat,tip=tip,img=img,desc=j.get("description",""),page=j["content_urls"]["desktop"]["page"]))
    except Exception as e:
        bad.append((name,str(e))); out.append(dict(name=name,title=title,category=cat,tip=tip,img=None,desc="",page=""))
    time.sleep(0.1)
json.dump(out,open('fetched.json','w'),indent=1,ensure_ascii=False)
print(bad)
