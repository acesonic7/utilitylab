import sys, os, re, json, base64, csv, io, random, html as H, urllib.request, urllib.parse, http.cookiejar
from collections import Counter
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
D=os.path.join(HERE,'out')
APP=os.environ.get('APP_URL','http://localhost:3005')
from rpc import rpc, key, env

def structure(k, sid):
    out={'groups':[], 'answers':None, 'blk_hidden':None}
    for g in rpc('list_groups',k,sid):
        out['groups'].append(rpc('get_group_properties',k,g['gid'],['group_name','grelevance']).get('grelevance'))
    for q in rpc('list_questions',k,sid):
        p=rpc('get_question_properties',k,q['qid'],['title','answeroptions','attributes'])
        if p['title']=='BLK':
            out['blk_hidden']=p['attributes'].get('hidden')
            continue
        out.setdefault('mandatory',set()).add(rpc('get_question_properties',k,q['qid'],['mandatory'])['mandatory'])
        if out['answers'] is None and isinstance(p['answeroptions'],dict): out['answers']=[v['answer'] for v in p['answeroptions'].values()]
    return out

def hidden_fields(page):
    f={}
    for m in re.finditer(r'<input[^>]*type=["\']hidden["\'][^>]*>', page):
        n=re.search(r'name=["\']([^"\']+)',m.group(0)); v=re.search(r'value=["\']([^"\']*)',m.group(0))
        if n: f[n.group(1)]=H.unescape(v.group(1)) if v else ''
    return f

def respond(sid, n):
    pages=[]
    for i in range(n):
        op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        page=op.open(f'http://localhost:8082/index.php/{sid}?lang=en&newtest=Y').read().decode()
        for step in range(12):
            f=hidden_fields(page)
            names={a or b for a,b in re.findall(r'name="(\d+X\d+X\d+)"[^>]*type="radio"|type="radio"[^>]*name="(\d+X\d+X\d+)"', page)}
            if names: pages.append(page)
            for nm in names: f[nm]=random.choice(['A1','A2','A3','A4'])
            if 'movesubmit' in page: f['move']='movesubmit'
            elif 'movenext' in page: f['move']='movenext'
            else: break
            page=op.open(f'http://localhost:8082/index.php/{sid}', urllib.parse.urlencode(f).encode()).read().decode()
            if f['move']=='movesubmit': break
    return pages

def skip_behaviour(sid):
    # Submit the block page without answering, twice. Returns how many submits it took to move on (None = never).
    op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    page=op.open(f'http://localhost:8082/index.php/{sid}?lang=en&newtest=Y').read().decode()
    def radios(p): return {a or b for a,b in re.findall(r'name="(\d+X\d+X\d+)"[^>]*type="radio"|type="radio"[^>]*name="(\d+X\d+X\d+)"', p)}
    for _ in range(3):
        if radios(page): break
        f=hidden_fields(page); f['move']='movenext'
        page=op.open(f'http://localhost:8082/index.php/{sid}', urllib.parse.urlencode(f).encode()).read().decode()
    first=radios(page)
    for attempt in (1,2):
        f=hidden_fields(page); f['move']='movesubmit' if 'movesubmit' in page else 'movenext'
        # Soft mandatory: after the prompt, tick "Continue without answering" on each question.
        for name in re.findall(r"name='(mandSoft\[\d+\])' class=\"ls-mandSoft-checkbox\"", page): f[name]='Y'
        page=op.open(f'http://localhost:8082/index.php/{sid}', urllib.parse.urlencode(f).encode()).read().decode()
        if radios(page)!=first: return attempt
    return None

def responses(k, sid):
    rows=list(csv.DictReader(io.StringIO(base64.b64decode(rpc('export_responses',k,sid,'csv','en','complete','code','short')).decode('utf-8-sig')),delimiter=';'))
    cols=[c for c in rows[0] if re.match(r'CT\d+T\d+',c)] if rows else []
    answered=lambda r: [c for c in cols if r[c]]
    skipped=[r for r in rows if not answered(r)]
    taken=[r for r in rows if answered(r)]
    bad=[r['id'] for r in taken if {re.match(r'CT(\d+)',c).group(1) for c in answered(r)}!={r['BLK']} or len(answered(r))!=3]
    return len(taken), dict(Counter(r['BLK'] for r in taken)), bad, len(skipped)

EXPECT_SKIP={'S':2,'Y':None,'N':1}

def report(label, k, sid, n=20, expect_text=None, mandatory='S'):
    s=structure(k,sid)
    print(f'[{label}] sid={sid} group relevance={s["groups"]} BLK hidden={s["blk_hidden"]} choice-task mandatory={s.get("mandatory")} answers={s["answers"]}')
    if s.get('mandatory')!={mandatory}: FAIL.append(f'{label}: mandatory {s.get("mandatory")} != {mandatory}')
    print(' activate', rpc('activate_survey',k,sid).get('status'))
    sk=skip_behaviour(sid)
    print(f'  skipping without answering moves on after submit #{sk} (expected #{EXPECT_SKIP[mandatory]})')
    if sk!=EXPECT_SKIP[mandatory]: FAIL.append(f'{label}: skip behaviour {sk}')
    pages=respond(sid,n)
    if expect_text:
        p=pages[0]; text=H.unescape(re.sub(r'<[^>]+>',' ',p))
        for t in expect_text: print(f'  shown literally {t!r}:', t in text); FAIL.append(t) if t not in text else None
    r=responses(k,sid)
    print('  answered responses / BLK distribution / wrong / skipped everything:', r)
    if r[0]!=n or r[2] or r[3]!=(1 if mandatory!='Y' else 0): FAIL.append(label)

FAIL=[]
mode=sys.argv[1]
k=key()
if mode=='import':
    for name,expect,mand in [('athens',['Which of these alternatives would you choose?'],'S'),('hostile',['Car {BLK.NAOK} ${x} [[Q]] <b>bold</b> & "quote"','Ποιο θα επιλέγατε για αυτή τη διαδρομή;'],'S'),('required',None,'Y')]:
        sid=rpc('import_survey',k,base64.b64encode(open(f'{D}/{name}.lss','rb').read()).decode(),'lss')
        report(f'LSS import: {name}',k,sid,expect_text=expect,mandatory=mand)
else:
    for name,mand in [('project','S'),('hostile','S'),('required','Y')]:
        sid=rpc('add_survey',k,0,f'Push {name}','en','G')
        body={'url':'http://localhost:8082','username':env['LS_USER'],'password':env['LS_PASS'],'surveyId':sid,'project':json.load(open(f'{D}/{name}.json'))}
        req=urllib.request.Request(f'{APP}/api/limesurvey/push',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':APP})
        try: res=json.load(urllib.request.urlopen(req,timeout=180))
        except urllib.error.HTTPError as e: res=json.load(e)
        print(f'[API push: {name}] ok={res.get("ok")} error={res.get("error")} message={res.get("message")}')
        if res.get('ok'): report(f'API push: {name}',k,sid,expect_text=['Car {BLK.NAOK} ${x} [[Q]] <b>bold</b> & "quote"'] if name=='hostile' else None,mandatory=mand)
        else: FAIL.append(f'push {name}')
rpc('release_session_key',k)
if FAIL: sys.exit('FAILED: '+', '.join(map(str,FAIL)))
print('PASSED')
