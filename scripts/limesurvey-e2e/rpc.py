import json, urllib.request, os
EP='http://localhost:8082/index.php/admin/remotecontrol'
env=dict(l.strip().split('=',1) for l in open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'out','.env.test')) if '=' in l)
def rpc(method,*params):
    req=urllib.request.Request(EP,data=json.dumps({'method':method,'params':list(params),'id':1}).encode(),headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(req))['result']
def key(): return rpc('get_session_key',env['LS_USER'],env['LS_PASS'])
